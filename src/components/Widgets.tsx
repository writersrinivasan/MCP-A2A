"use client";

import { useEffect, useState } from "react";
import { AGENTS, AgentId, agentCard } from "@/lib/a2a";

/* ───────────── MCP vs A2A ───────────── */

type View = "mcp" | "a2a" | "both";
export function McpVsA2A() {
  const [view, setView] = useState<View>("both");
  const showMcp = view !== "a2a";
  const showA2a = view !== "mcp";
  const agents = [
    { x: 90, label: "Sales agent", org: "Org A", c: "#22d3ee" },
    { x: 300, label: "Finance agent", org: "Org B", c: "#a78bfa" },
    { x: 510, label: "Logistics agent", org: "Org C", c: "#f472b6" },
  ];
  const tools = ["CRM", "DB", "API"];
  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-3 flex gap-1 rounded-xl bg-black/30 p-1 text-sm">
        {(["mcp", "a2a", "both"] as View[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 rounded-lg py-1.5 font-semibold transition ${view === v ? "bg-white/15 text-white" : "text-white/50 hover:text-white"}`}
          >
            {v === "mcp" ? "MCP (agent ↕ tools)" : v === "a2a" ? "A2A (agent ↔ agent)" : "Together"}
          </button>
        ))}
      </div>
      <svg viewBox="0 0 600 300" className="w-full" role="img" aria-label="Diagram comparing MCP and A2A">
        {showA2a &&
          [0, 1].map((i) => (
            <g key={i}>
              <line x1={agents[i].x + 60} y1={90} x2={agents[i + 1].x - 60} y2={90} stroke="#fbbf24" strokeWidth={2.5} className="animate-dash" />
              <text x={(agents[i].x + agents[i + 1].x) / 2} y={78} textAnchor="middle" fill="#fde68a" fontSize={12} fontWeight={600}>
                A2A tasks
              </text>
            </g>
          ))}
        {agents.map((a) => (
          <g key={a.label}>
            {showMcp &&
              tools.map((t, j) => {
                const tx = a.x - 55 + j * 55;
                return (
                  <g key={t}>
                    <line x1={a.x} y1={112} x2={tx} y2={210} stroke={a.c} strokeOpacity={0.6} strokeWidth={1.5} className="animate-dash" />
                    <rect x={tx - 22} y={210} width={44} height={26} rx={7} fill="#0f0f25" stroke={a.c} strokeOpacity={0.6} />
                    <text x={tx} y={227} textAnchor="middle" fill="#cbd5e1" fontSize={10}>
                      {t}
                    </text>
                  </g>
                );
              })}
            <rect x={a.x - 60} y={68} width={120} height={44} rx={12} fill="#13132e" stroke={a.c} strokeWidth={2} />
            <text x={a.x} y={88} textAnchor="middle" fill="#fff" fontSize={12} fontWeight={700}>
              {a.label}
            </text>
            <text x={a.x} y={103} textAnchor="middle" fill={a.c} fontSize={10}>
              {a.org}
            </text>
          </g>
        ))}
        {showMcp && (
          <text x={300} y={270} textAnchor="middle" fill="#94a3b8" fontSize={11}>
            MCP: each agent connects to its own tools & context (vertical)
          </text>
        )}
        {showA2a && (
          <text x={300} y={35} textAnchor="middle" fill="#94a3b8" fontSize={11}>
            A2A: opaque agents delegate tasks to peers across org boundaries (horizontal)
          </text>
        )}
      </svg>
    </div>
  );
}

/* ───────────── Task lifecycle ───────────── */

const STEPS = [
  { s: "submitted", c: "#38bdf8", d: "Client agent sends message/send. Remote agent creates a Task with an id and contextId." },
  { s: "working", c: "#a78bfa", d: "Remote agent is processing. Progress streams back as TaskStatusUpdate events over SSE." },
  { s: "input-required", c: "#fbbf24", d: "Remote agent needs more info or a human approval. Client replies on the same taskId." },
  { s: "working", c: "#a78bfa", d: "Work resumes with the extra input. Long tasks can use push notifications instead of an open stream." },
  { s: "completed", c: "#34d399", d: "Terminal state. Results arrive as Artifacts made of Parts (text, file, data)." },
];
export function TaskLifecycle() {
  const [i, setI] = useState(0);
  const [play, setPlay] = useState(false);
  useEffect(() => {
    if (!play) return;
    const t = setInterval(() => setI((x) => (x + 1) % STEPS.length), 1800);
    return () => clearInterval(t);
  }, [play]);
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-white/80">Task lifecycle</p>
        <button onClick={() => setPlay((p) => !p)} className="rounded-lg bg-white/10 px-3 py-1 text-xs font-semibold hover:bg-white/15">
          {play ? "⏸ Pause" : "▶ Play"}
        </button>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {STEPS.map((st, k) => (
          <div key={k} className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setPlay(false);
                setI(k);
              }}
              className="rounded-full px-3 py-1 font-mono text-xs font-semibold transition"
              style={{
                background: k === i ? st.c : "transparent",
                color: k === i ? "#0b0b1a" : st.c,
                border: `1px solid ${st.c}`,
                boxShadow: k === i ? `0 0 18px ${st.c}88` : "none",
              }}
            >
              {st.s}
            </button>
            {k < STEPS.length - 1 && <span className="text-white/30">→</span>}
          </div>
        ))}
      </div>
      <p key={i} className="animate-pop mt-4 min-h-12 text-sm leading-relaxed text-white/75">
        {STEPS[i].d}
      </p>
      <p className="mt-2 text-xs text-white/45">
        Other terminal states: <code className="text-rose-300">failed</code>, <code className="text-rose-300">canceled</code>,{" "}
        <code className="text-rose-300">rejected</code>. Plus <code className="text-amber-200">auth-required</code> when credentials are needed.
      </p>
    </div>
  );
}

/* ───────────── Agent Card explorer ───────────── */

export function AgentCardExplorer() {
  const ids: AgentId[] = ["diagnostics", "inventory", "supplier", "scheduler", "governance"];
  const [id, setId] = useState<AgentId>("supplier");
  const a = AGENTS[id];
  return (
    <div className="glass overflow-hidden rounded-2xl">
      <div className="flex flex-wrap gap-1.5 border-b border-white/10 p-3">
        {ids.map((x) => (
          <button
            key={x}
            onClick={() => setId(x)}
            className="rounded-lg px-2.5 py-1 text-xs font-semibold transition"
            style={{ background: x === id ? AGENTS[x].color : "rgba(255,255,255,.06)", color: x === id ? "#0b0b1a" : "#e2e8f0" }}
          >
            {AGENTS[x].emoji} {AGENTS[x].short}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between px-4 pt-3 text-xs">
        <span className="font-mono text-white/50">GET /.well-known/agent-card.json</span>
        <span className="rounded-md px-2 py-0.5 font-semibold" style={{ background: a.color + "22", color: a.color }}>
          {a.stack}
        </span>
      </div>
      <pre className="max-h-80 overflow-auto p-4 font-mono text-[11.5px] leading-relaxed text-emerald-100/90">
        {JSON.stringify(agentCard(a), null, 2)}
      </pre>
    </div>
  );
}

/* ───────────── Topology switcher ───────────── */

type Topo = "hub" | "mesh" | "hier";
const TOPO_INFO: Record<Topo, { title: string; pros: string; cons: string }> = {
  hub: { title: "Hub-and-spoke orchestrator", pros: "Simple governance, single audit point, easy to reason about", cons: "Orchestrator is a bottleneck and single point of failure" },
  mesh: { title: "Peer-to-peer mesh", pros: "Resilient, low latency, agents negotiate directly", cons: "Harder to govern & trace; needs strong identity + registry" },
  hier: { title: "Hierarchical (supervisors of supervisors)", pros: "Scales to many domains; each domain owns its agents", cons: "More hops; must propagate trace and auth context" },
};
export function TopologySwitcher() {
  const [t, setT] = useState<Topo>("hub");
  const cols = ["#22d3ee", "#a78bfa", "#f472b6", "#fbbf24", "#34d399", "#fb923c"];
  const ring = cols.map((c, i) => {
    const ang = (i / cols.length) * Math.PI * 2 - Math.PI / 2;
    return { x: 200 + Math.cos(ang) * 120, y: 130 + Math.sin(ang) * 95, c };
  });
  const hier = [
    { x: 200, y: 35, c: "#a78bfa" },
    { x: 100, y: 120, c: "#22d3ee" },
    { x: 300, y: 120, c: "#f472b6" },
    { x: 50, y: 215, c: "#34d399" },
    { x: 150, y: 215, c: "#fbbf24" },
    { x: 250, y: 215, c: "#fb923c" },
    { x: 350, y: 215, c: "#f87171" },
  ];
  let edges: [{ x: number; y: number }, { x: number; y: number }][] = [];
  let nodes: { x: number; y: number; c: string }[] = [];
  if (t === "hub") {
    nodes = [{ x: 200, y: 130, c: "#ffffff" }, ...ring];
    edges = ring.map((n) => [nodes[0], n]);
  } else if (t === "mesh") {
    nodes = ring;
    ring.forEach((a, i) => ring.slice(i + 1).forEach((b) => edges.push([a, b])));
  } else {
    nodes = hier;
    edges = [
      [hier[0], hier[1]],
      [hier[0], hier[2]],
      [hier[1], hier[3]],
      [hier[1], hier[4]],
      [hier[2], hier[5]],
      [hier[2], hier[6]],
    ];
  }
  const info = TOPO_INFO[t];
  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-2 flex gap-1 rounded-xl bg-black/30 p-1 text-sm">
        {(Object.keys(TOPO_INFO) as Topo[]).map((k) => (
          <button
            key={k}
            onClick={() => setT(k)}
            className={`flex-1 rounded-lg py-1.5 font-semibold ${t === k ? "bg-white/15 text-white" : "text-white/50 hover:text-white"}`}
          >
            {k === "hub" ? "Hub" : k === "mesh" ? "Mesh" : "Hierarchical"}
          </button>
        ))}
      </div>
      <svg viewBox="0 0 400 250" className="w-full" role="img" aria-label={info.title}>
        {edges.map(([a, b], i) => (
          <line key={t + i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#ffffff" strokeOpacity={0.25} strokeWidth={1.5} className="animate-dash" />
        ))}
        {nodes.map((n, i) => (
          <g key={t + "n" + i}>
            <circle cx={n.x} cy={n.y} r={i === 0 && t !== "mesh" ? 20 : 14} fill={n.c} fillOpacity={0.2} stroke={n.c} strokeWidth={2} />
            <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize={11} fill="#fff">
              {i === 0 && t !== "mesh" ? "🧭" : "🤖"}
            </text>
          </g>
        ))}
      </svg>
      <p className="font-semibold">{info.title}</p>
      <p className="mt-1 text-sm text-emerald-300/90">＋ {info.pros}</p>
      <p className="text-sm text-rose-300/90">− {info.cons}</p>
    </div>
  );
}

/* ───────────── Trust stack ───────────── */

const TRUST = [
  { k: "Identity", e: "🪪", c: "#22d3ee", d: "Every agent has a verifiable identity: OAuth2 / OIDC tokens, mTLS certificates, signed Agent Cards. No anonymous agents on the network." },
  { k: "Authorization", e: "🔐", c: "#a78bfa", d: "Least-privilege scopes per skill (e.g. procurement:quote, not procurement:*). Delegated tokens carry who the agent acts on behalf of." },
  { k: "Policy & guardrails", e: "📏", c: "#f472b6", d: "A policy engine (e.g. OPA) checks spend limits, data classification, residency and safety rules before actions run. Inputs from peers are treated as untrusted to block cross-agent prompt injection." },
  { k: "Human-in-the-loop", e: "🧑‍⚖️", c: "#fbbf24", d: "High-risk or over-limit actions pause in input-required until an accountable person approves. The demo below shows this with a LangGraph interrupt." },
  { k: "Observability & audit", e: "🔎", c: "#34d399", d: "W3C traceparent propagated through every A2A call (OpenTelemetry). Immutable audit log of who asked whom to do what, and why." },
  { k: "Compliance", e: "📚", c: "#fb923c", d: "Map controls to EU AI Act risk tiers, ISO/IEC 42001 and the NIST AI RMF. Keep a registry of agents, owners, models and versions." },
];
export function TrustStack() {
  const [i, setI] = useState(2);
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex flex-col-reverse gap-1.5">
        {TRUST.map((t, k) => (
          <button
            key={t.k}
            onClick={() => setI(k)}
            className="flex items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold transition"
            style={{
              background: k === i ? t.c + "30" : "rgba(255,255,255,.04)",
              border: `1px solid ${k === i ? t.c : "transparent"}`,
              marginInline: `${(TRUST.length - 1 - k) * 6}px`,
            }}
          >
            <span>{t.e}</span>
            <span style={{ color: k === i ? t.c : undefined }}>{t.k}</span>
            <span className="ml-auto font-mono text-xs text-white/30">L{k + 1}</span>
          </button>
        ))}
      </div>
      <p key={i} className="animate-pop mt-4 text-sm leading-relaxed text-white/75">
        {TRUST[i].d}
      </p>
    </div>
  );
}
