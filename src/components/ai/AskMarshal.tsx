"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/cn";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "What's my attendance looking like?",
  "What do I need for an A+ in my first class tomorrow?",
  "Can I skip a class and stay safe?",
];

export function AskMarshal() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const userMessageCount = messages.filter(m => m.role === "user").length;
  const isLimitReached = userMessageCount >= 5;

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;

    setError(null);
    const next = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(next);
    setInput("");
    setPending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "The Marshal's gone quiet.");
      } else {
        setMessages((m) => [...m, { role: "assistant", content: data.reply ?? "" }]);
      }
    } catch {
      setError("Couldn't reach the Marshal.");
    } finally {
      setPending(false);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div ref={scrollRef} className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
        {messages.length === 0 && (
          <div className="flex flex-col gap-2">
            <p className="font-ledger text-sm text-ink-muted">
              Ask about your attendance or what marks you need. The Marshal checks the ledger — he
              doesn&apos;t guess.
            </p>
            <div className="flex flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  disabled={pending}
                  className="border border-border-dark px-3 py-2 text-left font-ledger text-sm text-ink-muted hover:text-ink"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] whitespace-pre-wrap px-3 py-2 font-ledger text-sm",
                m.role === "user"
                  ? "border border-ink bg-paper-dark text-ink"
                  : "border-l-[3px] border-brass text-ink"
              )}
            >
              {m.content}
            </div>
          </div>
        ))}

        {pending && (
          <div className="flex justify-start">
            <div className="border-l-[3px] border-brass px-3 py-2 font-ledger text-sm text-ink-muted">
              The Marshal&apos;s checking the ledger…
            </div>
          </div>
        )}
      </div>

      {error && <p className="font-ledger text-sm text-blood">{error}</p>}
      
      {isLimitReached && (
        <p className="font-ledger text-sm text-brass">
          The Marshal&apos;s patience has worn thin for now. (Refresh to start a new session)
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!isLimitReached) send(input);
        }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isLimitReached ? "Session limit reached..." : "Ask the Marshal…"}
          disabled={pending || isLimitReached}
          className="flex-1 border border-ink bg-paper px-3 py-2 font-ledger text-sm text-ink placeholder:text-ink-muted focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={pending || !input.trim() || isLimitReached}
          className="border-[3px] border-ink px-4 py-2 font-poster text-sm uppercase tracking-widest text-ink disabled:opacity-40"
        >
          Ask
        </button>
      </form>
    </div>
  );
}
