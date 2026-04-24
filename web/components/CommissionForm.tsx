"use client";

import { useState } from "react";

const TIMELINES = ["1 week", "2-4 weeks", "flexible"];
const BUDGETS = ["$200–500", "$500–1500", "$1500+"];
const ATTACH = ["+ reference track", "+ mood image", "+ pdf brief"];

export function CommissionForm() {
  const [brief, setBrief] = useState("");
  const [attach, setAttach] = useState<Set<string>>(new Set());
  const [timeline, setTimeline] = useState("2-4 weeks");
  const [budget, setBudget] = useState("$500–1500");

  function toggleAttach(k: string) {
    setAttach((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  return (
    <div className="form">
      <div className="field">
        <div className="label">What do you have in mind?</div>
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="length, mood, references, timeline, budget…"
        />
      </div>
      <div className="field">
        <div className="label">Attach (optional)</div>
        <div className="chips">
          {ATTACH.map((c) => (
            <button
              key={c}
              type="button"
              className={`c ${attach.has(c) ? "on" : ""}`}
              onClick={() => toggleAttach(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <div className="label">Timeline</div>
        <div className="chips">
          {TIMELINES.map((t) => (
            <button
              key={t}
              type="button"
              className={`c ${timeline === t ? "on" : ""}`}
              onClick={() => setTimeline(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <div className="label">Budget range</div>
        <div className="chips">
          {BUDGETS.map((b) => (
            <button
              key={b}
              type="button"
              className={`c ${budget === b ? "on" : ""}`}
              onClick={() => setBudget(b)}
            >
              {b}
            </button>
          ))}
        </div>
      </div>
      <div className="send">
        <button type="button" className="scribble-btn accent">
          <span>Send request →</span>
        </button>
      </div>
    </div>
  );
}
