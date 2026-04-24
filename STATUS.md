# STATUS

Living doc. Update after each work session.

Last updated: **2026-04-24**

---

## Where we are

**Phase 1 + design port: complete.** Full stack wired end-to-end, and the minimal search UI is replaced with the IndiStream "Paper gallery" design (Home + Search only; other screens stubbed).

| Area | State |
|---|---|
| `api/` FastAPI backend | `POST /search` live: embeds query (`text-embedding-3-small`) → calls `search_works` RPC → returns top-K. `_embed` and `_rank` are clean extension seams for future ranking changes. |
| `api/scripts/seed.py` | Idempotent seeder. 5 artists, 9 works across all 4 mediums. |
| `web/` Next.js frontend | IndiStream design ported to `/` (editorial home) and `/search` (two-column brief + results). Nav, typography, paper grain, riso-art placeholders, rubber-stamp / tape / verified-badge system all in place. Raw CSS in `app/globals.css` (Tailwind no longer imported). Builds clean, 0 npm vulns. Stubs at `/artists` and `/work`. |
| `web/lib/supabase/{client,server}.ts` | `@supabase/ssr` helpers wired (server uses Next 16 `await cookies()`). Artists list fetched client-side on Search page. |
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

---

## What to do next (sequenced)

### 1. Build the stub screens for real

The biggest visible gap is now the screens we didn't port. In priority order:

- [ ] **Work detail** (`/work/[id]`) — hero + license tier panel + "more from this artist" strip. Needs price + license tier seed data (or hardcoded for now).
- [ ] **Artist profile** (`/artist/[id]`) — portrait + bio + available works grid + custom commission form. Can mostly use the `artists` + `works` tables we already have.
- [ ] **Artists directory** (`/artists`) — trending cards + numbered table.

### 2. Phase 1.5 — diversity re-rank (the "pair semantic meanings" piece)

Current `/search` returns pure cosine similarity. To improve relevance and avoid one artist dominating results:

- [ ] In `_rank`, over-fetch from `search_works` (e.g., `match_count = limit * 5`).
- [ ] Re-rank in Python to spread across `medium` and `artist_id`. Start with round-robin by `artist_id` (dead simple, cheap, interpretable). If not good enough, MMR (Maximal Marginal Relevance) using the stored embeddings.
- [ ] Consider hybrid: blend cosine score with a keyword match over `title`/`description` (BM25 or Postgres `ts_rank`). Low priority until we see real queries.
- [ ] Return `total_candidates` in the response so the frontend can show "ranked N of M" if useful.
- [ ] Add **artist search** endpoint so search mode=artist becomes real (embed `display_name + bio`, query against it). Currently placeholder (lists all seeded artists).

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
- **Verified tier is visual-only** (hardcoded whitelist in `SearchPage.tsx`). Add an `attestation_tier` enum column to `public.artists` in phase 2.
- **Mock stats on home** ("412 Artists", "94% threads → license", etc.) are prototype copy, not live numbers. Replace with derived queries before anything ships externally.
- **Font loading warning** (`@next/next/no-page-custom-font`): converting `<link>` → `next/font/google` would silence it, at the cost of reworking every `font-family: 'Fraunces'` CSS reference to `var(--font-fraunces)`. Deferred.

---

## Resolved

- ~~`npm audit` 2 moderate advisories~~ — `overrides` pin to postcss ^8.5.10.
- ~~`0001_init.sql` not idempotent~~ — enums + policies wrapped/guarded.
- ~~Corrupted `requirements.txt` (leading "I h")~~ — fixed.
- ~~`httpx==0.28.1` vs `supabase==2.10.0` conflict~~ — pinned `httpx==0.27.2`.
- ~~IVFFlat `lists=100` silently returns 0 rows on tiny datasets~~ — switched index to HNSW.
