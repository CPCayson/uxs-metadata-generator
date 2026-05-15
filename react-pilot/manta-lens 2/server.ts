import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Gemini API Proxy Route
  app.post("/api/gemini/suggest", async (req, res) => {
    try {
      const { context } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not set on the server." });
      }

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
             'User-Agent': 'aistudio-build',
          }
        }
      });

      const prompt = `
        You are the "AI Symbiote" for Manta Lens, a tool for NOAA metadata synthesis.
        The user is editing the following metadata:
        Title: "${context.title}"
        Abstract: "${context.abstract}"
        Current Field Being Edited: "${context.field}"
        Current Value: "${context.value}"

        Provide a concise, helpful suggestion to improve this metadata (ISO 19115-2 standards). 
        If it's the abstract, suggest expanding acronyms or adding platform details.
        If it's the title, ensure it matches DOI/NCEI conventions.

        Return your response in JSON format:
        {
          "insight": "Short tip or insight (max 100 chars)",
          "suggestion": "A full corrected version of the field content"
        }
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      const text = response.text || "";
      const cleanJson = text.replace(/```json|```/g, "").trim();
      res.json(JSON.parse(cleanJson));
    } catch (error) {
      console.error("Gemini Proxy Error:", error);
      res.status(500).json({ error: "Failed to fetch suggestion from Gemini." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
