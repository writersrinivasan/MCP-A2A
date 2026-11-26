"use client";

import { useEffect, useRef, useState } from "react";
import type { Actor, Assessment, HCEvent, Protocol } from "@/lib/healthcare/graph";
import type { Criterion } from "@/lib/healthcare/data";
import { CASES } from "@/lib/healthcare/data";
import { readNdjson } from "@/lib/ndjson";
import { useSettings } from "../Settings";

type Item =
  | { type: "thread"; threadId: string; mode: string }
  | { type: "node"; node: string }
  | { type: "event"; event: HCEvent }
  | { type: "state"; state: Record<string, unknown> }
  | { type: "interrupt"; value: { question: string; criteria: Criterion[]; summary: string } }
  | { type: "done" }
  | { type: "error"; message: string };

const P: Record<Protocol, { c: string; label: string }> = {
  mcp: { c: "#22d3ee", label: "MCP" },
  a2a: { c: "#fbbf24", label: "A2A" },
  rag: { c: "#34d399", label: "RAG" },
  agent: { c: "#a78bfa", label: "AGENT" },
  human: { c: "#f472b6", label: "HUMAN" },
};
const NODES: Record<Actor, { x: number; y: number; e: string; name: string; sub: string; c: string }> = {
  provider: { x: 200, y: 140, e: "🩺", name: "Provider PA Agent", sub: "LangGraph", c: "#a78bfa" },
  ehr: { x: 200, y: 305, e: "🗂️", name: "EHR MCP server", sub: "FHIR tools", c: "#22d3ee" },
  payer: { x: 650, y: 140, e: "🛡️", name: "Payer UM Agent", sub: "LangGraph", c: "#a78bfa" },
  payerdb: { x: 585, y: 305, e: "🗄️", name: "Core-admin MCP", sub: "eligibility · benefits", c: "#22d3ee" },
  policies: { x: 800, y: 305, e: "📚", name: "Policy library", sub: "RAG · 6 policies", c: "#34d399" },
  reviewer: { x: 830, y: 140, e: "👩‍⚕️", name: "Medical Director", sub: "human-in-the-loop", c: "#f472b6" },
};
const LINKS: [Actor, Actor, Protocol][] = [
  ["provider", "ehr", "mcp"],
  ["provider", "payer", "a2a"],
  ["payer", "payerdb", "mcp"],
  ["payer", "policies", "rag"],
  ["payer", "reviewer", "human"],
];

export function PADemo() {
  const { apiKey, model, headers, open } = useSettings();
  const [caseId, setCaseId] = useState(CASES[0].id);
  const [events, setEvents] = useState<HCEvent[]>([]);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [hits, setHits] = useState<{ id: string; title: string; score: number; text: string }[]>([]);
  const [det, setDet] = useState<{ status: string; authNumber?: string; letter: string } | null>(null);
  const [intr, setIntr] = useState<Extract<Item, { type: "interrupt" }>["value"] | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [sel, setSel] = useState<HCEvent | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [drained, setDrained] = useState(true);
  const [note, setNote] = useState("");
  const queue = useRef<Item[]>([]);
  const streaming = useRef(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => {
      const it = queue.current.shift();
      if (!it) {
        if (!streaming.current) setDrained(true);
        return;
      }
      setDrained(false);
      if (it.type === "thread") setThreadId(it.threadId);
      else if (it.type === "event") {
        setEvents((e) => [...e, it.event]);
        setSel(it.event);
      } else if (it.type === "state") {
        if (it.state.assessment) setAssessment(it.state.assessment as Assessment);
        if (it.state.hits) setHits(it.state.hits as typeof hits);
        if (it.state.determination) setDet(it.state.determination as typeof det);
      } else if (it.type === "interrupt") setIntr(it.value);
      else if (it.type === "error") setErr(it.message);
    }, 380);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [events.length]);

  const call = async (body: Record<string, unknown>) => {
    setRunning(true);
    setErr(null);
    streaming.current = true;
    try {
      const r = await fetch("/api/healthcare/run", { method: "POST", headers: headers(), body: JSON.stringify({ ...body, model }) });
      await readNdjson<Item>(r, (it) => queue.current.push(it));
    } catch (e) {
      queue.current.push({ type: "error", message: e instanceof Error ? e.message : "Request failed" });
    } finally {
      streaming.current = false;
      setRunning(false);
    }
  };
  const start = () => {
    queue.current = [];
    setEvents([]);
    setAssessment(null);
    setHits([]);
    setDet(null);
    setIntr(null);
    setSel(null);
    setNote("");
    call({ action: "start", caseId });
  };
  const decide = (decision: "approve" | "deny") => {
    setIntr(null);
    call({ action: "resume", threadId, decision, note });
  };

  const busy = running || !drained;
  const last = events[events.length - 1];
  const count = (p: Protocol) => events.filter((e) => e.protocol === p).length;
  const c = CASES.find((x) => x.id === caseId)!;

  return (
    <section id="demo" className="scroll-mt-20 border-y border-white/5 bg-black/20 py-14">
      <div className="mx-auto max-w-7xl px-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="rounded-full bg-amber-400/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-300">▶ Live · RAG + MCP + A2A together</span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight">Prior authorization, agent to agent</h2>
            <p className="mt-2 max-w-3xl text-white/70">
              A clinic&apos;s agent gathers evidence from its EHR over <Tag p="mcp" />, sends the request to the health plan&apos;s agent over <Tag p="a2a" />, which checks
              eligibility over <Tag p="mcp" /> and reads its medical policy through <Tag p="rag" />. If documents are missing it asks for them. It never denies on its own.
            </p>
          </div>
          <div className="glass rounded-xl px-3 py-2 text-xs">
            {apiKey ? (
              <span className="text-emerald-300">● Live: criteria judged by Groq · {model}</span>
            ) : (
              <span className="text-amber-300">
                ● Offline scripted mode ·{" "}
                <button onClick={open} className="underline">
                  add Groq key
                </button>
              </span>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
          {CASES.map((x) => (
            <button
              key={x.id}
              disabled={busy}
              onClick={() => setCaseId(x.id)}
              className={`rounded-2xl p-4 text-left transition disabled:cursor-not-allowed ${x.id === caseId ? "border-rainbow bg-white/10" : "glass hover:bg-white/10"}`}
            >
              <p className="flex items-center gap-2 font-semibold">
                <span className="text-2xl">{x.emoji}</span>
                {x.title}
              </p>
              <p className="mt-1 text-xs text-white/55">
                {x.patient.name}, {x.patient.age}
                {x.patient.sex} · {x.service.codeSystem} {x.service.code}
              </p>
              <p className="mt-1 text-xs text-white/40">{x.diagnosis.map((d) => `${d.code} ${d.text}`).join(", ")}</p>
            </button>
          ))}
          <button
            onClick={start}
            disabled={busy}
            className="rounded-2xl bg-gradient-to-br from-amber-300 via-pink-400 to-violet-500 px-6 py-4 font-bold text-black shadow-lg shadow-pink-500/20 hover:brightness-110 disabled:opacity-50"
          >
            {busy ? "Agents working…" : "▶ Submit prior auth"}
          </button>
        </div>
        <p className="mt-2 text-xs text-white/45">
          Expected story: 🩻 MRI → approved in one pass · 💊 GLP-1 → pended for documents, then approved · 🧬 BRCA → criteria not met → physician decides
        </p>

        {err && <p className="mt-3 rounded-xl border border-rose-400/40 bg-rose-500/10 p-3 text-sm text-rose-200">⚠️ {err}</p>}

        <div className="mt-5 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
          {/* architecture */}
          <div className="glass rounded-2xl p-2">
            <div className="flex flex-wrap gap-2 px-2 pt-2 text-xs">
              {(["mcp", "a2a", "rag", "human"] as Protocol[]).map((p) => (
                <span key={p} className="rounded-lg px-2 py-1 font-semibold" style={{ background: P[p].c + "22", color: P[p].c }}>
                  {P[p].label} · {count(p)}
                </span>
              ))}
            </div>
            <svg viewBox="0 0 900 380" className="w-full" role="img" aria-label="Provider and payer agent architecture">
              <rect x={20} y={40} width={360} height={325} rx={20} fill="#a78bfa" fillOpacity={0.05} stroke="#a78bfa" strokeOpacity={0.35} strokeDasharray="6 6" />
              <text x={40} y={66} fill="#c4b5fd" fontSize={14} fontWeight={700}>
                🏥 {c.provider.clinic}
              </text>
              <rect x={500} y={40} width={385} height={325} rx={20} fill="#fbbf24" fillOpacity={0.04} stroke="#fbbf24" strokeOpacity={0.35} strokeDasharray="6 6" />
              <text x={520} y={66} fill="#fde68a" fontSize={14} fontWeight={700}>
                🛡️ Sunrise Health Plan (payer)
              </text>
              <text x={440} y={30} textAnchor="middle" fill="#94a3b8" fontSize={11}>
                organisation boundary
              </text>
              <line x1={440} y1={40} x2={440} y2={365} stroke="#fff" strokeOpacity={0.12} strokeDasharray="3 5" />

              {LINKS.map(([a, b, p]) => {
                const hot = last && ((last.from === a && last.to === b) || (last.from === b && last.to === a));
                return (
                  <g key={a + b}>
                    <line x1={NODES[a].x} y1={NODES[a].y} x2={NODES[b].x} y2={NODES[b].y} stroke={P[p].c} strokeOpacity={hot ? 1 : 0.22} strokeWidth={hot ? 4 : 2} className={hot ? "animate-dash" : ""} />
                    <text
                      x={NODES[a].y === NODES[b].y ? (NODES[a].x + NODES[b].x) / 2 : NODES[a].x + (NODES[b].x - NODES[a].x) * 0.6 + 14}
                      y={NODES[a].y === NODES[b].y ? NODES[a].y - 10 : NODES[a].y + (NODES[b].y - NODES[a].y) * 0.6}
                      textAnchor={NODES[a].y === NODES[b].y ? "middle" : "start"}
                      fontSize={12}
                      fontWeight={800}
                      fill={P[p].c}
                      opacity={hot ? 1 : 0.6}
                      stroke="#070714"
                      strokeWidth={4}
                      paintOrder="stroke"
                    >
                      {P[p].label}
                    </text>
                    {hot && (
                      <circle r={7} fill={P[p].c}>
                        <animateMotion dur="0.8s" repeatCount="indefinite" path={`M${NODES[last.from].x},${NODES[last.from].y} L${NODES[last.to].x},${NODES[last.to].y}`} />
                      </circle>
                    )}
                  </g>
                );
              })}
              {(Object.keys(NODES) as Actor[]).map((id) => {
                const nd = NODES[id];
                const hot = last && (last.from === id || last.to === id);
                return (
                  <g key={id}>
                    {hot && <circle cx={nd.x} cy={nd.y} r={36} fill={nd.c} opacity={0.35} className="animate-ping-soft" style={{ transformOrigin: `${nd.x}px ${nd.y}px` }} />}
                    <circle cx={nd.x} cy={nd.y} r={34} fill="#101028" stroke={nd.c} strokeWidth={hot ? 4 : 2} />
                    <text x={nd.x} y={nd.y + 9} textAnchor="middle" fontSize={26}>
                      {nd.e}
                    </text>
                    <text x={nd.x} y={nd.y + 52} textAnchor="middle" fontSize={12} fontWeight={700} fill="#fff">
                      {nd.name}
                    </text>
                    <text x={nd.x} y={nd.y + 66} textAnchor="middle" fontSize={10} fill={nd.c}>
                      {nd.sub}
                    </text>
                  </g>
                );
              })}
            </svg>
            <div className="grid gap-1.5 px-3 pb-3 text-xs text-white/55 sm:grid-cols-2">
              <p>
                <b className="text-cyan-300">MCP</b>: each agent → its own organisation&apos;s systems
              </p>
              <p>
                <b className="text-amber-300">A2A</b>: agent ⇄ agent across the company boundary
              </p>
              <p>
                <b className="text-emerald-300">RAG</b>: payer agent → medical-policy knowledge
              </p>
              <p>
                <b className="text-pink-300">HUMAN</b>: clinician signs any adverse decision
              </p>
            </div>
          </div>

          {/* log */}
          <div className="glass flex max-h-[470px] flex-col rounded-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <p className="font-semibold">Protocol trace</p>
              <span className="font-mono text-xs text-white/40">{events.length} steps · click to inspect</span>
            </div>
            <div ref={logRef} className="flex-1 space-y-1.5 overflow-y-auto p-3">
              {events.length === 0 && !busy && <p className="p-3 text-sm text-white/45">Pick a case and press ▶ Submit.</p>}
              {events.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setSel(e)}
                  className={`animate-pop block w-full rounded-xl border px-3 py-2 text-left text-sm ${sel?.id === e.id ? "border-white/30 bg-white/10" : "border-transparent bg-white/[.03] hover:bg-white/[.07]"}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-14 shrink-0 rounded px-1.5 py-0.5 text-center font-mono text-[10px] font-bold" style={{ background: P[e.protocol].c + "25", color: P[e.protocol].c }}>
                      {P[e.protocol].label}
                    </span>
                    <span className="truncate font-semibold text-white/90">{e.title}</span>
                    {e.state && <span className="ml-auto shrink-0 font-mono text-[10px] text-amber-200">{e.state}</span>}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-white/60">{e.text}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {intr && drained && (
          <div className="border-rainbow animate-pop mt-5 bg-pink-500/10 p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-pink-300">⏸ LangGraph interrupt() · no automated denials</p>
            <p className="mt-2 text-xl font-bold">👩‍⚕️ You are the Medical Director. {intr.question}</p>
            <ul className="mt-3 space-y-1 text-sm">
              {intr.criteria.map((x) => (
                <li key={x.criterion} className={x.met ? "text-emerald-300" : "text-rose-300"}>
                  {x.met ? "✓" : "✗"} {x.criterion} <span className="text-white/45">· {x.evidence}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Clinical rationale (optional)…"
                className="min-w-60 flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-pink-300"
              />
              <button onClick={() => decide("approve")} className="rounded-xl bg-emerald-500 px-5 py-2 font-bold text-black">
                Override: approve
              </button>
              <button onClick={() => decide("deny")} className="rounded-xl bg-rose-500 px-5 py-2 font-bold">
                Uphold denial
              </button>
            </div>
          </div>
        )}

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <div className="glass rounded-2xl p-5">
            <p className="font-semibold">✅ Policy criteria check</p>
            {assessment ? (
              <ul className="mt-3 space-y-2 text-sm">
                {assessment.criteria.map((x) => (
                  <li key={x.criterion} className="rounded-xl bg-black/25 p-2.5">
                    <p className={x.met ? "text-emerald-300" : "text-rose-300"}>
                      {x.met ? "✓" : "✗"} <b>{x.criterion}</b>
                    </p>
                    <p className="mt-0.5 text-xs text-white/55">
                      {x.evidence} <span className="font-mono text-emerald-300/70">[{x.citation}]</span>
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-white/45">Filled in by the payer agent after RAG retrieval.</p>
            )}
            {hits.length > 0 && (
              <p className="mt-3 text-xs text-white/45">
                RAG context: {hits.map((h) => `${h.id} (${h.score})`).join(" · ")}
              </p>
            )}
          </div>
          <div className="glass rounded-2xl p-5">
            <p className="font-semibold">📨 Determination</p>
            {det && drained ? (
              <div className="animate-pop mt-3">
                <span className={`rounded-lg px-3 py-1 text-sm font-black ${det.status === "approved" ? "bg-emerald-400 text-black" : "bg-rose-500"}`}>
                  {det.status.toUpperCase()}
                  {det.authNumber ? ` · ${det.authNumber}` : ""}
                </span>
                <p className="mt-3 text-sm leading-relaxed text-white/80">{det.letter}</p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-white/45">Returned to the provider as an A2A artifact.</p>
            )}
          </div>
          <div className="glass flex flex-col overflow-hidden rounded-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <p className="font-semibold">🔬 On the wire</p>
              {sel && (
                <span className="rounded px-1.5 py-0.5 font-mono text-[10px] font-bold" style={{ background: P[sel.protocol].c + "25", color: P[sel.protocol].c }}>
                  {P[sel.protocol].label}
                </span>
              )}
            </div>
            <pre className="max-h-96 flex-1 overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-[11px] leading-relaxed text-cyan-100/90">
              {sel ? JSON.stringify(sel.detail ?? { note: sel.text }, null, 2) : "// Real MCP JSON-RPC, A2A envelopes and RAG results appear here"}
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}

function Tag({ p }: { p: Protocol }) {
  return (
    <b className="rounded px-1 font-mono text-sm" style={{ background: P[p].c + "25", color: P[p].c }}>
      {P[p].label}
    </b>
  );
}
