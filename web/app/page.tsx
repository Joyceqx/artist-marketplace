import Image from "next/image";
import Link from "next/link";
import { HomeHero } from "@/components/HomeHero";
import { createClient } from "@/lib/supabase/server";

type FeaturedDef = {
  display_name: string;
  slug: string;
  caption: string;
  tape: string;
  tapeStyle?: React.CSSProperties;
};

const FEATURED: FeaturedDef[] = [
  {
    display_name: "Pilar Vega",
    slug: "pilar",
    caption: "Illustrator · Lisbon · Est. 2019",
    tape: "new",
  },
  {
    display_name: "Kenji Arai",
    slug: "kenji",
    caption: "Musician · Kyoto",
    tape: "indie",
    tapeStyle: {
      background: "rgba(227,74,47,0.5)",
      transform: "rotate(2deg)",
    },
  },
  {
    display_name: "Ines Moreau",
    slug: "ines",
    caption: "Filmmaker · Marseille",
    tape: "emerging",
    tapeStyle: {
      background: "rgba(45,77,138,0.35)",
      transform: "rotate(-0.5deg)",
    },
  },
];

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("artists")
    .select("id, display_name, bio, location")
    .in(
      "display_name",
      FEATURED.map((f) => f.display_name),
    );
  const byName = new Map(
    (data ?? []).map((a) => [a.display_name as string, a] as const),
  );
  const featured = FEATURED.map((f, i) => ({
    ...f,
    no: `№ ${String(i + 1).padStart(2, "0")}`,
    id: byName.get(f.display_name)?.id as string | undefined,
    bio: byName.get(f.display_name)?.bio as string | undefined,
  })).filter((f) => f.id);

  const hero = featured[0];

  return (
    <section className="home">
      <div className="home-issue-line">
        <span>Vol. 01 · Issue 08</span>
        <span>A marketplace for independent artists</span>
        <span>Spring 2026</span>
      </div>

      <div className="home-hero">
        <Link
          href={hero ? `/artist/${hero.id}` : "/artists"}
          className="home-hero-img"
        >
          {hero ? (
            <Image
              src={`/featured/${hero.slug}.webp`}
              alt={hero.display_name}
              fill
              sizes="280px"
              style={{ objectFit: "cover" }}
              priority
            />
          ) : (
            <div className="art a2" />
          )}
          <span className="tape">this week&rsquo;s find ✦</span>
          <span className="no">№ 01</span>
        </Link>
        <div className="home-hero-body">
          <h1>
            Find your<br />
            hidden <span className="em">indie</span> <span className="em2">gem.</span>
          </h1>
          <div className="home-hero-meta">
            <div className="lede">
              A semantic, human-curated marketplace for independent musicians,
              illustrators, filmmakers, and makers — searchable in plain english.
              Built for buyers who need real licenses:{" "}
              <em>AI companies, studios, brands</em>.
            </div>
            <div className="stat">
              <div className="v">412</div>
              <div className="k">Artists</div>
            </div>
            <div className="stat">
              <div className="v">38</div>
              <div className="k">Countries</div>
            </div>
            <div className="stat accent">
              <div className="v">0</div>
              <div className="k">Ads, ever</div>
            </div>
          </div>
        </div>
      </div>

      <HomeHero />

      <div className="home-strip">
        <div className="strip-head">
          <h2>This week on IndiStream</h2>
          <div className="mono-caption">03 featured · updated fridays</div>
        </div>
        <div className="strip-grid">
          {featured.map((f) => (
            <Link
              key={f.slug}
              href={`/artist/${f.id}`}
              className="feat"
            >
              <div className="img-wrap">
                <Image
                  src={`/featured/${f.slug}.webp`}
                  alt={f.display_name}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  style={{ objectFit: "cover" }}
                />
                <span className="no">{f.no}</span>
                <span className="tape-label tape" style={f.tapeStyle}>
                  {f.tape}
                </span>
              </div>
              <h3>{f.display_name}</h3>
              <div className="caption">{f.caption}</div>
              <div className="quote">&ldquo;{f.bio}&rdquo;</div>
            </Link>
          ))}
        </div>
      </div>

      <div className="home-manifesto">
        <div className="kicker">Our premise</div>
        <p>
          We make <em>semantic search</em> for the long tail of human talent.
          Describe what you need in your own words —{" "}
          <em>&ldquo;warm,&rdquo; &ldquo;rainy,&rdquo; &ldquo;melancholic but not sad&rdquo;</em>{" "}
          — and meet artists who actually make that thing.
        </p>
      </div>

      <div className="home-buyers">
        <div className="hb-head">
          <div className="mono-caption">For buyers ——</div>
          <h2>
            Real licenses. <em>Legally clean.</em>
          </h2>
          <div className="hb-lede">
            Every work lists its license tiers upfront. Attestation on every artist
            — self-declared or platform-verified. Indemnification on Verified tier.
            Built for teams who can&rsquo;t afford to get this wrong.
          </div>
        </div>
        <div className="hb-stats">
          <div className="hb-stat">
            <div className="v">
              94<span className="u">%</span>
            </div>
            <div className="k">threads → license</div>
          </div>
          <div className="hb-stat">
            <div className="v">
              48<span className="u">h</span>
            </div>
            <div className="k">median response</div>
          </div>
          <div className="hb-stat">
            <div className="v">
              2.1<span className="u">k</span>
            </div>
            <div className="k">licenses issued</div>
          </div>
          <div className="hb-stat accent">
            <div className="v">0</div>
            <div className="k">takedowns, to date</div>
          </div>
        </div>
        <div className="hb-segments">
          <div className="hb-seg">AI training licenses</div>
          <div className="hb-seg">Film &amp; studio sync</div>
          <div className="hb-seg">Brand &amp; advertising</div>
          <div className="hb-seg">Publishing &amp; print</div>
        </div>
      </div>

      <div className="home-footer">
        <span>© IndiStream 2026</span>
        <span>Made in somebody&rsquo;s bedroom</span>
        <span>
          <a>For enterprise &amp; legal</a> · indistream.co
        </span>
      </div>
    </section>
  );
}
