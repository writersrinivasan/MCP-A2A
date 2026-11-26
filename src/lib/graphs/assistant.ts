/**
 * Workshop AI assistant: a small multi-agent LangGraph.
 * A router agent reads the question and hands it off to one specialist agent —
 * the same delegation pattern A2A enables across organisations, shown here in-process.
 *
 *   START ─► router ─► specialist ─► END
 */
import { Annotation, END, MessagesAnnotation, START, StateGraph } from "@langchain/langgraph";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { SystemMessage } from "@langchain/core/messages";
import { llmFromConfig, stripThinking, textOf } from "../llm";

export const SPECIALISTS = {
  protocol: {
    name: "A2A Protocol Expert",
    emoji: "📜",
    focus:
      "A2A fundamentals: Agent Cards (/.well-known/agent-card.json), tasks and task lifecycle (submitted, working, input-required, completed, failed, canceled), messages, parts (text/file/data), artifacts, JSON-RPC 2.0 over HTTP(S), SSE streaming, push notifications, and how A2A (agent↔agent, horizontal) complements MCP (agent↔tools/context, vertical).",
  },
  interop: {
    name: "Interoperability Architect",
    emoji: "🔌",
    focus:
      "Agent interoperability across platforms and frameworks (LangGraph, CrewAI, Google ADK, Semantic Kernel, AutoGen, Spring AI, Bedrock agents): opaque agents, capability discovery, content-type negotiation, versioning, adapters/gateways, and mixing A2A with MCP.",
  },
  network: {
    name: "Enterprise Network Designer",
    emoji: "🕸️",
    focus:
      "Building connected enterprise agent networks: agent registries/catalogs, topologies (hub-and-spoke orchestrator, mesh, hierarchical/supervisor), agent gateways, observability with OpenTelemetry trace propagation, reliability (retries, idempotency, long-running tasks), and scaling.",
  },
  governance: {
    name: "Trust & Governance Officer",
    emoji: "🛡️",
    focus:
      "Governance, security and trust in multi-agent environments: authentication (OAuth2/OIDC, mTLS), authorization and least privilege, signed Agent Cards, prompt-injection between agents, data boundaries and residency, human-in-the-loop approval, policy engines, audit trails, and regulation (EU AI Act, ISO 42001, NIST AI RMF).",
  },
  usecase: {
    name: "Industry Use-Case Strategist",
    emoji: "🏭",
    focus:
      "Real-world enterprise use cases and business value of agent networks: smart manufacturing predictive maintenance (the workshop's live demo: IoT Monitor → Orchestrator → OEM Diagnostics + ERP Inventory in parallel → external Supplier → MES Scheduler → Governance → human approval), supply chain, banking KYC, healthcare prior authorisation, IT operations, customer service, and ROI measurement.",
  },
} as const;
export type SpecialistId = keyof typeof SPECIALISTS;

const AssistantState = Annotation.Root({
  ...MessagesAnnotation.spec,
  route: Annotation<SpecialistId>,
  routeReason: Annotation<string>,
});

async function router(state: typeof AssistantState.State, config: LangGraphRunnableConfig) {
  const llm = llmFromConfig(config, { temperature: 0 })!;
  const last = textOf(state.messages[state.messages.length - 1]?.content);
  const options = Object.entries(SPECIALISTS)
    .map(([id, s]) => `- ${id}: ${s.focus.split(":")[0]}`)
    .join("\n");
  const res = await llm.invoke([
    new SystemMessage(
      `You are a router agent. Pick the single best specialist for the user's question.\nSpecialists:\n${options}\n\n` +
        `Respond ONLY with compact JSON: {"route":"<id>","reason":"<max 12 words>"}`,
    ),
    { role: "user", content: last },
  ]);
  const raw = stripThinking(textOf(res.content));
  let route: SpecialistId = "protocol";
  let reason = "Default to protocol fundamentals";
  try {
    const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? "{}");
    if (parsed.route in SPECIALISTS) route = parsed.route;
    if (typeof parsed.reason === "string") reason = parsed.reason;
  } catch {
    const hit = (Object.keys(SPECIALISTS) as SpecialistId[]).find((k) => raw.toLowerCase().includes(k));
    if (hit) route = hit;
  }
  return { route, routeReason: reason };
}

async function specialist(state: typeof AssistantState.State, config: LangGraphRunnableConfig) {
  const llm = llmFromConfig(config, { streaming: true, temperature: 0.5 })!;
  const sp = SPECIALISTS[state.route];
  const res = await llm.invoke([
    new SystemMessage(
      `You are the "${sp.name}" agent, a friendly expert co-host of the workshop "Beyond MCP: A2A, Agent Interoperability and Enterprise Agent Networks". ` +
        `Your speciality: ${sp.focus}\n\n` +
        `Answer for workshop participants (developers, architects, business leaders). Be accurate; if something is uncertain or evolving in the A2A spec, say so. ` +
        `Use short paragraphs, bullet points and small code/JSON snippets where they help. Keep answers under ~250 words unless asked for more. ` +
        `When relevant, connect the answer to the smart-factory demo on this page.`,
    ),
    ...state.messages.slice(-12),
  ]);
  return { messages: [res] };
}

let graph: ReturnType<typeof build> | undefined;
function build() {
  return new StateGraph(AssistantState)
    .addNode("router", router)
    .addNode("specialist", specialist)
    .addEdge(START, "router")
    .addEdge("router", "specialist")
    .addEdge("specialist", END)
    .compile();
}
export const assistantGraph = () => (graph ??= build());
