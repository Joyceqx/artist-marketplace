import { JoinForm } from "@/components/JoinForm";

export const metadata = {
  title: "Join · IndiStream",
};

export default function JoinPage() {
  return (
    <section className="join">
      <div className="join-wrap">
        <aside className="join-left">
          <div className="kicker">Vol. 01 · Issue 08 · Members</div>
          <h1 className="join-title">
            Join the<br />
            index.
          </h1>
          <p className="join-lede">
            A small, member-supported marketplace. No algorithm, no ads, no
            investors leaning over our shoulder. Sign in to continue, or apply
            to list your work.
          </p>
          <ul className="join-bullets">
            <li>
              <span className="b">○</span>
              <span>
                <strong>For buyers</strong> — browse, license, commission. Free.
              </span>
            </li>
            <li>
              <span className="b">○</span>
              <span>
                <strong>For artists</strong> — list works, get found, keep{" "}
                <em>85%</em>.
              </span>
            </li>
            <li>
              <span className="b">○</span>
              <span>
                <strong>Verified rights</strong> — optional paid attestation,
                indemnified licenses.
              </span>
            </li>
          </ul>
          <div className="join-margin">members &gt; metrics ✦</div>
        </aside>

        <div className="join-right">
          <JoinForm />
        </div>
      </div>
    </section>
  );
}
