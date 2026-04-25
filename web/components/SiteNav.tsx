"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Index", match: (p: string) => p === "/" },
  { href: "/search", label: "Search", match: (p: string) => p.startsWith("/search") },
  { href: "/artists", label: "Artists", match: (p: string) => p.startsWith("/artists") || p.startsWith("/artist") },
  { href: "/join", label: "Join", match: (p: string) => p.startsWith("/join") },
];

export function SiteNav() {
  const pathname = usePathname();
  return (
    <nav className="site">
      <Link href="/" className="brand">
        IndiStream<span className="dot">.</span>
      </Link>
      <div className="links">
        {LINKS.map((l) => (
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
      <div className="issue">Issue 08 · Spring 2026</div>
    </nav>
  );
}
