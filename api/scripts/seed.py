"""Seed artists + works with embeddings.

Sources:
  1. The hardcoded ARTISTS / WORKS below (the original 5 from the design).
  2. scripts/seed_data.json (if present) — LLM-generated synthetic roster.

Upserts: re-running updates existing rows. Uses the service_role key
to bypass RLS.

Run from api/ with the venv activated:
    python scripts/seed.py
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI
from supabase import create_client

load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env")

EMBEDDING_MODEL = "text-embedding-3-small"

# One row per artist. price_from_cents here is a fallback / metadata hint;
# per-work prices are set below by medium.
ARTISTS: list[dict] = [
    {
        "display_name": "Ava Chen",
        "bio": "Minimalist illustrator, pastel palettes, coastal themes.",
        "location": "Toronto, CA",
        "attestation_tier": "verified",
        "reach_score": 6400,
    },
    {
        "display_name": "Noah Patel",
        "bio": "Indie lofi beatmaker blending rain samples and tape hiss.",
        "location": "Brooklyn, NY",
        "attestation_tier": "verified",
        "reach_score": 12000,
    },
    {
        "display_name": "Maya Gomez",
        "bio": "Character designer for indie games.",
        "location": "CDMX, MX",
        "attestation_tier": "self_declared",
        "reach_score": 3800,
    },
    {
        "display_name": "Leo Brown",
        "bio": "Documentary cinematographer focused on quiet landscapes.",
        "location": "Portland, OR",
        "attestation_tier": "self_declared",
        "reach_score": 1100,
    },
    {
        "display_name": "Sora Kim",
        "bio": "Multidisciplinary artist, synth soundscapes and abstract visuals.",
        "location": "Berlin, DE",
        "attestation_tier": "self_declared",
        "reach_score": 2300,
    },
]

# Works grouped by artist display_name.
WORKS: dict[str, list[tuple[str, str, str]]] = {
    "Ava Chen": [
        ("Ocean fog", "soft watercolor of coastal fog at dawn, muted blues and greys", "illustration"),
        ("City rain", "neon-tinged illustration of rain on asphalt at night", "illustration"),
    ],
    "Noah Patel": [
        ("Midnight loop", "lofi hip-hop instrumental with soft rain and muted drums", "music"),
        ("Window light", "ambient piano piece with warm tape saturation", "music"),
    ],
    "Maya Gomez": [
        ("Fox warrior", "armored kitsune warrior character concept in ink and watercolor", "character"),
        ("Sky whale", "gentle floating sky whale creature with trailing seaweed", "character"),
    ],
    "Leo Brown": [
        ("Quiet harbor", "short video study of a fog-shrouded harbor at first light", "video"),
        ("Tidepool", "macro video of a tidepool, slow camera drift over kelp", "video"),
    ],
    "Sora Kim": [
        ("Aurora drift", "ambient synth drone evoking slow polar light", "music"),
    ],
}

# Per-medium default starting prices (cents).
MEDIUM_PRICE_CENTS: dict[str, int] = {
    "music": 4000,
    "illustration": 8000,
    "video": 14000,
    "character": 12000,
}


def _embed(client: OpenAI, text: str) -> list[float]:
    resp = client.embeddings.create(model=EMBEDDING_MODEL, input=text)
    return resp.data[0].embedding


def _load_synthetic() -> list[dict]:
    path = Path(__file__).resolve().parent / "seed_data.json"
    if not path.exists():
        return []
    entries = json.loads(path.read_text())
    # Normalise to the same shape as the hardcoded ARTISTS entries + expose works.
    out: list[dict] = []
    for e in entries:
        artist = {
            "display_name": e["display_name"],
            "bio": e["bio"],
            "location": e["location"],
            "attestation_tier": e["attestation_tier"],
            "reach_score": e["reach_score"],
            "_works": e.get("works", []),
        }
        out.append(artist)
    return out


def main() -> None:
    openai_client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    supabase = create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_KEY"],
    )

    artists_added = artists_updated = 0
    works_added = works_updated = 0

    # Build a unified seed list: hardcoded 5 + whatever's in seed_data.json.
    seed_list: list[dict] = []
    for a in ARTISTS:
        seed_list.append(
            {
                "display_name": a["display_name"],
                "bio": a["bio"],
                "location": a["location"],
                "attestation_tier": a["attestation_tier"],
                "reach_score": a["reach_score"],
                "works": [
                    {
                        "title": title,
                        "description": description,
                        "medium": medium,
                        "price_from_cents": MEDIUM_PRICE_CENTS.get(medium, 4000),
                    }
                    for title, description, medium in WORKS[a["display_name"]]
                ],
            }
        )
    for s in _load_synthetic():
        seed_list.append(
            {
                "display_name": s["display_name"],
                "bio": s["bio"],
                "location": s["location"],
                "attestation_tier": s["attestation_tier"],
                "reach_score": s["reach_score"],
                "works": s["_works"],
            }
        )

    for a in seed_list:
        fields = {
            "bio": a["bio"],
            "location": a["location"],
            "attestation_tier": a["attestation_tier"],
            "reach_score": a["reach_score"],
        }
        existing = (
            supabase.table("artists")
            .select("id")
            .eq("display_name", a["display_name"])
            .limit(1)
            .execute()
        )
        if existing.data:
            artist_id = existing.data[0]["id"]
            supabase.table("artists").update(fields).eq("id", artist_id).execute()
            artists_updated += 1
        else:
            inserted = (
                supabase.table("artists")
                .insert({"display_name": a["display_name"], **fields})
                .execute()
            )
            artist_id = inserted.data[0]["id"]
            artists_added += 1
            print(f"artist +  {a['display_name']}")

        for w in a["works"]:
            title = w["title"]
            description = w["description"]
            medium = w["medium"]
            price_cents = w.get("price_from_cents") or MEDIUM_PRICE_CENTS.get(
                medium, 4000
            )
            existing_work = (
                supabase.table("works")
                .select("id")
                .eq("artist_id", artist_id)
                .eq("title", title)
                .limit(1)
                .execute()
            )
            if existing_work.data:
                supabase.table("works").update(
                    {
                        "description": description,
                        "medium": medium,
                        "price_from_cents": price_cents,
                    }
                ).eq("id", existing_work.data[0]["id"]).execute()
                works_updated += 1
                continue

            embedding = _embed(openai_client, f"{title}. {description}")
            supabase.table("works").insert(
                {
                    "artist_id": artist_id,
                    "title": title,
                    "description": description,
                    "medium": medium,
                    "price_from_cents": price_cents,
                    "embedding": embedding,
                }
            ).execute()
            works_added += 1
            print(f"work   +  {a['display_name']} / {title}")

    print(
        f"\ndone. artists: +{artists_added} / ~{artists_updated}, "
        f"works: +{works_added} / ~{works_updated}"
    )


if __name__ == "__main__":
    main()
