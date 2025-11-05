# Agentic AI TypeScript Demo

Demo app showcasing Agentic AI with TypeScript and Next.js — a minimal, opinionated reference for building agent-driven UIs and workflows.

## Features

- TypeScript-first Next.js application
- Example agent orchestration patterns (tasks, tools, memory)
- Simple UI to demo agent decisions and step-by-step reasoning
- Testable, extensible architecture for experimenting with LLM-driven agents

## Tech stack

- Next.js (React + server / API routes)
- TypeScript
- Node.js
- Next build tools
- Optional: OpenAI-compatible LLM provider

## Prerequisites

- Node.js 18+ and npm or yarn
- (Optional) OpenAI API key or other LLM provider credentials

## Quick start

1. Clone the repo
2. Install dependencies
3. Set environment variables (see next section)
4. Run local dev server
5. Build and start production preview

## Environment variables

Create a `.env.local` file in project root with any required keys. Example:

```
GEMINI_API_KEY= api key from gemini
MONGODB_URI= mongodbconnection string
```

## Troubleshooting

- "No API key" — ensure GEMINI_API_KEY (or provider key) is set.

## Contributing

- Open issues for feature requests or bugs
- Keep changes small and add tests for new behavior

Enjoy exploring agentic patterns in TypeScript and Next.js.
