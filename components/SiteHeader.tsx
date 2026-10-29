
"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/bands", label: "Bands & Corps" },
  { href: "/competitions", label: "Competitions" },
  { href: "/organizations", label: "Organizations" },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur-xl">
      <div className="mx-auto flex h-24 max-w-7xl items-center justify-between gap-5 px-5 md:px-8">

        {/* Logo and Website Name */}
        <Link
          href="/"
          className="flex min-w-0 items-center gap-3"
          onClick={() => setOpen(false)}
        >
          <span className="flex h-18 w-18 shrink-0 items-center justify-center">
            <Image
              src="/tma-logo.png"
              alt="The Marching Archives logo"
              width={72}
              height={72}
              className="h-full w-full object-contain"
              priority
            />
          </span>

          <span className="min-w-0">
            <strong className="block truncate text-[15px] font-extrabold tracking-tight text-[#002144] sm:text-xl">
              The Marching Archives
            </strong>
            <span className="block text-[10px] font-semibold uppercase tracking-[.15em] text-slate-500 sm:text-xs">
              Competitive History, Preserved
            </span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav
          aria-label="Primary navigation"
          className="hidden items-center gap-1 lg:flex"
        >
          {links.map((link) => {
            const isActive =
              pathname === link.href ||
              pathname.startsWith(`${link.href}/`);

            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                  isActive
                    ? "bg-[#002144]/[.07] text-[#002144]"
                    : "text-slate-600 hover:bg-slate-100 hover:text-[#002144]"
                }`}
              >
                {link.label}
              </Link>
            );
          })}

          <Link
            href="/search"
            aria-current={
              pathname.startsWith("/search") ? "page" : undefined
            }
            className="ml-2 rounded-lg bg-[#861F41] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#6d1733]"
          >
            Search Archive ↗
          </Link>
        </nav>

        {/* Mobile Menu Button */}
        <button
          type="button"
          className="rounded-lg border border-slate-200 p-2.5 text-[#002144] transition hover:bg-slate-100 lg:hidden"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            {open ? (
              <path d="M5 5l14 14M19 5L5 19" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Navigation */}
      {open && (
        <nav
          id="mobile-menu"
          aria-label="Mobile navigation"
          className="border-t border-slate-200 bg-white px-5 py-4 shadow-lg lg:hidden"
        >
          <div className="mx-auto flex max-w-7xl flex-col gap-1">
            {[
              { href: "/", label: "Home" },
              ...links,
              { href: "/search", label: "Search Archive" },
            ].map((link) => {
              const isActive =
                pathname === link.href ||
                (link.href !== "/" &&
                  pathname.startsWith(`${link.href}/`));

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive ? "page" : undefined}
                  className={`rounded-lg px-4 py-3 font-semibold transition ${
                    isActive
                      ? "bg-[#002144]/[.07] text-[#002144]"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}

            <div className="my-2 border-t border-slate-200" />

            <Link
              href="/staff/login"
              onClick={() => setOpen(false)}
              className="rounded-lg px-4 py-3 text-sm font-medium text-slate-500 hover:bg-slate-100"
            >
              Staff Access
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
