import { NextResponse, NextRequest } from "next/server";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { embedTextGemini } from "@/lib/embed";
import RagChunks from "@/model/ragChunks";
import dbConnect from "@/lib/mongoose";
import { buildPromptFromConfig } from "@/lib/promptBuilder";
import { rga_ethify_cfg } from "@/lib/promots";
import ChatMemory from "@/model/chatMemory";

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
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({
        response:
          "I'm having trouble accessing the AI service. Please try again later.",
        usedChunks: [],
        thread_id,
      });
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

    const withRetry = async <T>(
      fn: () => Promise<T>,
      attempts = 2,
      delayMs = 500
    ): Promise<T> => {
      let lastErr: any;
      for (let i = 0; i < attempts; i++) {
        try {
          return await fn();
        } catch (e) {
          lastErr = e;
          if (i < attempts - 1)
            await new Promise((r) => setTimeout(r, delayMs));
        }
      }
      throw lastErr;
    };

    let vector: number[] | null = null;
    try {
      const queryEmbedding = await withRetry(() =>
        embedTextGemini({ contents: [prompt] })
      );
      vector = queryEmbedding?.[0]?.values || null;
    } catch (e) {
      console.warn(
        "Embedding failed; proceeding without retrieval:",
        (e as Error).message
      );
    }

    let similarChunks: any[] = [];
    if (vector) {
      try {
        similarChunks = await RagChunks.aggregate([
          {
            $vectorSearch: {
              queryVector: vector,
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
      } catch (e) {
        console.warn(
          "Vector search failed; continuing without chunks:",
          (e as Error).message
        );
        similarChunks = [];
      }
    }
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

    let aiResponse = "";
    try {
      const llmResponse: any = await withRetry(
        () => model.invoke(finalPrompt),
        2,
        700
      );
      aiResponse =
        typeof llmResponse?.text === "string" ? llmResponse.text : "";
      if (!aiResponse && Array.isArray(llmResponse?.content)) {
        aiResponse = llmResponse.content
          .map((p: any) => (typeof p === "string" ? p : p?.text || ""))
          .join("\n")
          .trim();
      }
      if (!aiResponse) aiResponse = "No response generated.";
    } catch (e) {
      console.warn("Model invocation failed:", (e as Error).message);
      aiResponse =
        "I'm temporarily unable to answer. Please retry your question soon.";
    }

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
      usedChunks: (similarChunks || []).map((c: any, i: number) => ({
        i,
        docName: c.docName,
        score: c.score,
      })),
      thread_id,
    });
  } catch (error) {
    console.error("Unhandled chat route error:", error);
    return NextResponse.json({
      response: "A server error occurred. Please try again shortly.",
      usedChunks: [],
      thread_id: undefined,
    });
  }
}
