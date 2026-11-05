import Link from "next/link";

const destinations = [
  { href: "/leaderboards", label: "Leaderboards", hint: "Competitive appearances and placements" },
  { href: "/records", label: "Records Explorer", hint: "Explore historical records" },
  { href: "/championships", label: "Championships", hint: "Titles and final placements" },
  { href: "/compare", label: "Compare Bands", hint: "Side-by-side ensemble history" },
  { href: "/power-rankings", label: "Power Rankings", hint: "Curated historical rankings" },
] as const;

/** Accessible cross-links to distinguish the archive's different statistical views. */
export default function StatisticsQuickLinks({ current }: { current: string }) {
  return (
    <nav aria-label="Explore other archive statistics" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-extrabold text-[#002144]">Explore more statistics</h2>
      <p className="mt-1 text-sm text-slate-600">Different tools answer different questions about the competitive record.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {destinations.filter((item) => item.href !== current).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            title={item.hint}
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold text-[#002144] transition hover:border-[#861F41] hover:text-[#861F41] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#861F41]"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
