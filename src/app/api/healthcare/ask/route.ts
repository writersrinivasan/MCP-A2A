import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatGroq } from "@langchain/groq";
import { retrieve } from "@/lib/healthcare/rag";
import { DEFAULT_MODEL, readKey, stripThinking, textOf } from "@/lib/llm";
import { friendlyError } from "@/lib/ndjson";

/** Plain RAG Q&A over the payer policy library: retrieve → augment → generate (with citations). */
export async function POST(req: Request) {
  const { question, model } = (await req.json()) as { question: string; model?: string };
  const q = String(question ?? "").slice(0, 500);
  const hits = retrieve(q, 4);
  const key = readKey(req);
  if (!key) return Response.json({ hits, answer: null });
  if (!hits.length) return Response.json({ hits, answer: "No relevant policy found in the library for that question." });
  try {
    const llm = new ChatGroq({ apiKey: key, model: model || DEFAULT_MODEL, temperature: 0.1 });
    const r = await llm.invoke([
      new SystemMessage(
        "Answer the question using ONLY the policy excerpts provided. Cite every claim like [POL-RAD-014 §2]. If the excerpts do not contain the answer, say so. Max 120 words.",
      ),
      new HumanMessage(`EXCERPTS:\n${hits.map((h) => `[${h.id}] ${h.title}: ${h.text}`).join("\n\n")}\n\nQUESTION: ${q}`),
    ]);
    return Response.json({ hits, answer: stripThinking(textOf(r.content)) });
  } catch (e) {
    return Response.json({ hits, answer: null, error: friendlyError(e) }, { status: 200 });
  }
}
