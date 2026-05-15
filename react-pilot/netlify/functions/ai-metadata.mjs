import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
const gemini15Flash = 'googleAI/gemini-1.5-flash';

const ai = genkit({
  plugins: [googleAI({ apiKey: process.env.GOOGLE_API_KEY })],
});

/**
 * AI-Assisted Metadata Generator (Netlify Function)
 * 
 * Actions:
 * - expandAcronyms: Expands NOAA/Navy acronyms in abstract/purpose.
 * - suggestKeywords: Suggests GCMD keywords from title/abstract.
 * - suggestCiteAs: Generates a NCEI-compliant citation string.
 */
export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { action, text, context = {} } = JSON.parse(event.body);

    let prompt = '';
    switch (action) {
      case 'expandAcronyms':
        prompt = `You are a NOAA metadata expert. Expand any technical or agency acronyms (e.g., REMUS, SAS, NCEI, NAVO, USBL) in the following text to improve human readability. Preserve the original meaning and tone.
        
Text: "${text}"

Expanded Text:`;
        break;

      case 'suggestKeywords':
        prompt = `Based on the following NOAA metadata title and abstract, suggest 8-10 relevant GCMD Science Keywords (e.g., EARTH SCIENCE > OCEANS > BATHYMETRY).
        
Title: ${context.title || 'Untitled'}
Abstract: ${context.abstract || text || 'No abstract provided'}

Keywords (comma-separated):`;
        break;

      case 'suggestCiteAs':
        prompt = `Generate a formal "Cite As" string for a NOAA/NCEI metadata record.
Format: Author(s) (Year). Title. [Data Accession ID or DOI if available]. NOAA National Centers for Environmental Information. Dataset.

Context:
- Title: ${context.title || 'Untitled'}
- Organization: ${context.org || 'NOAA'}
- Year: ${new Date().getFullYear()}

Cite As:`;
        break;

      default:
        return { statusCode: 400, body: JSON.stringify({ error: 'Invalid action' }) };
    }

    const response = await ai.generate({
      model: gemini15Flash,
      prompt,
      config: {
        temperature: 0.3,
      }
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        result: response.text,
        action,
        model: 'gemini-1.5-flash'
      }),
    };
  } catch (error) {
    console.error('AI Metadata Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message }),
    };
  }
};
