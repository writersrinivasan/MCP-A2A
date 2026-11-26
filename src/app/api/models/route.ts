import { readKey } from "@/lib/llm";

// Validates a BYOK Groq key and lists chat-capable models. The key is forwarded, never stored.
export async function GET(req: Request) {
  const key = readKey(req);
  if (!key) return Response.json({ error: "Missing Groq API key" }, { status: 400 });
  const r = await fetch("https://api.groq.com/openai/v1/models", {
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!r.ok) {
    return Response.json({ error: r.status === 401 ? "Invalid Groq API key" : `Groq error ${r.status}` }, { status: r.status });
  }
  const data = (await r.json()) as { data: { id: string; active?: boolean }[] };
  const models = data.data
    .filter((m) => m.active !== false && !/whisper|tts|guard|playai|orpheus|distil|safeguard|compound/i.test(m.id))
    .map((m) => m.id)
    .sort();
  return Response.json({ models });
}
