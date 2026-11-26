import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { assistantGraph, SPECIALISTS, SpecialistId } from "@/lib/graphs/assistant";
import { readKey } from "@/lib/llm";
import { ndjsonResponse } from "@/lib/ndjson";

type ChatMsg = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  const key = readKey(req);
  if (!key) return Response.json({ error: "Add your Groq API key in ⚙️ Settings to chat." }, { status: 401 });
  const { messages, model } = (await req.json()) as { messages: ChatMsg[]; model?: string };

  const history = (messages ?? []).slice(-12).map((m) =>
    m.role === "user" ? new HumanMessage(m.content.slice(0, 4000)) : new AIMessage(m.content.slice(0, 4000)),
  );

  return ndjsonResponse(async (send) => {
    const stream = await assistantGraph().stream(
      { messages: history },
      { configurable: { secrets: { groqApiKey: key }, model }, streamMode: ["updates", "messages"], signal: req.signal },
    );
    for await (const [mode, chunk] of stream as AsyncIterable<[string, unknown]>) {
      if (mode === "updates") {
        const upd = chunk as Record<string, { route?: SpecialistId; routeReason?: string }>;
        if (upd.router?.route) {
          const sp = SPECIALISTS[upd.router.route];
          send({ type: "route", id: upd.router.route, name: sp.name, emoji: sp.emoji, reason: upd.router.routeReason });
        }
      } else if (mode === "messages") {
        const [msg, meta] = chunk as [{ content: unknown }, { langgraph_node?: string }];
        if (meta?.langgraph_node === "specialist" && typeof msg.content === "string" && msg.content) {
          send({ type: "token", text: msg.content });
        }
      }
    }
    send({ type: "done" });
  });
}
