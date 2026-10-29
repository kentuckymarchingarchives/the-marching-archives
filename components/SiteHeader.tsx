"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const primaryLinks = [
  { href: "/bands", label: "Bands & Corps" },
  { href: "/competitions", label: "Competitions" },
];

const exploreLinks = [
  { href: "/organizations", label: "Organizations" },
  { href: "/leaderboards", label: "Leaderboards" },
  { href: "/championships", label: "Championships" },
  { href: "/compare", label: "Compare Ensembles" },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);

  const active = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);
  const exploring = exploreLinks.some((link) => active(link.href));

  const closeMenus = () => {
    setMobileOpen(false);
    setExploreOpen(false);
  };

  const navClass = (selected: boolean) =>
    `whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
      selected
        ? "bg-[#002144]/[0.07] text-[#002144]"
        : "text-slate-600 hover:bg-slate-100 hover:text-[#002144]"
    }`;

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white shadow-sm">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" onClick={closeMenus} className="flex min-w-0 items-center gap-3">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden">
            <Image
              src="/tma-logo.png"
              alt="The Marching Archives logo"
              width={56}
              height={56}
              className="h-14 w-14 object-contain"
              priority
            />
          </span>
          <span className="min-w-0">
            <strong className="block truncate text-[15px] font-extrabold tracking-tight text-[#002144] sm:text-xl">
              The Marching Archives
            </strong>
            <span className="hidden text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 sm:block">
              Competitive History, Preserved
            </span>
          </span>
        </Link>

        <nav aria-label="Primary navigation" className="hidden items-center gap-1 lg:flex">
          {primaryLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active(link.href) ? "page" : undefined}
              className={navClass(active(link.href))}
            >
              {link.label}
            </Link>
          ))}

          <div className="relative">
            <button
              type="button"
              onClick={() => setExploreOpen((value) => !value)}
              aria-expanded={exploreOpen}
              aria-controls="explore-menu"
              className={navClass(exploring)}
            >
              Explore <span aria-hidden="true">⌄</span>
            </button>
            {exploreOpen && (
              <div
                id="explore-menu"
                className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-xl"
              >
                {exploreLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setExploreOpen(false)}
                    aria-current={active(link.href) ? "page" : undefined}
                    className={`block rounded-lg px-4 py-3 text-sm font-semibold ${
                      active(link.href)
                        ? "bg-[#002144]/[0.07] text-[#002144]"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <Link
            href="/search"
            aria-current={active("/search") ? "page" : undefined}
            className="ml-2 whitespace-nowrap rounded-lg bg-[#861F41] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#6d1733]"
          >
            Search Archive
          </Link>
        </nav>

        <button
          type="button"
          className="shrink-0 rounded-lg border border-slate-200 p-2.5 text-[#002144] hover:bg-slate-100 lg:hidden"
          onClick={() => setMobileOpen((value) => !value)}
          aria-expanded={mobileOpen}
          aria-controls="mobile-menu"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            {mobileOpen ? <path d="M5 5l14 14M19 5L5 19" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      {mobileOpen && (
        <nav id="mobile-menu" aria-label="Mobile navigation" className="border-t border-slate-200 bg-white px-5 py-4 shadow-lg lg:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1">
            {[{ href: "/", label: "Home" }, ...primaryLinks, ...exploreLinks, { href: "/search", label: "Search Archive" }].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={closeMenus}
                aria-current={active(link.href) ? "page" : undefined}
                className={`rounded-lg px-4 py-3 text-sm font-semibold ${
                  active(link.href) ? "bg-[#002144]/[0.07] text-[#002144]" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <div className="my-2 border-t border-slate-200" />
            <Link href="/staff/login" onClick={closeMenus} className="rounded-lg px-4 py-3 text-sm text-slate-500 hover:bg-slate-100">
              Staff Access
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
