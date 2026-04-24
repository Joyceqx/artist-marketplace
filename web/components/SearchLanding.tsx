"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Mode = "artist" | "work";

const EXAMPLES = [
  "warm pastel illustrator for a kids' book about insects",
  "90s skater videographer, VHS feel, under $500",
  "ambient synth for a short film closing credit",
  "melancholic folk writer for a product narrative",
];

export function SearchLanding({ defaultMode = "artist" }: { defaultMode?: Mode }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode>(defaultMode);

  function submit(q: string, m: Mode = mode) {
    const next = q.trim();
    if (!next) return;
    const params = new URLSearchParams({ q: next, mode: m });
    router.push(`/search?${params.toString()}`);
  }

  return (
    <section className="search-landing">
      <div className="sl-kicker">Search · Plain english, please</div>
      <h1 className="sl-title">
        What are you<br />
        looking <em>for?</em>
      </h1>
      <div className="sl-lede">
        Describe it the way you&rsquo;d describe it to a friend. Mood, feel,
        references, constraints — we&rsquo;ll find artists or works that match.
      </div>

      <div className="sl-field">
        <div className="label">I&rsquo;m looking for ——</div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit(query);
          }}
          placeholder="moody lo-fi music for a Tokyo travel vlog"
          autoFocus
        />
        <button className="enter" type="button" onClick={() => submit(query)}>
          ↵ ENTER
        </button>
      </div>

      <div className="sl-mode-row">
        <button
          type="button"
          className={`sl-mode ${mode === "artist" ? "on" : ""}`}
          onClick={() => setMode("artist")}
        >
          An artist
        </button>
        <button
          type="button"
          className={`sl-mode ${mode === "work" ? "on" : ""}`}
          onClick={() => setMode("work")}
        >
          A specific work
        </button>
      </div>

      <div className="sl-examples">
        <div className="sl-examples-label">Try a prompt ——</div>
        <div className="sl-ex-list">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              className="sl-ex"
              onClick={() => submit(ex)}
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      <div className="sl-tips">
        <div className="sl-tips-label">How to search well ——</div>
        Mood words work (&ldquo;warm,&rdquo; &ldquo;rainy,&rdquo;
        &ldquo;melancholic but not sad&rdquo;). References work (&ldquo;like
        early Low, but slower&rdquo;). Constraints work (&ldquo;under
        $200,&rdquo; &ldquo;responds within 48h&rdquo;). We&rsquo;ll rank by
        feel, not keywords.
      </div>
    </section>
  );
}
