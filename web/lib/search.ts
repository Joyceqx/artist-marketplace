// Search seams — translated from api/main.py.
//
// _embed and _rank* are kept as small isolated functions so the ranking
// strategy can change without touching the route handlers.

import OpenAI from "openai";
import { adminClient } from "@/lib/supabase/admin";

const EMBEDDING_MODEL = "text-embedding-3-small";

let _openai: OpenAI | null = null;
function openai(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

export type WorkCandidate = {
  artist_id: string;
  work_id: string;
  title: string;
  medium: string;
  similarity: number;
};

export async function embed(text: string): Promise<number[]> {
  // Extension seam: swap when changing embedding strategy.
  const r = await openai().embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });
  return r.data[0].embedding;
}

async function candidates(
  embedding: number[],
  n: number,
): Promise<WorkCandidate[]> {
  const supabase = adminClient();
  const { data, error } = await supabase.rpc("search_works", {
    query_embedding: embedding,
    match_count: n,
  });
  if (error) throw new Error(`search_works RPC: ${error.message}`);
  return (data ?? []) as WorkCandidate[];
}

export type WorkResult = {
  artist_id: string;
  work_id: string;
  title: string;
  medium: string;
  score: number;
};

export async function rankWorks(
  embedding: number[],
  limit: number,
): Promise<WorkResult[]> {
  // Extension seam: pure cosine + diversity-by-artist round-robin.
  const rows = await candidates(embedding, limit * 5);

  const byArtist = new Map<string, WorkCandidate[]>();
  const order: string[] = [];
  for (const r of rows) {
    if (!byArtist.has(r.artist_id)) {
      byArtist.set(r.artist_id, []);
      order.push(r.artist_id);
    }
    byArtist.get(r.artist_id)!.push(r);
  }

  const merged: WorkCandidate[] = [];
  while (
    merged.length < limit &&
    order.some((a) => (byArtist.get(a)?.length ?? 0) > 0)
  ) {
    for (const a of order) {
      const bucket = byArtist.get(a)!;
      if (bucket.length > 0) {
        merged.push(bucket.shift()!);
        if (merged.length >= limit) break;
      }
    }
  }

  return merged.map((r) => ({
    artist_id: String(r.artist_id),
    work_id: String(r.work_id),
    title: r.title,
    medium: r.medium,
    score: r.similarity,
  }));
}

export type ArtistResult = {
  artist_id: string;
  display_name: string;
  bio: string | null;
  location: string | null;
  attestation_tier: string;
  reach_score: number;
  score: number;
  top_work_title: string;
  top_work_medium: string;
  matching_works: number;
};

export async function rankArtists(
  embedding: number[],
  limit: number,
): Promise<ArtistResult[]> {
  // No bio embeddings yet — derive artist relevance from their works' scores.
  // Score an artist by mean of their top-3 matching works.
  const rows = await candidates(embedding, 60);
  if (rows.length === 0) return [];

  const byArtist = new Map<string, WorkCandidate[]>();
  for (const r of rows) {
    if (!byArtist.has(r.artist_id)) byArtist.set(r.artist_id, []);
    byArtist.get(r.artist_id)!.push(r);
  }

  const artistIds = Array.from(byArtist.keys());
  const supabase = adminClient();
  const { data: artistsRaw, error } = await supabase
    .from("artists")
    .select("id, display_name, bio, location, attestation_tier, reach_score")
    .in("id", artistIds);
  if (error) throw new Error(`artists fetch: ${error.message}`);

  const meta = new Map<string, Record<string, unknown>>();
  for (const a of artistsRaw ?? []) {
    meta.set(String(a.id), a);
  }

  const ranked: ArtistResult[] = [];
  for (const [aid, works] of byArtist) {
    const top = [...works]
      .sort((x, y) => y.similarity - x.similarity)
      .slice(0, 3);
    const meanScore =
      top.reduce((s, w) => s + w.similarity, 0) / Math.max(top.length, 1);
    const m = meta.get(aid);
    if (!m) continue;
    ranked.push({
      artist_id: aid,
      display_name: String(m.display_name),
      bio: (m.bio as string | null) ?? null,
      location: (m.location as string | null) ?? null,
      attestation_tier: (m.attestation_tier as string) ?? "self_declared",
      reach_score: (m.reach_score as number) ?? 0,
      score: meanScore,
      top_work_title: top[0].title,
      top_work_medium: top[0].medium,
      matching_works: works.length,
    });
  }

  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, limit);
}
