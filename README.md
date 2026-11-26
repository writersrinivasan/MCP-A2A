# 🌐🤝 Beyond MCP — A2A, Agent Interoperability & Enterprise Agent Networks

An interactive workshop app built with **Next.js 16**, **LangGraph.js** and **Groq** (bring your own key).

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

Click **⚙️ Add Groq key** (top right) and paste a key from https://console.groq.com/keys.
The key stays in the browser (session storage, or local storage if "remember" is ticked). It is sent with each request
in an `x-groq-api-key` header, and the server passes it to Groq without storing or logging it.

No key? The smart-factory demo still runs in **offline scripted mode**: the same LangGraph, with canned agent replies.

## What's inside

| Section | What participants see |
|---|---|
| Modules 01–06 | One module per agenda item, each with an interactive widget: MCP vs A2A diagram, task-lifecycle player, Agent Card explorer, topology switcher (hub / mesh / hierarchical), collaboration patterns, trust-stack layers, use-case grid |
| 🏭 Smart-factory demo | A predictive-maintenance agent network: 7 agents from 5 orgs on 5 frameworks, animated live, with an A2A message log and a JSON-RPC wire inspector |
| 🤖 AI assistant | A LangGraph router → 5 specialist agents, streaming from Groq |

### Smart-factory LangGraph (`src/lib/graphs/factory.ts`)

```
iot → orchestrator_plan ─┬→ diagnostics ─┐
                         └→ inventory  ──┴→ join ─(no stock?)→ supplier ─→ scheduler → governance ─(over budget?)→ human ⏸ → work_order
```

- **Parallel fan-out / fan-in**: Diagnostics ∥ Inventory
- **Conditional routing**: the external Supplier agent is called only when the part is out of stock
- **Human-in-the-loop**: `interrupt()` pauses the graph when spend exceeds the autonomous limit; the UI resumes it with `Command({ resume })` (A2A state `input-required`)
- Each step emits an A2A-style JSON-RPC envelope (`message/send`, status updates, artifacts, Agent Card discovery)

Workshop tips: **Toggle "part in stock" off** to bring in the cross-company supplier. **Lower the spend limit** to force human approval.

## Notes

- The HITL checkpointer is an in-memory `MemorySaver`. That's fine for `npm run dev` / `npm start` on one machine. A serverless deploy needs a persistent checkpointer (e.g. Postgres).
- A2A envelopes and factory data are illustrative. The A2A spec is evolving; check https://a2a-protocol.org for the current version.

## 🏥 Assignment 2: Agentic prior authorization (`/healthcare`)

Payer ⇄ provider prior authorization that combines all three patterns:

| Layer | Question it answers | In the demo |
|---|---|---|
| **RAG** | What does the agent need to *know*? | Payer agent retrieves medical-policy sections (BM25 over `src/lib/healthcare/data.ts`) |
| **MCP** | What must it *read/do* in its own systems? | Real MCP servers (official SDK, in-memory transport): Provider EHR (FHIR-style tools) and Payer core-admin (eligibility, benefits) |
| **A2A** | Who does it *work with*? | Provider agent ⇄ payer agent: `message/send`, `input-required` pend loop, determination artifact |

```
provider_gather(MCP) → a2a_submit(A2A) → payer_intake(MCP) → payer_rag(RAG) → payer_review ─┬→ decide
                                                     ▲                                         ├→ provider_supplement(MCP+A2A) ┘
                                                     └─────────────────────────────────────────┴→ human_review ⏸ → decide
```

Guardrail in code: automation may **approve** or **pend**, but never deny. Denials require a physician (LangGraph `interrupt()`).

Cases: 🩻 MRI → approved · 💊 GLP-1 → pended for documents, then approved · 🧬 BRCA → criteria unmet → physician decides.
All patients, plans and policies are synthetic.

## Optional: LangSmith tracing

Copy `.env.example` to `.env.local` and add your LangSmith API key to trace every LangGraph run. Groq keys are never written to traces.
