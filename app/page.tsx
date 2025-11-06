"use client";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { useState, useEffect } from "react";
import { Response } from "@/components/ai-elements/response";
import type { ChatStatus } from "ai";

const ChatBotDemo = () => {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<ChatStatus | undefined>(undefined);
  type ChatMsg = { id: string; role: "user" | "assistant"; text: string };
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);

  useEffect(() => {
    let id = localStorage.getItem("chat_thread_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("chat_thread_id", id);
    }
    setThreadId(id);
  }, []);

  const handleSubmit = (message: PromptInputMessage) => {
    const hasText = Boolean(message.text);
    if (!hasText || !threadId) {
      return;
    }
    const userText = message.text!;

    const userMsg = {
      id: crypto.randomUUID(),
      role: "user" as const,
      text: userText,
    };
    setMessages((prev) => [...prev, userMsg]);

    setStatus("submitted");
    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: userText, thread_id: threadId }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error || `Request failed: ${res.status}`);
        }
        return res.json();
      })
      .then((data: { response?: string; thread_id?: string }) => {
        if (data.thread_id && data.thread_id !== threadId) {
          localStorage.setItem("chat_thread_id", data.thread_id);
          setThreadId(data.thread_id);
        }
        const text = data?.response ?? "";
        const assistantMsg = {
          id: crypto.randomUUID(),
          role: "assistant" as const,
          text,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      })
      .catch((e) => {
        const assistantMsg = {
          id: crypto.randomUUID(),
          role: "assistant" as const,
          text: `Error: ${e.message}`,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setStatus("error");
      })
      .finally(() => {
        setStatus(undefined);
      });
    setInput("");
  };

  if (!threadId) return <div>Loading chat...</div>;

  return (
    <div className="max-w-4xl mx-auto sm:p-6 p-2 relative size-full h-screen">
      <div className="flex flex-col h-full">
        <Conversation className="h-full">
          <ConversationContent>
            {messages.map((m, i) => (
              <div key={m.id}>
                <Message from={m.role}>
                  <MessageContent>
                    <Response>{m.text}</Response>
                  </MessageContent>
                </Message>
              </div>
            ))}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <PromptInput onSubmit={handleSubmit} className="mt-4">
          <PromptInputTextarea
            className="grow flex outline-none resize-none border-0 focus:ring-0 focus-visible:ring-0 "
            onChange={(e) => setInput(e.target.value)}
            value={input}
          />
          <PromptInputSubmit
            className="h-10 w-10 mx-2"
            disabled={!input && !status}
            status={status}
          />
        </PromptInput>
      </div>
    </div>
  );
};

export default ChatBotDemo;
