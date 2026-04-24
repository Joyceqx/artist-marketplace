// Design fields that don't exist in the schema yet — augment real DB rows
// so the UI reads cohesively. Remove per-field as real columns are added.

export type ArtistMock = {
  location: string;
  reach: string;
  priceFrom: number;
  tag?: "emerging" | "new" | "established";
  verified?: boolean;
};

export const ARTIST_MOCK: Record<string, ArtistMock> = {
  "Ava Chen": {
    location: "Toronto, CA",
    reach: "6.4k · IG",
    priceFrom: 80,
    verified: true,
  },
  "Noah Patel": {
    location: "Brooklyn, NY",
    reach: "12k · Bandcamp",
    priceFrom: 40,
    verified: true,
    tag: "established",
  },
  "Maya Gomez": {
    location: "CDMX, MX",
    reach: "3.8k · IG",
    priceFrom: 120,
    tag: "new",
  },
  "Leo Brown": {
    location: "Portland, OR",
    reach: "1.1k",
    priceFrom: 60,
    tag: "emerging",
  },
  "Sora Kim": {
    location: "Berlin, DE",
    reach: "2.3k",
    priceFrom: 50,
  },
};

export function artistMock(displayName: string): ArtistMock {
  return (
    ARTIST_MOCK[displayName] ?? {
      location: "Independent",
      reach: "—",
      priceFrom: 40,
    }
  );
}

// Per-medium defaults for fields we don't track yet.
export const MEDIUM_MOCK: Record<
  string,
  { duration: string; priceFrom: number }
> = {
  music: { duration: "3:22", priceFrom: 40 },
  illustration: { duration: "—", priceFrom: 80 },
  video: { duration: "2:48", priceFrom: 140 },
  character: { duration: "—", priceFrom: 120 },
};

export function mediumMock(medium: string) {
  return MEDIUM_MOCK[medium] ?? { duration: "—", priceFrom: 40 };
}

export const ART_CYCLE = ["a2", "a3", "a4", "a5", "a6"] as const;

export function artFor(i: number): string {
  return ART_CYCLE[i % ART_CYCLE.length];
}
