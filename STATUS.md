# STATUS

Living doc. Update after each work session.

Last updated: **2026-04-24**

---

## Where we are

**Phase 1.5 + all 5 design screens: complete.** Search works for both artists and works modes, with diversity re-rank on works. Home, search-landing, search-results, work detail, artist profile, and artists directory are all real — driven by live Supabase data with `lib/mock.ts` filling fields the schema doesn't have yet.

| Area | State |
|---|---|
| `api/` FastAPI backend | Two live endpoints: `POST /search` (works mode with diversity re-rank via round-robin by `artist_id`) and `POST /search/artists` (artist mode, aggregates top-3 work scores per artist, joins `artists` table). `_embed` / `_rank` / `_rank_artists` are clean seams for future ranking changes. |
| `api/scripts/seed.py` | Idempotent seeder. 5 artists, 9 works across all 4 mediums. |
| `web/` Next.js frontend | All 5 IndiStream screens live: `/` (home), `/search` (landing + results), `/artists` (directory), `/artist/[id]` (profile), `/work/[id]` (detail). Nav, typography, paper grain, riso-art placeholders, verified-badge system all in place. Raw CSS in `app/globals.css`. Builds clean, 0 npm vulns. |
| `web/lib/supabase/{client,server}.ts` + `lib/mock.ts` | `@supabase/ssr` helpers for browser + server reads (server uses Next 16 `await cookies()`). `mock.ts` centralizes placeholder fields (location, reach, priceFrom, tag, verified) until schema grows. |
| `supabase/migrations/0001_init.sql` | Idempotent. Applied to live project. **HNSW** vector index (switched from IVFFlat — IVFFlat lists=100 silently returned 0 rows with our tiny seed set). |
| `vercel.json` | Configured for combined Next.js + Python function deploy. Untested. |

---

## Completed

### 2026-04-24 — phase 0 + phase 1

**Phase 0 (setup):**
- Scaffolded `web/` (Next.js 16.2.4, React 19.2.4, TS, Tailwind v4, App Router). Installed `@supabase/supabase-js` + `@supabase/ssr`.
- Applied `0001_init.sql` to live Supabase project. Made migration fully idempotent (enums + RLS policies).
- Resolved `npm audit` advisories via `overrides: { postcss: "^8.5.10" }`.
- Created Python venv, fixed corrupted `requirements.txt` line, pinned `httpx==0.27.2` for `supabase==2.10.0` compat, installed all deps.
- Filled `api/.env` and `web/.env.local`. Smoke-tested backend stub.

**Phase 1 (search MVP):**
- Implemented `POST /search` in `api/main.py` with `_embed` / `_rank` extension seams.
- Wrote idempotent seed script; seeded 5 artists and 9 works with embeddings.
- **Found + fixed:** IVFFlat `lists=100` index silently returned 0 rows because default `probes=1` missed empty partitions with a tiny dataset. Switched to HNSW (modern default, no tuning, works at any size). Updated migration + provided one-shot SQL for live DB.
- Wrote `web/lib/supabase/{client,server}.ts` using `@supabase/ssr` (server variant uses `await cookies()` for Next 16).
- **End-to-end verified in browser:** `foggy coastal morning` → Ocean fog (0.688), Quiet harbor (0.592), Tidepool (0.414), etc. Rankings semantically accurate.

**IndiStream design port (scope B — Home + Search only):**
- Ported the prototype's design system to `web/app/globals.css`: paper palette, Fraunces + IBM Plex Mono + Caveat via Google Fonts `<link>`, paper-grain body overlay, riso-art gradient placeholders, stamps / tape / scribble-btn / verified-badge / attest-badge, home and search layouts.
- `app/layout.tsx`: fonts + site-wide nav. `components/SiteNav.tsx` client component highlights the active route via `usePathname`.
- `app/page.tsx` (Home): issue line, dense hero (slogan + stats), search field with artist/work mode toggle + try-chips (client island in `HomeHero.tsx`), this-week strip, manifesto, "For buyers" band, footer. Submit routes to `/search?q=…&mode=…`.
- `app/search/page.tsx` + `components/SearchPage.tsx`: now branches — no `?q` param renders `<SearchLanding />` (empty-state); with `?q` renders `<SearchResults />` (the existing two-column results UI).
- `components/SearchLanding.tsx`: "What are you looking for?" masthead, single input with mode toggle, 4 example-prompt links, "How to search well" tips block. Submit navigates to `/search?q=…&mode=…` → converges with home-page submits on the same results view.
- Results view: editable `<h3>` query, mode toggle, verified-only filter, medium chips, refine groups (Feel / Budget / Availability) with "Apply →" CTA. Right column is artist cards (mode=artist, lists seeded roster) or work rows (mode=work, calls real `/search`). Artist name lookup resolved client-side from Supabase.
- Attestation: `Ava Chen` and `Noah Patel` hardcoded as verified visually (no DB column yet).
- Stubs at `/artists` and `/work` (linked from cards / tape-strip / nav) show a placeholder back-to-index note.
- `npm run lint`: 0 errors, 1 non-blocking warning about font loading strategy. `npm run build`: 7 static routes, clean.

**Detail screens (post-port, same session):**
- `/work/[id]` — server component, fetches work + artist + more-from-artist; `LicensePanel` client subcomponent for tier selection (3 tiers derived from `artistMock.priceFrom`).
- `/artist/[id]` — server component, fetches artist + their works; `CommissionForm` client subcomponent (brief textarea + toggleable chips for attach/timeline/budget, not wired to a submit yet).
- `/artists` — server component, fetches all artists + works, groups by medium. First 3 rendered as featured cards with tape tags, rest as numbered directory rows.
- Search result work rows and artist cards now deep-link to the correct dynamic route.

**Phase 1.5 — diversity re-rank + real artist search (just shipped):**
- **`/search` (works mode):** `_rank` now over-fetches (`limit * 5`) from `search_works`, then buckets by `artist_id` and round-robins. Preserves similarity order within each bucket. Visible effect: queries like "quiet ambient music" that previously returned 3 music works from one artist now return one-per-artist until the pool is drained.
- **`/search/artists` (new endpoint):** `_rank_artists` aggregates top-3 work similarities per artist (mean), joins `artists` for `display_name` + `bio`, returns a ranked list with `top_work_title`, `top_work_medium`, `matching_works`. No schema change — reuses existing work embeddings.
- **`SearchPage`:** artist mode now fetches `/search/artists` by current query (previously listed all 5 seeded artists regardless of query). Artist cards show `{score}% match · via "{top_work_title}"`.
- Tested semantically: "foggy coast" → Leo Brown (quiet landscapes, 0.46) → Ava Chen (coastal illustrator, 0.43) → Sora Kim (synth, 0.30). Consistent with bios.

---

## What to do next (sequenced)

### 1. Schema alignment — drop `lib/mock.ts`

The UI is driven by real data for title / description / medium / bios / search scores, but these fields are still mocked per artist: `location`, `reach`, `priceFrom`, `tag` (emerging/new/established), `verified`. Proposal:

- [ ] Migration `0002_artist_profile.sql`: add `location text`, `website_url text`, `attestation_tier attestation_tier` (enum: `self_declared` | `verified`) on `public.artists`.
- [ ] Migration `0003_work_pricing.sql`: add `price_from_cents int`, `duration_seconds int` on `public.works`. Optional `license_tiers jsonb` for per-work overrides.
- [ ] Update `scripts/seed.py` to populate the new fields.
- [ ] Replace `lib/mock.ts` usage call-site-by-call-site, then delete the file.

### 2. Phase 1.5 continued (optional)

- [ ] Consider a real bio/name embedding for artists (new `embedding` column on `public.artists`) so artist search finds people without works yet. Current derivation from works is fine until we onboard artists who haven't listed anything.
- [ ] Hybrid ranking: blend cosine with a lexical match on `title`/`description` (Postgres `ts_rank`). Only do this if real queries expose the need.
- [ ] Return `total_candidates` in the response so the frontend can show "ranked N of M" if useful.

### 3. Phase 2 — artist onboarding

- [ ] Supabase auth (magic link) in `web/`.
- [ ] "Become an artist" flow: insert into `public.artists` tied to `auth.uid()` — the RLS writes require this row to exist before `works` inserts succeed. Worth an explicit assertion in the flow.
- [ ] Work upload: Supabase Storage bucket + `POST /works` endpoint (backend embeds title+description and inserts).

### 4. Phase 3 — listings / commerce terms, then deploy

- [ ] Listings CRUD for artists.
- [ ] Public work detail page.
- [ ] Deploy to Vercel, wire prod env vars, smoke-test end-to-end.

---

## Blockers

- None. Phase 1.5 is pure backend work — no new external accounts needed.
- **Vercel account** is the only outstanding external dep; blocks deploy only.

---

## Open risks / watch-items

- **Next 16 + React 19 + `@supabase/ssr` compat.** Currently fine. If server components start misbehaving, check `@supabase/ssr` release notes first.
- **HNSW recall** — confirm once we have thousands of works. No tuning for now.
- **`overrides: { postcss }` in `web/package.json`.** Drop when a Next.js release ships patched postcss bundled.
- **RLS write chain:** `works` insert requires an `artists` row tied to `auth.uid()`. The onboarding flow must create that row first — easy to forget.
- **`search_works` RPC runs under caller RLS** (not `security definer`). Fine now; flag if we ever restrict work visibility.
- **Key-format mix:** `api/.env` uses legacy JWT service key; `web/.env.local` uses new `sb_publishable_*`. Both work, worth unifying later.
- **Verified tier is visual-only** (hardcoded whitelist in `SearchPage.tsx` + `lib/mock.ts`). Schema-align in the next session.
- **Mock stats on home** ("412 Artists", "94% threads → license", etc.) are prototype copy, not live numbers. Replace with derived queries before anything ships externally.
- **Font loading warning** (`@next/next/no-page-custom-font`): converting `<link>` → `next/font/google` would silence it, at the cost of reworking every `font-family: 'Fraunces'` CSS reference to `var(--font-fraunces)`. Deferred.
- **Artist search is derivative** — scores come from aggregating work similarities, so an artist with no works yet is invisible to search. Fine for current seed data; revisit when onboarding lets artists sign up before listing.

---

## Resolved

- ~~`npm audit` 2 moderate advisories~~ — `overrides` pin to postcss ^8.5.10.
- ~~`0001_init.sql` not idempotent~~ — enums + policies wrapped/guarded.
- ~~Corrupted `requirements.txt` (leading "I h")~~ — fixed.
- ~~`httpx==0.28.1` vs `supabase==2.10.0` conflict~~ — pinned `httpx==0.27.2`.
- ~~IVFFlat `lists=100` silently returns 0 rows on tiny datasets~~ — switched index to HNSW.
- ~~One artist can dominate the top-K in work search~~ — diversity re-rank via round-robin by `artist_id` in `_rank`.
- ~~Artist search is a placeholder listing all seeded artists~~ — new `/search/artists` endpoint aggregates work scores by artist.
- ~~`str | None` used in Pydantic models~~ — python 3.9 incompatible; switched to `Optional[str]`.
