"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  navigationGroups,
  primaryNavigation,
  searchNavigation,
} from "@/lib/archive-navigation";

const baseLink =
  "rounded-lg px-3 py-2.5 text-sm font-semibold text-[#41546A] transition-colors hover:bg-[#F2F5F8] hover:text-[#002144] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#861F41]";

export default function SiteHeader() {
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const rootRef = useRef<HTMLElement>(null);

  const closeAll = () => {
    setOpenGroup(null);
    setMobileOpen(false);
  };

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) closeAll();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeAll();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <header ref={rootRef} className="sticky top-0 z-50 border-b border-[#E5E9EF] bg-white shadow-[0_2px_16px_rgba(0,33,68,0.04)]">
      <div className="mx-auto flex min-h-[94px] max-w-[1500px] items-center justify-between gap-4 px-4 py-2 sm:px-6 lg:px-8">
        <Link href="/" onClick={closeAll} aria-label="The Marching Archives — home" className="flex min-w-0 shrink-0 items-center gap-3">
          <Image
            src="/tma-logo.png"
            alt="The Marching Archives logo"
            width={76}
            height={76}
            priority
            className="h-[64px] w-[64px] shrink-0 object-contain sm:h-[76px] sm:w-[76px]"
          />
          <span className="min-w-0">
            <span className="block text-[17px] font-extrabold leading-tight tracking-tight text-[#002144] sm:text-[22px]">
              The Marching Archives
            </span>
            <span className="mt-1 block text-[9px] font-bold uppercase tracking-[0.145em] text-[#64758A] sm:text-[11px]">
              Competitive History, Preserved
            </span>
          </span>
        </Link>

        <nav aria-label="Primary navigation" className="hidden items-center gap-0.5 xl:flex">
          {primaryNavigation.map((link) => (
            <Link href={link.href} key={link.href} onClick={closeAll} className={`${baseLink} whitespace-nowrap`}>
              {link.label}
            </Link>
          ))}
          {navigationGroups.map((group) => (
            <div key={group.label}
              className="relative"
              onMouseEnter={() => setOpenGroup(group.label)}
              onMouseLeave={() => setOpenGroup((current) => current === group.label ? null : current)}
              onFocus={() => setOpenGroup(group.label)}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setOpenGroup((current) => current === group.label ? null : current);
                }
              }}>
              <button
                type="button"
                className={`${baseLink} flex items-center gap-1.5`}
                aria-expanded={openGroup === group.label}
                aria-controls={`nav-${group.label.toLowerCase()}`}
                onClick={() => setOpenGroup(openGroup === group.label ? null : group.label)}
              >
                {group.label}
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`h-3.5 w-3.5 transition-transform ${openGroup === group.label ? "rotate-180" : ""}`}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {openGroup === group.label && (
                <div id={`nav-${group.label.toLowerCase()}`} className="absolute right-0 top-full z-50 w-[306px] pt-3">
                  <div className="rounded-xl border border-[#DFE5EC] bg-white p-2 shadow-[0_18px_46px_rgba(0,33,68,.16)]">
                    <div className="px-3 pb-2 pt-2 text-[10px] font-extrabold uppercase tracking-[.18em] text-[#861F41]">
                      {group.label}
                    </div>
                    {group.links.map((link) => (
                      <Link key={link.href} href={link.href} onClick={closeAll} className="block rounded-lg px-3 py-2.5 transition-colors hover:bg-[#F2F5F8] focus-visible:outline-2 focus-visible:outline-[#861F41]">
                        <span className="block text-sm font-bold text-[#002144]">{link.label}</span>
                        <span className="mt-0.5 block text-xs text-[#667789]">{link.description}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
          <Link href={searchNavigation.href} onClick={closeAll} className="ml-3 whitespace-nowrap rounded-xl bg-[#861F41] px-5 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#6D1935] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#861F41]">
            Search Archive <span className="ml-1" aria-hidden="true">↗</span>
          </Link>
        </nav>

        <button
          type="button"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#DCE4EB] text-[#002144] hover:bg-[#F3F6F9] focus-visible:outline-2 focus-visible:outline-[#861F41] xl:hidden"
          onClick={() => { setMobileOpen(!mobileOpen); setOpenGroup(null); }}
          aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={mobileOpen}
          aria-controls="mobile-site-navigation"
        >
          <svg aria-hidden="true" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {mobileOpen ? <path d="M5 5l14 14M19 5 5 19" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      {mobileOpen && (
        <nav id="mobile-site-navigation" aria-label="Mobile navigation" className="max-h-[calc(100dvh-94px)] overflow-y-auto border-t border-[#E5E9EF] bg-white px-4 pb-5 pt-3 xl:hidden">
          <div className="mx-auto max-w-[1500px]">
            {primaryNavigation.map((link) => (
              <Link key={link.href} href={link.href} onClick={closeAll} className="block rounded-lg px-3 py-3 text-sm font-bold text-[#002144] hover:bg-[#F2F5F8]">{link.label}</Link>
            ))}
            {navigationGroups.map((group) => (
              <div key={group.label} className="mt-3 border-t border-[#EDF0F4] pt-3">
                <div className="px-3 pb-1 text-[11px] font-extrabold uppercase tracking-[.16em] text-[#861F41]">{group.label}</div>
                {group.links.map((link) => (
                  <Link key={link.href} href={link.href} onClick={closeAll} className="block rounded-lg px-3 py-2.5 text-sm text-[#344960] hover:bg-[#F2F5F8]">{link.label}</Link>
                ))}
              </div>
            ))}
            <Link href={searchNavigation.href} onClick={closeAll} className="mt-4 block rounded-lg bg-[#861F41] px-4 py-3 text-center text-sm font-bold text-white">Search Archive ↗</Link>
          </div>
        </nav>
      )}
    </header>
  );
}
