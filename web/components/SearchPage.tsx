"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { SearchLanding } from "@/components/SearchLanding";

type Mode = "artist" | "work";
type Medium = "music" | "illustration" | "video" | "character" | "any";

type WorkResult = {
  artist_id: string;
  work_id: string;
  title: string;
  medium: string;
  score: number;
};

type Artist = {
  id: string;
  display_name: string;
  bio: string | null;
};

// Visual-only attestation — hardcoded for MVP.
const VERIFIED_ARTISTS = new Set(["Ava Chen", "Noah Patel"]);

const MEDIA: { label: string; value: Medium }[] = [
  { label: "Music", value: "music" },
  { label: "Art", value: "illustration" },
  { label: "Video", value: "video" },
  { label: "IP", value: "character" },
  { label: "Any", value: "any" },
];

const REFINE_GROUPS: { label: string; chips: string[] }[] = [
  { label: "Feel", chips: ["less jazzy", "more tape", "warmer", "darker"] },
  { label: "Budget", chips: ["under $200", "$200–500", "$500+"] },
  { label: "Availability", chips: ["this week", "this month"] },
];

const ART_CYCLE = ["a2", "a3", "a4", "a5", "a6"];

function artFor(i: number) {
  return ART_CYCLE[i % ART_CYCLE.length];
}

export function SearchPage() {
  const params = useSearchParams();
  const initialQ = params.get("q") ?? "";
  const initialMode = (params.get("mode") as Mode) ?? "artist";

  if (!initialQ.trim()) {
    return <SearchLanding defaultMode={initialMode} />;
  }

  return <SearchResults initialQ={initialQ} initialMode={initialMode} />;
}

function SearchResults({
  initialQ,
  initialMode,
}: {
  initialQ: string;
  initialMode: Mode;
}) {

  const [query, setQuery] = useState(initialQ);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [medium, setMedium] = useState<Medium>("any");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [applyLabel, setApplyLabel] = useState("Apply");

  const [artists, setArtists] = useState<Artist[]>([]);
  const [works, setWorks] = useState<WorkResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from("artists")
      .select("id, display_name, bio")
      .order("display_name")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setError(error.message);
        else setArtists((data ?? []) as Artist[]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (mode !== "work") return;
    const q = query.trim();
    if (!q) return;
    let cancelled = false;
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: q, limit: 20 }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`search failed: ${res.status}`);
        const data = (await res.json()) as WorkResult[];
        if (!cancelled) {
          setWorks(data);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "search failed");
      });
    return () => {
      cancelled = true;
    };
  }, [mode, query]);

  const artistById = useMemo(() => {
    const m = new Map<string, Artist>();
    for (const a of artists) m.set(a.id, a);
    return m;
  }, [artists]);

  const filteredArtists = useMemo(() => {
    let list = artists;
    if (verifiedOnly) list = list.filter((a) => VERIFIED_ARTISTS.has(a.display_name));
    return list;
  }, [artists, verifiedOnly]);

  const filteredWorks = useMemo(() => {
    let list = works;
    if (medium !== "any") list = list.filter((w) => w.medium === medium);
    if (verifiedOnly) {
      list = list.filter((w) => {
        const a = artistById.get(w.artist_id);
        return a ? VERIFIED_ARTISTS.has(a.display_name) : false;
      });
    }
    return list;
  }, [works, medium, verifiedOnly, artistById]);

  function togglePicked(chip: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(chip)) next.delete(chip);
      else next.add(chip);
      return next;
    });
  }

  function onApply() {
    setApplyLabel(picked.size ? "Filtered" : "Pick chips above");
    setTimeout(() => setApplyLabel("Apply"), 1800);
  }

  function setModeAndRefetch(m: Mode) {
    setMode(m);
  }

  const pickedCount = picked.size;
  const currentQuery = query.trim() || "—";

  return (
    <section className="search">
      <aside className="brief-col">
        <div className="kicker">Searching</div>
        <h3
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          onBlur={(e) => setQuery(e.currentTarget.textContent?.replace(/\.$/, "") ?? "")}
          title="Edit to refine"
        >
          {currentQuery}.
        </h3>
        <div className="edit-hint">↑ edit to refine</div>

        <div className="search-mode-row">
          <button
            type="button"
            className={`search-mode ${mode === "artist" ? "on" : ""}`}
            onClick={() => setModeAndRefetch("artist")}
          >
            Artists
          </button>
          <button
            type="button"
            className={`search-mode ${mode === "work" ? "on" : ""}`}
            onClick={() => setModeAndRefetch("work")}
          >
            Works
          </button>
        </div>

        <label className="verified-row">
          <input
            type="checkbox"
            checked={verifiedOnly}
            onChange={(e) => setVerifiedOnly(e.target.checked)}
          />
          Verified only <span className="verified-badge" style={{ fontSize: 8 }}>✓</span>
        </label>

        <div className="medium-row">
          {MEDIA.map((m) => (
            <button
              key={m.value}
              type="button"
              className={`med ${medium === m.value ? "on" : ""}`}
              onClick={() => setMedium(m.value)}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="brief-thread">
          <div className="brief-resp">
            ↳ Showing{" "}
            <strong>
              {mode === "artist" ? filteredArtists.length : filteredWorks.length}{" "}
              {mode === "artist" ? "artists" : "works"}
            </strong>
            . Narrow by:
          </div>

          {REFINE_GROUPS.map((g) => (
            <div className="refine-group" key={g.label}>
              <div className="refine-label">{g.label}</div>
              <div className="refine-opts">
                {g.chips.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`sug ${picked.has(c) ? "on" : ""}`}
                    onClick={() => togglePicked(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <button type="button" className="apply-btn" onClick={onApply}>
            <span className="lbl">{applyLabel}</span>
            <span className="arrow">→</span>
            <span className="count-preview">
              {pickedCount ? `${pickedCount} filter${pickedCount > 1 ? "s" : ""} selected` : ""}
            </span>
          </button>
        </div>
      </aside>

      <main className="results-col">
        <div className="results-head">
          <div className="count">
            {mode === "artist" ? filteredArtists.length : filteredWorks.length}{" "}
            {mode === "artist" ? "artists" : "works"},{" "}
            <em>{verifiedOnly ? "verified only" : "ranked by feel"}</em>
          </div>
          <div className="sort">Sort · Relevance ↓</div>
        </div>

        {error && (
          <div className="results-head">
            <div className="empty-note" style={{ color: "var(--riso-red)" }}>
              {error}
            </div>
          </div>
        )}

        {mode === "artist" ? (
          <div className="results-grid">
            {filteredArtists.map((a, i) => (
              <Link key={a.id} href={`/artist/${a.id}`} className="artist-card">
                <div className="img-wrap">
                  <div className={`art ${artFor(i)}`} />
                  <span className="no">№ {String(i + 1).padStart(2, "0")}</span>
                </div>
                <h3>
                  {a.display_name}{" "}
                  {VERIFIED_ARTISTS.has(a.display_name) ? (
                    <span className="verified-badge">verified</span>
                  ) : (
                    <span className="attest-badge">self-declared</span>
                  )}
                </h3>
                <div className="sub">Artist · Independent</div>
                <div className="blurb">&ldquo;{a.bio ?? "No bio yet."}&rdquo;</div>
                <div className="foot">
                  <span className="match">·  {(90 - i * 4)}% match</span>
                  <span className="reach">view profile</span>
                </div>
              </Link>
            ))}
            {filteredArtists.length === 0 && !error && (
              <div className="empty-note" style={{ gridColumn: "1 / -1" }}>
                No artists match. (Full artist search arrives in phase 2; for now this lists the seeded roster.)
              </div>
            )}
          </div>
        ) : (
          <div className="works-list">
            {filteredWorks.map((w, i) => {
              const a = artistById.get(w.artist_id);
              const name = a?.display_name ?? "Unknown";
              const verified = VERIFIED_ARTISTS.has(name);
              return (
                <Link key={w.work_id} href={`/work/${w.work_id}`} className="work-row">
                  <div className="work-row-no">№ {String(i + 1).padStart(2, "0")}</div>
                  <div className="work-row-art">
                    <div className={`art ${artFor(i)}`} />
                    <span className="work-row-play">▶</span>
                  </div>
                  <div className="work-row-info">
                    <div className="work-row-title">
                      {w.title}{" "}
                      {verified ? (
                        <span className="verified-badge">verified</span>
                      ) : (
                        <span className="attest-badge">self-declared</span>
                      )}
                    </div>
                    <div className="work-row-by">
                      by {name} · {w.medium}
                    </div>
                  </div>
                  <div className="work-row-meta">
                    <div className="work-row-match">
                      {(w.score * 100).toFixed(0)}% match
                    </div>
                  </div>
                  <div className="work-row-price">
                    <div className="p-cta">license →</div>
                  </div>
                </Link>
              );
            })}
            {filteredWorks.length === 0 && !error && (
              <div className="empty-note" style={{ padding: "24px 0" }}>
                {query.trim() ? "No results." : "Type a query on the home page."}
              </div>
            )}
          </div>
        )}
      </main>
    </section>
  );
}
