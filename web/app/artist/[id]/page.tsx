import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { artFor, artistMock, mediumMock } from "@/lib/mock";
import { CommissionForm } from "@/components/CommissionForm";

type Params = { id: string };

export default async function ArtistPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: artist } = await supabase
    .from("artists")
    .select("id, display_name, bio, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!artist) notFound();

  const { data: works } = await supabase
    .from("works")
    .select("id, title, medium, created_at")
    .eq("artist_id", artist.id)
    .order("created_at", { ascending: false });

  const mock = artistMock(artist.display_name);
  const memberYear = artist.created_at
    ? new Date(artist.created_at).getFullYear()
    : new Date().getFullYear();

  const firstName = artist.display_name.split(" ")[0];
  const [first, ...rest] = artist.display_name.split(" ");
  const last = rest.join(" ");

  return (
    <section className="artist-page">
      <div className="breadcrumb">
        ← <Link href="/artists">artists</Link> /{" "}
        <span className="cur">{artist.display_name.toLowerCase()}</span>
      </div>

      <div className="artist-head">
        <div className="portrait">
          <div className={`art ${artFor(0)}`} />
          <span className="stamp-wrap">
            <span className="stamp">Member · {memberYear}</span>
          </span>
        </div>
        <div className="info">
          <div className="kicker">
            Independent · {mock.location}
            {mock.verified ? " · Verified ✓" : ""}
          </div>
          <h1>
            {first}
            {last ? (
              <>
                <br />
                {last}.
              </>
            ) : (
              "."
            )}
          </h1>
          <div className="bio">
            &ldquo;{artist.bio ?? "No bio yet."}&rdquo;
          </div>
          <div className="facts">
            <div className="cell">
              <div className="k">Based</div>
              <div className="v">{mock.location}</div>
            </div>
            <div className="cell">
              <div className="k">Reach</div>
              <div className="v">{mock.reach}</div>
            </div>
            <div className="cell">
              <div className="k">Works listed</div>
              <div className="v">
                {String(works?.length ?? 0).padStart(2, "0")} · from $
                {mock.priceFrom}
              </div>
            </div>
            <div className="cell">
              <div className="k">Open for</div>
              <div className="v">license, commission, collab</div>
            </div>
          </div>
          <div className="cta-row">
            <button type="button" className="scribble-btn primary">
              <span>Browse works ↓</span>
            </button>
            <button type="button" className="scribble-btn">
              <span>Message {firstName}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="artist-works">
        <div className="sec-head">
          <h2>Available works</h2>
          <div className="meta">
            {String(works?.length ?? 0).padStart(2, "0")} pieces · license or
            buy
          </div>
        </div>
        <div className="grid">
          {(works ?? []).map((w, i) => (
            <Link key={w.id} href={`/work/${w.id}`} className="work-item">
              <div className="img-wrap">
                <div className={`art ${artFor(i)}`} />
                <span className="no">№ {String(i + 1).padStart(2, "0")}</span>
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
          {(!works || works.length === 0) && (
            <div style={{ gridColumn: "1 / -1", color: "var(--ink-mute)" }}>
              No works listed yet.
            </div>
          )}
        </div>
      </div>

      <div className="commission">
        <div className="left">
          <div className="kicker">Or — something new</div>
          <h2>
            Work with
            <br />
            {firstName} on
            <br />a <em>custom</em> piece.
          </h2>
          <p>
            Commission an original piece, collaborate on a project, or brief{" "}
            {firstName} for something specific. Responds within 48 hours.
          </p>
          <div className="hand-note">responds in 48hrs ✦</div>
        </div>
        <CommissionForm />
      </div>
    </section>
  );
}
