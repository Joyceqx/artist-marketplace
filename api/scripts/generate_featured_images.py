"""One-shot: generate 3 illustrative images for the home page featured strip.

Outputs: web/public/featured/{pilar,kenji,ines}.webp
(DALL-E returns PNG; this script re-encodes to WebP at quality 82,
shrinking ~2 MB → ~150 KB per image with no visible quality loss.)

Run from api/ with the venv activated:
    python scripts/generate_featured_images.py
"""

from __future__ import annotations

import base64
import io
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI
from PIL import Image

load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env")

OUT = (
    Path(__file__).resolve().parent.parent.parent
    / "web"
    / "public"
    / "featured"
)

PROMPTS: dict[str, str] = {
    "pilar": (
        "Illustration in the style of a folk-tale ink-and-gouache painting: "
        "botanical detail with curling vines, a small songbird perched among "
        "leaves, muted rust-ochre and sea-green palette on warm aged paper, "
        "Iberian tile motifs glimpsed at the edges. Editorial composition "
        "with generous negative space. No text, no watermarks. Painterly."
    ),
    "kenji": (
        "Photograph: a vintage reel-to-reel tape recorder on a dusty wooden "
        "desk in a small Kyoto bedroom studio, soft afternoon window light, "
        "rain beyond the glass, a houseplant in the corner, ambient mood, "
        "muted warm color grading, visible grain, 35mm film aesthetic. "
        "No text."
    ),
    "ines": (
        "Still from a 16mm documentary: close three-quarter silhouette of a "
        "dockworker at dawn on a Mediterranean harbor, misty light on water, "
        "hand-printed film grain, muted warm-cool palette, slow-cinema "
        "composition, quiet, patient. No text."
    ),
}


def main() -> None:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        sys.exit("OPENAI_API_KEY not set")
    client = OpenAI(api_key=api_key)

    OUT.mkdir(parents=True, exist_ok=True)

    for slug, prompt in PROMPTS.items():
        path = OUT / f"{slug}.webp"
        if path.exists():
            print(f"  {slug:8} · cached")
            continue
        resp = client.images.generate(
            model="dall-e-3",
            prompt=prompt,
            size="1024x1024",
            quality="standard",
            response_format="b64_json",
            n=1,
        )
        png_bytes = base64.b64decode(resp.data[0].b64_json)
        Image.open(io.BytesIO(png_bytes)).save(
            path, "WEBP", quality=82, method=6
        )
        print(f"  {slug:8} · wrote {path.name} ({path.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
