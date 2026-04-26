"use client";

export function SignOutButton() {
  return (
    <form method="POST" action="/auth/signout" style={{ marginTop: 24 }}>
      <button type="submit" className="scribble-btn">
        <span>Sign out</span>
      </button>
    </form>
  );
}
