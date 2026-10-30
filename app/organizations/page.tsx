import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ORGANIZATION_LIST } from "@/lib/organization-branding";

export const metadata: Metadata = {
  title: "Competition Organizations | The Marching Archives",
  description: "Explore historical competition records from KMEA, MSBA, BOA, and DCI.",
};

export default function OrganizationsPage() {
  return (
    <main className="min-h-screen bg-[#f6f7f9] text-[#002144]">
      <section className="relative overflow-hidden bg-[#002144] px-6 py-16 text-white md:py-24">
        <div className="pointer-events-none absolute -right-32 -top-40 h-96 w-96 rounded-full bg-[#861F41]/30 blur-3xl" />
        <div className="relative mx-auto max-w-7xl md:px-2">
          <nav aria-label="Breadcrumb" className="text-sm text-slate-300">
            <Link href="/" className="hover:text-white hover:underline">Home</Link>
            <span aria-hidden="true" className="mx-2 text-slate-400">/</span>
            <span aria-current="page" className="text-white">Organizations</span>
          </nav>
          <p className="mt-10 text-xs font-extrabold uppercase tracking-[0.2em] text-[#efb5c8]">The archive / Organizations</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-tight sm:text-5xl md:text-6xl">
            The organizations behind <span className="text-[#efb5c8]">the competitions.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-slate-200 md:text-lg">
            Explore the organizing bodies represented in our historical records—from Kentucky contests to national and international championships.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/competitions" className="rounded-xl bg-[#861F41] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#a12d54] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Browse competitions →</Link>
            <Link href="/search" className="rounded-xl border border-white/30 bg-white/10 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Advanced search</Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="organizations-heading" className="mx-auto max-w-7xl px-6 py-14 md:px-8 md:py-20">
        <div className="mb-9 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#861F41]">Explore by organizing body</p>
            <h2 id="organizations-heading" className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Browse competition organizations</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">Choose an organization to view its archived competition results, or visit its official website.</p>
          </div>
          <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600">{ORGANIZATION_LIST.length} represented organizations</span>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {ORGANIZATION_LIST.map((organization) => (
            <article key={organization.code} className="group flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:border-[#861F41]/40 hover:shadow-xl">
              <div className="relative flex min-h-52 items-center justify-center border-b border-slate-100 bg-linear-to-br from-white via-[#f7f9fc] to-[#edf1f5] px-8 py-8">
                <span className="absolute left-6 top-6 rounded-full border border-[#002144]/10 bg-white px-3 py-1 text-xs font-black tracking-wide text-[#861F41]">{organization.shortName}</span>
                <Image src={organization.logo} alt={`${organization.name} logo`} width={270} height={135} sizes="(max-width: 768px) 220px, 270px" className="max-h-32 w-auto max-w-full object-contain" />
              </div>
              <div className="flex flex-1 flex-col p-7 sm:p-8">
                <h3 className="text-2xl font-black tracking-tight">{organization.name}</h3>
                <p className="mt-4 flex-1 text-sm leading-7 text-slate-600">{organization.description}</p>
                <div className="mt-7 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-6">
                  <Link href={`/competitions?organization=${encodeURIComponent(organization.code)}`} className="inline-flex items-center justify-center rounded-xl bg-[#002144] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#173d64] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#861F41]" aria-label={`Browse ${organization.shortName} archived competition results`}>Explore results <span aria-hidden="true" className="ml-2">→</span></Link>
                  <a href={organization.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-[#861F41] transition hover:border-[#861F41] hover:bg-[#fff7fa] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#861F41]" aria-label={`Visit ${organization.name} official website (new tab)`}>Official website <span aria-hidden="true" className="ml-2">↗</span></a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="border-t border-slate-200 bg-white px-6 py-12 md:px-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="max-w-3xl">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#861F41]">A historical reference</p>
            <h2 className="mt-2 text-xl font-black">Independent by design.</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">The Marching Archives is an independent project and is not affiliated with or endorsed by the organizations shown. Their names and logos are used for historical identification and reference.</p>
          </div>
          <Link href="/bands" className="shrink-0 text-sm font-bold text-[#861F41] hover:underline">Discover bands &amp; corps →</Link>
        </div>
      </section>
    </main>
  );
}
