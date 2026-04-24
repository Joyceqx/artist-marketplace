# web/ — Next.js frontend

**Not yet scaffolded.** Install Node.js 20+ first, then from the repo root run:

```bash
npx create-next-app@latest web \
  --typescript --tailwind --app --eslint \
  --no-src-dir --import-alias "@/*" --use-npm --yes
```

This directory already contains `.env.local.example` — copy it to `.env.local` after scaffolding.

Then install the Supabase client:

```bash
cd web
npm install @supabase/supabase-js @supabase/ssr
```
