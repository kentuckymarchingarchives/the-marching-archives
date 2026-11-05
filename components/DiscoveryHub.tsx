import Link from "next/link";

const links = [
  { href: "/featured", eyebrow: "Selected history", name: "Featured Competitions", description: "Handpicked published contests from across the archive." },
  { href: "/on-this-day", eyebrow: "Calendar", name: "On This Day", description: "Competitions held on today's date in earlier seasons." },
  { href: "/coverage", eyebrow: "Transparency", name: "Archive Coverage", description: "Explore documented competitions and recorded results by year." },
  { href: "/rivalries", eyebrow: "Head to head", name: "Historical Rivalries", description: "Compare bands when they appeared in the same published rounds." },
  { href: "/recently-verified", eyebrow: "Research", name: "Recently Verified", description: "See results whose supporting evidence remains current." },
];

export default function DiscoveryHub() {
  return (
    <section className="border-y border-slate-200 bg-[#f6f7f9] py-16" aria-labelledby="tma-discovery-heading">
      <div className="mx-auto max-w-330 px-6 md:px-8">
        <p className="text-xs font-black uppercase tracking-widest text-[#861F41]">More ways to explore</p>
        <h2 id="tma-discovery-heading" className="mt-3 text-3xl font-black tracking-tight text-[#002144] sm:text-4xl">Discover the stories in the scores.</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">Go beyond a single result. Follow the seasons, compare competitors, and inspect the archive's documented coverage.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {links.map(item => <Link key={item.href} href={item.href} className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-[#861F41] hover:shadow-md focus-visible:outline-2 focus-visible:outline-[#861F41]">
            <p className="text-xs font-bold uppercase tracking-wider text-[#861F41]">{item.eyebrow}</p>
            <h3 className="mt-3 text-xl font-black text-[#002144]">{item.name}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
            <span className="mt-5 inline-block text-sm font-bold text-[#861F41] group-hover:underline">Explore ↗</span>
          </Link>)}
        </div>
      </div>
    </section>
  );
}
