import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Guide, Roadmap } from "@/components/healthcare/Guide";
import { PADemo } from "@/components/healthcare/PADemo";
import { PolicyAsk } from "@/components/healthcare/PolicyAsk";

export const metadata: Metadata = {
  title: "Assignment 2 — Agentic prior authorization with RAG + MCP + A2A",
  description: "Healthcare payer/provider prior authorization using RAG, MCP and A2A together, built on LangGraph and Groq.",
};

export default function HealthcarePage() {
  return (
    <>
      <Header />
      <main>
        <section className="mx-auto max-w-7xl px-5 pb-6 pt-14">
          <span className="inline-flex items-center gap-2 rounded-full border border-pink-400/30 bg-pink-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-pink-200">
            🏥 Assignment 2 · Healthcare payer ⇄ provider
          </span>
          <h1 className="mt-5 text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl">
            Agentic <span className="text-rainbow">prior authorization</span>
            <span className="mt-2 block text-2xl font-bold text-white/85 sm:text-3xl">RAG + MCP + A2A, working together</span>
          </h1>
          <div className="mt-6 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
            <p className="text-lg leading-relaxed text-white/70">
              Healthcare offers many places to apply agentic AI. The one that hurts both sides most is <b className="text-white">prior authorization</b>: a clinic must
              prove to a health plan that a test, drug or procedure meets the plan&apos;s policy before the patient can get it. Today that means faxes, portals,
              phone calls and days of waiting. It&apos;s a natural fit for agents because it needs <b className="text-emerald-300">knowledge</b> (policies),{" "}
              <b className="text-cyan-300">system access</b> (EHR, eligibility) and <b className="text-amber-300">collaboration</b> between two companies.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["~39", "prior auths per physician per week", "#f472b6"],
                ["~13 h", "of physician & staff time per week", "#fbbf24"],
                ["2027", "CMS-0057-F prior-auth API deadline for impacted payers", "#22d3ee"],
                ["0", "denials issued by AI alone in this design", "#34d399"],
              ].map(([v, l, c]) => (
                <div key={l} className="glass rounded-2xl p-4">
                  <p className="text-3xl font-black" style={{ color: c }}>
                    {v}
                  </p>
                  <p className="mt-1 text-xs text-white/60">{l}</p>
                </div>
              ))}
              <p className="col-span-2 text-[11px] text-white/40">First two figures: AMA prior authorization physician survey (2024).</p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2 text-sm">
            {[
              ["#guide", "1 · Which one should I use?"],
              ["#demo", "2 · Live demo"],
              ["#ask", "3 · RAG policy Q&A"],
              ["#roadmap", "4 · Rollout roadmap"],
            ].map(([h, l]) => (
              <a key={h} href={h} className="glass rounded-xl px-4 py-2 font-semibold hover:bg-white/10">
                {l}
              </a>
            ))}
          </div>
        </section>
        <Guide />
        <PADemo />
        <PolicyAsk />
        <Roadmap />
      </main>
      <footer className="border-t border-white/5 py-8 text-center text-sm text-white/40">
        Synthetic patients, plan and policies, for education only. Not medical or coverage advice. MCP servers use the official SDK; A2A messages are
        protocol-shaped envelopes exchanged in-process.
      </footer>
    </>
  );
}
