import { NextResponse } from "next/server";
import { embed, rankWorks, type SearchFilters } from "@/lib/search";

type Body = {
  query?: unknown;
  limit?: unknown;
  filters?: unknown;
};

export const runtime = "nodejs";
export const maxDuration = 30;

const ALLOWED_MEDIUMS = new Set([
  "music",
  "illustration",
  "video",
  "character",
]);

function parseFilters(raw: unknown): SearchFilters {
  if (!raw || typeof raw !== "object") return {};
  const f = raw as Record<string, unknown>;
  const out: SearchFilters = {};
  if (typeof f.medium === "string" && ALLOWED_MEDIUMS.has(f.medium)) {
    out.medium = f.medium;
  }
  if (typeof f.budget_cents === "number" && f.budget_cents > 0) {
    out.budget_cents = Math.floor(f.budget_cents);
  }
  if (typeof f.verified_only === "boolean") {
    out.verified_only = f.verified_only;
  }
  return out;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";
  const limit =
    typeof body.limit === "number" && body.limit > 0
      ? Math.min(Math.floor(body.limit), 50)
      : 10;
  const filters = parseFilters(body.filters);

  if (!query) {
    return NextResponse.json({ error: "query required" }, { status: 400 });
  }

  try {
    const vec = await embed(query);
    const results = await rankWorks(vec, limit, filters);
    return NextResponse.json(results);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "search failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
