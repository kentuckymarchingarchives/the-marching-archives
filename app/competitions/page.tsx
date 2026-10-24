
import { Suspense } from "react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { competitionPublicUrl } from "@/lib/public-competition-routes";
import OrganizationMark from "@/components/OrganizationMark";

export const instant = false;

const PAGE_SIZE = 20;

const ORGANIZATIONS = ["KMEA", "MSBA", "BOA", "DCI"];

const COMPETITION_TYPES = [
  "regular_season",
  "smbc",
  "championships",
  "regional",
  "super_regional",
  "grand_nationals",
  "regular_competition",
  "world_championship",
];

type Props = {
  searchParams: Promise<{
    q?: string;
    organization?: string;
    year?: string;
    type?: string;
    page?: string;
  }>;
};

function label(value: string | null): string {
  if (!value) return "Not specified";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateLabel(value: string | null): string {
  if (!value) return "Date not recorded";

  const date = new Date(`${value}T12:00:00Z`);

  return Number.isNaN(date.getTime())
    ? "Date not recorded"
    : date.toLocaleDateString("en-US", {
        dateStyle: "medium",
        timeZone: "UTC",
      });
}

function pageUrl(
  filters: Record<string, string>,
  page: number
): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }

  params.set("page", String(page));

  return `/competitions?${params.toString()}`;
}

async function Directory({ searchParams }: Props) {
  const params = await searchParams;

  const q = (params.q ?? "").trim().slice(0, 100);

  const organization = ORGANIZATIONS.includes(
    params.organization ?? ""
  )
    ? params.organization!
    : "";

  const year =
    /^\d{4}$/.test(params.year ?? "") &&
    Number(params.year) >= 1800 &&
    Number(params.year) <= 2200
      ? params.year!
      : "";

  const type = COMPETITION_TYPES.includes(
    params.type ?? ""
  )
    ? params.type!
    : "";

  const requestedPage = Number(params.page ?? "1");

  const page =
    Number.isSafeInteger(requestedPage) &&
    requestedPage >= 1 &&
    requestedPage <= 10000
      ? requestedPage
      : 1;

  const supabase = await createClient();

  let query = supabase
    .from("competitions")
    .select(
      "id, slug, name, season_year, organization_code, competition_type, competition_date, city, state, country",
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

  if (q) {
    query = query.ilike(
      "name",
      `%${q.replace(/[%_\\]/g, "\\$&")}%`
    );
  }

  if (organization) {
    query = query.eq("organization_code", organization);
  }

  if (year) {
    query = query.eq("season_year", Number(year));
  }

  if (type) {
    query = query.eq("competition_type", type);
  }

  const from = (page - 1) * PAGE_SIZE;

  const { data, count, error } = await query.range(
    from,
    from + PAGE_SIZE - 1
  );

  const total = count ?? 0;
  const pages = Math.ceil(total / PAGE_SIZE);
  const filters = { q, organization, year, type };

  return (
    <div className="mx-auto max-w-7xl space-y-9 px-6 py-12">
      <form
        method="get"
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h2 className="text-xl font-bold text-[#002144]">
          Search Historical Competitions
        </h2>

        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-semibold text-[#002144] lg:col-span-2">
            Competition Name

            <input
              name="q"
              type="search"
              maxLength={100}
              defaultValue={q}
              placeholder="Search competition names"
              className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3"
            />
          </label>

          <label className="text-sm font-semibold text-[#002144]">
            Organization

            <select
              name="organization"
              defaultValue={organization}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3"
            >
              <option value="">All Organizations</option>

              {ORGANIZATIONS.map((org) => (
                <option key={org} value={org}>
                  {org}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-semibold text-[#002144]">
            Season

            <input
              name="year"
              type="number"
              min={1800}
              max={2200}
              defaultValue={year}
              placeholder="All Seasons"
              className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3"
            />
          </label>

          <label className="text-sm font-semibold text-[#002144] lg:col-span-2">
            Competition Type

            <select
              name="type"
              defaultValue={type}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3"
            >
              <option value="">All Types</option>

              {COMPETITION_TYPES.map((value) => (
                <option key={value} value={value}>
                  {label(value)}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-wrap items-end gap-3 lg:col-span-2">
            <button
              type="submit"
              className="cursor-pointer rounded-lg bg-[#861F41] px-6 py-3 text-sm font-bold text-white hover:bg-[#A02B52]"
            >
              Search Archive
            </button>

            <Link
              href="/competitions"
              className="rounded-lg border border-slate-300 px-6 py-3 text-sm font-bold text-[#002144]"
            >
              Clear Filters
            </Link>
          </div>
        </div>
      </form>

      <section className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-serif text-3xl font-bold text-[#002144]">
            Published Competitions
          </h2>

          {!error && (
            <p className="text-sm text-slate-500">
              {total.toLocaleString("en-US")} records
            </p>
          )}
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800"
          >
            Unable to load competitions.
          </p>
        ) : data?.length ? (
          <div className="grid gap-5 md:grid-cols-2">
            {data.map((competition) => (
              <article
                key={competition.id}
                className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-[#861F41] hover:shadow-md"
              >
                <div className="flex items-start gap-4">
                  <OrganizationMark
                    code={competition.organization_code}
                    size="medium"
                    linked
                  />

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
                      {competition.organization_code}
                      {" · "}
                      {competition.season_year}
                    </p>

                    <h3 className="mt-2 font-serif text-2xl font-bold text-[#002144]">
                      <Link
                        href={competitionPublicUrl(
                          competition.slug
                        )}
                        className="hover:text-[#861F41] hover:underline"
                      >
                        {competition.name}
                      </Link>
                    </h3>

                    <p className="mt-3 text-sm text-slate-600">
                      {label(competition.competition_type)}
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-2 text-sm text-slate-600">
                  <p>{dateLabel(competition.competition_date)}</p>

                  <p>
                    {[
                      competition.city,
                      competition.state,
                      competition.country,
                    ]
                      .filter(Boolean)
                      .join(", ") || "Location not recorded"}
                  </p>
                </div>

                <div className="mt-auto border-t border-slate-100 pt-5">
                  <Link
                    href={competitionPublicUrl(competition.slug)}
                    className="inline-flex cursor-pointer items-center gap-2 text-sm font-bold text-[#861F41] hover:underline"
                  >
                    View Competition &amp; Results
                    <span aria-hidden="true">&rarr;</span>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
            <h3 className="text-xl font-bold text-[#002144]">
              No competitions found
            </h3>

            <p className="mt-3 text-sm text-slate-600">
              Adjust your filters or check back as more
              historical records are published.
            </p>
          </div>
        )}
      </section>

      {!error && pages > 1 && (
        <nav
          aria-label="Competition pages"
          className="flex flex-wrap items-center justify-center gap-5 border-t border-slate-200 pt-8"
        >
          {page > 1 && (
            <Link
              href={pageUrl(filters, page - 1)}
              className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-[#002144]"
            >
              &larr; Previous
            </Link>
          )}

          <span className="text-sm font-semibold text-[#002144]">
            Page {page} of {pages}
          </span>

          {page < pages && (
            <Link
              href={pageUrl(filters, page + 1)}
              className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-[#002144]"
            >
              Next &rarr;
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

export default function CompetitionsPage(props: Props) {
  return (
    <main className="min-h-screen bg-[#F4F6F9]">
      <section className="bg-[#002144] px-6 py-16 text-white">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#E0B4C2]">
            The Marching Archives
          </p>

          <h1 className="mt-4 font-serif text-4xl font-bold md:text-5xl">
            Competition Archive
          </h1>

          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            Explore published marching band and drum corps
            competitions, placements, and scores.
          </p>
        </div>
      </section>

      <Suspense
        fallback={
          <div className="mx-auto max-w-7xl px-6 py-12 text-sm text-slate-600">
            Loading competitions...
          </div>
        }
      >
        <Directory searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
