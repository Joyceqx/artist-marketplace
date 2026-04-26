"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LOGGED_OUT_LINKS = [
  { href: "/", label: "Index", match: (p: string) => p === "/" },
  { href: "/search", label: "Search", match: (p: string) => p.startsWith("/search") },
  { href: "/artists", label: "Artists", match: (p: string) => p.startsWith("/artists") || p.startsWith("/artist") },
  { href: "/join", label: "Join", match: (p: string) => p.startsWith("/join") },
];

const LOGGED_IN_LINKS = [
  { href: "/", label: "Index", match: (p: string) => p === "/" },
  { href: "/search", label: "Search", match: (p: string) => p.startsWith("/search") },
  { href: "/artists", label: "Artists", match: (p: string) => p.startsWith("/artists") || p.startsWith("/artist") },
  { href: "/me", label: "Me", match: (p: string) => p.startsWith("/me") },
];

export function SiteNav({ userEmail }: { userEmail: string | null }) {
  const pathname = usePathname();
  const links = userEmail ? LOGGED_IN_LINKS : LOGGED_OUT_LINKS;

  return (
    <nav className="site">
      <Link href="/" className="brand">
        IndiStream<span className="dot">.</span>
      </Link>
      <div className="links">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={l.match(pathname) ? "on" : undefined}
          >
            {l.label}
          </Link>
        ))}
        <span style={{ color: "var(--ink-mute)", cursor: "default" }}>Manifesto</span>
      </div>
      <div className="issue">
        {userEmail ? (
          <span title={userEmail}>{userEmail.split("@")[0]}</span>
        ) : (
          "Issue 08 · Spring 2026"
        )}
      </div>
    </nav>
  );
}
