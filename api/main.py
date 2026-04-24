import os

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


@app.get("/health")
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


def _embed(text: str) -> list[float]:
    # Extension seam: swap when we change embedding strategy (multi-field, hybrid, etc.).
    resp = _openai.embeddings.create(model=EMBEDDING_MODEL, input=text)
    return resp.data[0].embedding


def _rank(embedding: list[float], limit: int) -> list[SearchResult]:
    # Extension seam: pure cosine via pgvector now; future adds diversity / hybrid / reranker.
    resp = _supabase.rpc(
        "search_works",
        {"query_embedding": embedding, "match_count": limit},
    ).execute()
    rows = resp.data or []
    return [
        SearchResult(
            artist_id=str(row["artist_id"]),
            work_id=str(row["work_id"]),
            title=row["title"],
            medium=row["medium"],
            score=float(row["similarity"]),
        )
        for row in rows
    ]


@app.post("/search", response_model=list[SearchResult])
def search(req: SearchRequest):
    embedding = _embed(req.query)
    return _rank(embedding, req.limit)
