"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { readNdjson } from "@/lib/ndjson";
import { useSettings } from "./Settings";

type Route = { id: string; name: string; emoji: string; reason?: string };
type Msg = { role: "user" | "assistant"; content: string; route?: Route };
type Item = { type: "route"; id: string; name: string; emoji: string; reason?: string } | { type: "token"; text: string } | { type: "done" } | { type: "error"; message: string };

const SUGGESTIONS = [
  "How is A2A different from MCP? When do I need both?",
  "Show me a minimal Agent Card JSON and explain each field",
  "How do I secure agent-to-agent calls across two companies?",
  "Walk me through what happened in the smart-factory demo",
  "Hub-and-spoke or mesh: which topology for 40 enterprise agents?",
  "How do I stop prompt injection between agents?",
];

const ROSTER = [
  ["📜", "A2A Protocol Expert", "#22d3ee"],
  ["🔌", "Interoperability Architect", "#a78bfa"],
  ["🕸️", "Enterprise Network Designer", "#f472b6"],
  ["🛡️", "Trust & Governance Officer", "#f87171"],
  ["🏭", "Industry Use-Case Strategist", "#34d399"],
];

export function Assistant() {
  const { apiKey, model, headers, open } = useSettings();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [routing, setRouting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && msgs.length) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    if (!apiKey) return open();
    const history: Msg[] = [...msgs, { role: "user", content: q }];
    setMsgs([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    setRouting(true);
    const ac = new AbortController();
    abortRef.current = ac;
    const patch = (fn: (m: Msg) => Msg) => setMsgs((all) => [...all.slice(0, -1), fn(all[all.length - 1])]);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ model, messages: history.map(({ role, content }) => ({ role, content })) }),
        signal: ac.signal,
      });
      if (!res.ok) throw new Error((await res.json()).error ?? `Error ${res.status}`);
      await readNdjson<Item>(res, (it) => {
        if (it.type === "route") {
          setRouting(false);
          patch((m) => ({ ...m, route: it }));
        } else if (it.type === "token") patch((m) => ({ ...m, content: m.content + it.text }));
        else if (it.type === "error") patch((m) => ({ ...m, content: m.content + `\n\n⚠️ ${it.message}` }));
      });
    } catch (e) {
      if ((e as Error).name !== "AbortError") patch((m) => ({ ...m, content: `⚠️ ${e instanceof Error ? e.message : "Request failed"}` }));
    } finally {
      setBusy(false);
      setRouting(false);
    }
  };

  return (
    <section id="assistant" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-16">
      <div className="grid gap-8 lg:grid-cols-[1fr_1.6fr]">
        <div>
          <span className="rounded-full bg-violet-400/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-violet-300">🤖 AI assistant · BYOK Groq</span>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight">Ask the agent network</h2>
          <p className="mt-3 text-white/70">
            The assistant is itself a small multi-agent system built with <b className="text-white">LangGraph</b>. A router agent reads your question and
            delegates it to one of five specialist agents, the same delegation pattern A2A uses across organisations.
          </p>
          <div className="mt-5 space-y-2">
            {ROSTER.map(([e, n, c]) => (
              <div key={n} className="glass flex items-center gap-3 rounded-xl px-3 py-2 text-sm">
                <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: c + "25" }}>
                  {e}
                </span>
                <span className="font-medium">{n}</span>
              </div>
            ))}
          </div>
          <pre className="mt-5 rounded-xl bg-black/40 p-3 font-mono text-xs text-violet-200/80">
            {`START → router ─(handoff)→ specialist → END`}
          </pre>
        </div>

        <div className="border-rainbow glass flex h-[620px] flex-col">
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5">
            {msgs.length === 0 && (
              <div className="grid h-full place-items-center">
                <div className="w-full max-w-lg text-center">
                  <p className="text-4xl">💬</p>
                  <p className="mt-2 font-semibold">Try one of these</p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {SUGGESTIONS.map((s) => (
                      <button key={s} onClick={() => send(s)} className="rounded-xl bg-white/5 p-3 text-left text-sm text-white/80 transition hover:bg-white/10">
                        {s}
                      </button>
                    ))}
                  </div>
                  {!apiKey && (
                    <button onClick={open} className="mt-5 rounded-xl bg-amber-400/15 px-4 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-400/25">
                      🔑 Add your Groq API key to start
                    </button>
                  )}
                </div>
              </div>
            )}
            {msgs.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <p className="max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2.5 text-sm">{m.content}</p>
                </div>
              ) : (
                <div key={i} className="max-w-[92%]">
                  {m.route ? (
                    <p className="animate-pop mb-1.5 text-xs text-white/50">
                      🧭 Router → <b className="text-white/80">{m.route.emoji} {m.route.name}</b>
                      {m.route.reason ? ` · ${m.route.reason}` : ""}
                    </p>
                  ) : (
                    routing && i === msgs.length - 1 && <p className="mb-1.5 animate-pulse text-xs text-white/50">🧭 Router agent is choosing a specialist…</p>
                  )}
                  <div className="prose-chat rounded-2xl rounded-tl-md bg-white/[.06] px-4 py-3 text-sm leading-relaxed text-white/85">
                    {m.content ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content.replace(/<think>[\s\S]*?(<\/think>|$)/g, "")}</ReactMarkdown>
                    ) : (
                      <span className="inline-flex gap-1">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-300" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-violet-300 [animation-delay:.15s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-pink-300 [animation-delay:.3s]" />
                      </span>
                    )}
                  </div>
                </div>
              ),
            )}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex gap-2 border-t border-white/10 p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={apiKey ? "Ask about A2A, interoperability, governance…" : "Add a Groq key to chat →"}
              aria-label="Message"
              className="flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm outline-none focus:border-violet-400"
            />
            {busy ? (
              <button type="button" onClick={() => abortRef.current?.abort()} className="rounded-xl bg-white/10 px-4 text-sm font-semibold hover:bg-white/15">
                ■ Stop
              </button>
            ) : (
              <button type="submit" className="rounded-xl bg-gradient-to-r from-cyan-400 to-violet-500 px-5 text-sm font-bold text-black hover:brightness-110">
                Send
              </button>
            )}
            {msgs.length > 0 && !busy && (
              <button type="button" onClick={() => setMsgs([])} className="rounded-xl px-3 text-sm text-white/50 hover:bg-white/10" title="Clear chat">
                ↺
              </button>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}
