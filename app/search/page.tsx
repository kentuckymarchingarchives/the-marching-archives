
import { Suspense } from "react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { BAND_KINDS } from "@/lib/band-validation";
import {
  competitionPublicUrl,
} from "@/lib/public-competition-routes";

import BandLogo from "@/components/BandLogo";
import OrganizationMark from "@/components/OrganizationMark";

export const instant = false;

const PAGE_SIZE = 12;

const ORGANIZATIONS = ["KMEA", "MSBA", "BOA", "DCI"];

type SearchParams = {
  q?: string | string[];
  kind?: string | string[];
  state?: string | string[];
  organization?: string | string[];
  year?: string | string[];
  bp?: string | string[];
  cp?: string | string[];
};

type Props = {
  searchParams: Promise<SearchParams>;
};

type FilterValues = {
  q: string;
  kind: string;
  state: string;
  organization: string;
  year: string;
  bp: number;
  cp: number;
};

function first(value: string | string[] | undefined) {
  return typeof value === "string"
    ? value
    : Array.isArray(value)
      ? (value[0] ?? "")
      : "";
}

function pageNumber(value: string): number {
  const number = Number(value);

  return Number.isSafeInteger(number) &&
    number >= 1 &&
    number <= 10000
    ? number
    : 1;
}

function getFilters(input: SearchParams): FilterValues {
  const rawKind = first(input.kind);
  const rawOrg = first(input.organization);
  const rawYear = first(input.year);
  const rawState = first(input.state)
    .trim()
    .slice(0, 100);

  const kind = BAND_KINDS.some(
    (item) => item.value === rawKind
  )
    ? rawKind
    : "";

  const organization = ORGANIZATIONS.includes(rawOrg)
    ? rawOrg
    : "";

  const year =
    /^\d{4}$/.test(rawYear) &&
    Number(rawYear) >= 1800 &&
    Number(rawYear) <= 2200
      ? rawYear
      : "";

  return {
    q: first(input.q).trim().slice(0, 100),
    kind,
    state: rawState,
    organization,
    year,
    bp: pageNumber(first(input.bp)),
    cp: pageNumber(first(input.cp)),
  };
}

function escapedSearch(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

function formatKind(value: string): string {
  const known = BAND_KINDS.find(
    (item) => item.value === value
  );

  return (
    known?.label ??
    value
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

function readableDate(value: string | null): string {
  if (!value) return "Date not recorded";

  const date = new Date(`${value}T12:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    return "Date not recorded";
  }

  return date.toLocaleDateString("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  });
}

function resultPageUrl(
  filters: FilterValues,
  target: "bands" | "competitions",
  page: number
): string {
  const params = new URLSearchParams();

  if (filters.q) params.set("q", filters.q);
  if (filters.kind) params.set("kind", filters.kind);
  if (filters.state) params.set("state", filters.state);

  if (filters.organization) {
    params.set("organization", filters.organization);
  }

  if (filters.year) params.set("year", filters.year);

  const bp = target === "bands" ? page : filters.bp;
  const cp = target === "competitions" ? page : filters.cp;

  if (bp > 1) params.set("bp", String(bp));
  if (cp > 1) params.set("cp", String(cp));

  const anchor =
    target === "bands" ? "#ensembles" : "#competitions";

  return `/search?${params.toString()}${anchor}`;
}

function Pagination({
  page,
  total,
  target,
  filters,
}: {
  page: number;
  total: number;
  target: "bands" | "competitions";
  filters: FilterValues;
}) {
  const pages = Math.ceil(total / PAGE_SIZE);

  if (pages <= 1) return null;

  return (
    <nav
      aria-label={
        target === "bands"
          ? "Ensemble search result pages"
          : "Competition search result pages"
      }
      className="mt-7 flex flex-wrap items-center justify-center gap-4"
    >
      {page > 1 ? (
        <Link
          href={resultPageUrl(filters, target, page - 1)}
          className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-[#002144] hover:bg-slate-50"
        >
          &larr; Previous
        </Link>
      ) : (
        <span />
      )}

      <span className="text-sm font-semibold tabular-nums text-[#002144]">
        Page {page} of {pages}
      </span>

      {page < pages ? (
        <Link
          href={resultPageUrl(filters, target, page + 1)}
          className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-[#002144] hover:bg-slate-50"
        >
          Next &rarr;
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

function SearchFilters({ filters }: { filters: FilterValues }) {
  const inputClass =
    "mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-[#002144] focus:border-[#861F41] focus:outline-none focus:ring-2 focus:ring-[#861F41]/20";

  return (
    <form
      method="get"
      action="/search"
      role="search"
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8"
    >
      <label className="block text-sm font-bold text-[#002144]">
        Search The Marching Archives

        <div className="relative mt-2">
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m16 16 5 5" />
          </svg>

          <input
            name="q"
            type="search"
            maxLength={100}
            defaultValue={filters.q}
            placeholder="Search band or competition names..."
            className={`${inputClass} mt-0 py-4 pl-12`}
          />
        </div>
      </label>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm font-semibold text-[#002144]">
          Ensemble Type

          <select
            name="kind"
            defaultValue={filters.kind}
            className={inputClass}
          >
            <option value="">All Ensemble Types</option>

            {BAND_KINDS.map((kind) => (
              <option
                key={kind.value}
                value={kind.value}
              >
                {kind.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-semibold text-[#002144]">
          State / Province

          <input
            name="state"
            type="text"
            maxLength={100}
            defaultValue={filters.state}
            placeholder="Example: Kentucky"
            className={inputClass}
          />
        </label>

        <label className="text-sm font-semibold text-[#002144]">
          Organization

          <select
            name="organization"
            defaultValue={filters.organization}
            className={inputClass}
          >
            <option value="">All Organizations</option>

            {ORGANIZATIONS.map((organization) => (
              <option
                key={organization}
                value={organization}
              >
                {organization}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-semibold text-[#002144]">
          Competition Season

          <input
            name="year"
            type="number"
            min={1800}
            max={2200}
            defaultValue={filters.year}
            placeholder="All Years"
            className={inputClass}
          />
        </label>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#861F41] px-7 py-3 text-sm font-bold text-white transition hover:bg-[#701832]"
        >
          Search Archive
          <span aria-hidden="true">&rarr;</span>
        </button>

        <Link
          href="/search"
          className="rounded-lg border border-slate-300 px-6 py-3 text-sm font-bold text-[#002144] hover:bg-slate-50"
        >
          Clear Filters
        </Link>
      </div>

      <p className="mt-5 text-xs leading-6 text-slate-500">
        The name search applies to ensembles and competitions.
        Ensemble Type filters only ensembles;
        Organization and Season filter only competitions.
        State / Province filters both.
      </p>
    </form>
  );
}

async function SearchResults({ searchParams }: Props) {
  const filters = getFilters(await searchParams);

  const supabase = await createClient();

  // Separate page numbers allow visitors to browse
  // either result category without losing their place
  // in the other.
  const bandFrom = (filters.bp - 1) * PAGE_SIZE;
  const competitionFrom = (filters.cp - 1) * PAGE_SIZE;

  let bandsQuery = supabase
    .from("bands")
    .select(
      "id, slug, name, kind, city, state, country, logo_path",
      { count: "exact" }
    )
    .is("archived_at", null)
    .order("name", { ascending: true })
    .order("id", { ascending: true });

  let competitionsQuery = supabase
    .from("competitions")
    .select(
      "id, slug, name, organization_code, season_year, competition_type, competition_date, city, state, country",
      { count: "exact" }
    )
    .eq("publication_status", "published")
    .is("archived_at", null)
    .order("season_year", { ascending: false })
    .order("competition_date", {
      ascending: false,
      nullsFirst: false,
    })
    .order("id", { ascending: true });

  if (filters.q) {
    const pattern = `%${escapedSearch(filters.q)}%`;

    bandsQuery = bandsQuery.ilike("name", pattern);

    competitionsQuery = competitionsQuery.ilike(
      "name",
      pattern
    );
  }

  if (filters.kind) {
    bandsQuery = bandsQuery.eq("kind", filters.kind);
  }

  if (filters.state) {
    const pattern = escapedSearch(filters.state);

    bandsQuery = bandsQuery.ilike("state", pattern);
    competitionsQuery = competitionsQuery.ilike(
      "state",
      pattern
    );
  }

  if (filters.organization) {
    competitionsQuery = competitionsQuery.eq(
      "organization_code",
      filters.organization
    );
  }

  if (filters.year) {
    competitionsQuery = competitionsQuery.eq(
      "season_year",
      Number(filters.year)
    );
  }

  const [bandsResult, competitionsResult] =
    await Promise.all([
      bandsQuery.range(
        bandFrom,
        bandFrom + PAGE_SIZE - 1
      ),

      competitionsQuery.range(
        competitionFrom,
        competitionFrom + PAGE_SIZE - 1
      ),
    ]);

  const bandCount = bandsResult.count ?? 0;
  const competitionCount =
    competitionsResult.count ?? 0;

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  const isFiltered =
    Boolean(filters.q) ||
    Boolean(filters.kind) ||
    Boolean(filters.state) ||
    Boolean(filters.organization) ||
    Boolean(filters.year);

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-6 py-10">
      <SearchFilters filters={filters} />

      <section className="space-y-4">
        <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
          {isFiltered
            ? "Your Search Results"
            : "Explore Our Records"}
        </p>

        <h2 className="font-serif text-3xl font-bold text-[#002144]">
          {isFiltered
            ? "Results Across the Archive"
            : "Discover the Marching Arts"}
        </h2>

        <p className="max-w-3xl text-sm leading-7 text-slate-600">
          {isFiltered
            ? "Results matching your selected search and filters."
            : "Browse the available ensemble profiles and published historical competitions. Use the search and filters above to narrow your results."}
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <a
          href="#ensembles"
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-[#861F41]"
        >
          <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
            Ensembles
          </p>

          <p className="mt-2 text-4xl font-bold tabular-nums text-[#002144]">
            {bandsResult.error
              ? "—"
              : bandCount.toLocaleString("en-US")}
          </p>

          <p className="mt-2 text-sm text-slate-600">
            Matching bands and drum corps
          </p>
        </a>

        <a
          href="#competitions"
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-[#861F41]"
        >
          <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
            Published Competitions
          </p>

          <p className="mt-2 text-4xl font-bold tabular-nums text-[#002144]">
            {competitionsResult.error
              ? "—"
              : competitionCount.toLocaleString("en-US")}
          </p>

          <p className="mt-2 text-sm text-slate-600">
            Matching historical competition records
          </p>
        </a>
      </div>

      <section
        id="ensembles"
        className="scroll-mt-8 space-y-6"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
              Ensemble Directory
            </p>

            <h2 className="mt-2 font-serif text-3xl font-bold text-[#002144]">
              Bands &amp; Drum Corps
            </h2>
          </div>

          <Link
            href="/bands"
            className="text-sm font-bold text-[#861F41] hover:underline"
          >
            Browse All Ensembles &rarr;
          </Link>
        </div>

        {bandsResult.error ? (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-900"
          >
            Ensemble search is temporarily unavailable.
          </p>
        ) : bandsResult.data?.length ? (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              {bandsResult.data.map((band) => (
                <article
                  key={band.id}
                  className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#861F41] hover:shadow-md"
                >
                  <BandLogo
                    name={band.name}
                    bandId={band.id}
                    logoPath={band.logo_path}
                    supabaseUrl={supabaseUrl}
                    size="medium"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase tracking-wide text-[#861F41]">
                      {formatKind(band.kind)}
                    </p>

                    <h3 className="mt-2 text-lg font-bold text-[#002144]">
                      <Link
                        href={`/bands/${band.slug}`}
                        className="hover:text-[#861F41] hover:underline"
                      >
                        {band.name}
                      </Link>
                    </h3>

                    <p className="mt-2 text-sm text-slate-600">
                      {[
                        band.city,
                        band.state,
                        band.country,
                      ]
                        .filter(Boolean)
                        .join(", ") ||
                        "Location not recorded"}
                    </p>

                    <Link
                      href={`/bands/${band.slug}`}
                      className="mt-4 inline-block text-sm font-bold text-[#861F41] hover:underline"
                    >
                      View Ensemble Profile &rarr;
                    </Link>
                  </div>
                </article>
              ))}
            </div>

            <Pagination
              page={filters.bp}
              total={bandCount}
              target="bands"
              filters={filters}
            />
          </>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm">
            <h3 className="text-lg font-bold text-[#002144]">
              No matching ensembles
            </h3>

            <p className="mt-2 text-sm text-slate-600">
              Try another name, type, or location.
            </p>
          </div>
        )}
      </section>

      <section
        id="competitions"
        className="scroll-mt-8 space-y-6 border-t border-slate-200 pt-10"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
              Competition History
            </p>

            <h2 className="mt-2 font-serif text-3xl font-bold text-[#002144]">
              Historical Competitions
            </h2>
          </div>

          <Link
            href="/competitions"
            className="text-sm font-bold text-[#861F41] hover:underline"
          >
            Browse All Competitions &rarr;
          </Link>
        </div>

        {competitionsResult.error ? (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-900"
          >
            Competition search is temporarily unavailable.
          </p>
        ) : competitionsResult.data?.length ? (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              {competitionsResult.data.map(
                (competition) => (
                  <article
                    key={competition.id}
                    className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#861F41] hover:shadow-md"
                  >
                    <OrganizationMark
                      code={competition.organization_code}
                      size="medium"
                    />

                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold uppercase tracking-wide text-[#861F41]">
                        {competition.organization_code}
                        {" · "}
                        {competition.season_year}
                      </p>

                      <h3 className="mt-2 text-lg font-bold text-[#002144]">
                        <Link
                          href={competitionPublicUrl(
                            competition.slug
                          )}
                          className="hover:text-[#861F41] hover:underline"
                        >
                          {competition.name}
                        </Link>
                      </h3>

                      <p className="mt-2 text-sm text-slate-600">
                        {readableDate(
                          competition.competition_date
                        )}
                      </p>

                      <p className="mt-1 text-sm text-slate-600">
                        {[
                          competition.city,
                          competition.state,
                          competition.country,
                        ]
                          .filter(Boolean)
                          .join(", ") ||
                          "Location not recorded"}
                      </p>

                      <Link
                        href={competitionPublicUrl(
                          competition.slug
                        )}
                        className="mt-4 inline-block text-sm font-bold text-[#861F41] hover:underline"
                      >
                        View Competition &amp; Results &rarr;
                      </Link>
                    </div>
                  </article>
                )
              )}
            </div>

            <Pagination
              page={filters.cp}
              total={competitionCount}
              target="competitions"
              filters={filters}
            />
          </>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm">
            <h3 className="text-lg font-bold text-[#002144]">
              No matching published competitions
            </h3>

            <p className="mt-2 text-sm text-slate-600">
              Try another competition name,
              organization, season, or location.
            </p>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm leading-7 text-slate-600">
        <h2 className="font-bold text-[#002144]">
          About Archive Search
        </h2>

        <p className="mt-2">
          This search includes non-archived ensemble
          profiles and published, non-archived
          competitions. Draft competitions are not
          included in public results. As additional
          historical records are verified and published,
          they become available here automatically.
        </p>
      </section>
    </div>
  );
}

export default function SearchPage(props: Props) {
  return (
    <main className="min-h-screen bg-[#F4F6F9]">
      <section className="bg-[#002144] px-6 py-16 text-white">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#E0B4C2]">
            The Marching Archives
          </p>

          <h1 className="mt-4 font-serif text-4xl font-bold md:text-5xl">
            Explore the Archive
          </h1>

          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            Discover the history of marching music.
            Search ensembles and published competitions
            across organizations and seasons.
          </p>
        </div>
      </section>

      <Suspense
        fallback={
          <div className="mx-auto max-w-7xl px-6 py-12">
            <div
              role="status"
              className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600"
            >
              Searching The Marching Archives...
            </div>
          </div>
        }
      >
        <SearchResults searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
