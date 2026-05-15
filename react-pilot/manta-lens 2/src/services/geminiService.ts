export async function getSymbioteSuggestion(context: { field: string; value: string; title: string; abstract: string }) {
  try {
    const response = await fetch("/api/gemini/suggest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ context }),
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Symbiote Proxy Error:", error);
    return null;
  }
}
