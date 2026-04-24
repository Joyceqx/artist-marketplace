"use client";

import { useState } from "react";

type Tier = {
  key: string;
  title: string;
  desc: string;
  price: number;
};

export function LicensePanel({
  tiers,
  defaultKey,
}: {
  tiers: Tier[];
  defaultKey: string;
}) {
  const [picked, setPicked] = useState(defaultKey);
  const current = tiers.find((t) => t.key === picked) ?? tiers[0];

  return (
    <div className="license-panel">
      <div className="kicker">License this work</div>
      {tiers.map((t) => (
        <button
          key={t.key}
          type="button"
          className={`license-row ${picked === t.key ? "pick" : ""}`}
          onClick={() => setPicked(t.key)}
        >
          <div>
            <div className="lr-title">{t.title}</div>
            <div className="lr-desc">{t.desc}</div>
          </div>
          <div className="lr-price">${t.price}</div>
        </button>
      ))}
      <div className="license-ctas">
        <button type="button" className="scribble-btn accent">
          <span>License for ${current.price}</span>
        </button>
        <button type="button" className="scribble-btn">
          <span>Ask about stems</span>
        </button>
      </div>
      <div className="mono-caption" style={{ marginTop: 14, textAlign: "center" }}>
        Instant delivery · Watermark-free · Pays artist 85%
      </div>
    </div>
  );
}
