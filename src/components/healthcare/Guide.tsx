"use client";

import { useState } from "react";

const LAYERS = {
  rag: { e: "📚", name: "RAG", q: "What does the agent need to KNOW?", c: "#34d399", d: "Retrieve the right passages from documents (medical policies, clinical guidelines, coding rules, provider manuals, contracts) and ground the LLM's answer in them, with citations.", ex: "Payer agent pulls the MRI policy's criteria before judging the case." },
  mcp: { e: "🔧", name: "MCP", q: "What does the agent need to READ or DO in our systems?", c: "#22d3ee", d: "A standard plug for tools and data: EHR (FHIR), eligibility, claims, scheduling. One MCP server per system, reusable by any agent or LLM app inside your organisation.", ex: "Provider agent calls get_clinical_notes on the EHR MCP server." },
  a2a: { e: "🤝", name: "A2A", q: "Who does the agent need to WORK WITH?", c: "#fbbf24", d: "Agent-to-agent collaboration, often across company boundaries: send a task, get status updates, answer follow-up questions, receive the result. Neither side exposes its internal systems.", ex: "Provider agent submits the request to the payer's agent, which replies input-required." },
} as const;
type L = keyof typeof LAYERS;

const USES: { t: string; who: string; layers: L[]; why: string; value: string }[] = [
  { t: "Prior authorization (live demo ↓)", who: "Provider ⇄ Payer", layers: ["rag", "mcp", "a2a"], why: "Policies are documents (RAG), evidence lives in the EHR (MCP), and two companies must exchange a request (A2A).", value: "Days → minutes for clean cases" },
  { t: "Claim denial management & appeals", who: "Provider revenue cycle", layers: ["rag", "mcp"], why: "Read the 835 remit and claim (MCP), match denial codes to payer policy (RAG), draft the appeal letter.", value: "More denials overturned, less rework" },
  { t: "Eligibility & benefits verification", who: "Provider front office", layers: ["mcp", "a2a"], why: "Check coverage through payer APIs or agents before the visit; no documents needed.", value: "Fewer front-end denials" },
  { t: "Medical coding assistant (ICD-10 / CPT)", who: "Provider HIM / coding", layers: ["rag", "mcp"], why: "Pull the encounter note (MCP), ground code suggestions in coding guidelines (RAG); a coder approves.", value: "Coder throughput ↑, accuracy ↑" },
  { t: "Payment integrity / FWA detection", who: "Payer SIU", layers: ["rag", "mcp"], why: "Query claims history (MCP), compare against billing edits & policy (RAG), flag for an investigator.", value: "Improper payments ↓" },
  { t: "Care-gap closure (HEDIS / Stars)", who: "Payer → Provider", layers: ["mcp", "a2a"], why: "Payer agent finds the gaps in its data (MCP) and asks the provider's agent to schedule or send evidence (A2A).", value: "Quality scores ↑" },
  { t: "Member / patient service assistant", who: "Payer & provider", layers: ["rag", "mcp"], why: "Answer 'is this covered?' from benefit documents (RAG) and the member's own plan data (MCP).", value: "Call volume ↓" },
];

export function Guide() {
  const [sel, setSel] = useState(0);
  const active = new Set(USES[sel].layers);
  return (
    <section id="guide" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-14">
      <h2 className="text-3xl font-extrabold tracking-tight">New to this? Use one question per layer</h2>
      <p className="mt-2 max-w-3xl text-white/70">
        RAG, MCP and A2A don&apos;t compete. They answer three different questions, and <b className="text-white">yes, you can and usually should combine them</b>.
        MCP is how an agent uses its own organisation&apos;s systems; A2A is how it works with someone else&apos;s agent.
      </p>
      <div className="mt-7 grid gap-4 md:grid-cols-3">
        {(Object.keys(LAYERS) as L[]).map((k) => {
          const l = LAYERS[k];
          const on = active.has(k);
          return (
            <div
              key={k}
              className="rounded-2xl border p-5 transition"
              style={{ borderColor: on ? l.c : "rgba(255,255,255,.08)", background: on ? l.c + "14" : "rgba(255,255,255,.03)", boxShadow: on ? `0 0 30px ${l.c}22` : "none" }}
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl">{l.e}</span>
                <span className="text-2xl font-black" style={{ color: l.c }}>
                  {l.name}
                </span>
                {on && <span className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold text-black" style={{ background: l.c }}>USED</span>}
              </div>
              <p className="mt-3 font-semibold text-white">{l.q}</p>
              <p className="mt-2 text-sm text-white/65">{l.d}</p>
              <p className="mt-3 text-xs text-white/50">In the demo: {l.ex}</p>
            </div>
          );
        })}
      </div>

      <h3 className="mt-12 text-xl font-bold">Where agentic AI helps in the payer / provider market</h3>
      <p className="mt-1 text-sm text-white/55">Click a use case to see which layers it needs.</p>
      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
        {USES.map((u, i) => (
          <button
            key={u.t}
            onClick={() => setSel(i)}
            className={`grid w-full gap-2 border-b border-white/5 px-4 py-3 text-left text-sm transition last:border-0 md:grid-cols-[1.3fr_0.8fr_0.9fr_2fr_1fr] md:items-center ${i === sel ? "bg-white/10" : "hover:bg-white/5"}`}
          >
            <span className="font-semibold text-white">{u.t}</span>
            <span className="text-white/55">{u.who}</span>
            <span className="flex gap-1">
              {u.layers.map((l) => (
                <span key={l} className="rounded-md px-1.5 py-0.5 text-[11px] font-bold" style={{ background: LAYERS[l].c + "25", color: LAYERS[l].c }}>
                  {LAYERS[l].name}
                </span>
              ))}
            </span>
            <span className="text-white/65">{u.why}</span>
            <span className="text-emerald-300/90">{u.value}</span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-white/45">
        Recommendation: start with <b className="text-white/70">prior authorization</b>. It&apos;s the most visible pain point between payers and providers, and the
        CMS Interoperability & Prior Authorization rule (CMS-0057-F) requires impacted payers to offer prior-auth APIs starting January 2027.
      </p>
    </section>
  );
}

export function Roadmap() {
  const steps = [
    { t: "Crawl", w: "Weeks 1–6", c: "#34d399", e: "📚", items: ["RAG Q&A over your payer policies for PA / billing staff", "Read-only, citations required", "Build a 50-question evaluation set with SMEs"] },
    { t: "Walk", w: "Months 2–4", c: "#22d3ee", e: "🔧", items: ["Add MCP servers for EHR (FHIR) and eligibility", "Agent drafts the PA packet + criteria checklist", "A human reviews and submits"] },
    { t: "Run", w: "Months 4–9", c: "#fbbf24", e: "🤝", items: ["A2A / FHIR (Da Vinci PAS) exchange with payer partners", "Auto-submit clean cases; pend loop for missing documents", "Automation never denies: denials go to clinicians"] },
  ];
  return (
    <section id="roadmap" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-14">
      <h2 className="text-3xl font-extrabold tracking-tight">How to bring this into your processes</h2>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {steps.map((s, i) => (
          <div key={s.t} className="glass relative rounded-2xl p-5" style={{ borderTop: `3px solid ${s.c}` }}>
            <p className="text-xs font-mono text-white/40">STEP {i + 1} · {s.w}</p>
            <p className="mt-1 text-2xl font-black" style={{ color: s.c }}>
              {s.e} {s.t}
            </p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-white/75">
              {s.items.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-4">
        {[
          ["🔒", "PHI & HIPAA", "Use an LLM vendor that signs a BAA and send only the minimum necessary PHI. This demo uses synthetic data only."],
          ["🧑‍⚕️", "Human accountability", "Automation may approve or ask for more information. Adverse decisions are signed by a clinician."],
          ["🧾", "Audit everything", "Log each MCP call, A2A message, retrieved chunk and model version for every decision."],
          ["📏", "Measure", "Turnaround time, first-pass approval rate, pend rate, overturn rate, staff hours saved."],
        ].map(([e, t, d]) => (
          <div key={t} className="glass rounded-xl p-4 text-sm">
            <p className="font-semibold">
              {e} {t}
            </p>
            <p className="mt-1 text-white/60">{d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
