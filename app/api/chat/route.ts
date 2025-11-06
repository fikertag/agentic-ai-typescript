import { NextResponse, NextRequest } from "next/server";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { embedTextGemini } from "@/lib/embed";
import RagChunks from "@/model/ragChunks";
import dbConnect from "@/lib/mongoose";
import { buildPromptFromConfig } from "@/lib/promptBuilder";
import { rga_ethify_cfg } from "@/lib/promots";

const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  apiKey: process.env.GEMINI_API_KEY!,
  temperature: 0.7,
});

export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    const { prompt } = await req.json();
    if (!prompt) {
      return NextResponse.json(
        { error: "Missing 'prompt' in request body" },
        { status: 400 }
      );
    }

    const queryEmbedding = await embedTextGemini({
      contents: [prompt],
    });

    const vector = queryEmbedding[0].values;
    const similarChunks = await RagChunks.aggregate([
      {
        $vectorSearch: {
          queryVector: vector || [],
          index: "rga_index",
          path: "embedding",
          numCandidates: 50,
          limit: 5,
        },
      },
      {
        $project: {
          _id: 0,
          docName: 1,
          chunkText: 1,
          score: { $meta: "vectorSearchScore" },
        },
      },
    ]);

    const contextBlocks = (similarChunks || []).map(
      (c: { docName: string; chunkText: string; score?: number }, i: number) =>
        `Source ${i + 1} (score=${(c.score ?? 0).toFixed(3)} | ${
          c.docName
        }):\n${c.chunkText}`
    );
    const dynamicContextSuffix = contextBlocks.length
      ? `\n\nRetrieved Sources:\n${contextBlocks.join("\n\n")}`
      : `\n\n<No matching sources retrieved>`;

    const dynamicConfig = {
      ...rga_ethify_cfg,
      context: `${rga_ethify_cfg.context}${dynamicContextSuffix}`,
    };

    const finalPrompt = buildPromptFromConfig(
      dynamicConfig,
      `USER QUESTION:\n${prompt}`
    );

    const response = await model.invoke(finalPrompt);

    return NextResponse.json({
      response: response.text,
      prompt: finalPrompt,
      usedChunks:
        similarChunks?.map((c: any, i: number) => ({
          i,
          docName: c.docName,
          score: c.score,
        })) ?? [],
    });
  } catch (error) {
    console.error("Error generating content:", error);
    return NextResponse.json(
      { error: (error as Error).message ?? "Internal Server Error" },
      { status: 500 }
    );
  }
}
