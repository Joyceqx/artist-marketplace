import { NextResponse } from "next/server";
import { embed, rankArtists } from "@/lib/search";

type Body = { query?: unknown; limit?: unknown };

export const runtime = "nodejs";
export const maxDuration = 30;

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
  if (!query) {
    return NextResponse.json({ error: "query required" }, { status: 400 });
  }

  try {
    const vec = await embed(query);
    const results = await rankArtists(vec, limit);
    return NextResponse.json(results);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "search failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
