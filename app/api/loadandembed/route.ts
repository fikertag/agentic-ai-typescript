import { loadDocuments } from "@/lib/loadDocuments";
import { chunkText } from "@/lib/chunk";
import dbConnect from "@/lib/mongoose";
import RagChunks from "@/model/ragChunks";
import { embedTextGemini } from "@/lib/embed";
import { NextResponse } from "next/server";
import config from "@/ragConfig.json";

export async function GET() {
  try {
    await dbConnect();

    const docs = loadDocuments();
    const allChunks: { docName: string; chunkText: string; index: number }[] =
      [];

    // Step 1: Chunk all documents
    for (const doc of docs) {
      const chunks = await chunkText(doc.text, {
        chunkSize: config.chunkSize,
        chunkOverlap: config.chunkOverlap,
      });

      chunks.forEach((chunk, index) => {
        allChunks.push({
          docName: doc.name,
          chunkText: chunk,
          index,
        });
      });
    }

    const embeddings = await embedTextGemini({
      contents: allChunks.map((chunk) => chunk.chunkText),
    });

    if (!embeddings || embeddings.length !== allChunks.length) {
      throw new Error("Embedding generation failed or incomplete.");
    }

    // Step 3: Prepare and insert into MongoDB
    const docsToInsert = allChunks.map((chunk, i) => ({
      docName: chunk.docName,
      chunkText: chunk.chunkText,
      index: chunk.index,
      embedding: embeddings[i].values,
    }));

    // Optional: clear old data before inserting (if you want to refresh)
    await RagChunks.deleteMany({});

    await RagChunks.insertMany(docsToInsert);

    return NextResponse.json({
      success: true,
      message: `Inserted ${docsToInsert.length} chunks successfully`,
    });
  } catch (err) {
    console.error("Error saving chunks:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
