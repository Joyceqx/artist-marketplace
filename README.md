# Artist Marketplace

Two-sided marketplace connecting independent artists with buyers via semantic search + diversity-boosted ranking.

See `docs/AI_Artist_Marketplace_Proposal.docx` for the project proposal.

## Structure

```
web/         Next.js 15 frontend  (deploys to Vercel)
api/         FastAPI backend      (deploys to Vercel Python functions)
supabase/    SQL migrations + schema
docs/        Proposal + design notes
```

## Prerequisites

- Node.js 20+ and npm
- Python 3.9+
- A Supabase project (free tier) with pgvector extension enabled
- OpenAI API key (for `text-embedding-3-small`)
- Vercel account (for deploy)

## Local setup

```bash
# 1. Backend
cd api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in SUPABASE_URL, SUPABASE_SERVICE_KEY, OPENAI_API_KEY
uvicorn main:app --reload --port 8000

# 2. Frontend (separate terminal)
cd web
npm install
cp .env.local.example .env.local   # fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_API_URL
npm run dev
```

## Supabase setup

1. Create a project at supabase.com
2. In SQL Editor, paste and run `supabase/migrations/0001_init.sql`
3. Copy the project URL and anon/service keys into the two `.env` files
