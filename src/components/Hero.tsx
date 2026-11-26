import Link from "next/link";

const AGENDA = [
  ["📜", "A2A communication fundamentals", "#m-fundamentals", "from-cyan-400 to-sky-500"],
  ["🔌", "Interoperability across platforms", "#m-interop", "from-violet-400 to-indigo-500"],
  ["🕸️", "Connected enterprise agent networks", "#m-networks", "from-fuchsia-400 to-pink-500"],
  ["🤝", "Seamless agent collaboration", "#m-collab", "from-amber-300 to-orange-500"],
  ["🛡️", "Governance, security & trust", "#m-governance", "from-rose-400 to-red-500"],
  ["🏭", "Real-world enterprise use cases", "#m-usecases", "from-emerald-300 to-teal-500"],
];

export function Hero() {
  return (
    <section id="top" className="relative mx-auto max-w-7xl px-5 pb-16 pt-14 sm:pt-20">
      <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-fuchsia-400/30 bg-fuchsia-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-fuchsia-200">
            ✨ Topic of the week
          </span>
          <h1 className="mt-5 text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
            Beyond <span className="text-rainbow">MCP</span>
            <span className="mt-2 block text-2xl font-bold text-white/85 sm:text-4xl">
              A2A, agent interoperability & enterprise agent networks
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/70">
            The future of AI isn&apos;t one super-agent. It&apos;s many agents from different teams, vendors and frameworks that{" "}
            <b className="text-cyan-300">discover</b>, <b className="text-violet-300">delegate to</b> and{" "}
            <b className="text-pink-300">trust</b> each other across systems. Explore the concepts, then watch a live agent network
            run a factory&apos;s maintenance response.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a
              href="#usecase"
              className="rounded-2xl bg-gradient-to-r from-cyan-400 via-violet-500 to-pink-500 px-5 py-3 font-semibold text-white shadow-lg shadow-violet-500/30 hover:brightness-110"
            >
              ▶ Run the smart-factory demo
            </a>
            <a href="#learn" className="glass rounded-2xl px-5 py-3 font-semibold hover:bg-white/10">
              Start learning
            </a>
          </div>
          <Link
            href="/healthcare"
            className="mt-6 flex max-w-xl items-center gap-3 rounded-2xl border border-pink-400/30 bg-pink-400/10 p-3 transition hover:bg-pink-400/20"
          >
            <span className="text-3xl">🏥</span>
            <span className="text-sm">
              <b className="block text-pink-200">Assignment 2: Healthcare prior authorization</b>
              <span className="text-white/65">RAG + MCP + A2A combined in a payer ⇄ provider agent network →</span>
            </span>
          </Link>
        </div>

        <div className="border-rainbow glass p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/50">🔥 What&apos;s in store</p>
          <ul className="grid gap-2.5">
            {AGENDA.map(([emoji, label, href, grad], i) => (
              <li key={href}>
                <a href={href} className="group flex items-center gap-3 rounded-xl p-2 transition hover:bg-white/5">
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${grad} text-lg shadow-lg`}>{emoji}</span>
                  <span className="text-sm font-medium text-white/85 group-hover:text-white">
                    <span className="mr-1.5 font-mono text-white/40">0{i + 1}</span>
                    {label}
                  </span>
                  <span className="ml-auto text-white/30 transition group-hover:translate-x-1 group-hover:text-white/70">→</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
