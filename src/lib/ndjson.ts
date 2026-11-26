/** Server: turn an async generator of objects into a newline-delimited JSON stream. */
export function ndjsonResponse(gen: (send: (obj: unknown) => void) => Promise<void>) {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(enc.encode(JSON.stringify(obj) + "\n"));
      try {
        await gen(send);
      } catch (e) {
        send({ type: "error", message: friendlyError(e) });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export function friendlyError(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  if (/401|invalid api key|invalid_api_key/i.test(msg)) return "Groq rejected the API key (401). Check the key in ⚙️ Settings.";
  if (/429|rate limit/i.test(msg)) return "Groq rate limit reached (429). Wait a moment or switch to a smaller model.";
  if (/model.*(not found|decommissioned|does not exist)/i.test(msg)) return "That Groq model isn't available. Pick another model in ⚙️ Settings.";
  return msg.slice(0, 300);
}

/** Client: read an NDJSON response and call onEvent for each parsed line. */
export async function readNdjson<T>(res: Response, onEvent: (e: T) => void) {
  if (!res.body) throw new Error("No response body");
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line) onEvent(JSON.parse(line) as T);
    }
  }
  if (buf.trim()) onEvent(JSON.parse(buf) as T);
}
