import { Command, factoryGraph } from "@/lib/graphs/factory";
import { readKey } from "@/lib/llm";
import { ndjsonResponse } from "@/lib/ndjson";
import { SCENARIOS } from "@/lib/a2a";

type Body =
  | { action: "start"; scenarioId: string; budgetLimit: number; partInStock: boolean; model?: string }
  | { action: "resume"; threadId: string; approved: boolean; note?: string; model?: string };

/**
 * Streams the smart-factory agent network run.
 * - action "start": new thread; runs until finished or until the human-approval interrupt.
 * - action "resume": resumes an interrupted thread with the human's decision.
 * No key → offline scripted demo (same graph, no LLM calls).
 */
export async function POST(req: Request) {
  const key = readKey(req);
  const body = (await req.json()) as Body;
  const threadId = body.action === "resume" ? body.threadId : `run-${crypto.randomUUID()}`;
  const config = {
    configurable: { thread_id: threadId, secrets: { groqApiKey: key }, model: body.model },
    streamMode: "updates" as const,
    signal: req.signal,
  };

  let input: unknown;
  if (body.action === "start") {
    const scenarioId = SCENARIOS.some((s) => s.id === body.scenarioId) ? body.scenarioId : SCENARIOS[0].id;
    input = {
      scenarioId,
      budgetLimit: Math.max(0, Number(body.budgetLimit) || 5000),
      partInStock: !!body.partInStock,
      contextId: `ctx-${threadId.slice(4, 12)}`,
    };
  } else {
    input = new Command({ resume: { approved: !!body.approved, approver: "Plant Manager (you)", note: body.note?.slice(0, 200) } });
  }

  return ndjsonResponse(async (send) => {
    send({ type: "thread", threadId, mode: key ? "live" : "offline" });
    const stream = await factoryGraph().stream(input as never, config);
    for await (const chunk of stream as AsyncIterable<Record<string, Record<string, unknown>>>) {
      for (const [node, update] of Object.entries(chunk)) {
        if (node === "__interrupt__") {
          const intr = (update as unknown as { value: unknown }[])[0];
          send({ type: "interrupt", value: intr?.value });
          continue;
        }
        send({ type: "node", node });
        const { events, ...rest } = (update ?? {}) as { events?: unknown[] };
        for (const e of events ?? []) send({ type: "event", event: e });
        if (Object.keys(rest).length) send({ type: "state", node, state: rest });
      }
    }
    send({ type: "done" });
  });
}
