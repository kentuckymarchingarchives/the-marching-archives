
import Link from "next/link";

const links = [
  { href: "/bands", label: "Bands & Corps" },
  { href: "/competitions", label: "Competitions" },
  { href: "/organizations", label: "Organizations" },
  { href: "/search", label: "Search" },
];

export default function SiteFooter() {
  return (
    <footer className="bg-[#00172f] text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 md:grid-cols-[1.4fr_1fr_1fr] md:px-8">
        <div>
          <Link
            href="/"
            className="text-xl font-extrabold tracking-tight"
          >
            The Marching Archives
          </Link>

          <p className="mt-4 max-w-sm text-sm leading-7 text-slate-300">
            An independent archive preserving competitive marching
            history through documented results, scores, placements,
            and achievements.
          </p>
        </div>

        <div>
          <h2 className="text-xs font-bold uppercase tracking-[.2em] text-[#e6a9bc]">
            Explore
          </h2>

          <nav
            aria-label="Footer navigation"
            className="mt-5 flex flex-col gap-3"
          >
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-sm text-slate-300 hover:text-white"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <div>
          <h2 className="text-xs font-bold uppercase tracking-[.2em] text-[#e6a9bc]">
            Administration
          </h2>

          <Link
            href="/staff/login"
            className="mt-5 inline-block text-sm text-slate-300 hover:text-white"
          >
            Staff access →
          </Link>

          <p className="mt-6 text-xs leading-6 text-slate-400">
            Independent resource; not affiliated with KMEA, MSBA,
            BOA, or DCI.
          </p>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-3 px-6 py-6 text-xs text-slate-400 md:px-8">
          <span>
            © 2026 The Marching Archives. All rights reserved.
          </span>
          <span>Preserving competitive history.</span>
        </div>
      </div>
    </footer>
  );
}
