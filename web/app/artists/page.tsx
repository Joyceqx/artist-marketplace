import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { artFor, formatPrice } from "@/lib/mock";

const FEATURED_TAPE: Array<{ label: string; style?: React.CSSProperties }> = [
  { label: "trending" },
  { label: "indie pick", style: { background: "rgba(45,77,138,0.35)" } },
  {
    label: "new",
    style: { background: "rgba(227,74,47,0.4)", transform: "rotate(-1deg)" },
  },
];

const MEDIA_CHIPS = ["All", "Music", "Illustration", "Video", "Writing"];
const SORT_CHIPS = ["Trending", "Newest", "A–Z"];

type ArtistRow = {
  id: string;
  display_name: string;
  bio: string | null;
  location: string | null;
  attestation_tier: string | null;
};

type WorkRow = {
  id: string;
  artist_id: string;
  medium: string;
  price_from_cents: number | null;
};

export default async function ArtistsPage() {
  const supabase = await createClient();

  const { data: artistsRaw } = await supabase
    .from("artists")
    .select("id, display_name, bio, location, attestation_tier")
    .order("display_name");

  const { data: worksRaw } = await supabase
    .from("works")
    .select("id, artist_id, medium, price_from_cents");

  const artists = (artistsRaw ?? []) as ArtistRow[];
  const worksByArtist = new Map<
    string,
    { count: number; mediums: Set<string>; minPrice: number | null }
  >();
  for (const w of (worksRaw ?? []) as WorkRow[]) {
    const entry = worksByArtist.get(w.artist_id) ?? {
      count: 0,
      mediums: new Set<string>(),
      minPrice: null as number | null,
    };
    entry.count += 1;
    entry.mediums.add(w.medium);
    if (w.price_from_cents != null) {
      entry.minPrice =
        entry.minPrice == null
          ? w.price_from_cents
          : Math.min(entry.minPrice, w.price_from_cents);
    }
    worksByArtist.set(w.artist_id, entry);
  }

  const featured = artists.slice(0, 3);
  const rest = artists.slice(3);

  function primaryMedium(artistId: string): string {
    const ms = worksByArtist.get(artistId)?.mediums;
    if (!ms || ms.size === 0) return "Artist";
    return Array.from(ms)[0];
  }

  return (
    <section className="artists-dir">
      <div className="artists-head">
        <div>
          <div className="kicker">Directory · Vol. 01 · Issue 08</div>
          <h1 className="artists-title">The Artists.</h1>
          <div className="artists-lede">
            A living index of independent makers on IndiStream — sorted by
            momentum, curated by humans, updated weekly.
          </div>
        </div>
        <div className="artists-stats">
          <div>
            <div className="k">Members</div>
            <div className="v">{artists.length}</div>
          </div>
          <div>
            <div className="k">This week</div>
            <div className="v">+{artists.length > 2 ? "02" : "00"}</div>
          </div>
        </div>
      </div>

      <div className="artists-filter-bar">
        <div className="afb-group">
          <span className="afb-label">Medium</span>
          {MEDIA_CHIPS.map((c, i) => (
            <span key={c} className={`afb-chip ${i === 0 ? "on" : ""}`}>
              {c}
            </span>
          ))}
        </div>
        <div className="afb-group">
          <span className="afb-label">Sort</span>
          {SORT_CHIPS.map((c, i) => (
            <span key={c} className={`afb-chip ${i === 0 ? "on" : ""}`}>
              {c}
            </span>
          ))}
        </div>
      </div>

      {featured.length > 0 && (
        <div className="artists-featured">
          <div className="af-head">
            <div className="mono-caption">Featured this week ——</div>
            <h2>Makers worth knowing.</h2>
          </div>
          <div className="af-grid">
            {featured.map((a, i) => {
              const tape = FEATURED_TAPE[i] ?? FEATURED_TAPE[0];
              const stats = worksByArtist.get(a.id);
              return (
                <Link
                  key={a.id}
                  href={`/artist/${a.id}`}
                  className="af-card"
                >
                  <div className="af-art">
                    <div className={`art ${artFor(i)}`} />
                    <span className="af-num">
                      № {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="af-tag tape" style={tape.style}>
                      {tape.label}
                    </span>
                  </div>
                  <h3>{a.display_name}</h3>
                  <div className="af-sub">
                    {primaryMedium(a.id)} · {a.location ?? "Independent"}
                  </div>
                  <div className="af-quote">
                    &ldquo;{a.bio ?? "No bio yet."}&rdquo;
                  </div>
                  <div className="af-foot">
                    <span>
                      {String(stats?.count ?? 0).padStart(2, "0")} works
                    </span>
                    <span>from {formatPrice(stats?.minPrice)}</span>
                    <span className="arr">→</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {rest.length > 0 && (
        <div className="artists-list">
          <div className="al-head">
            <div className="mono-caption">
              Full directory · {artists.length} makers ——
            </div>
            <div className="mono-caption" style={{ color: "var(--ink-mute)" }}>
              sorted by momentum ↓
            </div>
          </div>
          <div className="al-row al-row-head">
            <div>№</div>
            <div>Artist</div>
            <div>Medium · Location</div>
            <div>Signature</div>
            <div>Works</div>
            <div style={{ textAlign: "right" }}>From</div>
          </div>
          {rest.map((a, i) => {
            const stats = worksByArtist.get(a.id);
            return (
              <Link key={a.id} href={`/artist/${a.id}`} className="al-row">
                <div className="al-n">
                  {String(i + 4).padStart(2, "0")}
                </div>
                <div className="al-name">
                  {a.display_name}
                  {a.attestation_tier === "verified" && (
                    <>
                      {" "}
                      <span className="al-dot">·</span>{" "}
                      <span className="al-tag">verified</span>
                    </>
                  )}
                </div>
                <div className="al-meta">
                  {primaryMedium(a.id)} · {a.location ?? "Independent"}
                </div>
                <div className="al-sig">{a.bio ?? "No bio yet."}</div>
                <div className="al-works">
                  {String(stats?.count ?? 0).padStart(2, "0")}
                </div>
                <div className="al-price">{formatPrice(stats?.minPrice)}</div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="artists-footer-cta">
        <div>Can&rsquo;t find who you&rsquo;re looking for?</div>
        <Link href="/search">Describe them in plain english →</Link>
      </div>
    </section>
  );
}
