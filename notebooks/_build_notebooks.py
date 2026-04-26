"""Sync notebooks with production code.

Two outputs:
  1. Annotates notebooks/algorithm_design.ipynb in place — adds a top
     "Notebook ↔ Production divergence" markdown cell and inline NOTE
     comments at the 7 divergence points.
  2. Writes a fresh notebooks/algorithm_v1_production.ipynb — a minimal,
     runnable notebook that mirrors only what production ships.

Re-run whenever web/lib/search.ts changes.

    cd api && source .venv/bin/activate
    python ../notebooks/_build_notebooks.py
"""

from __future__ import annotations

from pathlib import Path

import nbformat as nbf

NB_DIR = Path(__file__).resolve().parent
DESIGN = NB_DIR / "algorithm_design.ipynb"
PROD = NB_DIR / "algorithm_v1_production.ipynb"


# ────────────────────────────────────────────────────────────────────────────
# Part 1 — annotate algorithm_design.ipynb
# ────────────────────────────────────────────────────────────────────────────

DIVERGENCE_HEADER = """\
## Notebook ↔ Production divergence (v1)

**This notebook is the design lab — the "ultimate" / aspirational version.**
It includes design alternatives we deliberately did not ship in production v1.

For the live production algorithm, see `algorithm_v1_production.ipynb` and
`web/lib/search.ts`.

| # | This notebook (design) | Production v1 (`web/lib/search.ts`) |
|---|---|---|
| 1 | `gamma_diversity = 0.4` (MMR weight on) | `gamma_diversity = 0.0` — round-robin by artist instead (cheaper, no embeddings server-side) |
| 2 | `RETRIEVAL_K = 30` | `max(K × 6, 60)` ≈ 60 — over-fetch headroom for hard filters + quota |
| 3 | `weighted_rerank()` is greedy MMR — recomputes diversity vs already-shown items | `roundRobinByArtist()` — bucket by `artist_id`, cycle one each |
| 4 | `epsilon_greedy_injection()` — random emerging-artist injection | not in prod (deferred — needs ~1,000+ catalog) |
| 5 | `apply_hard_filters()` returns `drop_log` (audit) | filters return survivors only — no log persisted |
| 6 | `search_agent()` returns full audit log + status codes | rank functions return the array; no audit log persistence |
| 7 | `tier_of(None) → 'emerging'` (benefit of doubt) | `tierOf(reach_score: number)` — assumes seeded value |

**Why the divergence is healthy.** The notebook is the source of truth for
*strategic intent* (weights, floors, philosophy). Production is the
*engineered subset* — predictable, observable, cheap. Each design alternative
above earns its way into production when round-robin / static configuration /
tiny scale stop being adequate. See `notebooks/how_search_works.docx`
Section 6 for the promotion conditions.

— Last sync: 2026-04-25 against `web/lib/search.ts`
"""

# Inline NOTE comments to add to specific cells (matched by substring).
INLINE_COMMENTS: list[tuple[str, str]] = [
    (
        "WEIGHTS = {",
        "# NOTE — divergences from production v1 in this cell:\n"
        "#   • gamma_diversity = 0.0 in prod (round-robin replaces MMR)\n"
        "#   • RETRIEVAL_K = max(K × 6, 60) ≈ 60 in prod (this 30 is\n"
        "#     the design-lab value; prod needs headroom because hard filters\n"
        "#     run AFTER retrieval, not before)\n"
        "# γ=0.4 stays here as the v2 MMR design candidate.\n",
    ),
    (
        "def weighted_rerank(",
        "# NOTE — this greedy MMR reranker is NOT what production v1 runs.\n"
        "# Production uses `roundRobinByArtist()` (see algorithm_v1_production.ipynb).\n"
        "# Kept here as the v2 candidate when round-robin produces visibly\n"
        "# clustered results in real traffic.\n",
    ),
    (
        "def quota_rerank(",
        "# NOTE — production v1's `applyQuota()` matches this function's\n"
        "# behaviour: target = ceil(K × 0.2), swap lowest non-emerging for\n"
        "# highest emerging that cleared QUOTA_FLOOR_REL. Aligned.\n",
    ),
    (
        "def epsilon_greedy_injection(",
        "# NOTE — production v1 does NOT inject random emerging works.\n"
        "# Deferred until catalog reaches ~1,000 works (see how_search_works.docx §6).\n"
        "# With ~30 artists today, \"random emerging\" would be the same five people.\n",
    ),
    (
        "def apply_hard_filters(",
        "# NOTE — production v1's `applyHardFilters()` returns survivors only;\n"
        "# the `drop_log` audit trail here is deferred (see how_search_works.docx §6).\n",
    ),
    (
        "def search_agent(",
        "# NOTE — production v1's `rankWorks()` / `rankArtists()` return the\n"
        "# result array directly. The audit log + status codes here\n"
        "# (OK / EMPTY_AFTER_FILTER / NO_MATCH) are deferred —\n"
        "# see how_search_works.docx §6, \"Structured request-level audit logging\".\n",
    ),
]


def annotate_design():
    nb = nbf.read(str(DESIGN), as_version=4)

    # Idempotency: skip if we already injected the divergence cell
    already_synced = any(
        c["cell_type"] == "markdown" and "Notebook ↔ Production divergence" in "".join(c["source"])
        for c in nb["cells"]
    )
    if not already_synced:
        # Insert the divergence cell right after the title cell (idx 0)
        new_cell = nbf.v4.new_markdown_cell(DIVERGENCE_HEADER)
        nb["cells"].insert(1, new_cell)

    # Inline NOTE comments — prepend if not already present.
    # Dedup uses the comment's own first line, which is unique per comment.
    for needle, comment_block in INLINE_COMMENTS:
        first_line = comment_block.strip().splitlines()[0]
        for cell in nb["cells"]:
            if cell["cell_type"] != "code":
                continue
            src = "".join(cell["source"])
            if needle not in src:
                continue
            if first_line in src:
                continue  # already applied
            cell["source"] = comment_block + "\n" + src

    nbf.write(nb, str(DESIGN))
    print(f"annotated {DESIGN.name}: {len(nb['cells'])} cells")


# ────────────────────────────────────────────────────────────────────────────
# Part 2 — author algorithm_v1_production.ipynb
# ────────────────────────────────────────────────────────────────────────────

PROD_TITLE = """\
# Search Algorithm — Production v1

**Scope:** this notebook reproduces ONLY what `web/lib/search.ts` ships
in production today. For the wider design space (MMR diversity,
ε-greedy exploration, audit logging, etc.) see `algorithm_design.ipynb`.

Last verified against `web/lib/search.ts` on **2026-04-25**.

## Why this notebook exists

The production code lives in TypeScript inside a Next.js Route Handler,
which is not a great surface for explaining an algorithm to a human. So
we mirror it here in Python — same constants, same stages, same maths
— with toy data that runs in seconds.

If you want to demo what's actually live in the marketplace, run this
notebook top to bottom. Every result you see comes from the same
formula production runs.
"""

PROD_PIPELINE_OVERVIEW = """\
## Pipeline overview

```
        user query (text) + filters {medium, verified_only, budget_cents}
                  │
                  ▼
        embed(query)        ← OpenAI text-embedding-3-small (skipped here; toy data has cosine baked in)
                  │
                  ▼
        retrieve top-N by cosine similarity     ← N = max(K × 6, 60)
                  │
                  ▼
        hydrate with artist tier + price meta
                  │
                  ▼
        Stage 1 ─ apply hard filters             ← medium / verified / price ≤ 1.5 × budget
                  │
                  ▼
        Stage 2 ─ score = α·rel + δ·health − ε·price_pen
                  │
                  ▼
        Stage 3 ─ round-robin by artist          ← γ = 0 in v1; this replaces MMR
                  │
                  ▼
        Stage 4 ─ quota repair                   ← ≥ ceil(K × 0.2) emerging at rel ≥ 0.40
                  │
                  ▼
        Stage 5 ─ confidence tier                ← HIGH / MEDIUM / LOW / NO_MATCH
                  │
                  ▼
                top-K results
```

We'll go through each stage, run it on a toy candidate set, and then
chain them in an end-to-end demo at the bottom.
"""

PROD_CONSTANTS_MD = """\
## Constants

These match `web/lib/search.ts` exactly. If they drift here, the
notebook is wrong.
"""

PROD_CONSTANTS_CODE = '''\
# ─── from web/lib/search.ts ─────────────────────────────────────────────
WEIGHTS = {
    "alpha_relevance":  1.0,   # base: cosine similarity
    "beta_revenue":     0.0,   # off in v1 (no conversion data yet)
    "gamma_diversity":  0.0,   # 0 in prod — round-robin replaces MMR
    "delta_health":     0.5,   # emerging-artist boost (gated by rel ≥ 0.20)
}

EPSILON_PRICE_PENALTY = 0.6    # max price-overage penalty
PRICE_CEILING_MULT    = 1.5    # hard reject above 1.5× budget
QUOTA_FLOOR_REL       = 0.40   # quota slots only filled by rel ≥ this
MIN_RELEVANCE_FLOOR   = 0.20   # health bonus gated by rel ≥ this
RELEVANCE_FLOORS      = {"HIGH": 0.55, "MEDIUM": 0.40, "LOW": 0.25}

TIER_BONUS = {"emerging": 1.0, "growing": 0.5, "established": 0.0}

def tier_of(reach_score: int) -> str:
    if reach_score < 1500:  return "emerging"
    if reach_score < 5000:  return "growing"
    return "established"

# Retrieve count rule used by production: max(K * 6, 60)
def retrieve_count(k: int) -> int:
    return max(k * 6, 60)

print("Weights:", WEIGHTS)
print(f"Price ceiling: {PRICE_CEILING_MULT}× budget")
print(f"Quota floor (rel): {QUOTA_FLOOR_REL}")
print(f"Confidence tiers: {RELEVANCE_FLOORS}")
'''

PROD_TOY_DATA_MD = """\
## Toy candidate set

To keep this notebook runnable without an OpenAI key, we hand-craft a
candidate set with pre-computed similarity scores. These mirror real
candidates from the live catalog (Aya Tolentino, Noah Patel, etc.) so
the demo at the end matches what's in `how_search_works.docx`.

In production the similarity comes from `pgvector`'s cosine search; the
rest of the pipeline is identical to what we'll run below.
"""

PROD_TOY_DATA_CODE = '''\
import pandas as pd

# Hand-crafted candidate set for the running query:
#   "moody lo-fi music for a Tokyo travel vlog, budget $65, only verified"
#
# `similarity` is what pgvector's cosine returns; everything else is the
# hydrated metadata production looks up after retrieval.
candidates = pd.DataFrame([
    # work_id            artist             medium  price  reach  attest        sim
    ("aya-rainy",       "Aya Tolentino",   "music",  4000,   900, "verified",   0.45),
    ("noah-midnight",   "Noah Patel",      "music",  6500, 12000, "verified",   0.57),
    ("noah-window",     "Noah Patel",      "music",  7200, 12000, "verified",   0.44),
    ("kenji-rain",      "Kenji Arai",      "music",  5500,  8000, "verified",   0.52),
    ("kenji-dawn",      "Kenji Arai",      "music",  6000,  8000, "verified",   0.41),
    ("sora-aurora",     "Sora Kim",        "music",  5000,  2300, "self_declared", 0.38),
    ("ava-ocean",       "Ava Chen",        "illustration", 8000, 6400, "verified", 0.21),
    ("leo-harbor",      "Leo Brown",       "video", 14000,  1100, "self_declared", 0.18),
    ("juno-fern",       "Juno Park",       "music",  3500,  500, "verified",    0.35),
    ("eli-loop",        "Eli Tran",        "music",  9800,  300, "verified",    0.48),
], columns=["work_id", "artist", "medium", "price_from_cents",
            "reach_score", "attestation_tier", "similarity"])

# Hydrate the tier column up front (this is what hydrateCandidates does in TS)
candidates["tier"] = candidates["reach_score"].apply(tier_of)
candidates
'''

PROD_FILTER_MD = """\
## Stage 1 — Hard filters

Three filters, applied as a single pass:

- **medium** — wrong medium → drop
- **verified_only** — non-verified → drop
- **budget_cents** — `price > budget × 1.5` → drop (anything beyond
  the soft band is genuinely unaffordable)

Survivors flow into the scorer. Anything dropped here is gone — the
score formula never sees it.
"""

PROD_FILTER_CODE = '''\
def apply_hard_filters(df, *, medium=None, verified_only=False,
                       budget_cents=None):
    out = df
    if medium:
        out = out[out["medium"] == medium]
    if verified_only:
        out = out[out["attestation_tier"] == "verified"]
    if budget_cents is not None:
        ceiling = budget_cents * PRICE_CEILING_MULT
        out = out[out["price_from_cents"] <= ceiling]
    return out.reset_index(drop=True)

# Demo: apply the running query's filters
filtered = apply_hard_filters(
    candidates,
    medium="music",
    verified_only=True,
    budget_cents=6500,    # $65 in cents
)
print(f"survivors: {len(filtered)} of {len(candidates)}")
filtered
'''

PROD_SCORE_MD = """\
## Stage 2 — Weighted score

For each survivor:

```
score = α · rel + δ · health_eff − ε · price_pen
```

with three sub-rules:

- **`health_eff`**: `TIER_BONUS[tier]` if `rel ≥ 0.20`, else `0`. Don't
  boost weak matches just for being emerging.
- **`price_pen`**: `0` under budget; quadratic ramp to `1` at the
  `1.5 × budget` ceiling; clamped at `1` beyond (already filtered out).
- `β` (revenue) and `γ` (MMR) are both `0` in v1, so they don't appear
  in the live formula.
"""

PROD_SCORE_CODE = '''\
def price_soft_penalty(price_cents, budget_cents):
    """Quadratic ramp: 0 below budget, 1 at the 1.5× ceiling."""
    if budget_cents is None or price_cents <= budget_cents:
        return 0.0
    ceiling = budget_cents * PRICE_CEILING_MULT
    if price_cents >= ceiling:
        return 1.0
    over = (price_cents - budget_cents) / (ceiling - budget_cents)
    return over * over

def score_candidates(df, budget_cents=None):
    out = df.copy()
    rel = out["similarity"]
    out["rel"] = rel
    # health bonus, gated by min relevance
    out["health"] = [
        TIER_BONUS.get(t, 0.0) if r >= MIN_RELEVANCE_FLOOR else 0.0
        for r, t in zip(rel, out["tier"])
    ]
    out["price_pen"] = [
        price_soft_penalty(p, budget_cents)
        for p in out["price_from_cents"]
    ]
    out["score"] = (
        WEIGHTS["alpha_relevance"] * out["rel"]
        + WEIGHTS["delta_health"]   * out["health"]
        - EPSILON_PRICE_PENALTY     * out["price_pen"]
    )
    return out.sort_values("score", ascending=False).reset_index(drop=True)

scored = score_candidates(filtered, budget_cents=6500)
scored[["artist", "work_id", "tier", "rel", "health", "price_pen", "score"]]
'''

PROD_RR_MD = """\
## Stage 3 — Round-robin by artist

After scoring, walk the artists in score-descending order and pull one
work each, cycling until each artist's queue drains or `K` slots fill.
Within an artist's queue, the score order is preserved.

This replaces the MMR diversity weight (γ) — same goal (don't let one
artist monopolise the top), much simpler implementation.
"""

PROD_RR_CODE = '''\
from collections import defaultdict, OrderedDict

def round_robin_by_artist(scored_df, k):
    # bucket by artist, in order of best-scoring artist first
    buckets = OrderedDict()
    for _, row in scored_df.iterrows():
        buckets.setdefault(row["artist"], []).append(row)
    merged = []
    while len(merged) < k and any(buckets.values()):
        for artist, queue in buckets.items():
            if queue:
                merged.append(queue.pop(0))
                if len(merged) >= k:
                    break
    return pd.DataFrame(merged).reset_index(drop=True)

K = 8
spread = round_robin_by_artist(scored, K)
spread[["artist", "work_id", "tier", "rel", "score"]]
'''

PROD_QUOTA_MD = """\
## Stage 4 — Quota repair

Count emerging-tier rows in the top-K. If fewer than `ceil(K × 0.2)`
(so 1 of 5, 2 of 10), swap the *lowest-ranked non-emerging* slot for
the *highest-ranked emerging artist outside the top-K* — but **only if
that artist's relevance ≥ `QUOTA_FLOOR_REL`**.

The relevance floor is what keeps the quota from filling with garbage:
better to underfill than to surface a weak match.

Repaired rows get `quota_repaired = True` so the UI can mark them.
"""

PROD_QUOTA_CODE = '''\
import math

def apply_quota(ranked_df, all_scored_df, k):
    target = max(1, math.ceil(k * 0.2))
    out = ranked_df.copy()
    out["quota_repaired"] = False

    current_em = (out["tier"] == "emerging").sum()
    if current_em >= target:
        return out

    in_set = set(out["work_id"])
    pool = (all_scored_df[
        (all_scored_df["tier"] == "emerging")
        & (all_scored_df["rel"] >= QUOTA_FLOOR_REL)
        & (~all_scored_df["work_id"].isin(in_set))
    ].sort_values("rel", ascending=False))

    needed = target - current_em
    # lowest-ranked non-emerging slots, last-to-first
    non_em_idx = [i for i in range(len(out) - 1, -1, -1)
                  if out.loc[i, "tier"] != "emerging"]

    for _, em in pool.iterrows():
        if needed <= 0 or not non_em_idx:
            break
        slot = non_em_idx.pop(0)
        for col in em.index:
            if col in out.columns:
                out.at[slot, col] = em[col]
        out.at[slot, "quota_repaired"] = True
        needed -= 1
    return out

repaired = apply_quota(spread, scored, K)
repaired[["artist", "work_id", "tier", "rel", "score", "quota_repaired"]]
'''

PROD_CONFIDENCE_MD = """\
## Stage 5 — Confidence tier

Final per-result label, based on raw relevance:

- `rel ≥ 0.55` → **HIGH**
- `rel ≥ 0.40` → **MEDIUM**
- `rel ≥ 0.25` → **LOW**
- otherwise   → **NO_MATCH**

The frontend uses this to dim, badge, or refuse to display. A search
that comes back all-NO_MATCH stays honest instead of forcing a top-K
of weak matches.
"""

PROD_CONFIDENCE_CODE = '''\
def confidence_tier(rel):
    if rel >= RELEVANCE_FLOORS["HIGH"]:    return "HIGH"
    if rel >= RELEVANCE_FLOORS["MEDIUM"]:  return "MEDIUM"
    if rel >= RELEVANCE_FLOORS["LOW"]:     return "LOW"
    return "NO_MATCH"

repaired["confidence"] = repaired["rel"].apply(confidence_tier)
repaired[["artist", "work_id", "tier", "rel", "score",
          "confidence", "quota_repaired"]]
'''

PROD_END_TO_END_MD = """\
## End-to-end pipeline

Chaining all five stages in one function — the same shape as
`rankWorks()` in `web/lib/search.ts`.
"""

PROD_END_TO_END_CODE = '''\
def rank_works(candidates_df, k, *, medium=None, verified_only=False,
               budget_cents=None):
    """Production v1 pipeline. Mirrors web/lib/search.ts::rankWorks()."""
    # Stage 1 — hard filters
    filtered = apply_hard_filters(candidates_df, medium=medium,
                                  verified_only=verified_only,
                                  budget_cents=budget_cents)
    if filtered.empty:
        return filtered.assign(score=[], confidence=[])

    # Stage 2 — score
    scored = score_candidates(filtered, budget_cents=budget_cents)

    # Stage 3 — round-robin
    spread = round_robin_by_artist(scored, k)

    # Stage 4 — quota
    repaired = apply_quota(spread, scored, k)

    # Stage 5 — confidence
    repaired["confidence"] = repaired["rel"].apply(confidence_tier)
    return repaired

# Demo: the running query
result = rank_works(
    candidates, k=8,
    medium="music", verified_only=True, budget_cents=6500,
)
result[["artist", "work_id", "tier", "rel", "health", "price_pen",
        "score", "confidence", "quota_repaired"]]
'''

PROD_CLOSING_MD = """\
## Notes for the demo

- **Same maths, different runtime.** Production runs in TypeScript on
  Vercel; this notebook is Python. The constants and stages are
  identical.
- **No OpenAI in this notebook.** The `similarity` column is
  hand-crafted toy data so you can run cells without an API key. In
  production, `embed(query) → cosine via pgvector` produces these
  numbers.
- **Why the divergence with `algorithm_design.ipynb`?** That notebook
  explores the wider design space (MMR diversity, exploration
  injection, audit logging). This one ships only what's currently
  live. See `how_search_works.docx` Section 6 for the promotion
  conditions of each deferred feature.
"""


def author_production():
    nb = nbf.v4.new_notebook()
    nb["metadata"] = {
        "kernelspec": {
            "display_name": "Python 3",
            "language": "python",
            "name": "python3",
        },
        "language_info": {"name": "python"},
    }

    pairs = [
        (PROD_TITLE,                "md"),
        (PROD_PIPELINE_OVERVIEW,    "md"),
        (PROD_CONSTANTS_MD,         "md"),
        (PROD_CONSTANTS_CODE,       "code"),
        (PROD_TOY_DATA_MD,          "md"),
        (PROD_TOY_DATA_CODE,        "code"),
        (PROD_FILTER_MD,            "md"),
        (PROD_FILTER_CODE,          "code"),
        (PROD_SCORE_MD,             "md"),
        (PROD_SCORE_CODE,           "code"),
        (PROD_RR_MD,                "md"),
        (PROD_RR_CODE,              "code"),
        (PROD_QUOTA_MD,             "md"),
        (PROD_QUOTA_CODE,           "code"),
        (PROD_CONFIDENCE_MD,        "md"),
        (PROD_CONFIDENCE_CODE,      "code"),
        (PROD_END_TO_END_MD,        "md"),
        (PROD_END_TO_END_CODE,      "code"),
        (PROD_CLOSING_MD,           "md"),
    ]
    for src, kind in pairs:
        if kind == "md":
            nb["cells"].append(nbf.v4.new_markdown_cell(src))
        else:
            nb["cells"].append(nbf.v4.new_code_cell(src))

    nbf.write(nb, str(PROD))
    print(f"wrote {PROD.name}: {len(nb['cells'])} cells")


# ────────────────────────────────────────────────────────────────────────────
# Run
# ────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    annotate_design()
    author_production()
