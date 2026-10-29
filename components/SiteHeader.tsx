
import Image from "next/image";
import Link from "next/link";

const navigation = [
  {
    label: "Home",
    href: "/",
  },
  {
    label: "Bands & Corps",
    href: "/bands",
  },
  {
    label: "Competitions",
    href: "/competitions",
  },
  {
    label: "Organizations",
    href: "/organizations",
  },
];

export default function SiteHeader() {
  return (
    <header className="relative z-20 border-b border-white/10 bg-[#002144] text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5 px-5 py-4 md:px-8">
        {/* Website logo and identity */}
        <Link
          href="/"
          aria-label="The Marching Archives homepage"
          className="flex min-w-0 items-center gap-4"
        >
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-white p-2 shadow-sm md:h-24 md:w-24">
            <Image
              src="/tma-logo.png"
              alt="The Marching Archives logo"
              width={96}
              height={96}
              priority
              className="h-full w-full object-contain"
            />
          </div>

          <div className="min-w-0">
            <span className="block font-serif text-lg font-bold tracking-wide md:text-2xl">
              The Marching Archives
            </span>

            <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-[#E0B4C2] md:text-xs">
              Preserving Marching History
            </span>
          </div>
        </Link>

        {/* Main navigation */}
        <nav
          aria-label="Main navigation"
          className="flex w-full flex-wrap items-center gap-2 sm:w-auto"
        >
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
            >
              {item.label}
            </Link>
          ))}

          {/* Unified archive search */}
          <Link
            href="/search"
            aria-label="Search The Marching Archives"
            className="inline-flex items-center gap-2 rounded-lg border border-white/25 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:border-white/50 hover:bg-white/10"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m16 16 5 5" />
            </svg>
            Search
          </Link>

          {/* Staff login */}
          <Link
            href="/staff/login"
            className="ml-1 rounded-lg bg-[#861F41] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#A02B52]"
          >
            Staff Login
          </Link>
        </nav>
      </div>
    </header>
  );
}
