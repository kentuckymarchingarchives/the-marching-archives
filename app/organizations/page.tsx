
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import {
  ORGANIZATION_LIST,
} from "@/lib/organization-branding";

export const metadata: Metadata = {
  title: "Organizations",
  description:
    "Explore the marching band and drum corps competition organizations documented by The Marching Archives.",
};

export default function OrganizationsPage() {
  return (
    <main className="min-h-screen bg-[#F4F6F9]">
      <header className="bg-[#002144] px-6 py-16 text-white">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#E0B4C2]">
            The Marching Archives
          </p>

          <h1 className="mt-4 font-serif text-4xl font-bold md:text-5xl">
            Competition Organizations
          </h1>

          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
            Explore organizations represented in our
            collection of historical marching band and
            drum corps competition records.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-10 px-6 py-12">
        <div className="grid gap-6 md:grid-cols-2">
          {ORGANIZATION_LIST.map((organization) => (
            <article
              key={organization.code}
              className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"
            >
              <div className="flex min-h-36 items-center justify-center rounded-xl bg-[#F4F6F9] p-5">
                <a
                  href={organization.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Visit ${organization.name}`}
                  className="flex h-28 w-full cursor-pointer items-center justify-center"
                >
                  <Image
                    src={organization.logo}
                    alt={`${organization.name} logo`}
                    width={280}
                    height={160}
                    sizes="(max-width: 768px) 240px, 280px"
                    className="max-h-full w-auto max-w-full object-contain"
                  />
                </a>
              </div>

              <div className="mt-6 flex-1">
                <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
                  {organization.shortName}
                </p>

                <h2 className="mt-2 text-2xl font-bold text-[#002144]">
                  {organization.name}
                </h2>

                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {organization.description}
                </p>
              </div>

              <div className="mt-7 flex flex-wrap gap-3 border-t border-slate-100 pt-5">
                <Link
                  href={`/competitions?organization=${organization.code}`}
                  className="cursor-pointer rounded-lg bg-[#002144] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#123B63]"
                >
                  Browse TMA Results
                </Link>

                <a
                  href={organization.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cursor-pointer rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-[#861F41] transition hover:border-[#861F41]"
                >
                  Official Website ↗
                </a>
              </div>
            </article>
          ))}
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-7">
          <h2 className="text-xl font-bold text-[#002144]">
            About These Organizations
          </h2>

          <p className="mt-3 text-sm leading-7 text-slate-600">
            The Marching Archives is an independent
            historical archive. Organization names and
            logos are provided for identification and
            reference. Their inclusion does not indicate
            sponsorship, endorsement, or affiliation.
          </p>

          <p className="mt-3 text-sm leading-7 text-slate-600">
            All organization names and trademarks remain
            the property of their respective owners.
          </p>
        </section>

        <div>
          <Link
            href="/competitions"
            className="inline-block cursor-pointer rounded-lg bg-[#861F41] px-6 py-3 text-sm font-bold text-white hover:bg-[#A02B52]"
          >
            Explore All Competitions →
          </Link>
        </div>
      </div>
    </main>
  );
}
