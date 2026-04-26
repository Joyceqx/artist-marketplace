# STATUS

Living doc. Update after each work session.

Last updated: **2026-04-25**

---

## Where we are

**Phase 1 closed (tagged `v0.1.0-phase1`). Phase 2 slice 2a shipped: Google OAuth sign-in.** Search + browse stack is fully real, search-thinking transition runs in front of every fetch, all controls go through Apply. Sign-in works end-to-end (verified locally + prod). Live at **https://indistream.vercel.app** (Vercel auto-deploys `main`). Algo experiments live in a worktree at `~/Desktop/artist-marketplace-algo` on branch `search-experiments`.

| Area | State |
|---|---|
| `api/` FastAPI backend | Two live endpoints: `POST /search` (works mode with diversity re-rank via round-robin by `artist_id`) and `POST /search/artists` (artist mode, aggregates top-3 work scores per artist, joins `artists` table). `_embed` / `_rank` / `_rank_artists` are clean seams for future ranking changes. |
| `api/scripts/seed.py` | Idempotent seeder. 5 artists, 9 works across all 4 mediums. |
| `web/` Next.js frontend | 7 screens live: `/` (home), `/join` (sign-in/apply), `/search` (landing + results + thinking transition), `/me` (gated stub), `/artists` (directory), `/artist/[id]` (profile), `/work/[id]` (detail). Nav swaps Join → Me when signed in. Raw CSS in `app/globals.css`. Builds clean, 0 npm vulns. |
| `web/app/api/` Route Handlers | Production search runs here (Node serverless on Vercel): `/api/search`, `/api/search/artists`, `/api/health`. The original FastAPI in `api/` stays for local script work (`scripts/seed.py`, `scripts/generate_*.py`) but isn't in the deploy. |
| `web/app/auth/` | OAuth: `/auth/callback` exchanges the code; `/auth/signout` clears the session. `proxy.ts` (Next 16) refreshes the cookie on every request. |
| `web/lib/supabase/{client,server,admin}.ts` + `lib/format.ts` | `@supabase/ssr` for browser + server with cookies; `admin.ts` for service-role server reads (search RPC). `format.ts` = `artFor`, `formatPrice`, `formatReach`, `portraitFor`. |
| `supabase/migrations/` | `0001_init` (HNSW index, idempotent policies) + `0002_artist_pricing_and_attestation`. Both applied to live project. |
| `vercel.json` | Minimal: `{ "framework": "nextjs" }`. Vercel Root Directory is `web`. |

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

**Phase 1.5 — diversity re-rank + real artist search:**
- **`/search` (works mode):** `_rank` now over-fetches (`limit * 5`) from `search_works`, then buckets by `artist_id` and round-robins. Preserves similarity order within each bucket. Queries like "quiet ambient music" that previously returned 3 music works from one artist now return one-per-artist until the pool is drained.
- **`/search/artists` (new endpoint):** `_rank_artists` aggregates top-3 work similarities per artist (mean), joins `artists`, returns a ranked list with `top_work_title`, `top_work_medium`, `matching_works`.
- **Refine chips now work end-to-end.** Selecting chips in Feel/Budget/Availability and clicking Apply copies `picked → applied` and re-runs the search with the chips appended to the embedding query (e.g. `"quiet music. more tape, warmer"`). Results shift.
- **`SearchPage`:** artist mode fetches `/search/artists` by current query (previously listed all 5 seeded artists regardless of query).

**Schema alignment — drop `lib/mock.ts`:**
- Migration `0002_artist_pricing_and_attestation.sql`: `artists.location text`, `artists.attestation_tier text default 'self_declared'`, `works.price_from_cents int default 4000`. Idempotent.
- Seed script upserts — re-running updates existing rows (location, tier, reach_score on artists; price_from_cents on works) without re-embedding.
- `/search/artists` now returns `location`, `attestation_tier`, `reach_score` alongside the score/top-work fields.
- `SearchPage` verified-only filter is now a real DB predicate (`attestation_tier === 'verified'`) rather than a hardcoded string whitelist.
- Work detail license tiers derive from `work.price_from_cents × {1, 4, 22}`. Artist directory's "from $X" per row is `min(work.price_from_cents)` across that artist's works.
- `lib/mock.ts` renamed to `lib/format.ts`, gutted to three display helpers.

---

## What to do next (sequenced)

### 1. Phase 2 slice 2b — artist onboarding (next big move)

Slice 2a (sign-in) is done. Next: turn the gray "Apply to join" tab into a real onboarding flow.

- [ ] On submit, create a `public.artists` row tied to `auth.uid()` (RLS already enforces this). Inputs: display_name, bio, location, optional portfolio URL.
- [ ] On `/me`, detect whether the user has an artists row. If yes → show "Welcome back, edit profile". If no → CTA into Apply form.
- [ ] Server-side inserts via a Route Handler (`/api/me/profile`?) that reads `auth.getUser()`, validates input, inserts.
- [ ] Slice 2c (later): work upload — `/api/me/works` POST handler that takes title + description + medium, embeds, inserts.
- [ ] Slice 2d (later): file upload via Supabase Storage bucket.

### 2. Smaller follow-ups

- [ ] Real bio/name embedding for artists (new `embedding` column on `public.artists`) so artist search finds people without works yet. Current derivation from works is fine until we onboard artists who haven't listed anything.
- [ ] Hybrid ranking: blend cosine with a lexical match on `title`/`description` (Postgres `ts_rank`). Only if real queries expose the need.
- [ ] Add `duration_seconds` to `works` (music/video only) — license UI shows real durations.
- [ ] Replace the hardcoded "412 Artists · 38 Countries · 94% threads → license" stats on home with derived queries (or a single `stats` materialised view).

### 3. Phase 3 — listings / commerce terms

- [ ] Listings CRUD for artists.
- [ ] License purchase flow (Stripe?) so the dead "License for $X" buttons become real.
- [ ] Commission request flow so the dead "Send request →" form posts somewhere.

---

## Blockers

- None. Phase 1.5 is pure backend work — no new external accounts needed.
- **Vercel account** is the only outstanding external dep; blocks deploy only.

---

## Phase 2 slice 2a — Google OAuth (2026-04-25)

Shipped and verified on prod.

- **`/join`** Sign-in tab is OAuth-only now (Google live, Apple grayed "soon"). Apply tab still gray-disabled; wires up in slice 2b.
- **`/auth/callback`** exchanges the OAuth code for a Supabase session, then redirects to `?next` param (defaults to `/`).
- **`/auth/signout`** clears the session, redirects home.
- **`/me`** is gated — redirects to `/join` if no session, shows email + Sign out otherwise. Stub for now; phase 2b will become "edit my artist profile."
- **`proxy.ts`** (Next 16's renamed middleware) refreshes the Supabase auth cookie on every request so server components always see a current `auth.getUser()`.
- **Layout** now reads the session server-side and passes `userEmail` to the nav. Nav swaps Join → Me link and shows the user's handle in the top-right when signed in.
- **Dashboard config done in two places**: Google Cloud Console (OAuth client + consent screen) and Supabase (Sign In / Providers → Google enabled, Site URL + Redirect URLs whitelisted for localhost + prod).
- **No new env vars** in the app. The provider is configured server-side in Supabase; the client just calls `supabase.auth.signInWithOAuth({ provider: 'google' })`.

## Search UX contract: deferred Apply (2026-04-25)

Every search-affecting control is now Apply-gated. **The fetch only fires on Apply.**

- **Apply-gated** (changing these does NOT trigger a search; user must click Apply):
  - Prompt edit (the editable `<h3>`)
  - Mode toggle (Artists / Works)
  - Budget chips (under $200 / $200–500 / $500+)
  - Verified-only checkbox
- **Instant** (no Apply needed; client-side filter on already-fetched data):
  - Medium chips (Music / Art / Video / IP / Any)

State model in `SearchPage.tsx`: paired staged/applied (`query`/`appliedQuery`, `mode`/`appliedMode`, `picked`/`applied`, `verifiedStaged`/`verifiedApplied`). Apply commits all four pairs in one go. Apply button is disabled (dim) until any staged ≠ applied; turns dark/clickable when dirty; dims again right after click.

Implications for the algo worktree: when ranking changes land, the deferred-apply contract must be preserved. Don't auto-search on prompt or filter changes — the user wants to compose a brief, then commit.

## Pre-share UI audit (2026-04-25)

Live audit of https://indistream.vercel.app. All 5 pages return HTTP 200 in production; `/api/health`, `/api/search`, `/api/search/artists` all green. **Nothing structurally broken.** Known-rough surface area, deferred deliberately to keep momentum:

**High (mildly embarrassing on a teammate share):**
- **Home masthead stats are fake.** "412 Artists / 38 Countries / 0 Ads" — real corpus is 30 / 30 / 0. Should derive from DB or remove.
- **For-buyers band stats are fake.** "94% threads → license · 48h median · 2.1k licenses · 0 takedowns." None of those features exist (no thread, no licensing flow). Replace with aspirational placeholders ("—", "coming once we have buyers") or remove the band.
- **No "preview" indicator on the live URL.** Issue line reads `Vol. 01 · Issue 08 · Spring 2026` — looks like a real product. Adding `· preview` (or similar) sets the right expectation.

**Medium (visible but not critical):**
- **Dead "License for $X" + "Ask about stems"** on work detail. Click is a no-op.
- **Dead "Send request →"** on commission form. No backend route, no toast, just nothing.
- **Dead nav: "Manifesto" / "Join"** are static `<span>`s — no hover signal, look like decorative labels (acceptable as-is).
- **Dead footer link: "For enterprise & legal"** is an `<a>` with no `href`.

**Low (defer):**
- **Mobile responsive** — design is desktop-only. Likely fine if teammates open on laptops.
- **No loading state** during slow first search after cold start.

## Open risks / watch-items

- **Next 16 + React 19 + `@supabase/ssr` compat.** Currently fine. If server components start misbehaving, check `@supabase/ssr` release notes first.
- **HNSW recall** — confirm once we have thousands of works. No tuning for now.
- **`overrides: { postcss }` in `web/package.json`.** Drop when a Next.js release ships patched postcss bundled.
- **RLS write chain:** `works` insert requires an `artists` row tied to `auth.uid()`. The onboarding flow must create that row first — easy to forget.
- **`search_works` RPC runs under caller RLS** (not `security definer`). Fine now; flag if we ever restrict work visibility.
- **Key-format mix:** `api/.env` uses legacy JWT service key; `web/.env.local` uses new `sb_publishable_*`. Both work, worth unifying later.
- **Font loading warning** (`@next/next/no-page-custom-font`): converting `<link>` → `next/font/google` would silence it, at the cost of reworking every `font-family: 'Fraunces'` CSS reference to `var(--font-fraunces)`. Deferred.
- **Artist search is derivative** — scores come from aggregating work similarities, so an artist with no works yet is invisible to search. Fine for current seed data; revisit when onboarding lets artists sign up before listing.

---

## Resolved

- ~~Phase 1 closed~~ — tagged `v0.1.0-phase1` at commit `92dd8e2` (search MVP + diversity rerank + design port + deferred-apply + thinking transition + /join visual).
- ~~Vercel deploy issues (Python runtime, monorepo detection)~~ — ported FastAPI to Next.js Route Handlers; Vercel Root Directory set to `web`. Single-runtime deploy.
- ~~Auth missing (sign-in / sign-up flow non-functional)~~ — Google OAuth via Supabase, slice 2a shipped 2026-04-25.
- ~~`npm audit` 2 moderate advisories~~ — `overrides` pin to postcss ^8.5.10.
- ~~`0001_init.sql` not idempotent~~ — enums + policies wrapped/guarded.
- ~~Corrupted `requirements.txt` (leading "I h")~~ — fixed.
- ~~`httpx==0.28.1` vs `supabase==2.10.0` conflict~~ — pinned `httpx==0.27.2`.
- ~~IVFFlat `lists=100` silently returns 0 rows on tiny datasets~~ — switched index to HNSW.
- ~~One artist can dominate the top-K in work search~~ — diversity re-rank via round-robin by `artist_id` in `_rank`.
- ~~Artist search is a placeholder listing all seeded artists~~ — new `/search/artists` endpoint aggregates work scores by artist.
- ~~`str | None` used in Pydantic models~~ — python 3.9 incompatible; switched to `Optional[str]`.
- ~~Refine chips were cosmetic~~ — Apply now re-runs the search with chips appended to the embedding query; results actually change.
- ~~Per-artist location/reach/price mocked in `lib/mock.ts`~~ — migration 0002 added real columns, seed backfills, frontend reads DB. File renamed to `lib/format.ts` and slimmed to display helpers.
- ~~Verified tier is visual-only~~ — now `attestation_tier` enum-ish column; filter is a real DB predicate.
- ~~Uniform per-medium prices ($40 / $80 / $120 / $140)~~ — `_price_for(artist, title, medium)` in seed.py adds tier multiplier × per-title jitter. Range now $20-$305, 46 distinct values, deterministic on re-run.
- ~~FastAPI on Vercel Python serverless deploy issues~~ — ported `/api/search` and `/api/search/artists` to Next.js Route Handlers. Single-runtime deploy, no Python in the deploy path. `api/` directory still used for local Python work (`scripts/seed.py`, `scripts/generate_*.py`).
