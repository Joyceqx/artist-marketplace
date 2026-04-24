"""Expand hand-written artist briefs into full bios + works via gpt-4o-mini.

Writes to api/scripts/seed_data.json. Reviewable, deterministic once written,
regeneratable on demand. seed.py reads this file and upserts.

Run from api/ with the venv activated:
    python scripts/generate_synthetic.py
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env")

MODEL = "gpt-4o-mini"
OUT = Path(__file__).resolve().parent / "seed_data.json"

# Per-medium starting prices (cents). Matches seed.py.
MEDIUM_PRICE_CENTS: dict[str, int] = {
    "music": 4000,
    "illustration": 8000,
    "video": 14000,
    "character": 12000,
}

# 25 briefs: (display_name, medium, location, verified, reach_score, works_count, style)
BRIEFS: list[tuple[str, str, str, bool, int, int, str]] = [
    ("Kenji Arai",        "music",        "Kyoto, JP",         False, 8000,  12, "ambient field-recording musician; long-form drones, vintage tape hiss, bird and rain samples"),
    ("Olu Adeyemi",       "music",        "Lagos, NG",         False, 4500,  7,  "Afrobeat producer; polyrhythmic drums, warm analog synths, Yoruba vocal samples"),
    ("Talia Forsyth",     "music",        "Dunedin, NZ",       False, 2400,  6,  "open-tuning guitarist; reverb-soaked, post-rock ambience, patient pacing"),
    ("Marcus Winter",     "music",        "Reykjavík, IS",     True,  9200,  10, "modular synth dronist; glacial textures, 30-minute pieces, very slow tempos"),
    ("Aya Tolentino",     "music",        "Manila, PH",        False, 900,   3,  "bossa-tinged jazz pianist; humid-city recordings, warm mic bleed"),
    ("Elias Dubois",      "music",        "Montréal, CA",      False, 500,   2,  "harpsichord plus electronica; baroque samples chopped into broken beats"),
    ("Pilar Vega",        "illustration", "Lisbon, PT",        True,  11000, 13, "folk-tale ink-and-gouache; botanical detail, rust-ochre palettes, Iberian motifs"),
    ("Mireia Pons",       "illustration", "Barcelona, ES",     False, 5200,  7,  "risograph zine artist; two-color prints, skate culture, punk flyers"),
    ("Anja Larsen",       "illustration", "Copenhagen, DK",    False, 3100,  5,  "minimal editorial illustrator; hairline pen, negative space, newsprint restraint"),
    ("Suri Patel",        "illustration", "Mumbai, IN",        False, 1200,  3,  "botanical gouache painter; monsoon palettes, field-journal format"),
    ("Henrik Volk",       "illustration", "Oslo, NO",          False, 2800,  6,  "graphic-novel ink artist; dense crosshatch, noir urban scenes"),
    ("Zuri Okafor",       "illustration", "Accra, GH",         False, 4100,  5,  "afrofuturist digital painter; portraits with wax-print motifs and chrome"),
    ("Juno Fernández",    "illustration", "Lima, PE",          False, 700,   2,  "newsprint comic-strip artist; satirical four-panel format, political wit"),
    ("Ines Moreau",       "video",        "Marseille, FR",     True,  7800,  11, "16mm documentary filmmaker; handheld portraits of tradespeople, slow pacing"),
    ("Raza Kahn",         "video",        "Karachi, PK",       False, 3600,  6,  "motion-graphic title designer; tarot-geometric, built for film credits"),
    ("Daria Petrov",      "video",        "Tallinn, EE",       False, 1400,  3,  "slow-cinema vlogger; dusk-to-dark loops, windswept northern coast"),
    ("Theo Nakamura",     "video",        "Osaka, JP",         False, 950,   2,  "skate-punk super-8 cinematographer; grainy, no-edit long takes"),
    ("Mira Al-Sayed",     "video",        "Amman, JO",         False, 2200,  5,  "drone-landscape videographer; stone canyons, geological time-lapses"),
    ("Oscar Dias",        "video",        "Luanda, AO",        False, 400,   1,  "coastal documentarian; long-take interviews with community elders, salt-air audio"),
    ("Asher Coen",        "character",    "Tel Aviv, IL",      False, 6100,  10, "stop-motion animator; wool-felt creatures, surreal bestiaries, handmade armatures"),
    ("Youssef Rahim",     "character",    "Cairo, EG",         False, 4800,  8,  "painterly game concept artist; desert mythology, dense atmospherics"),
    ("Luna Prieto",       "character",    "Buenos Aires, AR",  False, 3200,  6,  "chibi sprite artist; pixel-art sheets, retro-console aesthetic"),
    ("Wren Hollis",       "character",    "Dublin, IE",        False, 1100,  3,  "gothic ink illustrator; bog-horror creatures, folkloric beasts"),
    ("Ben Tam",           "character",    "Singapore, SG",     False, 800,   2,  "mythological plate painter; cross-cultural bestiary with painted-plate compositions"),
    ("Kenneth Eko",       "character",    "Port Harcourt, NG", False, 300,   1,  "mask-making character designer; ritual figures, woodcut-influenced"),
]

PROMPT_TEMPLATE = """You are writing concise editorial copy for an independent artist marketplace.

Artist brief:
- Name: {name}
- Medium: {medium}
- Location: {location}
- Style: {style}

Produce:
1. bio: one or two crisp sentences in a quiet, curatorial tone — like a gallery label or album liner note. Concrete sensory detail, no marketing hype, no hedging adjectives. Do NOT put the name in the bio.
2. works: exactly {n} entries. Each:
   - title: 2 to 5 words, evocative, distinctive within this artist's catalogue
   - description: one sentence with specific technical and artistic details (instruments / materials / techniques; mood; setting). Each description should be noticeably different from the others — they should be semantically searchable.

Do not repeat title words across this artist's works. Keep the voice consistent to the artist.

Return strict JSON in this exact shape:
{{"bio": "...", "works": [{{"title": "...", "description": "..."}}]}}
"""


def generate() -> None:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        sys.exit("OPENAI_API_KEY not set")
    client = OpenAI(api_key=api_key)

    # Preserve previously generated artists if re-running — skip those already present
    # so a retry doesn't double-spend on regenerating artists that came out fine.
    prior: dict[str, dict] = {}
    if OUT.exists():
        try:
            for entry in json.loads(OUT.read_text()):
                prior[entry["display_name"]] = entry
        except json.JSONDecodeError:
            pass

    out: list[dict] = []
    for name, medium, location, verified, reach, n_works, style in BRIEFS:
        if name in prior and len(prior[name].get("works", [])) == n_works:
            print(f"  {name:20} · cached")
            out.append(prior[name])
            continue

        resp = client.chat.completions.create(
            model=MODEL,
            messages=[
                {
                    "role": "user",
                    "content": PROMPT_TEMPLATE.format(
                        name=name, medium=medium, location=location, style=style, n=n_works
                    ),
                }
            ],
            response_format={"type": "json_object"},
            temperature=0.8,
        )
        content = resp.choices[0].message.content or "{}"
        try:
            data = json.loads(content)
        except json.JSONDecodeError:
            print(f"  {name:20} · BAD JSON, skipping")
            continue

        bio = (data.get("bio") or "").strip()
        works_raw = data.get("works") or []
        works = [
            {
                "title": (w.get("title") or "").strip(),
                "description": (w.get("description") or "").strip(),
                "medium": medium,
                "price_from_cents": MEDIUM_PRICE_CENTS.get(medium, 4000),
            }
            for w in works_raw
            if (w.get("title") and w.get("description"))
        ]
        if not bio or not works:
            print(f"  {name:20} · incomplete, skipping")
            continue
        if len(works) != n_works:
            print(f"  {name:20} · asked {n_works}, got {len(works)}")

        out.append(
            {
                "display_name": name,
                "bio": bio,
                "location": location,
                "attestation_tier": "verified" if verified else "self_declared",
                "reach_score": reach,
                "works": works,
            }
        )
        print(f"  {name:20} · bio + {len(works)} works")

    OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False))
    total_works = sum(len(a["works"]) for a in out)
    print(f"\nwrote {OUT.name}: {len(out)} artists, {total_works} works")


if __name__ == "__main__":
    generate()
