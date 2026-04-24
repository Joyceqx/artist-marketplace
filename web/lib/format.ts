// Display-formatters used across pages.

// Maps artist display_name → local image slug. Until we add a portrait_url
// column on public.artists, this is the single source of truth.
const PORTRAIT_SLUGS: Record<string, string> = {
  "Pilar Vega": "pilar",
  "Kenji Arai": "kenji",
  "Ines Moreau": "ines",
};

export function portraitFor(displayName: string): string | null {
  const slug = PORTRAIT_SLUGS[displayName];
  return slug ? `/featured/${slug}.webp` : null;
}

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
