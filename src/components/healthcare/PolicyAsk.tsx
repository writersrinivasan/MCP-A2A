"use client";

import { useState } from "react";
import { useSettings } from "../Settings";

type Hit = { id: string; title: string; text: string; score: number };
const QS = [
  "When is a lumbar MRI medically necessary?",
  "What are the BMI rules for GLP-1 weight-loss drugs?",
  "Can an automated system deny a prior authorization?",
  "Who qualifies for BRCA testing?",
];

export function PolicyAsk() {
  const { apiKey, model, headers, open } = useSettings();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ hits: Hit[]; answer: string | null; error?: string } | null>(null);

  const ask = async (question: string) => {
    if (!question.trim()) return;
    setQ(question);
    setBusy(true);
    try {
      const r = await fetch("/api/healthcare/ask", { method: "POST", headers: headers(), body: JSON.stringify({ question, model }) });
      setRes(await r.json());
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="ask" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-14">
      <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-300">📚 RAG on its own</span>
      <h2 className="mt-4 text-3xl font-extrabold tracking-tight">Ask the policy library</h2>
      <p className="mt-2 max-w-3xl text-white/70">
        The simplest first step for any payer or provider team: <b className="text-white">retrieve</b> the relevant policy sections →{" "}
        <b className="text-white">augment</b> the prompt with them → <b className="text-white">generate</b> an answer with citations.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(q);
        }}
        className="mt-5 flex gap-2"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask about a medical policy…"
          aria-label="Policy question"
          className="flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-emerald-400"
        />
        <button disabled={busy} className="rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-5 font-bold text-black disabled:opacity-50">
          {busy ? "…" : "Ask"}
        </button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {QS.map((x) => (
          <button key={x} onClick={() => ask(x)} className="rounded-lg bg-white/5 px-3 py-1.5 text-xs text-white/75 hover:bg-white/10">
            {x}
          </button>
        ))}
      </div>

      {res && (
        <div className="animate-pop mt-6 grid gap-4 lg:grid-cols-2">
          <div className="glass rounded-2xl p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-white/50">① Retrieved chunks (BM25)</p>
            <div className="mt-3 space-y-2">
              {res.hits.map((h, i) => (
                <div key={h.id} className="rounded-xl bg-black/30 p-3 text-sm">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-emerald-300">
                      #{i + 1} {h.id}
                    </span>
                    <span className="text-white/40">score {h.score}</span>
                  </div>
                  <p className="mt-1 text-xs text-white/50">{h.title}</p>
                  <p className="mt-1 text-white/75">{h.text}</p>
                </div>
              ))}
              {!res.hits.length && <p className="text-sm text-white/50">No matching chunks.</p>}
            </div>
          </div>
          <div className="glass rounded-2xl p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-white/50">② Grounded answer (Groq)</p>
            {res.answer ? (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-white/85">{res.answer}</p>
            ) : res.error ? (
              <p className="mt-3 text-sm text-rose-300">⚠️ {res.error}</p>
            ) : (
              <div className="mt-3 text-sm text-white/60">
                {apiKey ? "No answer." : "Retrieval works without a key. "}
                {!apiKey && (
                  <button onClick={open} className="text-amber-300 underline">
                    Add a Groq key to generate the grounded answer.
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
