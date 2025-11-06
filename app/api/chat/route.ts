import { NextResponse, NextRequest } from "next/server";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { embedTextGemini } from "@/lib/embed";
import RagChunks from "@/model/ragChunks";
import dbConnect from "@/lib/mongoose";
import { buildPromptFromConfig } from "@/lib/promptBuilder";
import { rga_ethify_cfg } from "@/lib/promots";

import mongoose from "mongoose";

const ChatMemorySchema = new mongoose.Schema({
  thread_id: { type: String, required: true, unique: true },
  full_history: [{ role: { type: String }, content: { type: String } }],
  summary_history: { type: String, default: "" },
  updated_at: { type: Date, default: Date.now },
});
const ChatMemory =
  mongoose.models.ChatMemory || mongoose.model("ChatMemory", ChatMemorySchema);

const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  apiKey: process.env.GEMINI_API_KEY!,
  temperature: 0.7,
});

async function summarizeHistory(
  olderHistory: any[],
  currentSummary: string,
  llm: any
) {
  const historyToSummarize = [
    ...(currentSummary ? [{ role: "system", content: currentSummary }] : []),
    ...olderHistory,
  ];
  const historyStr = historyToSummarize
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");
  const summaryPrompt = `Summarize the following conversation history into 2-3 key points for context in an e-commerce assistant chat. Focus on user goals, unresolved issues, and Ethify features mentioned.\n\n${historyStr}\n\nSummary:`;
  const summaryResponse = await llm.invoke(summaryPrompt);
  return `${currentSummary ? currentSummary + " " : ""}${summaryResponse.text}`;
}

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const { prompt, thread_id } = await req.json();
    if (!prompt) {
      return NextResponse.json(
        { error: "Missing 'prompt' in request body" },
        { status: 400 }
      );
    }

    let chatDoc = await ChatMemory.findOne({ thread_id });
    let currentFull = chatDoc?.full_history || [];
    let currentSummary = chatDoc?.summary_history || "";

    const updatedFull = [...currentFull, { role: "user", content: prompt }];

    const recent = updatedFull.slice(-10);
    let formattedHistory = "";
    if (currentSummary) {
      formattedHistory += `Summary of prior chat: ${currentSummary}\n`;
    }
    formattedHistory += recent
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n\n");

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
      `Chat History:\n${formattedHistory}\n\nUSER QUESTION:\n${prompt}`
    );

    const response = await model.invoke(finalPrompt);
    const aiResponse = response.text;

    const finalFull = [
      ...updatedFull,
      { role: "assistant", content: aiResponse },
    ];
    let finalSummary = currentSummary;
    if (finalFull.length > 10) {
      const dropped = finalFull.slice(0, finalFull.length - 10);
      finalSummary = await summarizeHistory(dropped, currentSummary, model);
      const cappedFull = finalFull.slice(-10);
      await ChatMemory.findOneAndUpdate(
        { thread_id },
        {
          full_history: cappedFull,
          summary_history: finalSummary,
          updated_at: new Date(),
        },
        { upsert: true }
      );
    } else {
      await ChatMemory.findOneAndUpdate(
        { thread_id },
        {
          full_history: finalFull,
          summary_history: finalSummary,
          updated_at: new Date(),
        },
        { upsert: true }
      );
    }

    return NextResponse.json({
      response: aiResponse,
      prompt: finalPrompt,
      usedChunks:
        similarChunks?.map((c: any, i: number) => ({
          i,
          docName: c.docName,
          score: c.score,
        })) ?? [],
      thread_id,
    });
  } catch (error) {
    console.error("Error generating content:", error);
    return NextResponse.json(
      { error: (error as Error).message ?? "Internal Server Error" },
      { status: 500 }
    );
  }
}
