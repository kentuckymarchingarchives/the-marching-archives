
import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

const PAGE_SIZE = 20;

type SearchFilters = {
  q?: string;
  organization?: string;
  year?: string;
  page?: string;
};

type Props = {
  searchParams: Promise<SearchFilters>;
};

const organizations = ["KMEA", "MSBA", "BOA", "DCI"];

function formatDate(value: string | null): string {
  if (!value) return "Date not recorded";

  const date = new Date(`${value}T12:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    return "Date not recorded";
  }

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function pageLink(
  q: string,
  organization: string,
  year: string,
  page: number
): string {
  const params = new URLSearchParams();

  if (q) params.set("q", q);
  if (organization) {
    params.set("organization", organization);
  }
  if (year) params.set("year", year);

  params.set("page", String(page));

  return `/competitions?${params.toString()}`;
}

async function DirectoryContent({ searchParams }: Props) {
  const filters = await searchParams;

  const q = (filters.q ?? "").trim().slice(0, 100);

  const organization = organizations.includes(
    filters.organization ?? ""
  )
    ? filters.organization!
    : "";

  const year =
    /^\d{4}$/.test(filters.year ?? "") &&
    Number(filters.year) >= 1800 &&
    Number(filters.year) <= 2200
      ? filters.year!
      : "";

  const parsedPage = Number(filters.page ?? "1");

  const page =
    Number.isSafeInteger(parsedPage) &&
    parsedPage >= 1 &&
    parsedPage <= 10000
      ? parsedPage
      : 1;

  const supabase = await createClient();

  let query = supabase
    .from("competitions")
    .select(
      "id, name, season_year, organization_code, competition_type, competition_date, city, state, country",
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
    query = query.eq(
      "organization_code",
      organization
    );
  }

  if (year) {
    query = query.eq("season_year", Number(year));
  }

  const offset = (page - 1) * PAGE_SIZE;

  const { data, error, count } = await query.range(
    offset,
    offset + PAGE_SIZE - 1
  );

  const competitions = data ?? [];
  const total = count ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 py-12">
      <form
        method="get"
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h2 className="text-xl font-bold text-[#002144]">
          Search Competitions
        </h2>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <label className="text-sm font-semibold text-[#002144]">
            Competition Name
            <input
              name="q"
              type="search"
              maxLength={100}
              defaultValue={q}
              placeholder="Search by event name"
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
              {organizations.map((org) => (
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
              placeholder="All seasons"
              className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3"
            />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="submit"
            className="cursor-pointer rounded-lg bg-[#861F41] px-6 py-3 text-sm font-bold text-white hover:bg-[#A02B52]"
          >
            Search Archive
          </button>

          <Link
            href="/competitions"
            className="rounded-lg border border-slate-300 px-6 py-3 text-sm font-bold text-[#002144] hover:bg-slate-50"
          >
            Clear Filters
          </Link>
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
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800"
          >
            Unable to load competition records.
          </div>
        ) : competitions.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
            <h3 className="text-xl font-bold text-[#002144]">
              No competitions found
            </h3>

            <p className="mt-3 text-sm text-slate-600">
              Try adjusting your filters, or check back
              as more verified historical results are published.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {competitions.map((competition) => (
              <Link
                key={competition.id}
                href={`/competitions/${competition.id}`}
                className="group flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-[#861F41] hover:shadow-md"
              >
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
                    {competition.organization_code}
                    {" · "}
                    {competition.season_year}
                  </p>

                  <h3 className="mt-3 font-serif text-2xl font-bold text-[#002144] group-hover:text-[#861F41]">
                    {competition.name}
                  </h3>

                  <p className="mt-3 text-sm text-slate-600">
                    {competition.competition_type
                      .replaceAll("_", " ")
                      .replace(/\b\w/g, (letter: string) =>
                        letter.toUpperCase()
                      )}
                  </p>

                  <div className="mt-5 space-y-2 text-sm text-slate-600">
                    <p>
                      <strong>Date:</strong>{" "}
                      {formatDate(
                        competition.competition_date
                      )}
                    </p>

                    <p>
                      <strong>Location:</strong>{" "}
                      {[
                        competition.city,
                        competition.state,
                        competition.country,
                      ]
                        .filter(Boolean)
                        .join(", ") ||
                        "Not recorded"}
                    </p>
                  </div>
                </div>

                <p className="mt-6 border-t border-slate-100 pt-4 text-sm font-bold text-[#861F41]">
                  View Competition & Results →
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {!error && totalPages > 1 && (
        <nav
          aria-label="Competition pages"
          className="flex flex-wrap items-center justify-center gap-4 border-t border-slate-200 pt-7"
        >
          {page > 1 && (
            <Link
              href={pageLink(
                q,
                organization,
                year,
                page - 1
              )}
              className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-[#002144]"
            >
              ← Previous
            </Link>
          )}

          <span className="text-sm font-semibold text-[#002144]">
            Page {page} of {totalPages}
          </span>

          {page < totalPages && (
            <Link
              href={pageLink(
                q,
                organization,
                year,
                page + 1
              )}
              className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-[#002144]"
            >
              Next →
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
          <p className="text-xs font-bold uppercase tracking-widest text-[#E0B4C2]">
            The Marching Archives
          </p>

          <h1 className="mt-4 font-serif text-4xl font-bold md:text-5xl">
            Competition Archive
          </h1>

          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            Explore published historical competitions,
            championship events, placements, and results.
          </p>
        </div>
      </section>

      <Suspense
        fallback={
          <div
            role="status"
            className="mx-auto max-w-7xl px-6 py-12 text-sm text-slate-600"
          >
            Loading competition archive...
          </div>
        }
      >
        <DirectoryContent searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
