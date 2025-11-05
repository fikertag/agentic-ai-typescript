import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

export interface ChunkerOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  separators?: string[];
}

export async function chunkText(
  text: string,
  options: ChunkerOptions = {}
): Promise<string[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: options.chunkSize ?? 500,
    chunkOverlap: options.chunkOverlap ?? 50,
    separators: options.separators ?? ["\n\n", "\n", " "],
  });

  const chunks = await splitter.splitText(text);
  return chunks;
}
