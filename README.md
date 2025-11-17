## Agentic AI TypeScript Demo

A minimal Next.js + TypeScript demo for building agentic AI workflows. It shows how to orchestrate LLMs with retrieval (RAG), memory, and modular prompts for e‑commerce tasks such as store management queries.

### Live Demo

Try the deployed version:

https://assistant.fikiryilkal.me/

Notes:

- May occasionally hit API usage/rate limits.
- Runs on a modest server; brief slowdowns/timeouts are possible.

### Description

This repo implements a chat assistant tailored for Ethify (an e‑commerce platform). It retrieves documentation snippets via vector search (MongoDB $vectorSearch), builds a context‑aware prompt (with a prompt builder + configuration), generates responses using Google Gemini, and persists multi‑turn conversation history in MongoDB. It’s meant for quickly prototyping agent‑driven UIs where AI maintains context across turns.

Key goal: let developers experiment with agent patterns (RAG, memory, prompt composition) without a lot of boilerplate.

### Features

- RAG pipeline: embed queries, run MongoDB vector search, inject top chunks into prompts.
- Multi‑turn memory: keep the last 10 messages verbatim; summarize older history for efficiency.
- Prompt builder: structured, reusable prompt config in `lib/promptBuilder.ts` + `lib/promots.ts`.
- Agent‑ready: modular pieces you can extend with tools/actions.
- Frontend: React chat UI with auto‑scroll, copy action, and clean error fallbacks.

### Tech Stack

- Frontend/Backend: Next.js 16 (App Router, TypeScript)
- AI/ML: Google Gemini (chat via LangChain; embeddings via `@google/genai`)
- Database: MongoDB (Atlas) with vector search; Mongoose models
- Utils: Zod, `use-stick-to-bottom`

### Prerequisites

- Node.js 18+
- MongoDB instance (local or Atlas) with a vector index (e.g., name: `rga_index`)
- Gemini API key (GEMINI_API_KEY)

### Installation

Clone the repo:

```bash
git clone https://github.com/fikertag/agentic-ai-typescript.git
cd agentic-ai-typescript
```

Install dependencies:

```bash
npm install
```

Create `.env.local` in project root:

```bash
GEMINI_API_KEY=your_gemini_api_key
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/ethify_db?retryWrites=true&w=majority
```

### Seed the DB (RAG)

This project includes an API route to chunk and embed local docs.

1. Put your plain‑text docs in the `data/` folder (read by `lib/loadDocuments.ts`).
2. Run the dev server:

```bash
npm run dev
```

3. In a browser, hit:

```
http://localhost:3000/api/loadandembed
```

It will chunk, embed with Gemini, and insert vectors into MongoDB (`RagChunks` collection).

### RAG Pipeline Configuration

The project uses the following configuration for the RAG pipeline:

- `chunkSize` (in `ragConfig.json`): 500 tokens per chunk
- `chunkOverlap` (in `ragConfig.json`): 50 tokens overlapping between chunks
- `embeddingModel` (hardcoded in `loadAndEmbed` API route): embedTextGemini

These settings control how documents are chunked and embedded for retrieval.
Users can adjust `chunkSize` and `chunkOverlap` in `ragConfig.json` to fine-tune performance.

### Usage

Local development:

```bash
npm run dev
```

Then open http://localhost:3000 and chat (e.g., “How do I add products?”). Multi‑turn behavior is supported: follow up with clarifying questions; the API summarizes older turns and keeps recent ones.

Production build:

```bash
npm run build
npm start
```

### Reproducibility (AI‑specific)

- Gemini outputs are probabilistic; to reduce variance, lower temperature in the model config (currently 0.7).
- Use consistent model versions and the same documents in `data/` when re‑embedding.
- Re‑embed any doc changes via the `/api/loadandembed` route.

### Ethics & Safety

The assistant enforces scope and safety guidelines from `lib/promots.ts` (e.g., refuse off‑topic or unsafe requests). Review and adapt these to your needs.

### Example

Input: “Customize store theme?”

Output: concise steps grounded in retrieved docs, optionally with cited source snippets.
