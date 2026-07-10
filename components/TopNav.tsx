"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS: { href: string; label: string; isActive: (pathname: string) => boolean }[] = [
  { href: "/", label: "Home", isActive: (pathname) => pathname === "/" },
  { href: "/admin/edit", label: "Admin", isActive: (pathname) => pathname.startsWith("/admin") },
];

/**
 * Persistent top nav, rendered once from the root layout so every page —
 * including ones with their own sticky page-level header (see
 * app/page.tsx, app/admin/edit/[positioningId]/page.tsx) — stays reachable
 * by clicking. Those page headers use `top-10` (not `top-0`) to stack below
 * this bar's `h-10` instead of overlapping it.
 *
 * "Admin" is a plain link, not an inline login form — /admin/edit itself
 * decides whether to show a login form or the full editor based on session
 * state, so this bar never needs to know or display login/logout status.
 */
export function TopNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-20 flex h-10 items-center gap-1 bg-cv-navy px-6">
      {NAV_LINKS.map((link) => {
        const active = link.isActive(pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={
              "rounded px-3 py-1.5 text-xs font-semibold tracking-wide transition-colors " +
              (active ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white")
            }
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
