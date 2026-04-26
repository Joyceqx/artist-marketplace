// Search seams — translated from notebooks/algorithm_design.ipynb.
//
// Pipeline (mirrors the notebook's stages 1-10):
//   1. embed(query)
//   2. retrieve top-N candidates by cosine similarity (search_works RPC)
//   3. hydrate candidates with full work + artist metadata
//   4. apply HARD filters (medium, verified_only, price ceiling = 1.5x budget)
//   5. score each: rel = α·cos + δ·health − ε·price_pen   (β=0, γ=0 in prod v1)
//   6. round-robin by artist_id (existing diversity mechanism — kept for v1)
//   7. quota repair: ensure ceil(K * 0.2) emerging artists with rel ≥ 0.40
//   8. tag confidence (HIGH/MEDIUM/LOW/NO_MATCH)
//
// Production v1 simplifications vs notebook:
//   - γ (MMR diversity) = 0 in production. The notebook uses embedding-based
//     MMR; production uses round-robin by artist_id (cheaper, no embeddings
//     fetched server-side). Style-level diversity is left to the next slice.
//   - β (revenue) = 0; will turn on once conversion data is real.

import OpenAI from "openai";
import { adminClient } from "@/lib/supabase/admin";

const EMBEDDING_MODEL = "text-embedding-3-small";

// ─── Strategic config (single source of truth — match the notebook) ────────
const WEIGHTS = {
  alpha_relevance: 1.0,
  beta_revenue: 0.0,
  gamma_diversity: 0.0, // 0 in prod v1 — round-robin handles diversity
  delta_health: 0.5,
};
const EPSILON_PRICE_PENALTY = 0.6;
const PRICE_CEILING_MULT = 1.5;
const QUOTA_FLOOR_REL = 0.4;
const MIN_RELEVANCE_FLOOR = 0.2;
const RELEVANCE_FLOORS = { HIGH: 0.55, MEDIUM: 0.4, LOW: 0.25 };

const TIER_BONUS: Record<string, number> = {
  emerging: 1.0,
  growing: 0.5,
  established: 0.0,
};

function tierOf(reachScore: number): string {
  if (reachScore < 1500) return "emerging";
  if (reachScore < 5000) return "growing";
  return "established";
}

// ─── Types ─────────────────────────────────────────────────────────────────
export type SearchFilters = {
  medium?: string;
  budget_cents?: number;
  verified_only?: boolean;
};

type RPCRow = {
  work_id: string;
  artist_id: string;
  title: string;
  medium: string;
  similarity: number;
};

type FullCand = RPCRow & {
  price_from_cents: number;
  display_name: string;
  attestation_tier: string;
  reach_score: number;
  tier: string;
};

type Scored = FullCand & {
  rel: number;
  health: number;
  price_pen: number;
  score: number;
  quota_repaired?: boolean;
};

export type WorkResult = {
  artist_id: string;
  work_id: string;
  title: string;
  medium: string;
  price_from_cents: number;
  display_name: string;
  attestation_tier: string;
  tier: string;
  rel: number;
  health: number;
  price_pen: number;
  score: number;
  confidence: "HIGH" | "MEDIUM" | "LOW" | "NO_MATCH";
  quota_repaired?: boolean;
};

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

// ─── OpenAI client ─────────────────────────────────────────────────────────
let _openai: OpenAI | null = null;
function openai(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

export async function embed(text: string): Promise<number[]> {
  const r = await openai().embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });
  return r.data[0].embedding;
}

// ─── Stage 2: retrieve candidates from RPC ─────────────────────────────────
async function retrieveCandidates(
  embedding: number[],
  n: number,
): Promise<RPCRow[]> {
  const supabase = adminClient();
  const { data, error } = await supabase.rpc("search_works", {
    query_embedding: embedding,
    match_count: n,
  });
  if (error) throw new Error(`search_works RPC: ${error.message}`);
  return (data ?? []) as RPCRow[];
}

// ─── Stage 3: hydrate with full work + artist metadata ─────────────────────
type ArtistMeta = {
  display_name: string;
  attestation_tier: string;
  reach_score: number;
};
type WorkRow = {
  id: string;
  price_from_cents: number;
  artists: ArtistMeta | ArtistMeta[] | null;
};

async function hydrateCandidates(rows: RPCRow[]): Promise<FullCand[]> {
  if (rows.length === 0) return [];
  const supabase = adminClient();
  const workIds = rows.map((r) => r.work_id);
  const { data, error } = await supabase
    .from("works")
    .select(
      "id, price_from_cents, artists ( display_name, attestation_tier, reach_score )",
    )
    .in("id", workIds);
  if (error) throw new Error(`hydrate: ${error.message}`);

  const meta = new Map<string, WorkRow>();
  for (const w of (data ?? []) as WorkRow[]) {
    meta.set(w.id, w);
  }

  const out: FullCand[] = [];
  for (const r of rows) {
    const m = meta.get(r.work_id);
    if (!m) continue;
    // PostgREST returns the join either as object or array depending on
    // foreign-key cardinality — handle both.
    const artist: ArtistMeta | undefined = Array.isArray(m.artists)
      ? m.artists[0]
      : m.artists ?? undefined;
    const reach = artist?.reach_score ?? 0;
    out.push({
      ...r,
      price_from_cents: m.price_from_cents ?? 0,
      display_name: artist?.display_name ?? "",
      attestation_tier: artist?.attestation_tier ?? "self_declared",
      reach_score: reach,
      tier: tierOf(reach),
    });
  }
  return out;
}

// ─── Stage 4: hard filters ─────────────────────────────────────────────────
function applyHardFilters(
  cands: FullCand[],
  f: SearchFilters,
): FullCand[] {
  return cands.filter((c) => {
    if (f.medium && c.medium !== f.medium) return false;
    if (f.verified_only && c.attestation_tier !== "verified") return false;
    if (f.budget_cents !== undefined) {
      const ceiling = f.budget_cents * PRICE_CEILING_MULT;
      if (c.price_from_cents > ceiling) return false;
    }
    return true;
  });
}

// ─── Stage 5: weighted score ───────────────────────────────────────────────
function priceSoftPenalty(
  priceCents: number,
  budgetCents: number | undefined,
): number {
  if (budgetCents === undefined || priceCents <= budgetCents) return 0;
  const ceiling = budgetCents * PRICE_CEILING_MULT;
  if (priceCents >= ceiling) return 1;
  const over = (priceCents - budgetCents) / (ceiling - budgetCents);
  return over * over;
}

function scoreCandidates(
  cands: FullCand[],
  budgetCents: number | undefined,
): Scored[] {
  return cands.map((c) => {
    const rel = c.similarity;
    const healthEff =
      rel >= MIN_RELEVANCE_FLOOR ? (TIER_BONUS[c.tier] ?? 0) : 0;
    const pricePen = priceSoftPenalty(c.price_from_cents, budgetCents);
    const score =
      WEIGHTS.alpha_relevance * rel +
      WEIGHTS.delta_health * healthEff -
      EPSILON_PRICE_PENALTY * pricePen;
    return { ...c, rel, health: healthEff, price_pen: pricePen, score };
  });
}

// ─── Stage 6: round-robin by artist (kept from prod v0; γ in prod v1 = 0) ──
function roundRobinByArtist(scored: Scored[], limit: number): Scored[] {
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const byArtist = new Map<string, Scored[]>();
  const order: string[] = [];
  for (const s of sorted) {
    if (!byArtist.has(s.artist_id)) {
      byArtist.set(s.artist_id, []);
      order.push(s.artist_id);
    }
    byArtist.get(s.artist_id)!.push(s);
  }
  const merged: Scored[] = [];
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
  return merged;
}

// ─── Stage 7: quota repair ─────────────────────────────────────────────────
function applyQuota(
  ranked: Scored[],
  allCands: Scored[],
  k: number,
): Scored[] {
  const target = Math.max(1, Math.ceil(k * 0.2));
  const out = ranked.map((r) => ({ ...r }));
  const currentEmerging = out.filter((r) => r.tier === "emerging").length;
  if (currentEmerging >= target) return out;

  const inSet = new Set(out.map((r) => r.work_id));
  const pool = allCands
    .filter(
      (c) =>
        c.tier === "emerging" &&
        c.rel >= QUOTA_FLOOR_REL &&
        !inSet.has(c.work_id),
    )
    .sort((a, b) => b.rel - a.rel);

  let needed = target - currentEmerging;
  // Lowest-ranked non-emerging slots, last to first
  const nonEmIndices: number[] = [];
  for (let i = out.length - 1; i >= 0; i--) {
    if (out[i].tier !== "emerging") nonEmIndices.push(i);
  }

  for (const em of pool) {
    if (needed <= 0 || nonEmIndices.length === 0) break;
    const slotIdx = nonEmIndices.shift()!;
    out[slotIdx] = { ...em, quota_repaired: true };
    needed--;
  }
  return out;
}

// ─── Stage 8: confidence tier ──────────────────────────────────────────────
function confidenceTier(rel: number): WorkResult["confidence"] {
  if (rel >= RELEVANCE_FLOORS.HIGH) return "HIGH";
  if (rel >= RELEVANCE_FLOORS.MEDIUM) return "MEDIUM";
  if (rel >= RELEVANCE_FLOORS.LOW) return "LOW";
  return "NO_MATCH";
}

// ─── Public API ────────────────────────────────────────────────────────────
export async function rankWorks(
  embedding: number[],
  limit: number,
  filters: SearchFilters = {},
): Promise<WorkResult[]> {
  // Over-fetch generously so hard filters + reranking have room to work.
  const cands = await retrieveCandidates(embedding, Math.max(limit * 6, 60));
  const full = await hydrateCandidates(cands);

  const filtered = applyHardFilters(full, filters);
  if (filtered.length === 0) return [];

  const scored = scoreCandidates(filtered, filters.budget_cents);
  const top = roundRobinByArtist(scored, limit);
  const repaired = applyQuota(top, scored, limit);

  return repaired.map((r) => ({
    artist_id: String(r.artist_id),
    work_id: String(r.work_id),
    title: r.title,
    medium: r.medium,
    price_from_cents: r.price_from_cents,
    display_name: r.display_name,
    attestation_tier: r.attestation_tier,
    tier: r.tier,
    rel: r.rel,
    health: r.health,
    price_pen: r.price_pen,
    score: r.score,
    confidence: confidenceTier(r.rel),
    ...(r.quota_repaired ? { quota_repaired: true } : {}),
  }));
}

// ─── Artist mode: aggregate top-3 work scores per artist (lightly updated) ─
export async function rankArtists(
  embedding: number[],
  limit: number,
  filters: SearchFilters = {},
): Promise<ArtistResult[]> {
  const rpcRows = await retrieveCandidates(embedding, 120);
  if (rpcRows.length === 0) return [];

  const full = await hydrateCandidates(rpcRows);
  const filtered = applyHardFilters(full, filters);
  if (filtered.length === 0) return [];

  // Group by artist
  const byArtist = new Map<string, FullCand[]>();
  for (const r of filtered) {
    if (!byArtist.has(r.artist_id)) byArtist.set(r.artist_id, []);
    byArtist.get(r.artist_id)!.push(r);
  }

  // Need bio + location from artists (not in hydrate result)
  const artistIds = Array.from(byArtist.keys());
  const supabase = adminClient();
  const { data: artistsRaw, error } = await supabase
    .from("artists")
    .select("id, bio, location")
    .in("id", artistIds);
  if (error) throw new Error(`artists fetch: ${error.message}`);
  const meta = new Map<
    string,
    { bio: string | null; location: string | null }
  >();
  for (const a of (artistsRaw ?? []) as {
    id: string;
    bio: string | null;
    location: string | null;
  }[]) {
    meta.set(String(a.id), { bio: a.bio, location: a.location });
  }

  const ranked: ArtistResult[] = [];
  for (const [aid, works] of byArtist) {
    const top = [...works]
      .sort((x, y) => y.similarity - x.similarity)
      .slice(0, 3);
    const meanRel =
      top.reduce((s, w) => s + w.similarity, 0) / Math.max(top.length, 1);
    // Tier-aware artist score: mean relevance + δ × health bonus (keeps mission)
    const tier = tierOf(top[0].reach_score);
    const healthEff =
      meanRel >= MIN_RELEVANCE_FLOOR ? (TIER_BONUS[tier] ?? 0) : 0;
    const finalScore =
      WEIGHTS.alpha_relevance * meanRel + WEIGHTS.delta_health * healthEff;

    ranked.push({
      artist_id: aid,
      display_name: top[0].display_name,
      bio: meta.get(aid)?.bio ?? null,
      location: meta.get(aid)?.location ?? null,
      attestation_tier: top[0].attestation_tier,
      reach_score: top[0].reach_score,
      score: finalScore,
      top_work_title: top[0].title,
      top_work_medium: top[0].medium,
      matching_works: works.length,
    });
  }

  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, limit);
}
