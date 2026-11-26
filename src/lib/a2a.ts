// Shared A2A-flavoured types used by the factory simulation (server) and the UI (client).

export type AgentId =
  | "iot"
  | "orchestrator"
  | "diagnostics"
  | "inventory"
  | "supplier"
  | "scheduler"
  | "governance"
  | "human";

export type TaskState =
  | "submitted"
  | "working"
  | "input-required"
  | "completed"
  | "failed"
  | "canceled";

export type EventKind = "discovery" | "message" | "status" | "artifact" | "policy" | "hitl";

export interface A2AEvent {
  id: string;
  ts: number;
  from: AgentId;
  to: AgentId;
  kind: EventKind;
  state: TaskState;
  title: string;
  text: string;
  /** The wire-level JSON-RPC envelope as it would travel between agents. */
  envelope: unknown;
}

export interface AgentMeta {
  id: AgentId;
  name: string;
  short: string;
  emoji: string;
  org: string;
  stack: string;
  color: string; // tailwind-ish hex
  skills: string[];
  external?: boolean;
}

export const AGENTS: Record<AgentId, AgentMeta> = {
  iot: {
    id: "iot",
    name: "Edge IoT Monitor Agent",
    short: "IoT Monitor",
    emoji: "📡",
    org: "Plant OT Network",
    stack: "Python · edge runtime",
    color: "#22d3ee",
    skills: ["stream-telemetry", "detect-anomaly"],
  },
  orchestrator: {
    id: "orchestrator",
    name: "Plant Ops Orchestrator",
    short: "Orchestrator",
    emoji: "🧭",
    org: "Manufacturing HQ",
    stack: "LangGraph · TypeScript",
    color: "#a78bfa",
    skills: ["plan-response", "delegate-tasks", "issue-work-order"],
  },
  diagnostics: {
    id: "diagnostics",
    name: "OEM Diagnostics Agent",
    short: "Diagnostics",
    emoji: "🩺",
    org: "Machine OEM Cloud",
    stack: "CrewAI · Python",
    color: "#f472b6",
    skills: ["root-cause-analysis", "remaining-useful-life"],
    external: true,
  },
  inventory: {
    id: "inventory",
    name: "ERP Inventory Agent",
    short: "Inventory",
    emoji: "📦",
    org: "Corporate ERP",
    stack: "Semantic Kernel · .NET",
    color: "#fbbf24",
    skills: ["check-stock", "reserve-part"],
  },
  supplier: {
    id: "supplier",
    name: "Supplier Network Agent",
    short: "Supplier",
    emoji: "🚚",
    org: "Tier-1 Supplier (external)",
    stack: "Spring AI · Java",
    color: "#fb923c",
    skills: ["quote-part", "expedite-shipment"],
    external: true,
  },
  scheduler: {
    id: "scheduler",
    name: "MES Production Scheduler",
    short: "Scheduler",
    emoji: "🗓️",
    org: "Shop-floor MES",
    stack: "Google ADK · Python",
    color: "#34d399",
    skills: ["find-maintenance-window", "rebalance-lines"],
  },
  governance: {
    id: "governance",
    name: "Governance & Trust Agent",
    short: "Governance",
    emoji: "🛡️",
    org: "Risk & Compliance",
    stack: "Policy engine · OPA",
    color: "#f87171",
    skills: ["authorize-spend", "audit-trail", "safety-check"],
  },
  human: {
    id: "human",
    name: "Plant Manager (Human-in-the-loop)",
    short: "Plant Manager",
    emoji: "👩‍🏭",
    org: "Manufacturing HQ",
    stack: "Approval UI",
    color: "#e2e8f0",
    skills: ["approve", "reject"],
  },
};

export interface Scenario {
  id: string;
  title: string;
  emoji: string;
  asset: string;
  line: string;
  symptom: string;
  readings: Record<string, string>;
  part: string;
  partNumber: string;
  partCost: number;
  laborCost: number;
  rulHours: number;
  severity: "medium" | "high" | "critical";
}

export const SCENARIOS: Scenario[] = [
  {
    id: "spindle",
    title: "CNC spindle bearing wear",
    emoji: "⚙️",
    asset: "CNC-07 (5-axis machining centre)",
    line: "Line 2 · Gearbox housings",
    symptom: "Vibration RMS climbing for 6 hours, rising bearing temperature",
    readings: { "Vibration RMS": "11.2 mm/s (limit 7.1)", "Bearing temp": "78 °C (+14)", "Spindle load": "92 %" },
    part: "Angular-contact spindle bearing set",
    partNumber: "BRG-7014-P4",
    partCost: 3800,
    laborCost: 1100,
    rulHours: 72,
    severity: "high",
  },
  {
    id: "hydraulic",
    title: "Hydraulic press pressure drop",
    emoji: "💧",
    asset: "PRESS-03 (800 t stamping press)",
    line: "Line 1 · Body panels",
    symptom: "System pressure sagging under load, oil temperature creeping up",
    readings: { Pressure: "162 bar (nominal 210)", "Oil temp": "68 °C", "Cycle time": "+9 %" },
    part: "Main pump seal & valve kit",
    partNumber: "HYD-SK-210",
    partCost: 900,
    laborCost: 600,
    rulHours: 120,
    severity: "medium",
  },
  {
    id: "servo",
    title: "Welding robot servo overheat",
    emoji: "🤖",
    asset: "ROBOT-12 (6-axis welding robot)",
    line: "Line 3 · Chassis welding",
    symptom: "Axis-3 servo over-temperature alarms with rising current draw",
    readings: { "Servo temp": "96 °C (limit 85)", "Motor current": "+28 %", "Position error": "0.4 mm" },
    part: "Axis-3 servo motor with encoder",
    partNumber: "SRV-A3-4KW",
    partCost: 8200,
    laborCost: 1400,
    rulHours: 36,
    severity: "critical",
  },
];

export function agentCard(a: AgentMeta) {
  return {
    protocolVersion: "0.3.0",
    name: a.name,
    description: `${a.short} agent operated by ${a.org}`,
    url: `https://${a.id}.agents.acme-mfg.example/a2a/v1`,
    preferredTransport: "JSONRPC",
    version: "1.4.0",
    provider: { organization: a.org },
    capabilities: { streaming: true, pushNotifications: a.id !== "iot" },
    securitySchemes: a.external
      ? { oauth: { type: "oauth2", flows: { clientCredentials: { tokenUrl: "https://idp.example/token", scopes: {} } } }, mtls: { type: "mutualTLS" } }
      : { oidc: { type: "openIdConnect", openIdConnectUrl: "https://idp.acme-mfg.example/.well-known/openid-configuration" } },
    defaultInputModes: ["application/json", "text/plain"],
    defaultOutputModes: ["application/json", "text/plain"],
    skills: a.skills.map((s) => ({ id: s, name: s.replace(/-/g, " "), tags: [a.short.toLowerCase()] })),
  };
}
