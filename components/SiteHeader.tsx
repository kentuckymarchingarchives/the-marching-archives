import Image from "next/image";
import Link from "next/link";
import { navigationGroups, primaryNavigation } from "@/lib/archive-navigation";

const navLink =
  "rounded-lg px-3 py-2 text-[13px] font-semibold text-[#344960] transition hover:bg-[#edf1f5] hover:text-[#002144] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#861F41]";

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#dae2e8] bg-white/95 shadow-[0_4px_20px_rgba(0,33,68,0.035)] backdrop-blur-xl">
      <div className="mx-auto flex min-h-22 max-w-375 items-center justify-between gap-4 px-4 py-2 sm:px-6 lg:px-8">
        <Link href="/" aria-label="The Marching Archives home" className="group flex min-w-0 shrink-0 items-center gap-3">
          <span className="flex h-17.5 w-17.5 shrink-0 items-center justify-center rounded-xl bg-[#002144] p-1 shadow-sm ring-1 ring-[#002144]/10 sm:h-19 sm:w-19">
            <Image src="/tma-logo.png" alt="The Marching Archives logo" width={76} height={76} className="h-full w-full object-contain" priority />
          </span>
          <span className="min-w-0">
            <span className="block text-[16px] font-extrabold leading-tight tracking-tight text-[#002144] sm:text-[20px]">The Marching Archives</span>
            <span className="mt-1 block text-[9px] font-bold uppercase tracking-[.14em] text-[#667586] sm:text-[10px]">Competitive history, preserved</span>
          </span>
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-1 xl:flex">
          {primaryNavigation.map((link) => (
            <Link key={link.href} href={link.href} className={navLink}>{link.label}</Link>
          ))}
          {navigationGroups.map((group) => (
            <details key={group.label} className="group relative">
              <summary className={`${navLink} flex cursor-pointer list-none items-center gap-1 [&::-webkit-details-marker]:hidden`}>
                {group.label}
                <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
              </summary>
              <div className="absolute right-0 top-[calc(100%+12px)] w-77.5 rounded-2xl border border-[#dbe3ea] bg-white p-2 shadow-[0_18px_50px_rgba(0,33,68,.18)]">
                <p className="px-3 pb-2 pt-2 text-[10px] font-extrabold uppercase tracking-[.18em] text-[#861F41]">{group.label}</p>
                {group.links.map((link) => (
                  <Link key={link.href} href={link.href} className="block rounded-xl px-3 py-2.5 transition hover:bg-[#f2f5f8]">
                    <span className="block text-[13px] font-bold text-[#002144]">{link.label}</span>
                    <span className="mt-0.5 block text-[11px] text-[#64748b]">{link.description}</span>
                  </Link>
                ))}
              </div>
            </details>
          ))}
          <Link href="/search" className="ml-2 rounded-xl bg-[#861F41] px-4 py-2.5 text-[13px] font-bold text-white shadow-sm transition hover:bg-[#6c1734] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#861F41]">Search Archive ↗</Link>
        </nav>

        <details className="relative xl:hidden">
          <summary aria-label="Open site navigation" className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-xl border border-[#dae2e8] text-[#002144] [&::-webkit-details-marker]:hidden">
            <svg aria-hidden="true" width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </summary>
          <nav aria-label="Mobile navigation" className="absolute right-0 top-[calc(100%+12px)] max-h-[75vh] w-[min(92vw,360px)] overflow-y-auto rounded-2xl border border-[#dbe3ea] bg-white p-3 shadow-[0_18px_50px_rgba(0,33,68,.18)]">
            <Link href="/" className="block rounded-lg px-3 py-2 text-sm font-bold text-[#002144] hover:bg-slate-100">Home</Link>
            {primaryNavigation.map((link) => <Link key={link.href} href={link.href} className="block rounded-lg px-3 py-2 text-sm font-bold text-[#002144] hover:bg-slate-100">{link.label}</Link>)}
            {navigationGroups.map((group) => (
              <div key={group.label} className="mt-3 border-t border-slate-100 pt-3">
                <p className="px-3 pb-1 text-[10px] font-extrabold uppercase tracking-[.14em] text-[#861F41]">{group.label}</p>
                {group.links.map((link) => <Link key={link.href} href={link.href} className="block rounded-lg px-3 py-2 text-sm text-[#334155] hover:bg-slate-100">{link.label}</Link>)}
              </div>
            ))}
            <Link href="/search" className="mt-3 block rounded-lg bg-[#861F41] px-3 py-3 text-center text-sm font-bold text-white">Search Archive ↗</Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
