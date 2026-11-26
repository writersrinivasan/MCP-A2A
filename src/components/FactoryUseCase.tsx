"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { A2AEvent, AGENTS, AgentId, SCENARIOS } from "@/lib/a2a";
import { readNdjson } from "@/lib/ndjson";
import { useSettings } from "./Settings";

type StreamItem =
  | { type: "thread"; threadId: string; mode: "live" | "offline" }
  | { type: "node"; node: string }
  | { type: "event"; event: A2AEvent }
  | { type: "state"; node: string; state: Record<string, unknown> }
  | { type: "interrupt"; value: { question: string; totalCost: number; reasons: string[] } }
  | { type: "done" }
  | { type: "error"; message: string };

const POS: Record<AgentId, { x: number; y: number }> = {
  iot: { x: 105, y: 235 },
  orchestrator: { x: 400, y: 235 },
  diagnostics: { x: 250, y: 75 },
  inventory: { x: 550, y: 75 },
  supplier: { x: 700, y: 235 },
  scheduler: { x: 550, y: 395 },
  governance: { x: 250, y: 395 },
  human: { x: 80, y: 395 },
};

const GRAPH_NODES = [
  ["iot", "📡 iot"],
  ["orchestrator_plan", "🧭 plan"],
  ["diagnostics", "🩺 diagnostics"],
  ["inventory", "📦 inventory"],
  ["join", "⛙ join"],
  ["supplier", "🚚 supplier?"],
  ["scheduler", "🗓️ scheduler"],
  ["governance", "🛡️ governance"],
  ["human", "👩‍🏭 human? (interrupt)"],
  ["work_order", "✅ work_order"],
] as const;

const STATE_COLOR: Record<string, string> = {
  submitted: "#38bdf8",
  working: "#a78bfa",
  "input-required": "#fbbf24",
  completed: "#34d399",
  failed: "#f87171",
  canceled: "#f87171",
};

const KIND_LABEL: Record<A2AEvent["kind"], string> = {
  discovery: "Agent Card",
  message: "message/send",
  status: "status-update",
  artifact: "artifact",
  policy: "policy",
  hitl: "human",
};

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

export function FactoryUseCase() {
  const { apiKey, model, headers, open } = useSettings();
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const [partInStock, setPartInStock] = useState(true);
  const [budget, setBudget] = useState(5000);

  const [running, setRunning] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [mode, setMode] = useState<"live" | "offline" | null>(null);
  const [events, setEvents] = useState<A2AEvent[]>([]);
  const [visited, setVisited] = useState<string[]>([]);
  const [interruptV, setInterruptV] = useState<Extract<StreamItem, { type: "interrupt" }>["value"] | null>(null);
  const [final, setFinal] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<A2AEvent | null>(null);
  const [note, setNote] = useState("");

  // Stream items are queued and revealed one by one so the animation is easy to follow.
  const queue = useRef<StreamItem[]>([]);
  const streaming = useRef(false);
  const logRef = useRef<HTMLDivElement>(null);
  const [drained, setDrained] = useState(true);

  useEffect(() => {
    const t = setInterval(() => {
      const item = queue.current.shift();
      if (!item) {
        if (!streaming.current) setDrained(true);
        return;
      }
      setDrained(false);
      switch (item.type) {
        case "thread":
          setThreadId(item.threadId);
          setMode(item.mode);
          break;
        case "node":
          setVisited((v) => [...v, item.node]);
          break;
        case "event":
          setEvents((e) => [...e, item.event]);
          setSelected(item.event);
          break;
        case "state":
          setFinal((f) => ({ ...f, ...item.state }));
          break;
        case "interrupt":
          setInterruptV(item.value);
          break;
        case "error":
          setError(item.message);
          break;
      }
    }, 420);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [events.length]);

  const call = async (body: Record<string, unknown>) => {
    setRunning(true);
    setError(null);
    streaming.current = true;
    try {
      const res = await fetch("/api/factory", { method: "POST", headers: headers(), body: JSON.stringify({ ...body, model }) });
      await readNdjson<StreamItem>(res, (item) => queue.current.push(item));
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
    setVisited([]);
    setInterruptV(null);
    setFinal({});
    setSelected(null);
    setThreadId(null);
    setNote("");
    call({ action: "start", scenarioId, budgetLimit: budget, partInStock });
  };

  const decide = (approved: boolean) => {
    if (!threadId) return;
    setInterruptV(null);
    call({ action: "resume", threadId, approved, note });
  };

  const busy = running || !drained;
  const last = events[events.length - 1];
  const nodeStatus = useMemo(() => {
    const st: Partial<Record<AgentId, string>> = {};
    for (const e of events) {
      if (e.kind === "discovery") continue;
      st[e.from] = e.state;
      if (e.kind === "message") st[e.to] = "working";
      // A human decision or the final work order also settles the receiving agent's task.
      if (e.kind === "hitl" || (e.kind === "artifact" && e.to === "iot")) st[e.to] = e.state;
    }
    return st;
  }, [events]);
  const involved = new Set<AgentId>(events.flatMap((e) => [e.from, e.to]));
  const sc = SCENARIOS.find((s) => s.id === scenarioId)!;
  const workOrder = final.workOrder as string | undefined;
  const policy = final.policy as { decision: string; totalCost: number; reasons: string[] } | undefined;

  return (
    <section id="usecase" className="scroll-mt-20 border-y border-white/5 bg-black/20 py-16">
      <div className="mx-auto max-w-7xl px-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-300">
              🏭 Industrial use case · live LangGraph
            </span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Smart factory: <span className="text-rainbow">predictive maintenance</span> across an agent network
            </h2>
            <p className="mt-3 max-w-3xl text-white/70">
              A sensor spots trouble on a production machine. Seven agents, owned by five different teams and companies and built on five different
              frameworks, discover each other, split the work, negotiate across company lines, ask for human approval, and issue a work order before the
              machine fails.
            </p>
          </div>
          <div className="glass rounded-xl px-3 py-2 text-xs">
            {apiKey ? (
              <span className="text-emerald-300">● Live: agents reason with Groq · {model}</span>
            ) : (
              <span className="text-amber-300">
                ● Offline scripted mode ·{" "}
                <button onClick={open} className="underline">
                  add Groq key for live LLM agents
                </button>
              </span>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="mt-8 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="grid gap-3 sm:grid-cols-3">
            {SCENARIOS.map((s) => (
              <button
                key={s.id}
                disabled={busy}
                onClick={() => setScenarioId(s.id)}
                className={`rounded-2xl p-4 text-left transition disabled:cursor-not-allowed ${
                  s.id === scenarioId ? "border-rainbow bg-white/10" : "glass hover:bg-white/10"
                }`}
              >
                <p className="text-2xl">{s.emoji}</p>
                <p className="mt-1 font-semibold">{s.title}</p>
                <p className="mt-1 text-xs text-white/55">{s.asset}</p>
                <p className="mt-2 text-xs font-semibold" style={{ color: s.severity === "critical" ? "#f87171" : s.severity === "high" ? "#fbbf24" : "#38bdf8" }}>
                  {s.severity.toUpperCase()} · RUL {s.rulHours} h · {usd(s.partCost + s.laborCost)}
                </p>
              </button>
            ))}
          </div>
          <div className="glass flex flex-col justify-between gap-4 rounded-2xl p-4">
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>
                <b>Spare part in stock?</b>
                <span className="block text-xs text-white/50">If not, the network brings in the external Supplier agent</span>
              </span>
              <button
                role="switch"
                aria-checked={partInStock}
                disabled={busy}
                onClick={() => setPartInStock((p) => !p)}
                className={`relative h-7 w-12 shrink-0 rounded-full transition ${partInStock ? "bg-emerald-500" : "bg-white/20"}`}
              >
                <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${partInStock ? "left-6" : "left-1"}`} />
              </button>
            </label>
            <label className="text-sm">
              <span className="flex justify-between">
                <b>Autonomous spend limit</b>
                <span className="font-mono text-amber-300">{usd(budget)}</span>
              </span>
              <span className="block text-xs text-white/50">Above this, Governance escalates to a human (you)</span>
              <input
                type="range"
                min={1000}
                max={15000}
                step={500}
                value={budget}
                disabled={busy}
                onChange={(e) => setBudget(+e.target.value)}
                className="mt-2 w-full accent-amber-400"
              />
            </label>
            <button
              onClick={start}
              disabled={busy}
              className="rounded-xl bg-gradient-to-r from-emerald-400 via-cyan-400 to-violet-500 py-3 font-bold text-black shadow-lg shadow-cyan-500/20 transition hover:brightness-110 disabled:opacity-50"
            >
              {busy ? "Agents collaborating…" : `▶ Trigger anomaly on ${sc.asset.split(" ")[0]}`}
            </button>
          </div>
        </div>

        {/* LangGraph execution path */}
        <div className="mt-5 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="mr-1 font-semibold text-white/50">LangGraph path:</span>
          {GRAPH_NODES.map(([id, label], i) => {
            const on = visited.includes(id);
            const skipped = !on && (visited.includes("work_order") || (id === "supplier" && visited.includes("scheduler")));
            return (
              <span key={id} className="flex items-center gap-1.5">
                <span
                  className={`rounded-md px-2 py-1 font-mono transition ${
                    on ? "bg-violet-500/30 text-white ring-1 ring-violet-400" : skipped ? "text-white/20 line-through" : "bg-white/5 text-white/45"
                  }`}
                >
                  {label}
                </span>
                {i < GRAPH_NODES.length - 1 && <span className="text-white/20">›</span>}
              </span>
            );
          })}
        </div>

        {error && <div className="mt-4 rounded-xl border border-rose-400/40 bg-rose-500/10 p-3 text-sm text-rose-200">⚠️ {error}</div>}

        {/* Network + log */}
        <div className="mt-5 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
          <div className="glass relative overflow-hidden rounded-2xl p-2">
            <svg viewBox="0 0 800 470" className="w-full" role="img" aria-label="Animated agent network">
              <defs>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="4" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              {/* base links */}
              {(Object.keys(POS) as AgentId[])
                .filter((a) => a !== "orchestrator" && a !== "human")
                .map((a) => (
                  <line key={a} x1={POS.orchestrator.x} y1={POS.orchestrator.y} x2={POS[a].x} y2={POS[a].y} stroke="#fff" strokeOpacity={0.08} strokeWidth={2} />
                ))}
              <line x1={POS.human.x} y1={POS.human.y} x2={POS.governance.x} y2={POS.governance.y} stroke="#fff" strokeOpacity={0.08} strokeWidth={2} strokeDasharray="4 6" />

              {/* active message */}
              {last && last.from !== last.to && (
                <g key={last.id}>
                  <line
                    x1={POS[last.from].x}
                    y1={POS[last.from].y}
                    x2={POS[last.to].x}
                    y2={POS[last.to].y}
                    stroke={AGENTS[last.from].color}
                    strokeWidth={3}
                    className="animate-dash"
                    filter="url(#glow)"
                  />
                  <circle r={7} fill={AGENTS[last.from].color} filter="url(#glow)">
                    <animateMotion
                      dur="0.9s"
                      repeatCount="indefinite"
                      path={`M${POS[last.from].x},${POS[last.from].y} L${POS[last.to].x},${POS[last.to].y}`}
                    />
                  </circle>
                  <text
                    x={(POS[last.from].x + POS[last.to].x) / 2}
                    y={(POS[last.from].y + POS[last.to].y) / 2 - 12}
                    textAnchor="middle"
                    fontSize={12}
                    fontWeight={700}
                    fill="#fff"
                    stroke="#070714"
                    strokeWidth={4}
                    paintOrder="stroke"
                  >
                    {KIND_LABEL[last.kind]}
                  </text>
                </g>
              )}

              {/* nodes */}
              {(Object.keys(POS) as AgentId[]).map((id) => {
                const a = AGENTS[id];
                const p = POS[id];
                const st = nodeStatus[id];
                const active = last && (last.from === id || last.to === id);
                const dim = events.length > 0 && !involved.has(id);
                const r = id === "orchestrator" ? 46 : 38;
                return (
                  <g key={id} opacity={dim ? 0.3 : 1} style={{ transition: "opacity .4s" }}>
                    {active && <circle cx={p.x} cy={p.y} r={r} fill={a.color} opacity={0.35} className="animate-ping-soft" style={{ transformOrigin: `${p.x}px ${p.y}px` }} />}
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={r}
                      fill="#101028"
                      stroke={a.color}
                      strokeWidth={active ? 4 : 2}
                      strokeDasharray={a.external ? "7 5" : undefined}
                    />
                    <text x={p.x} y={p.y + 9} textAnchor="middle" fontSize={id === "orchestrator" ? 30 : 26}>
                      {a.emoji}
                    </text>
                    <text x={p.x} y={p.y + r + 18} textAnchor="middle" fontSize={13} fontWeight={700} fill="#fff">
                      {a.short}
                    </text>
                    <text x={p.x} y={p.y + r + 33} textAnchor="middle" fontSize={10} fill={a.color}>
                      {a.external ? "EXTERNAL · " : ""}
                      {a.stack}
                    </text>
                    {st && (
                      <g>
                        <rect x={p.x - 40} y={p.y - r - 24} width={80} height={18} rx={9} fill={STATE_COLOR[st] ?? "#64748b"} />
                        <text x={p.x} y={p.y - r - 11} textAnchor="middle" fontSize={10} fontWeight={700} fill="#0b0b1a">
                          {st}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
            <div className="flex flex-wrap gap-3 px-2 pb-1 text-[11px] text-white/50">
              <span>
                <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full border border-dashed border-white/60" />
                External org (cross-company trust)
              </span>
              <span>Built on different frameworks, talking over A2A</span>
            </div>
            {events.length === 0 && !busy && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <p className="animate-floaty rounded-xl bg-black/60 px-4 py-2 text-sm text-white/80">Choose a scenario and press ▶ to wake the network</p>
              </div>
            )}
          </div>

          {/* message log */}
          <div className="glass flex max-h-[560px] flex-col rounded-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <p className="font-semibold">A2A message log</p>
              <span className="font-mono text-xs text-white/40">
                {events.length} msgs{mode ? ` · ${mode}` : ""}
              </span>
            </div>
            <div ref={logRef} className="flex-1 space-y-2 overflow-y-auto p-3">
              {events.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setSelected(e)}
                  className={`animate-pop block w-full rounded-xl border p-3 text-left text-sm transition ${
                    selected?.id === e.id ? "border-white/30 bg-white/10" : "border-transparent bg-white/[.03] hover:bg-white/[.07]"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="font-semibold" style={{ color: AGENTS[e.from].color }}>
                      {AGENTS[e.from].emoji} {AGENTS[e.from].short}
                    </span>
                    <span className="text-white/30">→</span>
                    <span className="font-semibold" style={{ color: AGENTS[e.to].color }}>
                      {AGENTS[e.to].emoji} {AGENTS[e.to].short}
                    </span>
                    <span className="ml-auto rounded px-1.5 py-0.5 font-mono text-[10px]" style={{ background: (STATE_COLOR[e.state] ?? "#64748b") + "30", color: STATE_COLOR[e.state] }}>
                      {e.state}
                    </span>
                  </div>
                  <p className="mt-1.5 font-semibold text-white/90">
                    <span className="mr-1.5 rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-white/60">{KIND_LABEL[e.kind]}</span>
                    {e.title}
                  </p>
                  <p className="mt-1 text-white/65">{e.text}</p>
                </button>
              ))}
              {busy && (
                <div className="flex items-center gap-2 px-2 py-1 text-xs text-white/50">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-violet-400" /> agents working…
                </div>
              )}
            </div>
          </div>
        </div>

        {/* HITL approval */}
        {interruptV && drained && (
          <div className="border-rainbow animate-pop mt-5 bg-amber-400/10 p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-300">⏸ Graph paused · LangGraph interrupt() · A2A task state: input-required</p>
            <p className="mt-2 text-xl font-bold">👩‍🏭 You are the Plant Manager. {interruptV.question}</p>
            <ul className="mt-3 space-y-1 text-sm text-white/75">
              {interruptV.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional note to the agents…"
                className="min-w-60 flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-amber-300"
              />
              <button onClick={() => decide(true)} className="rounded-xl bg-emerald-500 px-5 py-2 font-bold text-black hover:brightness-110">
                ✓ Approve
              </button>
              <button onClick={() => decide(false)} className="rounded-xl bg-rose-500 px-5 py-2 font-bold text-white hover:brightness-110">
                ✕ Reject
              </button>
            </div>
          </div>
        )}

        {/* outcome + inspector */}
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="glass rounded-2xl p-5">
            <p className="font-semibold">📋 Outcome</p>
            {workOrder && drained ? (
              <div className="animate-pop mt-3 space-y-3 text-sm">
                <p className="rounded-xl bg-emerald-400/10 p-3 leading-relaxed text-emerald-50">{workOrder}</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Stat label="Agents involved" value={String(involved.size)} c="#a78bfa" />
                  <Stat label="A2A messages" value={String(events.length)} c="#22d3ee" />
                  <Stat label="Total cost" value={policy ? usd(policy.totalCost) : "—"} c="#fbbf24" />
                </div>
                <p className="text-xs text-white/50">
                  Path:{" "}
                  {final.stock && (final.stock as { available: boolean }).available ? "part from internal stock" : "external supplier sourced the part"} ·{" "}
                  {policy?.decision === "escalated" ? "human-approved spend" : "auto-approved by policy"}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-white/50">The final work order appears here once the network finishes.</p>
            )}
          </div>
          <div className="glass flex flex-col overflow-hidden rounded-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <p className="font-semibold">🔬 Wire inspector</p>
              <span className="text-xs text-white/40">{selected ? `${AGENTS[selected.from].short} → ${AGENTS[selected.to].short}` : "click a message"}</span>
            </div>
            <pre className="max-h-72 flex-1 overflow-auto p-4 font-mono text-[11px] leading-relaxed text-cyan-100/90">
              {selected ? JSON.stringify(selected.envelope, null, 2) : "// The JSON-RPC envelope that would travel between agents"}
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, c }: { label: string; value: string; c: string }) {
  return (
    <div className="rounded-xl bg-white/5 p-2">
      <p className="text-lg font-black" style={{ color: c }}>
        {value}
      </p>
      <p className="text-[11px] text-white/50">{label}</p>
    </div>
  );
}
