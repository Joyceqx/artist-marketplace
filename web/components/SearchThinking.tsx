"use client";

import { useEffect, useState } from "react";

const STEPS = [
  { lbl: "Reading your brief", meta: "parsing tone, medium, intent" },
  {
    lbl: "Embedding into our taste space",
    meta: "30 artists · 30 countries",
  },
  {
    lbl: "Cross-checking license attestations",
    meta: "verified ✓   self-declared ○",
  },
  { lbl: "Curating for diversity & long-tail", meta: "no algorithm slop" },
];

const STEP_DELAYS_MS = [0, 450, 900, 1350];

export function SearchThinking({ query }: { query: string }) {
  const [step, setStep] = useState(-1);

  useEffect(() => {
    const timers = STEP_DELAYS_MS.map((delay, i) =>
      setTimeout(() => setStep(i), delay),
    );
    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, []);

  return (
    <section className="search-thinking">
      <div className="st-wrap">
        <div className="st-kicker">Searching ——</div>
        <h2 className="st-query">{query}.</h2>
        <div className="st-steps">
          {STEPS.map((s, i) => {
            const cls =
              i < step ? "st-step done" : i === step ? "st-step active" : "st-step";
            const tick = i < step ? "✓" : "○";
            return (
              <div key={s.lbl} className={cls}>
                <span className="st-tick">{tick}</span>
                <span className="st-lbl">{s.lbl}</span>
                <span className="st-meta">{s.meta}</span>
              </div>
            );
          })}
        </div>
        <div className="st-hand">no algorithms, just taste ✦</div>
      </div>
    </section>
  );
}
