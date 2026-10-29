import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ORGANIZATION_LIST } from "@/lib/organization-branding";

export const metadata: Metadata = {
  title: "Competition Organizations | The Marching Archives",
  description:
    "Browse KMEA, MSBA, BOA, and DCI competition records in The Marching Archives.",
};

export default function OrganizationsPage() {
  return (
    <main className="min-h-screen bg-[#f6f7f9] text-[#002144]">
      <section className="bg-[#002144] px-6 py-14 text-white md:py-20">
        <div className="mx-auto max-w-7xl">
          <nav aria-label="Breadcrumb" className="text-sm text-slate-300">
            <Link href="/" className="hover:text-white hover:underline">Home</Link>
            <span className="mx-2" aria-hidden="true">/</span>
            <span aria-current="page" className="text-white">Organizations</span>
          </nav>
          <p className="mt-9 text-xs font-extrabold uppercase tracking-[0.2em] text-[#edb8c9]">
            Explore the archive
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">
            Competition organizations
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-200 md:text-lg">
            Find historical competitions and results by organizing body.
            Choose an organization to browse its records in the archive.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/competitions" className="rounded-lg bg-[#861F41] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#a02b52]">
              All competitions <span aria-hidden="true">→</span>
            </Link>
            <Link href="/search" className="rounded-lg border border-white/30 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10">
              Search the archive
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-14 md:py-20" aria-labelledby="organizations-heading">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#861F41]">Browse by organization</p>
            <h2 id="organizations-heading" className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
              Organizations in the archive
            </h2>
            <p className="mt-3 max-w-2xl leading-7 text-slate-600">
              Each organization links directly to its filtered competition directory.
            </p>
          </div>
          <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600">
            {ORGANIZATION_LIST.length} organizations
          </span>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {ORGANIZATION_LIST.map((organization) => (
            <article key={organization.code} className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-lg">
              <div className="flex min-h-44 items-center justify-center border-b border-slate-100 bg-[#f9fafb] px-8 py-7">
                <Image
                  src={organization.logo}
                  alt={`${organization.name} logo`}
                  width={260}
                  height={128}
                  sizes="(max-width: 768px) 220px, 260px"
                  className="max-h-28 w-auto max-w-full object-contain"
                />
              </div>
              <div className="flex flex-1 flex-col p-6 sm:p-8">
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#861F41]">
                  {organization.shortName}
                </p>
                <h3 className="mt-2 text-xl font-extrabold tracking-tight sm:text-2xl">
                  {organization.name}
                </h3>
                <p className="mt-4 flex-1 text-sm leading-7 text-slate-600">
                  {organization.description}
                </p>
                <div className="mt-7 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-6">
                  <Link
                    href={`/competitions?organization=${encodeURIComponent(organization.code)}`}
                    className="inline-flex items-center justify-center rounded-lg bg-[#002144] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#123b63]"
                    aria-label={`Browse ${organization.shortName} competition results`}
                  >
                    Browse results <span className="ml-2" aria-hidden="true">→</span>
                  </Link>
                  <a
                    href={organization.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-5 py-3 text-sm font-semibold text-[#861F41] transition hover:border-[#861F41] hover:bg-[#fdf7f9]"
                    aria-label={`Visit ${organization.name} official website (opens in new tab)`}
                  >
                    Official website <span className="ml-2" aria-hidden="true">↗</span>
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-slate-200 bg-white px-6 py-12">
        <div className="mx-auto max-w-7xl md:flex md:items-start md:justify-between md:gap-10">
          <div className="max-w-3xl">
            <h2 className="text-xl font-extrabold">An independent historical resource</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              The Marching Archives is not affiliated with or endorsed by the organizations listed here.
              Organization names, logos, and trademarks belong to their respective owners and are used
              for identification and historical reference.
            </p>
          </div>
          <Link href="/bands" className="mt-5 inline-flex shrink-0 text-sm font-bold text-[#861F41] hover:underline md:mt-1">
            Explore bands &amp; corps <span className="ml-2" aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
