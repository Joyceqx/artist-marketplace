"""Seed a small set of artists + works with embeddings.

Idempotent: safe to re-run. Skips rows that already exist by display_name / title.
Uses the service_role key to bypass RLS on writes.

Run from repo root:
    cd api && source .venv/bin/activate && python -m scripts.seed
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI
from supabase import create_client

load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env")

EMBEDDING_MODEL = "text-embedding-3-small"

SEED: list[tuple[str, str, list[tuple[str, str, str]]]] = [
    ("Ava Chen", "Minimalist illustrator, pastel palettes, coastal themes.", [
        ("Ocean fog", "soft watercolor of coastal fog at dawn, muted blues and greys", "illustration"),
        ("City rain", "neon-tinged illustration of rain on asphalt at night", "illustration"),
    ]),
    ("Noah Patel", "Indie lofi beatmaker blending rain samples and tape hiss.", [
        ("Midnight loop", "lofi hip-hop instrumental with soft rain and muted drums", "music"),
        ("Window light", "ambient piano piece with warm tape saturation", "music"),
    ]),
    ("Maya Gomez", "Character designer for indie games.", [
        ("Fox warrior", "armored kitsune warrior character concept in ink and watercolor", "character"),
        ("Sky whale", "gentle floating sky whale creature with trailing seaweed", "character"),
    ]),
    ("Leo Brown", "Documentary cinematographer focused on quiet landscapes.", [
        ("Quiet harbor", "short video study of a fog-shrouded harbor at first light", "video"),
        ("Tidepool", "macro video of a tidepool, slow camera drift over kelp", "video"),
    ]),
    ("Sora Kim", "Multidisciplinary artist, synth soundscapes and abstract visuals.", [
        ("Aurora drift", "ambient synth drone evoking slow polar light", "music"),
    ]),
]


def _embed(client: OpenAI, text: str) -> list[float]:
    resp = client.embeddings.create(model=EMBEDDING_MODEL, input=text)
    return resp.data[0].embedding


def main() -> None:
    openai_client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    supabase = create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_KEY"],
    )

    added_artists = added_works = skipped_works = 0

    for display_name, bio, works in SEED:
        existing = (
            supabase.table("artists")
            .select("id")
            .eq("display_name", display_name)
            .limit(1)
            .execute()
        )
        if existing.data:
            artist_id = existing.data[0]["id"]
        else:
            inserted = (
                supabase.table("artists")
                .insert({"display_name": display_name, "bio": bio})
                .execute()
            )
            artist_id = inserted.data[0]["id"]
            added_artists += 1
            print(f"artist +  {display_name}")

        for title, description, medium in works:
            existing_work = (
                supabase.table("works")
                .select("id")
                .eq("artist_id", artist_id)
                .eq("title", title)
                .limit(1)
                .execute()
            )
            if existing_work.data:
                skipped_works += 1
                continue

            embedding = _embed(openai_client, f"{title}. {description}")
            supabase.table("works").insert(
                {
                    "artist_id": artist_id,
                    "title": title,
                    "description": description,
                    "medium": medium,
                    "embedding": embedding,
                }
            ).execute()
            added_works += 1
            print(f"work   +  {display_name} / {title}")

    print(
        f"\ndone. artists added: {added_artists}, "
        f"works added: {added_works}, works skipped (already present): {skipped_works}"
    )


if __name__ == "__main__":
    main()
