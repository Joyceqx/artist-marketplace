import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { artFor, artistMock, mediumMock } from "@/lib/mock";
import { LicensePanel } from "@/components/LicensePanel";

type Params = { id: string };

export default async function WorkPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: work } = await supabase
    .from("works")
    .select("id, title, description, medium, artist_id, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!work) notFound();

  const { data: artist } = await supabase
    .from("artists")
    .select("id, display_name, bio")
    .eq("id", work.artist_id)
    .maybeSingle();

  const { data: more } = await supabase
    .from("works")
    .select("id, title, medium")
    .eq("artist_id", work.artist_id)
    .neq("id", work.id)
    .limit(4);

  const mm = mediumMock(work.medium);
  const am = artist ? artistMock(artist.display_name) : { priceFrom: 40 };

  const tiers = [
    {
      key: "personal",
      title: "Personal / small creator",
      desc: "under 10k views, non-commercial",
      price: am.priceFrom,
    },
    {
      key: "commercial",
      title: "Standard commercial",
      desc: "brand content, ads under $50k spend",
      price: am.priceFrom * 4,
    },
    {
      key: "buyout",
      title: "Exclusive buyout",
      desc: "removed from marketplace",
      price: am.priceFrom * 22,
    },
  ];

  const year = work.created_at
    ? new Date(work.created_at).getFullYear()
    : 2024;

  return (
    <section className="work">
      <div className="breadcrumb">
        ← <Link href="/search">search</Link> / {work.medium} /{" "}
        <span className="cur">{work.title.toLowerCase()}</span>
      </div>

      <div className="work-top">
        <div>
          <div className="work-hero">
            <div className={`art ${artFor(0)}`} />
            <span className="stamp-wrap">
              <span className="stamp">Original · {year}</span>
            </span>
          </div>
          <div className="work-player">
            <div className="play">▶</div>
            <div className="track">
              <span className="track-fill" />
              <span className="track-dot" />
            </div>
            <div className="time">
              1:14 / {mm.duration !== "—" ? mm.duration : "3:22"}
            </div>
          </div>
        </div>

        <div className="work-info">
          <div className="kicker">
            {work.medium.charAt(0).toUpperCase() + work.medium.slice(1)} ·{" "}
            Original · {mm.duration !== "—" ? mm.duration : "—"}
          </div>
          <h1>{work.title}.</h1>
          {artist && (
            <div className="by">
              by{" "}
              <Link href={`/artist/${artist.id}`}>{artist.display_name}</Link>
            </div>
          )}
          <div className="desc">
            {work.description ?? "No description yet."}
          </div>

          <div className="work-meta">
            <div className="cell">
              <div className="k">Mood</div>
              <div className="v">{work.medium}, quiet, warm</div>
            </div>
            <div className="cell">
              <div className="k">Available</div>
              <div className="v">license & commission</div>
            </div>
            <div className="cell">
              <div className="k">Stems</div>
              <div className="v">available on request</div>
            </div>
            <div className="cell">
              <div className="k">Best for</div>
              <div className="v">film, ads, editorial</div>
            </div>
          </div>

          <LicensePanel tiers={tiers} defaultKey="commercial" />
        </div>
      </div>

      {more && more.length > 0 && artist && (
        <div className="work-also">
          <h2>More from {artist.display_name}</h2>
          <div className="grid">
            {more.map((w, i) => (
              <Link key={w.id} href={`/work/${w.id}`} className="card">
                <div className="img-wrap">
                  <div className={`art ${artFor(i + 1)}`} />
                </div>
                <h4>{w.title}</h4>
                <div className="meta">
                  <span>{w.medium}</span>
                  <span className="price">
                    from ${mediumMock(w.medium).priceFrom}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
