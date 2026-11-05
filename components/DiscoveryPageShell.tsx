import type { ReactNode } from "react";
import Link from "next/link";

const tabs = [
  ["Featured", "/featured"], ["On This Day", "/on-this-day"],
  ["Coverage", "/coverage"], ["Rivalries", "/rivalries"],
  ["Verified", "/recently-verified"],
] as const;

export default function DiscoveryPageShell({ title, description, active, children }: { title: string; description: string; active: string; children: ReactNode }) {
  return <main className="min-h-screen bg-[#f6f7f9] text-[#002144]">
    <header className="bg-[#002144] px-6 py-14 text-white sm:py-16"><div className="mx-auto max-w-6xl">
      <Link href="/" className="text-sm font-bold text-[#e8afc2] hover:underline">← The Marching Archives</Link>
      <p className="mt-8 text-xs font-bold uppercase tracking-widest text-[#e8afc2]">Explore / Historical discovery</p>
      <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">{title}</h1>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-200">{description}</p>
    </div></header>
    <div className="mx-auto max-w-6xl px-6 py-8">
      <nav aria-label="Historical discovery" className="mb-8 flex flex-wrap gap-2">{tabs.map(([label, href]) =>
        <Link key={href} href={href} aria-current={active === href ? "page" : undefined} className={`rounded-full border px-4 py-2 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-[#861F41] ${active === href ? "border-[#861F41] bg-[#861F41] text-white" : "border-slate-200 bg-white text-[#002144] hover:border-[#861F41]"}`}>{label}</Link>
      )}</nav>
      {children}
    </div>
  </main>;
}
