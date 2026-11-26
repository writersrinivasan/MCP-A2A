import { Command, paGraph } from "@/lib/healthcare/graph";
import { CASES } from "@/lib/healthcare/data";
import { readKey } from "@/lib/llm";
import { ndjsonResponse } from "@/lib/ndjson";

type Body =
  | { action: "start"; caseId: string; model?: string }
  | { action: "resume"; threadId: string; decision: "approve" | "deny"; note?: string; model?: string };

/** Streams the prior-auth agent network. Without a key it runs the same graph with scripted assessments. */
export async function POST(req: Request) {
  const key = readKey(req);
  const body = (await req.json()) as Body;
  const threadId = body.action === "resume" ? body.threadId : `pa-${crypto.randomUUID()}`;
  const input =
    body.action === "start"
      ? { caseId: CASES.some((c) => c.id === body.caseId) ? body.caseId : CASES[0].id, contextId: `ctx-${threadId.slice(3, 11)}` }
      : new Command({ resume: { decision: body.decision === "approve" ? "approve" : "deny", reviewer: "Dr. Medical Director (you)", note: body.note?.slice(0, 200) } });

  return ndjsonResponse(async (send) => {
    send({ type: "thread", threadId, mode: key ? "live" : "offline" });
    const stream = await paGraph().stream(input as never, {
      configurable: { thread_id: threadId, secrets: { groqApiKey: key }, model: body.model },
      streamMode: "updates",
      signal: req.signal,
    });
    for await (const chunk of stream as AsyncIterable<Record<string, Record<string, unknown>>>) {
      for (const [node, update] of Object.entries(chunk)) {
        if (node === "__interrupt__") {
          send({ type: "interrupt", value: (update as unknown as { value: unknown }[])[0]?.value });
          continue;
        }
        send({ type: "node", node });
        const { events, ...rest } = (update ?? {}) as { events?: unknown[] };
        for (const e of events ?? []) send({ type: "event", event: e });
        if (Object.keys(rest).length) send({ type: "state", state: rest });
      }
    }
    send({ type: "done" });
  });
}
