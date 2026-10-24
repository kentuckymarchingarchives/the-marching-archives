
import Image from "next/image";
import Link from "next/link";

import { ORGANIZATION_LIST } from "@/lib/organization-branding";

export default function HomePage() {
  return (
    <main className="bg-[#F4F6F9]">
      {/* Hero */}
      <section className="bg-[#002144] text-white">
        <div className="mx-auto max-w-7xl px-6 py-24 md:py-32">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#E0B4C2]">
            Welcome to The Marching Archives
          </p>

          <h1 className="mt-6 max-w-4xl font-serif text-5xl font-bold leading-tight md:text-7xl">
            Every Performance.
            <br />
            Every Competition.
            <br />
            <span className="text-[#DCA6B7]">
              Every Legacy.
            </span>
          </h1>

          <p className="mt-8 max-w-2xl text-lg leading-8 text-slate-300">
            Preserving the competitive history of
            marching bands and drum corps through
            competition results, historical records,
            scores, and placements.
          </p>

          <Link
            href="/bands"
            className="mt-10 inline-block cursor-pointer rounded-lg bg-[#861F41] px-7 py-3 font-bold text-white transition hover:bg-[#A02B52]"
          >
            Explore Bands &amp; Corps &rarr;
          </Link>
        </div>
      </section>

      {/* Mission */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
              Our Mission
            </p>

            <h2 className="mt-4 font-serif text-4xl font-bold text-[#002144]">
              Preserving Marching History
            </h2>

            <p className="mt-6 leading-8 text-slate-600">
              The Marching Archives is an independent
              historical resource dedicated to documenting
              the marching arts.
            </p>

            <p className="mt-4 leading-8 text-slate-600">
              Our goal is to make historical competition
              records accessible to performers, educators,
              alumni, researchers, and fans.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <h3 className="text-xl font-bold text-[#002144]">
              What You'll Find
            </h3>

            <div className="mt-6 space-y-5">
              {[
                "Historical Competition Results",
                "Band & Drum Corps Profiles",
                "Placements and Caption Scores",
                "Competitive History and Statistics",
              ].map((feature) => (
                <div
                  key={feature}
                  className="border-l-4 border-[#861F41] py-2 pl-5 font-semibold text-[#002144]"
                >
                  {feature}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Organizations */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
              Competition Coverage
            </p>

            <h2 className="mt-4 font-serif text-4xl font-bold text-[#002144]">
              Organizations We're Documenting
            </h2>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {ORGANIZATION_LIST.map((organization) => (
              <div
                key={organization.code}
                className="flex h-full flex-col items-center rounded-2xl border border-slate-200 bg-[#F8FAFC] p-7 text-center transition hover:border-[#861F41] hover:shadow-md"
              >
                <a
                  href={organization.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Visit the official ${organization.name} website`}
                  className="flex h-28 w-full cursor-pointer items-center justify-center rounded-xl bg-white p-4 transition hover:bg-slate-50"
                >
                  <Image
                    src={organization.logo}
                    alt={`${organization.name} logo`}
                    width={240}
                    height={130}
                    sizes="(max-width: 640px) 240px, 200px"
                    className="max-h-full w-auto max-w-full object-contain"
                  />
                </a>

                <h3 className="mt-5 text-lg font-bold text-[#002144]">
                  {organization.name}
                </h3>

                <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {organization.code}
                </p>

                <div className="mt-auto w-full pt-6">
                  <a
                    href={organization.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#861F41] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#A02B52] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#861F41]"
                  >
                    Official Website
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M13 5h6v6" />
                      <path d="M19 5l-9 9" />
                      <path d="M19 13v6H5V5h6" />
                    </svg>
                  </a>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <Link
              href="/organizations"
              className="inline-block cursor-pointer rounded-lg bg-[#002144] px-7 py-3 text-sm font-bold text-white transition hover:bg-[#123B63]"
            >
              Explore All Organizations &rarr;
            </Link>
          </div>

          <p className="mx-auto mt-6 max-w-3xl text-center text-xs leading-6 text-slate-500">
            The Marching Archives is an independent
            historical resource and is not affiliated
            with or endorsed by the organizations listed.
            Their logos and trademarks belong to their
            respective owners.
          </p>
        </div>
      </section>

      {/* Development Notice */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="rounded-2xl bg-[#002144] px-8 py-14 text-center text-white">
          <h2 className="font-serif text-3xl font-bold">
            Our Archive Is Growing
          </h2>

          <p className="mx-auto mt-5 max-w-2xl leading-7 text-slate-300">
            Competition results, band profiles, and
            historical records will continue to be
            added as The Marching Archives develops.
          </p>
        </div>
      </section>
    </main>
  );
}
