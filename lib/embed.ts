import { GoogleGenAI } from "@google/genai";

export async function embedTextGemini({ contents }: { contents: string[] }) {
  const ai = new GoogleGenAI({});

  const response = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents,
  });

  if (!response.embeddings) {
    throw new Error("Gemini API did not return embeddings.");
  }

  return response.embeddings;
}
