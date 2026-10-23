
import Image from "next/image";
import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="bg-[#002144] text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 md:grid-cols-3 md:px-8">
        {/* Website branding */}
        <div>
          <Link
            href="/"
            className="flex items-center gap-3"
          >
            <Image
              src="/tma-logo.png"
              alt="The Marching Archives logo"
              width={56}
              height={56}
              className="h-14 w-14 shrink-0 object-contain"
            />

            <span className="font-serif text-xl font-bold">
              The Marching Archives
            </span>
          </Link>

          <p className="mt-5 max-w-sm text-sm leading-7 text-slate-300">
            Preserving the history of competitive
            marching bands and drum corps through
            historical records, competition results,
            and research.
          </p>
        </div>

        {/* Website navigation */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-[#E0B4C2]">
            Explore
          </h2>

          <nav
            aria-label="Footer navigation"
            className="mt-5 flex flex-col items-start gap-3 text-sm"
          >
            <Link
              href="/"
              className="text-slate-300 transition-colors hover:text-white"
            >
              Home
            </Link>

            <Link
              href="/bands"
              className="text-slate-300 transition-colors hover:text-white"
            >
              Band & Corps Directory
            </Link>

            <Link
              href="/staff/login"
              className="text-slate-300 transition-colors hover:text-white"
            >
              Staff Login
            </Link>
          </nav>
        </div>

        {/* Archive details */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-[#E0B4C2]">
            About the Archive
          </h2>

          <p className="mt-5 text-sm leading-7 text-slate-300">
            The Marching Archives is an independent
            historical resource documenting the
            competitive marching arts.
          </p>

          <p className="mt-4 text-xs leading-6 text-slate-400">
            The Marching Archives is not officially
            affiliated with KMEA, MSBA, BOA, or DCI.
          </p>
        </div>
      </div>

      {/* Bottom copyright bar */}
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-xs text-slate-400 md:px-8">
          <p>
            © 2026 The Marching Archives.
            All rights reserved.
          </p>

          <p>
            Preserving Every Performance. Every Legacy.
          </p>
        </div>
      </div>
    </footer>
  );
}
