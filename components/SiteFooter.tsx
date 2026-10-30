import Link from "next/link";

const groups = [
  { title: "Explore", items: [{ label: "Bands & Corps", href: "/bands" }, { label: "Competitions", href: "/competitions" }, { label: "Organizations", href: "/organizations" }, { label: "Advanced Search", href: "/search" }] },
  { title: "About", items: [{ label: "Meet the Team", href: "/team" }, { label: "Staff Access", href: "/staff/login" }] },
];

export default function SiteFooter() {
  return (
    <footer className="bg-[#00192f] text-white">
      <div className="mx-auto grid max-w-330 gap-12 px-6 py-16 md:grid-cols-[1.8fr_1fr_1fr] md:px-8">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[.3em] text-[#e8afc2]">A living record of the marching arts</span>
          <Link href="/" className="mt-4 block text-2xl font-black tracking-tight">The Marching Archives<span className="text-[#bb5578]">.</span></Link>
          <p className="mt-5 max-w-md text-sm leading-7 text-slate-300">An independent historical archive documenting competition results, scores, placements, and achievements across the marching arts.</p>
        </div>
        {groups.map(group => <div key={group.title}><h2 className="text-xs font-black uppercase tracking-[.22em] text-[#e8afc2]">{group.title}</h2><nav aria-label={`${group.title} footer links`} className="mt-6 flex flex-col gap-3">{group.items.map(link => <Link key={link.href} href={link.href} className="text-sm text-slate-300 transition hover:text-white">{link.label}</Link>)}</nav></div>)}
      </div>
      <div className="border-t border-white/10"><div className="mx-auto flex max-w-330 flex-col justify-between gap-3 px-6 py-6 text-xs text-slate-400 sm:flex-row md:px-8"><span>© 2026 The Marching Archives. All rights reserved.</span><span>Independent and not affiliated with KMEA, BOA, MSBA, or DCI.</span></div></div>
    </footer>
  );
}
