/**
 * Prior-authorization agent network (LangGraph) that combines all three patterns:
 *
 *   RAG  → Payer agent retrieves the relevant medical-policy sections (knowledge)
 *   MCP  → each agent reaches its OWN systems: Provider → EHR server, Payer → core-admin server (tools/data)
 *   A2A  → Provider agent ⇄ Payer agent across the organisation boundary (collaboration)
 *
 *  provider_gather ─► a2a_submit ─► payer_intake ─► payer_rag ─► payer_review ─┬─► decide
 *                                                       ▲                       ├─► provider_supplement ─┘(round 2)
 *                                                       └───────────────────────┤
 *                                                                               └─► human_review ⏸ ─► decide
 */
import { Annotation, Command, END, interrupt, MemorySaver, START, StateGraph } from "@langchain/langgraph";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { CASES, Criterion, PACase } from "./data";
import { connectMcp, WireLog } from "./mcp";
import { Hit, retrieve } from "./rag";
import { llmFromConfig, stripThinking, textOf } from "../llm";

export type Actor = "provider" | "ehr" | "payer" | "payerdb" | "policies" | "reviewer";
export type Protocol = "mcp" | "a2a" | "rag" | "agent" | "human";
export interface HCEvent {
  id: string;
  ts: number;
  protocol: Protocol;
  from: Actor;
  to: Actor;
  title: string;
  text: string;
  state?: string;
  detail?: unknown;
}
export type Assessment = { criteria: Criterion[]; summary: string; decision: "approve" | "pend" | "review" };
type Review = { decision: "approve" | "deny"; reviewer: string; note?: string };

const PAState = Annotation.Root({
  caseId: Annotation<string>,
  contextId: Annotation<string>,
  taskId: Annotation<string>,
  round: Annotation<number>,
  events: Annotation<HCEvent[]>({ reducer: (a, b) => a.concat(b), default: () => [] }),
  evidence: Annotation<string[]>,
  hits: Annotation<Hit[]>,
  assessment: Annotation<Assessment | undefined>,
  review: Annotation<Review | undefined>,
  determination: Annotation<{ status: "approved" | "denied"; authNumber?: string; letter: string } | undefined>,
});
type S = typeof PAState.State;

let n = 0;
const uid = (p: string) => `${p}-${Date.now().toString(36)}${(n++).toString(36)}`;
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const caseOf = (s: S): PACase => CASES.find((c) => c.id === s.caseId) ?? CASES[0];
const E = (e: Omit<HCEvent, "id" | "ts">): HCEvent => ({ id: uid("ev"), ts: Date.now(), ...e });

async function llmText(config: LangGraphRunnableConfig, system: string, user: string, fallback: string) {
  const llm = llmFromConfig(config, { temperature: 0.3 });
  if (!llm) {
    await pause(500);
    return fallback;
  }
  const r = await llm.invoke([new SystemMessage(system), new HumanMessage(user)]);
  return stripThinking(textOf(r.content)) || fallback;
}

/** Groups captured MCP wire traffic into one UI event per JSON-RPC exchange. */
function mcpEvents(wire: WireLog[], from: Actor, to: Actor): HCEvent[] {
  const out: HCEvent[] = [];
  for (const w of wire) {
    const m = w.message as { id?: number; method?: string; params?: { name?: string; arguments?: unknown } };
    if (w.dir !== "→ request") continue;
    const resp = wire.find((x) => x.dir === "← response" && (x.message as { id?: number }).id === m.id && m.id !== undefined);
    const method = m.method ?? "";
    const label =
      method === "tools/call" ? `tools/call · ${m.params?.name}` : method === "notifications/initialized" ? "initialized" : method;
    const text =
      method === "initialize"
        ? "Handshake: protocol version + capabilities exchanged"
        : method === "tools/list"
          ? `Discovered tools: ${((resp?.message as { result?: { tools?: { name: string }[] } })?.result?.tools ?? []).map((t) => t.name).join(", ")}`
          : method === "tools/call"
            ? `Args ${JSON.stringify(m.params?.arguments)}`
            : "Client ready";
    out.push(E({ protocol: "mcp", from, to, title: label, text, detail: { request: w.message, response: resp?.message ?? null } }));
  }
  return out;
}

// ───────────────────────── provider side ─────────────────────────

async function providerGather(s: S, config: LangGraphRunnableConfig) {
  const c = caseOf(s);
  const wire: WireLog[] = [];
  const ehr = await connectMcp("ehr", (w) => wire.push(w));
  await ehr.client.listTools();
  const patient = await ehr.call("get_patient_summary", { mrn: c.patient.mrn });
  const notes = await ehr.call("get_clinical_notes", { mrn: c.patient.mrn, service: c.service.code });
  await ehr.close();
  const evidence: string[] = (notes.entry ?? []).map((e: { text: string }) => e.text);
  const summary = await llmText(
    config,
    "You are the Provider prior-auth agent at a clinic. Write a 2-sentence clinical justification for a prior-auth request using ONLY the facts given. No preamble.",
    `Patient: ${JSON.stringify(patient)}\nService: ${c.service.name} (${c.service.codeSystem} ${c.service.code})\nNotes:\n${evidence.join("\n")}`,
    `${c.patient.name}, ${c.patient.age}${c.patient.sex}, requires ${c.service.name} for ${c.diagnosis.map((d) => d.text).join(", ")}. Supporting notes attached from the EHR.`,
  );
  return {
    evidence,
    events: [
      E({ protocol: "agent", from: "provider", to: "provider", title: "New order detected", text: `${c.provider.name} ordered ${c.service.name}. Plan requires prior auth, so the agent assembles the case.` }),
      ...mcpEvents(wire, "provider", "ehr"),
      E({ protocol: "agent", from: "provider", to: "provider", title: "Clinical justification drafted", text: summary }),
    ],
  };
}

function a2aSubmit(s: S) {
  const c = caseOf(s);
  const taskId = uid("task");
  const envelope = {
    jsonrpc: "2.0",
    id: uid("rpc"),
    method: "message/send",
    params: {
      message: {
        role: "user",
        messageId: uid("msg"),
        contextId: s.contextId,
        parts: [
          { kind: "text", text: `Prior authorization request: ${c.service.name}` },
          {
            kind: "data",
            data: {
              resourceType: "Claim",
              use: "preauthorization",
              patient: { memberId: c.patient.memberId, name: c.patient.name },
              provider: { npi: c.provider.npi, name: c.provider.name },
              item: { code: c.service.code, system: c.service.codeSystem, display: c.service.name },
              diagnosis: c.diagnosis,
              priority: c.urgency,
              supportingInfo: s.evidence,
            },
          },
        ],
      },
      metadata: { skill: "prior-authorization", profile: "Da Vinci PAS-inspired" },
    },
  };
  return {
    taskId,
    round: 1,
    events: [
      E({ protocol: "a2a", from: "provider", to: "payer", title: "message/send · PA request", text: `Sent request + ${s.evidence.length} clinical documents to Sunrise Health Plan's PA agent (discovered via its Agent Card).`, state: "submitted", detail: envelope }),
    ],
  };
}

async function providerSupplement(s: S) {
  const c = caseOf(s);
  const missing = s.assessment!.criteria.filter((x) => !x.met).map((x) => x.criterion);
  const wire: WireLog[] = [];
  const ehr = await connectMcp("ehr", (w) => wire.push(w));
  const found = await ehr.call("search_additional_documentation", { mrn: c.patient.mrn, requested: missing });
  await ehr.close();
  const docs: string[] = found.documents ?? [];
  const reply = {
    jsonrpc: "2.0",
    id: uid("rpc"),
    method: "message/send",
    params: {
      message: {
        role: "user",
        messageId: uid("msg"),
        taskId: s.taskId,
        contextId: s.contextId,
        parts: docs.length
          ? [{ kind: "text", text: "Additional documentation attached." }, { kind: "data", data: { documents: docs } }]
          : [{ kind: "text", text: "No additional documentation found in the chart." }],
      },
    },
  };
  return {
    round: 2,
    evidence: [...s.evidence, ...docs],
    events: [
      ...mcpEvents(wire, "provider", "ehr").filter((e) => e.title.startsWith("tools/call")),
      E({
        protocol: "a2a",
        from: "provider",
        to: "payer",
        title: "message/send · reply on same task",
        text: docs.length ? `Found ${docs.length} documents in the chart and replied on task ${s.taskId}.` : "Searched the chart; nothing more to send.",
        state: "working",
        detail: reply,
      }),
    ],
  };
}

// ───────────────────────── payer side ─────────────────────────

async function payerIntake(s: S) {
  const c = caseOf(s);
  const wire: WireLog[] = [];
  const db = await connectMcp("payer", (w) => wire.push(w));
  await db.client.listTools();
  const elig = await db.call("check_eligibility", { memberId: c.patient.memberId });
  const ben = await db.call("check_benefit", { code: c.service.code });
  await db.close();
  return {
    events: [
      E({ protocol: "a2a", from: "payer", to: "provider", title: "status-update", text: "Request received. Task created and working.", state: "working", detail: { jsonrpc: "2.0", method: "tasks/statusUpdate", params: { taskId: s.taskId, contextId: s.contextId, status: { state: "working" } } } }),
      ...mcpEvents(wire, "payer", "payerdb"),
      E({ protocol: "agent", from: "payer", to: "payer", title: "Eligibility & benefit confirmed", text: `${elig.active ? "Active" : "INACTIVE"} on ${elig.plan}. Service covered: ${ben.covered ? "yes" : "no"}, PA required, governed by ${ben.policy}. Cost share ${ben.costShare}.` }),
    ],
  };
}

function payerRag(s: S) {
  const c = caseOf(s);
  const query = `${c.service.name} ${c.service.code} ${c.diagnosis.map((d) => d.text).join(" ")} ${c.policyHint}`;
  const hits = retrieve(query, 4);
  return {
    hits,
    events: [
      E({
        protocol: "rag",
        from: "payer",
        to: "policies",
        title: `Retrieved ${hits.length} policy chunks`,
        text: `Top match: ${hits[0]?.id} “${hits[0]?.title}” (score ${hits[0]?.score}).`,
        detail: { query, results: hits.map((h) => ({ id: h.id, score: h.score, text: h.text })) },
      }),
    ],
  };
}

async function payerReview(s: S, config: LangGraphRunnableConfig) {
  const c = caseOf(s);
  const llm = llmFromConfig(config, { temperature: 0 });
  let criteria: Criterion[] = (s.round >= 2 ? c.offline.round2 : undefined) ?? c.offline.round1;
  let summary = "";
  if (llm) {
    const policyText = s.hits.map((h) => `[${h.id}] ${h.title}: ${h.text}`).join("\n");
    const r = await llm.invoke([
      new SystemMessage(
        "You are a health-plan utilization-management agent. Evaluate the request ONLY against the retrieved policy text and the clinical evidence. " +
          "List each medical-necessity criterion from the applicable policy (2-4 criteria). Mark met=true only if the evidence explicitly supports it. " +
          'Respond with ONLY JSON: {"criteria":[{"criterion":"...","met":true,"evidence":"short quote or \'not documented\'","citation":"POL-XXX §n"}],"summary":"one sentence"}',
      ),
      new HumanMessage(`Requested: ${c.service.name} (${c.service.codeSystem} ${c.service.code}); Dx: ${c.diagnosis.map((d) => `${d.code} ${d.text}`).join("; ")}\n\nRETRIEVED POLICY:\n${policyText}\n\nCLINICAL EVIDENCE:\n${s.evidence.map((e) => `- ${e}`).join("\n")}`),
    ]);
    try {
      const parsed = JSON.parse(stripThinking(textOf(r.content)).match(/\{[\s\S]*\}/)?.[0] ?? "");
      if (Array.isArray(parsed.criteria) && parsed.criteria.length) {
        criteria = parsed.criteria.map((x: Criterion) => ({ criterion: String(x.criterion), met: x.met === true, evidence: String(x.evidence ?? ""), citation: String(x.citation ?? "") }));
        summary = String(parsed.summary ?? "");
      }
    } catch {
      /* fall back to scripted assessment */
    }
  } else await pause(700);

  const allMet = criteria.every((x) => x.met);
  // Guardrail in code, not in the prompt: automation may approve or pend, never deny.
  const decision: Assessment["decision"] = allMet ? "approve" : s.round < 2 ? "pend" : "review";
  const missing = criteria.filter((x) => !x.met);
  summary ||= allMet ? "All policy criteria are met." : `${missing.length} of ${criteria.length} criteria not met.`;

  const events: HCEvent[] = [
    E({ protocol: "agent", from: "payer", to: "payer", title: `Criteria check (round ${s.round})`, text: `${criteria.filter((x) => x.met).length}/${criteria.length} criteria met. ${summary}`, detail: criteria }),
  ];
  if (decision === "pend") {
    events.push(
      E({
        protocol: "a2a",
        from: "payer",
        to: "provider",
        title: "status-update · input-required",
        text: `Pended, not denied. Requested: ${missing.map((m) => m.criterion).join("; ")}.`,
        state: "input-required",
        detail: { jsonrpc: "2.0", method: "tasks/statusUpdate", params: { taskId: s.taskId, contextId: s.contextId, final: false, status: { state: "input-required", message: { role: "agent", parts: [{ kind: "text", text: "Additional documentation required" }, { kind: "data", data: { missing } }] } } } },
      }),
    );
  }
  if (decision === "review") {
    events.push(E({ protocol: "agent", from: "payer", to: "reviewer", title: "Routed to physician reviewer", text: "Criteria still not met. Policy POL-ADM-001 §2 forbids automated denials, so the case is queued for a Medical Director." }));
  }
  return { assessment: { criteria, summary, decision }, events };
}

function humanReview(s: S) {
  const a = s.assessment!;
  const r = interrupt({ question: `Medical Director review: ${caseOf(s).service.name} for ${caseOf(s).patient.name}`, criteria: a.criteria, summary: a.summary }) as Review;
  return {
    review: r,
    events: [E({ protocol: "human", from: "reviewer", to: "payer", title: r.decision === "approve" ? "Physician override: approve" : "Physician upholds denial", text: `${r.reviewer}${r.note ? `: “${r.note}”` : ""}` })],
  };
}

async function determination(s: S, config: LangGraphRunnableConfig) {
  const c = caseOf(s);
  const approved = s.assessment!.decision === "approve" || s.review?.decision === "approve";
  const authNumber = approved ? `PA-2026-${Math.floor(100000 + Math.random() * 899999)}` : undefined;
  const unmet = s.assessment!.criteria.filter((x) => !x.met);
  const letter = await llmText(
    config,
    "You write concise prior-authorization determination notices for a health plan (max 90 words, plain language, no greeting/sign-off). For denials: state the specific unmet criteria with policy citations, and mention appeal rights and peer-to-peer option.",
    `Member: ${c.patient.name}. Service: ${c.service.name}. Decision: ${approved ? `APPROVED, auth ${authNumber}, valid 90 days` : "DENIED"}. ${s.review ? `Reviewed by ${s.review.reviewer}.` : "Auto-approved: all criteria met."} Unmet criteria: ${unmet.map((u) => `${u.criterion} (${u.citation})`).join("; ") || "none"}.`,
    approved
      ? `${c.service.name} for ${c.patient.name} is APPROVED (auth ${authNumber}, valid 90 days). All criteria in ${s.hits[0]?.policyId} were met${s.review ? ` per physician review by ${s.review.reviewer}` : ""}.`
      : `${c.service.name} for ${c.patient.name} is DENIED. Criteria not met: ${unmet.map((u) => `${u.criterion} (${u.citation})`).join("; ")}. You may appeal within 60 days or request a peer-to-peer discussion with the reviewing physician.`,
  );
  const state = approved ? "completed" : "rejected";
  return {
    determination: { status: approved ? ("approved" as const) : ("denied" as const), authNumber, letter },
    events: [
      E({
        protocol: "a2a",
        from: "payer",
        to: "provider",
        title: `artifact · determination (${state})`,
        text: letter,
        state,
        detail: { jsonrpc: "2.0", id: uid("rpc"), result: { kind: "task", id: s.taskId, contextId: s.contextId, status: { state }, artifacts: [{ artifactId: uid("art"), name: "PA determination", parts: [{ kind: "data", data: { status: approved ? "approved" : "denied", authNumber, criteria: s.assessment!.criteria } }, { kind: "text", text: letter }] }] } },
      }),
      E({ protocol: "agent", from: "provider", to: "provider", title: approved ? "Scheduled & patient notified" : "Care team alerted", text: approved ? `Auth ${authNumber} written back to the EHR; scheduling notified; patient message sent.` : "Denial filed to the chart; appeal and peer-to-peer options queued for the physician." }),
    ],
  };
}

// ───────────────────────── graph ─────────────────────────

function build() {
  const g = globalThis as unknown as { __paCkpt?: MemorySaver };
  return new StateGraph(PAState)
    .addNode("provider_gather", providerGather)
    .addNode("a2a_submit", a2aSubmit)
    .addNode("payer_intake", payerIntake)
    .addNode("payer_rag", payerRag)
    .addNode("payer_review", payerReview)
    .addNode("provider_supplement", providerSupplement)
    .addNode("human_review", humanReview)
    .addNode("decide", determination)
    .addEdge(START, "provider_gather")
    .addEdge("provider_gather", "a2a_submit")
    .addEdge("a2a_submit", "payer_intake")
    .addEdge("payer_intake", "payer_rag")
    .addEdge("payer_rag", "payer_review")
    .addConditionalEdges("payer_review", (s: S) => (s.assessment!.decision === "approve" ? "decide" : s.assessment!.decision === "pend" ? "provider_supplement" : "human_review"), [
      "decide",
      "provider_supplement",
      "human_review",
    ])
    .addEdge("provider_supplement", "payer_review")
    .addEdge("human_review", "decide")
    .addEdge("decide", END)
    .compile({ checkpointer: (g.__paCkpt ??= new MemorySaver()) });
}
let graph: ReturnType<typeof build> | undefined;
export const paGraph = () => (graph ??= build());
export { Command };
