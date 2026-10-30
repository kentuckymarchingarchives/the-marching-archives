import Image from "next/image";
import Link from "next/link";

const links = [
  { href: "/bands", label: "Bands & Corps" },
  { href: "/competitions", label: "Competitions" },
  { href: "/organizations", label: "Organizations" },
  { href: "/team", label: "Our Team" },
];

export default function SiteHeader() {
  return (
    <header className="tma-header sticky top-0 z-50 border-b border-[#dfe4e9] bg-white/95 backdrop-blur-xl">
      <div className="mx-auto flex h-19 max-w-330 items-center justify-between gap-5 px-5 sm:px-8">
        <Link href="/" className="group flex min-w-0 items-center gap-3.5" aria-label="The Marching Archives home">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-[#002144] p-1.5 shadow-sm transition-transform group-hover:scale-[1.04]">
            <Image src="/tma-logo.png" width={48} height={48} alt="" className="h-full w-full object-contain" priority />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[16px] font-black leading-tight tracking-[-.045em] text-[#002144] sm:text-[19px]">The Marching Archives</span>
            <span className="mt-1 block text-[9px] font-bold uppercase tracking-[.2em] text-[#667586] sm:text-[10px]">Competitive history, preserved</span>
          </span>
        </Link>
        <nav aria-label="Main navigation" className="hidden items-center gap-1 lg:flex">
          {links.map((link) => <Link key={link.href} href={link.href} className="rounded-xl px-3.5 py-2.5 text-[13px] font-bold text-[#435467] transition hover:bg-[#f1f4f7] hover:text-[#002144]">{link.label}</Link>)}
          <Link href="/search" className="ml-3 inline-flex items-center gap-2 rounded-xl bg-[#861F41] px-5 py-3 text-[13px] font-bold text-white shadow-sm transition hover:bg-[#6b1733]">Search archive <span aria-hidden="true">↗</span></Link>
        </nav>
        <details className="tma-mobile-nav relative lg:hidden">
          <summary className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-xl border border-[#dce2e8] text-xl font-bold text-[#002144] [&::-webkit-details-marker]:hidden" aria-label="Toggle navigation">☰</summary>
          <nav aria-label="Mobile navigation" className="absolute right-0 top-13.25 w-[min(85vw,310px)] rounded-2xl border border-[#dfe4e9] bg-white p-2 shadow-xl">
            <Link href="/" className="block rounded-xl px-4 py-3 text-sm font-semibold text-[#002144] hover:bg-[#f4f6f8]">Home</Link>
            {links.map((link) => <Link key={link.href} href={link.href} className="block rounded-xl px-4 py-3 text-sm font-semibold text-[#002144] hover:bg-[#f4f6f8]">{link.label}</Link>)}
            <Link href="/search" className="mt-1 block rounded-xl bg-[#861F41] px-4 py-3 text-sm font-bold text-white">Search archive ↗</Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
