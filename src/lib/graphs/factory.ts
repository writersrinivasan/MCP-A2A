/**
 * Smart-factory predictive-maintenance network, modelled as a LangGraph StateGraph.
 *
 * Each node plays one independently-owned agent. Nodes "talk" by emitting A2A-style
 * JSON-RPC envelopes (message/send, task status updates, artifacts) so the UI can show
 * what would travel over the wire between agents from different vendors/frameworks.
 *
 *   iot ─► orchestrator_plan ─┬─► diagnostics ─┐
 *                             └─► inventory  ──┴─► route ─► (supplier?) ─► scheduler ─► governance ─► (human?) ─► work_order
 *
 * With a Groq key the agents reason with an LLM; without one they run a scripted offline demo.
 */
import { Annotation, Command, END, interrupt, MemorySaver, START, StateGraph } from "@langchain/langgraph";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { A2AEvent, AGENTS, AgentId, agentCard, Scenario, SCENARIOS, TaskState, EventKind } from "../a2a";
import { llmFromConfig, stripThinking, textOf } from "../llm";

type Diagnosis = { summary: string; cost: number };
type Inventory = { available: boolean; location: string; qty: number };
type SupplierQuote = { vendor: string; price: number; etaHours: number; expedite: number };
type Schedule = { window: string; impact: string };
type Governance = { decision: "auto-approved" | "escalated"; totalCost: number; reasons: string[] };
type Approval = { approved: boolean; approver: string; note?: string };

const FactoryState = Annotation.Root({
  scenarioId: Annotation<string>,
  budgetLimit: Annotation<number>,
  partInStock: Annotation<boolean>,
  contextId: Annotation<string>,
  events: Annotation<A2AEvent[]>({ reducer: (a, b) => a.concat(b), default: () => [] }),
  diagnosis: Annotation<Diagnosis | undefined>,
  stock: Annotation<Inventory | undefined>,
  quote: Annotation<SupplierQuote | undefined>,
  schedule: Annotation<Schedule | undefined>,
  policy: Annotation<Governance | undefined>,
  approval: Annotation<Approval | undefined>,
  workOrder: Annotation<string | undefined>,
});
type S = typeof FactoryState.State;

const scenarioOf = (s: S): Scenario => SCENARIOS.find((x) => x.id === s.scenarioId) ?? SCENARIOS[0];
const usd = (n: number) => `$${n.toLocaleString("en-US")}`;
let seq = 0;
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`;
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Builds one A2A event with a realistic JSON-RPC 2.0 envelope. */
function ev(
  s: S,
  from: AgentId,
  to: AgentId,
  kind: EventKind,
  state: TaskState,
  title: string,
  text: string,
  data?: Record<string, unknown>,
): A2AEvent {
  const taskId = uid("task");
  const parts: unknown[] = [{ kind: "text", text }];
  if (data) parts.push({ kind: "data", data });
  let envelope: unknown;
  if (kind === "discovery") {
    envelope = { request: `GET https://${to}.agents.acme-mfg.example/.well-known/agent-card.json`, response: agentCard(AGENTS[to]) };
  } else if (kind === "artifact") {
    envelope = {
      jsonrpc: "2.0",
      id: uid("rpc"),
      result: {
        kind: "task",
        id: taskId,
        contextId: s.contextId,
        status: { state, timestamp: new Date().toISOString() },
        artifacts: [{ artifactId: uid("art"), name: title, parts }],
      },
    };
  } else if (kind === "status" || kind === "hitl") {
    envelope = {
      jsonrpc: "2.0",
      method: "tasks/statusUpdate",
      params: { kind: "status-update", taskId, contextId: s.contextId, final: state !== "input-required", status: { state, message: { role: "agent", parts } } },
    };
  } else {
    envelope = {
      jsonrpc: "2.0",
      id: uid("rpc"),
      method: "message/send",
      params: {
        message: { role: "user", messageId: uid("msg"), contextId: s.contextId, parts },
        configuration: { acceptedOutputModes: ["application/json", "text/plain"], blocking: false },
        metadata: { sender: AGENTS[from].name, traceparent: `00-${s.contextId.replace(/\W/g, "").padEnd(32, "0").slice(0, 32)}-${Math.random().toString(16).slice(2, 18).padEnd(16, "0")}-01` },
      },
    };
  }
  return { id: uid("ev"), ts: Date.now(), from, to, kind, state, title, text, envelope };
}

/** Ask the agent's LLM for a short in-character reply; fall back to scripted text offline. */
async function think(config: LangGraphRunnableConfig, agent: AgentId, task: string, fallback: string) {
  const llm = llmFromConfig(config, { temperature: 0.5 });
  if (!llm) {
    await pause(650);
    return fallback;
  }
  const meta = AGENTS[agent];
  const res = await llm.invoke([
    new SystemMessage(
      `You are the "${meta.name}", an autonomous agent run by ${meta.org} (built on ${meta.stack}) inside an enterprise A2A agent network for a car-parts manufacturer. ` +
        `Reply in-character to the peer agent in 2-3 crisp sentences (max 60 words). Use concrete industrial language. No markdown headings, no preamble, never invent different numbers than those given.`,
    ),
    new HumanMessage(task),
  ]);
  return stripThinking(textOf(res.content)) || fallback;
}

// ───────────────────────────── nodes ─────────────────────────────

async function iot(s: S, config: LangGraphRunnableConfig) {
  const sc = scenarioOf(s);
  const readings = Object.entries(sc.readings).map(([k, v]) => `${k}: ${v}`).join("; ");
  const text = await think(
    config,
    "iot",
    `Raise an anomaly alert to the Plant Ops Orchestrator. Asset ${sc.asset} on ${sc.line}. Symptom: ${sc.symptom}. Readings: ${readings}.`,
    `Anomaly on ${sc.asset}: ${sc.symptom.toLowerCase()}. Live readings — ${readings}. Requesting a coordinated maintenance response.`,
  );
  return {
    events: [ev(s, "iot", "orchestrator", "message", "submitted", "Anomaly alert", text, { asset: sc.asset, line: sc.line, readings: sc.readings, severity: sc.severity })],
  };
}

async function orchestratorPlan(s: S, config: LangGraphRunnableConfig) {
  const sc = scenarioOf(s);
  const discovery = (["diagnostics", "inventory", "supplier", "scheduler", "governance"] as AgentId[]).map((a) =>
    ev(s, "orchestrator", a, "discovery", "completed", `Discover ${AGENTS[a].short}`, `Fetched Agent Card for ${AGENTS[a].name} — skills: ${AGENTS[a].skills.join(", ")}.`),
  );
  const plan = await think(
    config,
    "orchestrator",
    `You received an anomaly alert for ${sc.asset} (${sc.symptom}). You discovered peer agents via their Agent Cards: Diagnostics, Inventory, Supplier, Scheduler, Governance. Announce your plan: you will ask Diagnostics and Inventory in parallel first.`,
    `Alert acknowledged. Discovered 5 peer agents via Agent Cards. Dispatching Diagnostics and Inventory in parallel; Scheduler and Governance follow once root cause and part availability are known.`,
  );
  return {
    events: [
      ...discovery,
      ev(s, "orchestrator", "iot", "status", "working", "Plan", plan),
      ev(s, "orchestrator", "diagnostics", "message", "submitted", "Diagnose asset", `Run root-cause analysis and remaining-useful-life estimate for ${sc.asset}.`, { readings: sc.readings }),
      ev(s, "orchestrator", "inventory", "message", "submitted", "Check spare part", `Check stock for parts likely needed on ${sc.asset}.`, { assetClass: sc.asset.split(" ")[0] }),
    ],
  };
}

async function diagnostics(s: S, config: LangGraphRunnableConfig) {
  const sc = scenarioOf(s);
  const summary = await think(
    config,
    "diagnostics",
    `Diagnose ${sc.asset}. Symptom: ${sc.symptom}. Readings: ${JSON.stringify(sc.readings)}. Conclude that the "${sc.part}" (${sc.partNumber}) needs replacement, severity ${sc.severity}, remaining useful life about ${sc.rulHours} hours. Give the likely root cause.`,
    `Pattern matches progressive degradation of the ${sc.part.toLowerCase()}. Severity ${sc.severity}; estimated remaining useful life ${sc.rulHours} h. Recommend replacing ${sc.partNumber} within the next planned window.`,
  );
  return {
    diagnosis: { summary, cost: sc.partCost + sc.laborCost },
    events: [
      ev(s, "diagnostics", "orchestrator", "status", "working", "Analysing", "Streaming vibration spectrum through OEM fleet model (14,200 similar machines)…"),
      ev(s, "diagnostics", "orchestrator", "artifact", "completed", "Diagnosis report", summary, {
        part: sc.part,
        partNumber: sc.partNumber,
        severity: sc.severity,
        remainingUsefulLifeHours: sc.rulHours,
        estimatedRepairCost: sc.partCost + sc.laborCost,
      }),
    ],
  };
}

async function inventory(s: S, config: LangGraphRunnableConfig) {
  const sc = scenarioOf(s);
  const inv: Inventory = s.partInStock
    ? { available: true, location: "Central stores, Bay C-14", qty: 2 }
    : { available: false, location: "—", qty: 0 };
  const text = await think(
    config,
    "inventory",
    `Report stock for ${sc.part} (${sc.partNumber}). Result: ${inv.available ? `${inv.qty} units at ${inv.location}; reserving one` : "zero on hand at all plants; recommend sourcing from the external supplier network"}.`,
    inv.available
      ? `${sc.partNumber} in stock: ${inv.qty} units at ${inv.location}. One unit reserved against this incident.`
      : `${sc.partNumber} is out of stock across all three plants. Recommend sourcing via the Supplier Network Agent.`,
  );
  return {
    stock: inv,
    events: [ev(s, "inventory", "orchestrator", "artifact", "completed", inv.available ? "Part reserved" : "Stock-out", text, { partNumber: sc.partNumber, ...inv })],
  };
}

function route(s: S) {
  return s.stock?.available ? "scheduler" : "supplier";
}

async function supplier(s: S, config: LangGraphRunnableConfig) {
  const sc = scenarioOf(s);
  const q: SupplierQuote = { vendor: "Precision Components Ltd.", price: Math.round(sc.partCost * 1.08), etaHours: 18, expedite: 450 };
  const ask = ev(s, "orchestrator", "supplier", "message", "submitted", "Request quote (cross-org)", `Request expedited quote for ${sc.partNumber}, qty 1, deliver to Plant 2. Authenticated with OAuth2 client-credentials over mTLS.`, { partNumber: sc.partNumber, qty: 1, incoterm: "DAP" });
  const text = await think(
    config,
    "supplier",
    `A customer agent requested an expedited quote for ${sc.part} (${sc.partNumber}). Your quote: ${usd(q.price)} plus ${usd(q.expedite)} express freight, delivery in ${q.etaHours} hours. Note you only share price/ETA, not your internal inventory systems.`,
    `Quote for ${sc.partNumber}: ${usd(q.price)} + ${usd(q.expedite)} express freight, ETA ${q.etaHours} h. Quote valid 4 h. Internal stock systems remain private to our organisation.`,
  );
  return {
    quote: q,
    events: [ask, ev(s, "supplier", "orchestrator", "artifact", "completed", "Quote", text, { ...q, validForHours: 4 })],
  };
}

async function scheduler(s: S, config: LangGraphRunnableConfig) {
  const sc = scenarioOf(s);
  const leadH = s.quote?.etaHours ?? 0;
  const window = leadH > 0 ? "Tomorrow 14:00–18:00 (after part arrival)" : "Tonight 22:00–02:00 (3rd shift changeover)";
  const impact = sc.severity === "critical" ? "Shift 210 units to Line 4; zero customer-order slip" : "Pull forward buffer stock; ~2 % daily output impact";
  const text = await think(
    config,
    "scheduler",
    `Find a maintenance window on ${sc.line} for replacing ${sc.part}. Part lead time ${leadH} h, remaining useful life ${sc.rulHours} h. Proposed window: ${window}. Production impact: ${impact}.`,
    `Maintenance window booked: ${window}. ${impact}. Window is within the ${sc.rulHours} h remaining-life budget.`,
  );
  return {
    schedule: { window, impact },
    events: [
      ev(s, "orchestrator", "scheduler", "message", "submitted", "Book window", `Need a ${sc.laborCost > 1000 ? 4 : 3} h stop on ${sc.line} before RUL expires (${sc.rulHours} h).`),
      ev(s, "scheduler", "orchestrator", "artifact", "completed", "Window booked", text, { window, impact }),
    ],
  };
}

async function governance(s: S, config: LangGraphRunnableConfig) {
  const sc = scenarioOf(s);
  const total = sc.partCost + sc.laborCost + (s.quote ? s.quote.price - sc.partCost + s.quote.expedite : 0);
  const reasons: string[] = [
    "✔ Caller identity verified (OIDC token, signed Agent Card)",
    "✔ Least-privilege scopes: maintenance:write, procurement:quote",
  ];
  if (s.quote) reasons.push("✔ External supplier on approved-vendor list; data shared limited to part no. & qty");
  const overBudget = total > s.budgetLimit;
  reasons.push(overBudget ? `✖ Spend ${usd(total)} exceeds autonomous limit ${usd(s.budgetLimit)}` : `✔ Spend ${usd(total)} within autonomous limit ${usd(s.budgetLimit)}`);
  if (sc.severity === "critical") reasons.push("⚠ Critical safety asset — lock-out/tag-out checklist attached");
  const decision: Governance["decision"] = overBudget ? "escalated" : "auto-approved";
  const text = await think(
    config,
    "governance",
    `Policy evaluation for a maintenance work order on ${sc.asset}, total cost ${usd(total)}, autonomous spend limit ${usd(s.budgetLimit)}. Decision: ${decision === "escalated" ? "ESCALATE to the human Plant Manager for approval" : "AUTO-APPROVE"}. Mention the audit trail entry.`,
    decision === "escalated"
      ? `Spend of ${usd(total)} exceeds the ${usd(s.budgetLimit)} autonomous limit. Escalating to the Plant Manager for approval. Decision trace written to the immutable audit log.`
      : `All policies pass; ${usd(total)} is within the ${usd(s.budgetLimit)} limit. Auto-approved and recorded in the immutable audit log.`,
  );
  return {
    policy: { decision, totalCost: total, reasons },
    events: [
      ev(s, "orchestrator", "governance", "message", "submitted", "Authorize work order", `Requesting authorization for ${usd(total)} maintenance action on ${sc.asset}.`, { totalCost: total }),
      ev(s, "governance", "orchestrator", "policy", decision === "escalated" ? "input-required" : "completed", decision === "escalated" ? "Escalated" : "Auto-approved", text, { decision, reasons, totalCost: total }),
    ],
  };
}

function afterGovernance(s: S) {
  return s.policy?.decision === "escalated" ? "human" : "work_order";
}

function human(s: S) {
  const g = s.policy!;
  // Pauses the graph. The UI shows an approval card; the run resumes with Command({ resume }).
  const decision = interrupt({
    question: `Approve ${usd(g.totalCost)} maintenance spend on ${scenarioOf(s).asset}?`,
    totalCost: g.totalCost,
    reasons: g.reasons,
  }) as Approval;
  return {
    approval: decision,
    events: [
      ev(
        s,
        "human",
        "governance",
        "hitl",
        decision.approved ? "completed" : "canceled",
        decision.approved ? "Human approved" : "Human rejected",
        `${decision.approver} ${decision.approved ? "approved" : "rejected"} the spend${decision.note ? `: “${decision.note}”` : "."}`,
        { ...decision },
      ),
    ],
  };
}

async function workOrder(s: S, config: LangGraphRunnableConfig) {
  const sc = scenarioOf(s);
  const rejected = s.approval && !s.approval.approved;
  const facts = [
    `Asset: ${sc.asset}`,
    `Diagnosis: ${s.diagnosis?.summary}`,
    `Part: ${sc.part} (${sc.partNumber}) — ${s.stock?.available ? `from ${s.stock.location}` : `from ${s.quote?.vendor}, ETA ${s.quote?.etaHours} h`}`,
    `Window: ${s.schedule?.window}; ${s.schedule?.impact}`,
    `Cost: ${usd(s.policy?.totalCost ?? 0)} — ${s.policy?.decision}${s.approval ? `, human ${s.approval.approved ? "approved" : "rejected"}` : ""}`,
  ].join("\n");
  const fallback = rejected
    ? `Work order WO-${sc.partNumber} placed ON HOLD after human rejection. Monitoring cadence raised to every 5 minutes; asset will be re-evaluated at the next shift review.`
    : `Work order WO-${sc.partNumber} released: replace ${sc.part} on ${sc.asset} during ${s.schedule?.window}. Technicians, parts and LOTO checklist dispatched; IoT Monitor will verify vibration/temperature after restart.`;
  const text = await think(
    config,
    "orchestrator",
    `Write the final ${rejected ? "ON-HOLD notice" : "work-order release"} summarising the collaboration of all agents, based only on these facts:\n${facts}`,
    fallback,
  );
  const state: TaskState = rejected ? "canceled" : "completed";
  return {
    workOrder: text,
    events: [
      ev(s, "orchestrator", "scheduler", "status", state, rejected ? "Hold" : "Dispatch crew", rejected ? "Releasing reserved maintenance window." : `Confirmed: ${s.schedule?.window}.`),
      ev(s, "orchestrator", "iot", "artifact", state, rejected ? "Work order on hold" : "Work order released", text, { workOrder: `WO-${sc.partNumber}`, totalCost: s.policy?.totalCost, status: state }),
    ],
  };
}

// ───────────────────────────── graph ─────────────────────────────

function build() {
  return new StateGraph(FactoryState)
    .addNode("iot", iot)
    .addNode("orchestrator_plan", orchestratorPlan)
    .addNode("diagnostics", diagnostics)
    .addNode("inventory", inventory)
    .addNode("join", () => ({}))
    .addNode("supplier", supplier)
    .addNode("scheduler", scheduler)
    .addNode("governance", governance)
    .addNode("human", human)
    .addNode("work_order", workOrder)
    .addEdge(START, "iot")
    .addEdge("iot", "orchestrator_plan")
    .addEdge("orchestrator_plan", "diagnostics") // fan-out: both run in parallel
    .addEdge("orchestrator_plan", "inventory")
    .addEdge(["diagnostics", "inventory"], "join") // fan-in: wait for both
    .addConditionalEdges("join", route, ["supplier", "scheduler"])
    .addEdge("supplier", "scheduler")
    .addEdge("scheduler", "governance")
    .addConditionalEdges("governance", afterGovernance, ["human", "work_order"])
    .addEdge("human", "work_order")
    .addEdge("work_order", END)
    .compile({ checkpointer: getCheckpointer() });
}

// The checkpointer lives in memory so a paused (interrupted) run can be resumed by a later request.
function getCheckpointer() {
  const g = globalThis as unknown as { __factoryCkpt?: MemorySaver };
  return (g.__factoryCkpt ??= new MemorySaver());
}

let graph: ReturnType<typeof build> | undefined;
export const factoryGraph = () => (graph ??= build());

export { Command };
export type { S as FactoryStateType };
