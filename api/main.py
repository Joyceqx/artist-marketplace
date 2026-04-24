from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os

app = FastAPI(title="Artist Marketplace API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


@app.post("/search", response_model=list[SearchResult])
def search(req: SearchRequest):
    # TODO(Track B): embed req.query, pgvector similarity, diversity re-rank
    return []
