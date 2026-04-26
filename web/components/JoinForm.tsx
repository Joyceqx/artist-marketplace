"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Tab = "signin" | "signup";

export function JoinForm() {
  const [tab, setTab] = useState<Tab>("signin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signInWithGoogle() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/`,
      },
    });
    if (error) {
      setError(error.message);
      setBusy(false);
    }
    // On success the browser navigates to Google; no further client work.
  }

  return (
    <>
      <div className="join-tabs">
        <button
          type="button"
          className={`join-tab ${tab === "signin" ? "on" : ""}`}
          onClick={() => setTab("signin")}
        >
          Sign in
        </button>
        <button
          type="button"
          className={`join-tab ${tab === "signup" ? "on" : ""}`}
          onClick={() => setTab("signup")}
        >
          Apply to join
        </button>
      </div>

      {tab === "signin" ? (
        <form
          className="join-form"
          onSubmit={(e) => e.preventDefault()}
          aria-label="Sign in"
        >
          <p
            style={{
              fontFamily: "Fraunces, serif",
              fontStyle: "italic",
              fontSize: 16,
              lineHeight: 1.5,
              color: "var(--ink-2)",
              margin: "0 0 8px",
            }}
          >
            One tap. We don&rsquo;t store passwords here.
          </p>

          <div className="jf-oauth">
            <button
              type="button"
              className="jf-oauth-btn"
              onClick={signInWithGoogle}
              disabled={busy}
            >
              <span className="g">G</span>{" "}
              {busy ? "Redirecting…" : "Continue with Google"}
            </button>
            <button type="button" className="jf-oauth-btn" disabled>
              <span className="g" style={{ fontFamily: "serif" }}>
                a
              </span>{" "}
              Continue with Apple
              <span
                style={{
                  marginLeft: "auto",
                  fontFamily: "IBM Plex Mono, monospace",
                  fontStyle: "normal",
                  fontSize: 9,
                  letterSpacing: "1.5px",
                  color: "var(--ink-mute)",
                }}
              >
                soon
              </span>
            </button>
          </div>

          {error && (
            <div
              style={{
                fontFamily: "IBM Plex Mono, monospace",
                fontSize: 11,
                color: "var(--riso-red)",
                padding: "8px 12px",
                border: "1px solid var(--riso-red)",
              }}
            >
              {error}
            </div>
          )}

          <div className="jf-foot">
            New here?{" "}
            <button
              type="button"
              className="jf-link"
              onClick={() => setTab("signup")}
            >
              Apply to join →
            </button>
          </div>
        </form>
      ) : (
        <form
          className="join-form"
          onSubmit={(e) => e.preventDefault()}
          aria-label="Apply as artist"
        >
          <div className="jf-coming-soon" role="status">
            <span className="dot" />
            <span>Artist onboarding · coming soon</span>
          </div>

          <div className="jf-disabled" aria-hidden="true">
            <div className="jf-field">
              <label htmlFor="signup-name">Your name</label>
              <input
                id="signup-name"
                type="text"
                placeholder="First & last"
                disabled
              />
            </div>
            <div className="jf-field">
              <label htmlFor="signup-email">Email</label>
              <input
                id="signup-email"
                type="email"
                placeholder="you@studio.com"
                disabled
              />
            </div>
            <div className="jf-field">
              <label htmlFor="signup-portfolio">
                Portfolio link <span className="opt">(optional)</span>
              </label>
              <input
                id="signup-portfolio"
                type="url"
                placeholder="bandcamp.com/you, instagram.com/you, …"
                disabled
              />
            </div>
            <label className="jf-check">
              <input type="checkbox" disabled /> I agree to the{" "}
              <span className="jf-link">terms</span> &amp;{" "}
              <span className="jf-link">artist code of conduct</span>.
            </label>
            <button type="button" className="jf-submit" disabled>
              <span className="lbl">Apply to join</span>
              <span className="arrow">→</span>
            </button>
          </div>

          <div className="jf-foot">
            Already a member?{" "}
            <button
              type="button"
              className="jf-link"
              onClick={() => setTab("signin")}
            >
              Sign in →
            </button>
          </div>
        </form>
      )}
    </>
  );
}
