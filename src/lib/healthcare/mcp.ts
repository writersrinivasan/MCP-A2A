/**
 * Two real MCP servers built with the official @modelcontextprotocol/sdk:
 *   • Provider EHR server (FHIR-style clinical data) — used by the Provider agent
 *   • Payer Core-Admin server (eligibility & benefits) — used by the Payer agent
 * They connect to MCP clients over an in-memory transport, and every JSON-RPC
 * message on the wire is captured so the UI can show the actual MCP protocol.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { BENEFITS, CASES, MEMBERS } from "./data";

const json = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] });

function ehrServer() {
  const s = new McpServer({ name: "provider-ehr-fhir", version: "1.0.0" });
  s.registerTool(
    "get_patient_summary",
    {
      description: "Return demographics, coverage and active problems for a patient (FHIR Patient + Condition).",
      inputSchema: { mrn: z.string() },
    },
    async ({ mrn }) => {
      const c = CASES.find((x) => x.patient.mrn === mrn);
      if (!c) return { ...json({ error: "not found" }), isError: true };
      return json({
        resourceType: "Patient",
        id: c.patient.mrn,
        name: c.patient.name,
        age: c.patient.age,
        gender: c.patient.sex === "F" ? "female" : "male",
        coverage: { payer: "Sunrise Health Plan", memberId: c.patient.memberId },
        conditions: c.diagnosis,
      });
    },
  );
  s.registerTool(
    "get_clinical_notes",
    {
      description: "Return clinical notes relevant to a requested service (FHIR DocumentReference).",
      inputSchema: { mrn: z.string(), service: z.string() },
    },
    async ({ mrn }) => {
      const c = CASES.find((x) => x.patient.mrn === mrn);
      return json({ resourceType: "Bundle", type: "searchset", entry: (c?.notes ?? []).map((n, i) => ({ id: `doc-${i + 1}`, text: n })) });
    },
  );
  s.registerTool(
    "search_additional_documentation",
    {
      description: "Search the full chart (problem list, referrals, program enrolments) for documentation the payer requested.",
      inputSchema: { mrn: z.string(), requested: z.array(z.string()) },
    },
    async ({ mrn }) => {
      const c = CASES.find((x) => x.patient.mrn === mrn);
      return json({ found: (c?.supplemental ?? []).length > 0, documents: c?.supplemental ?? [] });
    },
  );
  return s;
}

function payerServer() {
  const s = new McpServer({ name: "payer-core-admin", version: "1.0.0" });
  s.registerTool(
    "check_eligibility",
    { description: "Check member eligibility and plan (X12 270/271 equivalent).", inputSchema: { memberId: z.string() } },
    async ({ memberId }) => json(MEMBERS[memberId] ? { memberId, ...MEMBERS[memberId] } : { memberId, active: false }),
  );
  s.registerTool(
    "check_benefit",
    {
      description: "Check whether a service code is covered, needs prior authorization, and which medical policy applies.",
      inputSchema: { code: z.string() },
    },
    async ({ code }) => json({ code, ...(BENEFITS[code] ?? { covered: false, paRequired: false }) }),
  );
  return s;
}

export type WireLog = { dir: "→ request" | "← response"; message: JSONRPCMessage };

/** Connect an MCP client to one of the servers; returns the client plus a log of wire messages. */
export async function connectMcp(which: "ehr" | "payer", onWire: (w: WireLog) => void) {
  const server = which === "ehr" ? ehrServer() : payerServer();
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  const send = clientT.send.bind(clientT);
  clientT.send = async (m, o) => {
    onWire({ dir: "→ request", message: m });
    return send(m, o);
  };
  const serverSend = serverT.send.bind(serverT);
  serverT.send = async (m, o) => {
    onWire({ dir: "← response", message: m });
    return serverSend(m, o);
  };
  await server.connect(serverT);
  const client = new Client({ name: which === "ehr" ? "provider-agent" : "payer-agent", version: "1.0.0" });
  await client.connect(clientT);
  return {
    client,
    async call(name: string, args: Record<string, unknown>) {
      const r = await client.callTool({ name, arguments: args });
      const text = (r.content as { type: string; text?: string }[])?.[0]?.text ?? "{}";
      return JSON.parse(text);
    },
    close: () => client.close(),
  };
}
