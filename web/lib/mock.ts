// Visual-only helpers that remain after schema alignment.
// All artist/work fields (location, attestation_tier, price_from_cents, etc.)
// now come from the database — not this file.

export const ART_CYCLE = ["a2", "a3", "a4", "a5", "a6"] as const;

export function artFor(i: number): string {
  return ART_CYCLE[i % ART_CYCLE.length];
}

export function formatReach(score: number | null | undefined): string {
  const n = score ?? 0;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

export function formatPrice(cents: number | null | undefined): string {
  const n = cents ?? 0;
  return `$${Math.round(n / 100)}`;
}
