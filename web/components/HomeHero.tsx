"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const TRY_CHIPS = [
  "warm pastel illustrator for a kids' book",
  "90s skater videographer, VHS feel",
  "ambient synth for a short film",
];

export function HomeHero() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"artist" | "work">("artist");

  function go(q: string, m: "artist" | "work" = mode) {
    const next = q.trim();
    if (!next) return;
    const params = new URLSearchParams({ q: next, mode: m });
    router.push(`/search?${params.toString()}`);
  }

  return (
    <>
      <div className="home-search">
        <div className="home-search-hint hand">type in plain english →</div>
        <div className="home-search-field">
          <div className="label">I&rsquo;m looking for ——</div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") go(query);
            }}
            placeholder="moody lo-fi music for a Tokyo travel vlog"
          />
          <button className="enter" type="button" onClick={() => go(query)}>
            ↵ ENTER
          </button>
        </div>
        <div className="home-mode-row">
          <button
            type="button"
            className={`mode ${mode === "artist" ? "on" : ""}`}
            onClick={() => setMode("artist")}
          >
            An artist
          </button>
          <button
            type="button"
            className={`mode ${mode === "work" ? "on" : ""}`}
            onClick={() => setMode("work")}
          >
            A specific work
          </button>
        </div>
      </div>

      <div className="home-try">
        <span className="mono-caption" style={{ padding: "6px 0" }}>
          Try ——
        </span>
        {TRY_CHIPS.map((c) => (
          <button key={c} type="button" className="try-chip" onClick={() => go(c)}>
            {c}
          </button>
        ))}
      </div>
    </>
  );
}
