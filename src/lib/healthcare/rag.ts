/**
 * Minimal RAG retriever over the payer policy library.
 * Uses BM25 keyword scoring so it runs with zero setup (Groq has no embeddings endpoint).
 * In production: chunk → embed → vector DB (pgvector, Pinecone, Azure AI Search…) + hybrid search + re-ranking.
 */
import { POLICIES } from "./data";

export type Chunk = { id: string; policyId: string; title: string; section: number; text: string };
export type Hit = Chunk & { score: number };

const STOP = new Set(
  "a an and are as at be by for from has have in is it its of on or that the to was were with without when who this which may must not any at least".split(" "),
);
const tokenize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9.\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t));

const CHUNKS: Chunk[] = POLICIES.flatMap((p) =>
  p.sections.map((text, i) => ({ id: `${p.id} §${i + 1}`, policyId: p.id, title: p.title, section: i + 1, text })),
);
const DOCS = CHUNKS.map((c) => tokenize(`${c.title} ${c.text}`));
const AVG = DOCS.reduce((a, d) => a + d.length, 0) / DOCS.length;
const DF = new Map<string, number>();
DOCS.forEach((d) => new Set(d).forEach((t) => DF.set(t, (DF.get(t) ?? 0) + 1)));

export function retrieve(query: string, k = 4): Hit[] {
  const q = tokenize(query);
  const N = DOCS.length;
  const k1 = 1.4;
  const b = 0.75;
  return CHUNKS.map((c, i) => {
    const d = DOCS[i];
    let score = 0;
    for (const t of q) {
      const tf = d.filter((x) => x === t).length;
      if (!tf) continue;
      const idf = Math.log(1 + (N - (DF.get(t) ?? 0) + 0.5) / ((DF.get(t) ?? 0) + 0.5));
      score += idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * d.length) / AVG)));
    }
    return { ...c, score: Math.round(score * 100) / 100 };
  })
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

export const CORPUS_STATS = { policies: POLICIES.length, chunks: CHUNKS.length };
