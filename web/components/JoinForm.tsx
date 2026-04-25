"use client";

import { useState } from "react";

type Tab = "signin" | "signup";

export function JoinForm() {
  const [tab, setTab] = useState<Tab>("signin");

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
          <div className="jf-field">
            <label htmlFor="signin-email">Email</label>
            <input
              id="signin-email"
              type="email"
              placeholder="you@studio.com"
              autoComplete="email"
            />
          </div>
          <div className="jf-field">
            <label htmlFor="signin-password">Password</label>
            <input
              id="signin-password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>
          <div className="jf-row">
            <label className="jf-check">
              <input type="checkbox" defaultChecked /> Stay signed in
            </label>
            <button type="button" className="jf-link">
              Forgot password
            </button>
          </div>
          <button type="button" className="jf-submit">
            <span className="lbl">Sign in</span>
            <span className="arrow">→</span>
          </button>
          <div className="jf-divider">
            <span>or</span>
          </div>
          <div className="jf-oauth">
            <button type="button" className="jf-oauth-btn">
              <span className="g">G</span> Continue with Google
            </button>
            <button type="button" className="jf-oauth-btn">
              <span className="g" style={{ fontFamily: "serif" }}>
                a
              </span>{" "}
              Continue with Apple
            </button>
          </div>
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
              <label htmlFor="signup-password">Password</label>
              <input
                id="signup-password"
                type="password"
                placeholder="at least 8 characters"
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
