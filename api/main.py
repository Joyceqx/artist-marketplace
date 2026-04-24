import os
from collections import defaultdict
from statistics import mean
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel
from supabase import create_client

load_dotenv()

EMBEDDING_MODEL = "text-embedding-3-small"

app = FastAPI(title="Artist Marketplace API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_openai = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
_supabase = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_KEY"],
)


@app.get("/api/health")
def health():
    return {"status": "ok"}


class SearchRequest(BaseModel):
    query: str
    limit: int = 10


class SearchResult(BaseModel):
    artist_id: str
    work_id: str
    title: str
    medium: str
    score: float


class ArtistResult(BaseModel):
    artist_id: str
    display_name: str
    bio: Optional[str]
    location: Optional[str]
    attestation_tier: str
    reach_score: int
    score: float
    top_work_title: str
    top_work_medium: str
    matching_works: int


def _embed(text: str) -> list[float]:
    # Extension seam: swap when we change embedding strategy (multi-field, hybrid, etc.).
    resp = _openai.embeddings.create(model=EMBEDDING_MODEL, input=text)
    return resp.data[0].embedding


def _candidates(embedding: list[float], n: int) -> list[dict]:
    resp = _supabase.rpc(
        "search_works",
        {"query_embedding": embedding, "match_count": n},
    ).execute()
    return resp.data or []


def _rank(embedding: list[float], limit: int) -> list[SearchResult]:
    # Diversity rerank: over-fetch then round-robin by artist_id so one artist
    # doesn't dominate the top. Within each artist's bucket we keep the RPC's
    # similarity ordering (highest-scoring first).
    rows = _candidates(embedding, limit * 5)
    by_artist: dict[str, list[dict]] = defaultdict(list)
    artist_order: list[str] = []
    for r in rows:
        aid = r["artist_id"]
        if aid not in by_artist:
            artist_order.append(aid)
        by_artist[aid].append(r)

    merged: list[dict] = []
    while len(merged) < limit and any(by_artist[a] for a in artist_order):
        for a in artist_order:
            if by_artist[a]:
                merged.append(by_artist[a].pop(0))
                if len(merged) >= limit:
                    break

    return [
        SearchResult(
            artist_id=str(r["artist_id"]),
            work_id=str(r["work_id"]),
            title=r["title"],
            medium=r["medium"],
            score=float(r["similarity"]),
        )
        for r in merged
    ]


def _rank_artists(embedding: list[float], limit: int) -> list[ArtistResult]:
    # No bio embeddings yet — derive artist relevance from their works' scores.
    # Score an artist by mean of their top-3 matching works (or fewer).
    rows = _candidates(embedding, 60)
    if not rows:
        return []

    by_artist: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        by_artist[str(r["artist_id"])].append(r)

    artist_ids = list(by_artist.keys())
    artists_resp = (
        _supabase.table("artists")
        .select("id, display_name, bio, location, attestation_tier, reach_score")
        .in_("id", artist_ids)
        .execute()
    )
    meta = {str(a["id"]): a for a in (artists_resp.data or [])}

    ranked: list[ArtistResult] = []
    for aid, works in by_artist.items():
        top = sorted(works, key=lambda w: w["similarity"], reverse=True)[:3]
        top_scores = [float(w["similarity"]) for w in top]
        artist_score = mean(top_scores) if top_scores else 0.0
        m = meta.get(aid)
        if not m:
            continue
        ranked.append(
            ArtistResult(
                artist_id=aid,
                display_name=m["display_name"],
                bio=m.get("bio"),
                location=m.get("location"),
                attestation_tier=m.get("attestation_tier") or "self_declared",
                reach_score=int(m.get("reach_score") or 0),
                score=artist_score,
                top_work_title=top[0]["title"],
                top_work_medium=top[0]["medium"],
                matching_works=len(works),
            )
        )

    ranked.sort(key=lambda r: r.score, reverse=True)
    return ranked[:limit]


@app.post("/api/search", response_model=list[SearchResult])
def search(req: SearchRequest):
    embedding = _embed(req.query)
    return _rank(embedding, req.limit)


@app.post("/api/search/artists", response_model=list[ArtistResult])
def search_artists(req: SearchRequest):
    embedding = _embed(req.query)
    return _rank_artists(embedding, req.limit)
