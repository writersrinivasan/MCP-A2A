import { AgentCardExplorer, McpVsA2A, TaskLifecycle, TopologySwitcher, TrustStack } from "./Widgets";

function Module(props: {
  id: string;
  n: string;
  emoji: string;
  title: string;
  grad: string;
  lead: string;
  children: React.ReactNode;
  widget: React.ReactNode;
}) {
  return (
    <section id={props.id} className="scroll-mt-24 py-14">
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div>
          <div className="flex items-center gap-3">
            <span className={`grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br ${props.grad} text-2xl shadow-lg`}>{props.emoji}</span>
            <span className="font-mono text-sm text-white/40">MODULE {props.n}</span>
          </div>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight">{props.title}</h2>
          <p className="mt-3 text-lg leading-relaxed text-white/70">{props.lead}</p>
          <div className="mt-5 space-y-3 text-[15px] leading-relaxed text-white/75">{props.children}</div>
        </div>
        <div className="lg:pt-16">{props.widget}</div>
      </div>
    </section>
  );
}

function Pill({ c, children }: { c: string; children: React.ReactNode }) {
  return (
    <span className="mr-1.5 mb-1.5 inline-block rounded-lg px-2.5 py-1 text-xs font-semibold" style={{ background: c + "22", color: c }}>
      {children}
    </span>
  );
}

function Grid({ items }: { items: [string, string, string][] }) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {items.map(([e, t, d]) => (
        <div key={t} className="glass rounded-xl p-3">
          <p className="font-semibold text-white">
            {e} {t}
          </p>
          <p className="mt-1 text-sm text-white/65">{d}</p>
        </div>
      ))}
    </div>
  );
}

export function Modules() {
  return (
    <div id="learn" className="mx-auto max-w-7xl scroll-mt-20 divide-y divide-white/5 px-5">
      <Module
        id="m-fundamentals"
        n="01"
        emoji="📜"
        grad="from-cyan-400 to-sky-500"
        title="A2A communication fundamentals"
        lead="MCP gives an agent hands (tools and context). A2A gives agents colleagues: an open protocol for one agent to discover another, hand it a task and get results back, without seeing its internals."
        widget={
          <div className="space-y-4">
            <McpVsA2A />
            <TaskLifecycle />
          </div>
        }
      >
        <Grid
          items={[
            ["🪪", "Agent Card", "A JSON manifest at /.well-known/agent-card.json: name, endpoint, skills, auth schemes, capabilities."],
            ["📋", "Task", "The unit of work, with an id, a contextId and a lifecycle state. Tasks can be short or run for days."],
            ["💬", "Message & Parts", "Turns between client and remote agent. Parts are typed: text, file or structured data."],
            ["📦", "Artifact", "The output a task produces, such as a report, a quote or a file. It is also made of Parts."],
          ]}
        />
        <p>
          <b className="text-white">Transport:</b> JSON-RPC 2.0 over HTTPS (gRPC and HTTP+JSON bindings also exist), with{" "}
          <b className="text-cyan-300">SSE streaming</b> for live updates and <b className="text-cyan-300">push notifications</b> (webhooks) for
          long-running work. It is open source under the Linux Foundation, and the spec is still evolving, so check the current version.
        </p>
      </Module>

      <Module
        id="m-interop"
        n="02"
        emoji="🔌"
        grad="from-violet-400 to-indigo-500"
        title="Interoperability across platforms & ecosystems"
        lead="Agents are opaque. A LangGraph agent never needs to know that its peer runs on CrewAI, .NET or Java. It only needs the peer's Agent Card and a shared protocol."
        widget={<AgentCardExplorer />}
      >
        <div>
          {[
            ["LangGraph", "#a78bfa"],
            ["CrewAI", "#f472b6"],
            ["Google ADK", "#34d399"],
            ["Semantic Kernel", "#fbbf24"],
            ["AutoGen", "#22d3ee"],
            ["Spring AI", "#fb923c"],
            ["Bedrock Agents", "#f87171"],
            ["Custom HTTP", "#e2e8f0"],
          ].map(([n, c]) => (
            <Pill key={n} c={c}>
              {n}
            </Pill>
          ))}
        </div>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <b className="text-white">Discovery:</b> fetch Agent Cards from well-known URLs or an enterprise registry, then choose by skill and tag.
          </li>
          <li>
            <b className="text-white">Negotiation:</b> agree on input and output modes (text, JSON, files) per request.
          </li>
          <li>
            <b className="text-white">Opacity:</b> no shared memory, prompts or tools are exposed. That protects IP and limits the blast radius.
          </li>
          <li>
            <b className="text-white">A2A + MCP:</b> each agent uses MCP internally for its tools and A2A externally to talk to peers.
          </li>
          <li>
            <b className="text-white">Versioning:</b> version the Agent Card and skills; keep breaking changes behind new skill ids.
          </li>
        </ul>
      </Module>

      <Module
        id="m-networks"
        n="03"
        emoji="🕸️"
        grad="from-fuchsia-400 to-pink-500"
        title="Building connected enterprise agent networks"
        lead="Once you have dozens of agents across business units and partners, you need the same plumbing that microservices needed: a registry, a gateway, observability and reliability patterns."
        widget={<TopologySwitcher />}
      >
        <Grid
          items={[
            ["📇", "Agent registry", "A catalog of approved agents, their owners, cards, versions and SLAs. It is the 'service mesh' for agents."],
            ["🚪", "Agent gateway", "One entry point for auth, rate limits, routing, payload inspection and policy enforcement."],
            ["🧵", "Tracing", "Propagate W3C traceparent through every hop so a single request is traceable across 6+ agents."],
            ["♻️", "Reliability", "Idempotent tasks, retries with backoff, timeouts, dead-letter handling, and resumable long-running tasks."],
          ]}
        />
      </Module>

      <Module
        id="m-collab"
        n="04"
        emoji="🤝"
        grad="from-amber-300 to-orange-500"
        title="Enabling seamless collaboration between agents"
        lead="Collaboration is more than calling an API. Agents delegate, fan out work in parallel, negotiate, ask for clarification and hand off to humans."
        widget={
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["🎯", "Delegation", "Orchestrator → specialist with a clear task and expected artifact.", "#22d3ee"],
              ["🔀", "Parallel fan-out / fan-in", "Ask several agents at once and merge their results. The demo runs Diagnostics ∥ Inventory.", "#a78bfa"],
              ["🤝", "Negotiation", "Buyer agent ↔ supplier agent exchange quotes and constraints across companies.", "#f472b6"],
              ["❓", "Clarification", "Remote agent returns input-required; the client supplies missing details on the same task.", "#fbbf24"],
              ["🧑‍💼", "Human handoff", "Escalate to an accountable person, then resume. The work is paused, not lost.", "#34d399"],
              ["⏳", "Long-running", "Push notifications for tasks that take hours (shipping, approvals, batch jobs).", "#fb923c"],
            ].map(([e, t, d, c]) => (
              <div key={t} className="glass rounded-2xl p-4" style={{ borderColor: c + "55" }}>
                <p className="text-2xl">{e}</p>
                <p className="mt-2 font-semibold" style={{ color: c }}>
                  {t}
                </p>
                <p className="mt-1 text-sm text-white/65">{d}</p>
              </div>
            ))}
          </div>
        }
      >
        <p>
          A useful mental model: <b className="text-white">MCP is how an employee uses their software; A2A is how employees email each other a work request</b>, including
          follow-up questions, status updates and the final deliverable.
        </p>
        <p>
          Design every agent with a <b className="text-amber-300">narrow, well-described skill set</b>. Small, composable agents with crisp contracts are easier to
          reuse, test, secure and replace than one giant agent.
        </p>
      </Module>

      <Module
        id="m-governance"
        n="05"
        emoji="🛡️"
        grad="from-rose-400 to-red-500"
        title="Governance, security & trust"
        lead="When agents act on each other's requests, trust becomes the product. Every hop needs identity, authorization, policy, auditability and a human escape hatch."
        widget={<TrustStack />}
      >
        <p className="font-semibold text-white">Top multi-agent risks to design for:</p>
        <Grid
          items={[
            ["💉", "Cross-agent prompt injection", "A peer's response contains instructions. Treat all peer output as untrusted data."],
            ["🎭", "Agent impersonation", "A fake agent card or endpoint. Use signed cards, mTLS and registry allow-lists."],
            ["📈", "Privilege escalation", "Agent A uses Agent B's broader rights. Use scoped, delegated, short-lived tokens."],
            ["🌀", "Runaway loops & cost", "Agents ping-pong forever. Set hop limits, budgets, timeouts and circuit breakers."],
          ]}
        />
      </Module>

      <Module
        id="m-usecases"
        n="06"
        emoji="🏭"
        grad="from-emerald-300 to-teal-500"
        title="Real-world use cases driving enterprise AI"
        lead="The value shows up where work crosses team, system and company boundaries, exactly where single agents get stuck."
        widget={
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["🏭", "Smart manufacturing", "Predictive maintenance across IoT, OEM, ERP, MES and suppliers.", "Downtime ↓ 30–50%", "#34d399", true],
              ["🚢", "Supply chain", "Demand, procurement and logistics agents re-plan around disruptions.", "Lead time ↓", "#22d3ee", false],
              ["🏦", "Banking KYC / AML", "Onboarding agent ↔ sanctions, credit and fraud agents.", "Onboarding days → hours", "#a78bfa", false],
              ["🏥", "Healthcare prior auth", "Provider agent ↔ payer agent exchange evidence and decisions.", "Admin cost ↓", "#f472b6", false],
              ["🖥️", "IT operations", "Monitoring → triage → remediation → change-approval agents.", "MTTR ↓", "#fbbf24", false],
              ["👋", "HR onboarding", "HR, IT, facilities and payroll agents provision a new hire.", "Day-1 ready", "#fb923c", false],
            ].map(([e, t, d, kpi, c, live]) => (
              <div key={t as string} className="glass relative rounded-2xl p-4">
                {live && (
                  <a href="#usecase" className="absolute right-3 top-3 rounded-full bg-emerald-400 px-2 py-0.5 text-[10px] font-bold text-black">
                    LIVE DEMO ↓
                  </a>
                )}
                <p className="text-2xl">{e}</p>
                <p className="mt-2 font-semibold">{t}</p>
                <p className="mt-1 text-sm text-white/65">{d}</p>
                <p className="mt-2 text-xs font-semibold" style={{ color: c as string }}>
                  {kpi}
                </p>
              </div>
            ))}
          </div>
        }
      >
        <p>
          Pick use cases with three properties: <b className="text-white">several systems of record</b>, <b className="text-white">clear hand-offs</b> between
          teams or companies, and <b className="text-white">measurable outcomes</b> (downtime, cycle time, cost per case).
        </p>
        <p>
          Start with one orchestrated workflow, put governance in from day one, then grow into a network as more teams publish agents to the registry.
        </p>
        <p className="text-xs text-white/45">KPI ranges are typical industry-reported figures, not guarantees.</p>
      </Module>
    </div>
  );
}
