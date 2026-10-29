
import Link from "next/link";
import Image from "next/image";
import { ORGANIZATION_LIST } from "@/lib/organization-branding";

const destinations = [
  {
    number: "01",
    title: "Bands & Corps",
    desc: "Browse profiles, competitive histories, achievements, and statistics for individual ensembles.",
    href: "/bands",
    cta: "Explore directory",
  },
  {
    number: "02",
    title: "Competitions & Results",
    desc: "Find events, rounds, placements, scores, and archived competition results.",
    href: "/competitions",
    cta: "View competitions",
  },
  {
    number: "03",
    title: "Organizations",
    desc: "Explore the organizations behind the events and the records in the archive.",
    href: "/organizations",
    cta: "Browse organizations",
  },
];

export default function HomePage() {
  return (
    <main className="bg-[#f6f7f9] text-[#002144]">
      <section className="relative overflow-hidden bg-[#002144] text-white">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 85% 20%, #861F41 0, transparent 38%), linear-gradient(130deg,transparent 30%,#14486d 100%)",
          }}
        />

        <div className="relative mx-auto grid max-w-7xl gap-12 px-6 py-20 md:px-8 md:py-28 lg:grid-cols-[1.3fr_.7fr] lg:items-center">
          <div>
            <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[.2em] text-[#f0c6d3]">
              The competitive marching arts archive
            </span>

            <h1 className="mt-7 max-w-3xl text-5xl font-extrabold leading-[1.07] tracking-tight sm:text-6xl lg:text-7xl">
              The history behind{" "}
              <span className="text-[#e6a9bc]">every result.</span>
            </h1>

            <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-200">
              Discover the bands, competitions, scores, and achievements
              that shaped the marching arts. One archive, built to make
              competitive history easier to find.
            </p>

            <form
              action="/search"
              method="get"
              role="search"
              className="mt-9 flex max-w-xl flex-col gap-2 rounded-xl bg-white p-2 shadow-2xl sm:flex-row"
            >
              <label htmlFor="home-search" className="sr-only">
                Search the archive
              </label>
              <input
                id="home-search"
                name="q"
                placeholder="Search bands, competitions, and more…"
                className="min-w-0 flex-1 rounded-lg px-4 py-3 text-base text-slate-900 outline-none placeholder:text-slate-400"
              />
              <button
                type="submit"
                className="rounded-lg bg-[#861F41] px-6 py-3 font-bold text-white hover:bg-[#6d1733]"
              >
                Search archive
              </button>
            </form>

            <p className="mt-4 text-sm text-slate-300">
              Or{" "}
              <Link
                href="/bands"
                className="font-semibold text-white underline underline-offset-4"
              >
                browse all bands
              </Link>{" "}
              and{" "}
              <Link
                href="/competitions"
                className="font-semibold text-white underline underline-offset-4"
              >
                competition results
              </Link>
              .
            </p>
          </div>

          <div className="hidden lg:block">
            <div className="rounded-3xl border border-white/15 bg-white/10 p-7 shadow-2xl backdrop-blur">
              <div className="mb-6 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-[.2em] text-[#f0c6d3]">
                  Inside the archive
                </span>
                <span className="h-2.5 w-2.5 rounded-full bg-[#e6a9bc]" />
              </div>

              {[
                { label: "Explore", value: "Ensemble histories" },
                { label: "Discover", value: "Event results" },
                { label: "Research", value: "Scores & placements" },
                { label: "Compare", value: "Competitive statistics" },
              ].map((item, i) => (
                <div
                  key={item.label}
                  className="flex items-center gap-4 border-t border-white/15 py-5"
                >
                  <span className="text-2xl font-light text-[#e6a9bc]">
                    0{i + 1}
                  </span>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-300">
                      {item.label}
                    </p>
                    <p className="mt-1 text-lg font-bold">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#861F41]">
              Find your way
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Explore the archive
            </h2>
          </div>
          <Link
            href="/search"
            className="text-sm font-bold text-[#861F41] hover:underline"
          >
            Advanced search →
          </Link>
        </div>

        <div className="mt-9 grid gap-5 md:grid-cols-3">
          {destinations.map((d) => (
            <Link
              href={d.href}
              key={d.number}
              className="group flex min-h-72 flex-col rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition hover:-translate-y-1 hover:border-[#861F41]/40 hover:shadow-xl"
            >
              <span className="text-sm font-black text-[#861F41]">
                {d.number} / EXPLORE
              </span>
              <h3 className="mt-7 text-2xl font-extrabold tracking-tight">
                {d.title}
              </h3>
              <p className="mt-4 leading-7 text-slate-600">{d.desc}</p>
              <span className="mt-auto pt-8 text-sm font-extrabold text-[#861F41]">
                {d.cta} →
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 md:grid-cols-[.8fr_1.2fr] md:items-center md:px-8">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#861F41]">
              Built for discovery
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight">
              From a single score to a lasting legacy.
            </h2>
            <p className="mt-5 leading-8 text-slate-600">
              Explore historical results by competition, then follow an
              ensemble&apos;s competitive record to see placements,
              achievements, and statistics in context.
            </p>
            <Link
              href="/search"
              className="mt-7 inline-flex rounded-lg bg-[#002144] px-6 py-3 font-bold text-white hover:bg-[#123b63]"
            >
              Start exploring →
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              "Competition results",
              "Band & corps profiles",
              "Placements and scores",
              "Achievements and statistics",
            ].map((t, i) => (
              <div
                key={t}
                className="rounded-xl border border-slate-200 bg-[#f6f7f9] p-6"
              >
                <span className="text-xs font-bold text-[#861F41]">
                  0{i + 1}
                </span>
                <p className="mt-5 text-lg font-extrabold">{t}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20 md:px-8">
        <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#861F41]">
          Archive coverage
        </p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Organizations we document
          </h2>
          <Link
            href="/organizations"
            className="text-sm font-bold text-[#861F41] hover:underline"
          >
            View organizations →
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ORGANIZATION_LIST.map((o) => (
            <Link
              href="/organizations"
              key={o.code}
              className="flex flex-col items-center rounded-xl border border-slate-200 bg-white p-6 text-center transition hover:border-[#861F41]/40 hover:shadow-md"
            >
              <div className="flex h-24 w-full items-center justify-center">
                <Image
                  src={o.logo}
                  alt={`${o.name} logo`}
                  width={180}
                  height={85}
                  className="max-h-20 w-auto max-w-full object-contain"
                />
              </div>
              <strong className="mt-5 text-base">{o.name}</strong>
              <span className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {o.code}
              </span>
            </Link>
          ))}
        </div>

        <p className="mt-7 text-xs leading-6 text-slate-500">
          The Marching Archives is independent and is not affiliated
          with or endorsed by these organizations. Logos and trademarks
          belong to their respective owners.
        </p>
      </section>

      <section className="bg-[#002144] px-6 py-16 text-center text-white">
        <h2 className="text-3xl font-extrabold">
          History is still being written.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl leading-7 text-slate-300">
          The archive continues to grow as additional historical
          competition records are documented and verified.
        </p>
        <Link
          href="/competitions"
          className="mt-7 inline-flex rounded-lg bg-[#861F41] px-6 py-3 font-bold text-white hover:bg-[#a02b52]"
        >
          Explore results →
        </Link>
      </section>
    </main>
  );
}
