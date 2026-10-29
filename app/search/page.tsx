
import { Suspense } from "react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { BAND_KINDS } from "@/lib/band-validation";
import { competitionPublicUrl } from "@/lib/public-competition-routes";

import BandLogo from "@/components/BandLogo";
import OrganizationMark from "@/components/OrganizationMark";

export const instant = false;

const PAGE_SIZE = 12;

const ORGANIZATIONS = ["KMEA", "MSBA", "BOA", "DCI"];

const COMPETITION_TYPES = [
  ["regular_season", "Regular Season"],
  ["regular_competition", "Regular Competition"],
  ["smbc", "State Marching Band Championships"],
  ["championships", "Championships"],
  ["regional", "Regional"],
  ["super_regional", "Super Regional"],
  ["grand_nationals", "Grand Nationals"],
  ["world_championship", "World Championship"],
] as const;

type RawParams = {
  q?: string | string[];
  kind?: string | string[];
  city?: string | string[];
  state?: string | string[];
  organization?: string | string[];
  type?: string | string[];
  from?: string | string[];
  to?: string | string[];
  bp?: string | string[];
  cp?: string | string[];
  year?: string | string[];
};

type Props = {
  searchParams: Promise<RawParams>;
};

type Filters = {
  q: string;
  kind: string;
  city: string;
  state: string;
  organization: string;
  type: string;
  from: string;
  to: string;
  bp: number;
  cp: number;
};

function first(
  value: string | string[] | undefined
): string {
  if (typeof value === "string") return value;
  return Array.isArray(value) ? (value[0] ?? "") : "";
}

function pageNumber(value: string): number {
  const number = Number(value);

  return Number.isSafeInteger(number) &&
    number >= 1 &&
    number <= 10000
    ? number
    : 1;
}

function validYear(value: string): string {
  return /^\d{4}$/.test(value) &&
    Number(value) >= 1800 &&
    Number(value) <= 2200
    ? value
    : "";
}

function parseFilters(params: RawParams): Filters {
  const rawKind = first(params.kind);
  const rawType = first(params.type);
  const rawOrg = first(params.organization);

  const kind = BAND_KINDS.some(
    (item) => item.value === rawKind
  )
    ? rawKind
    : "";

  const type = COMPETITION_TYPES.some(
    (item) => item[0] === rawType
  )
    ? rawType
    : "";

  return {
    q: first(params.q).trim().slice(0, 100),
    kind,
    city: first(params.city).trim().slice(0, 100),
    state: first(params.state).trim().slice(0, 100),
    organization: ORGANIZATIONS.includes(rawOrg)
      ? rawOrg
      : "",
    type,
    from: validYear(
      first(params.from) || first(params.year)
    ),
    to: validYear(
      first(params.to) || first(params.year)
    ),
    bp: pageNumber(first(params.bp)),
    cp: pageNumber(first(params.cp)),
  };
}

function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

function namePattern(value: string): string {
  // Remove characters that could interfere with
  // PostgREST's OR-filter grammar.
  const safe = value.replace(/[(),"\\]/g, " ").trim();

  return `%${escapeLike(safe)}%`;
}

function kindLabel(value: string): string {
  return (
    BAND_KINDS.find((item) => item.value === value)?.label ??
    value.replaceAll("_", " ")
  );
}

function competitionTypeLabel(value: string): string {
  return (
    COMPETITION_TYPES.find((item) => item[0] === value)?.[1] ??
    value.replaceAll("_", " ")
  );
}

function dateLabel(value: string | null): string {
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

function searchUrl(
  filters: Filters,
  section: "bands" | "competitions",
  page: number
): string {
  const params = new URLSearchParams();

  const stringFilters = {
    q: filters.q,
    kind: filters.kind,
    city: filters.city,
    state: filters.state,
    organization: filters.organization,
    type: filters.type,
    from: filters.from,
    to: filters.to,
  };

  for (const [key, value] of Object.entries(stringFilters)) {
    if (value) params.set(key, value);
  }

  const bp = section === "bands" ? page : filters.bp;
  const cp = section === "competitions" ? page : filters.cp;

  if (bp > 1) params.set("bp", String(bp));
  if (cp > 1) params.set("cp", String(cp));

  return (
    `/search?${params.toString()}` +
    (section === "bands"
      ? "#ensembles"
      : "#competitions")
  );
}

function Pagination({
  page,
  count,
  section,
  filters,
}: {
  page: number;
  count: number;
  section: "bands" | "competitions";
  filters: Filters;
}) {
  const pages = Math.ceil(count / PAGE_SIZE);

  if (pages <= 1) return null;

  return (
    <nav
      aria-label={`${section} search pagination`}
      className="flex flex-wrap items-center justify-center gap-4 pt-5"
    >
      {page > 1 && (
        <Link
          href={searchUrl(filters, section, page - 1)}
          className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-[#002144] hover:bg-slate-50"
        >
          &larr; Previous
        </Link>
      )}

      <span className="text-sm font-semibold tabular-nums text-[#002144]">
        Page {page} of {pages}
      </span>

      {page < pages && (
        <Link
          href={searchUrl(filters, section, page + 1)}
          className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-[#002144] hover:bg-slate-50"
        >
          Next &rarr;
        </Link>
      )}
    </nav>
  );
}

const inputClass =
  "mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-[#002144] focus:border-[#861F41] focus:outline-none focus:ring-2 focus:ring-[#861F41]/20";

function SearchForm({ filters }: { filters: Filters }) {
  return (
    <form
      method="get"
      action="/search"
      role="search"
      className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8"
    >
      <div>
        <label
          htmlFor="archive-q"
          className="text-sm font-bold text-[#002144]"
        >
          Search Ensemble or Competition Names
        </label>

        <div className="relative mt-2">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m16 16 5 5" />
          </svg>

          <input
            id="archive-q"
            type="search"
            name="q"
            maxLength={100}
            defaultValue={filters.q}
            placeholder="Current band name, former band name, or event..."
            className={`${inputClass} mt-0 py-4 pl-12`}
          />
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm font-semibold text-[#002144]">
          Ensemble Type
          <select
            name="kind"
            defaultValue={filters.kind}
            className={inputClass}
          >
            <option value="">All Ensemble Types</option>
            {BAND_KINDS.map((kind) => (
              <option key={kind.value} value={kind.value}>
                {kind.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-semibold text-[#002144]">
          City
          <input
            name="city"
            maxLength={100}
            defaultValue={filters.city}
            placeholder="Example: Richmond"
            className={inputClass}
          />
        </label>

        <label className="text-sm font-semibold text-[#002144]">
          State / Province
          <input
            name="state"
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
              <option key={organization} value={organization}>
                {organization}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-semibold text-[#002144]">
          Competition Type
          <select
            name="type"
            defaultValue={filters.type}
            className={inputClass}
          >
            <option value="">All Competition Types</option>
            {COMPETITION_TYPES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-semibold text-[#002144]">
          Season From
          <input
            type="number"
            name="from"
            min={1800}
            max={2200}
            placeholder="Earliest year"
            defaultValue={filters.from}
            className={inputClass}
          />
        </label>

        <label className="text-sm font-semibold text-[#002144]">
          Season Through
          <input
            type="number"
            name="to"
            min={1800}
            max={2200}
            placeholder="Latest year"
            defaultValue={filters.to}
            className={inputClass}
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          className="cursor-pointer rounded-lg bg-[#861F41] px-7 py-3 text-sm font-bold text-white hover:bg-[#701832]"
        >
          Search Archive &rarr;
        </button>

        <Link
          href="/search"
          className="rounded-lg border border-slate-300 px-6 py-3 text-sm font-bold text-[#002144] hover:bg-slate-50"
        >
          Clear All Filters
        </Link>
      </div>

      <p className="text-xs leading-6 text-slate-500">
        Ensemble Type applies to bands and drum corps.
        Organization, Competition Type, and Season Range
        apply to competitions. City and State apply to both.
        Name search includes historical ensemble names
        where they are recorded.
      </p>
    </form>
  );
}

async function SearchContent({
  searchParams,
}: Props) {
  const filters = parseFilters(await searchParams);
  const supabase = await createClient();

  const bandFrom = (filters.bp - 1) * PAGE_SIZE;
  const competitionFrom =
    (filters.cp - 1) * PAGE_SIZE;

  const invalidRange =
    Boolean(filters.from && filters.to) &&
    Number(filters.from) > Number(filters.to);

  // Find alternate/historical names first.
  // We use matching band IDs to extend the band search
  // without requiring a new database function.
  let historicalIds: string[] = [];
  let historicalSearchUnavailable = false;
  let historicalResultsLimited = false;

  if (filters.q && !invalidRange) {
    const safeQuery = filters.q
      .replace(/[(),"\\]/g, " ")
      .trim();

    if (safeQuery) {
      const { data, error } = await supabase
        .from("band_names")
        .select("band_id")
        .ilike("name", `%${escapeLike(safeQuery)}%`)
        .limit(501);

      if (error) {
        historicalSearchUnavailable = true;
      } else {
        historicalResultsLimited = (data?.length ?? 0) > 500;
        historicalIds = [
          ...new Set(
            (data ?? [])
              .slice(0, 500)
              .map((record) => record.band_id)
              .filter(
                (id): id is string =>
                  typeof id === "string" &&
                  /^[0-9a-f-]{36}$/i.test(id)
              )
          ),
        ];
      }
    }
  }

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
    const pattern = namePattern(filters.q);

    if (historicalIds.length > 0) {
      bandsQuery = bandsQuery.or(
        `name.ilike."${pattern}",id.in.(${historicalIds.join(",")})`
      );
    } else {
      bandsQuery = bandsQuery.ilike("name", pattern);
    }

    competitionsQuery = competitionsQuery.ilike(
      "name",
      pattern
    );
  }

  if (filters.kind) {
    bandsQuery = bandsQuery.eq("kind", filters.kind);
  }

  if (filters.city) {
    const pattern = `%${escapeLike(filters.city)}%`;

    bandsQuery = bandsQuery.ilike("city", pattern);
    competitionsQuery = competitionsQuery.ilike(
      "city",
      pattern
    );
  }

  if (filters.state) {
    const pattern = `%${escapeLike(filters.state)}%`;

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

  if (filters.type) {
    competitionsQuery = competitionsQuery.eq(
      "competition_type",
      filters.type
    );
  }

  if (filters.from) {
    competitionsQuery = competitionsQuery.gte(
      "season_year",
      Number(filters.from)
    );
  }

  if (filters.to) {
    competitionsQuery = competitionsQuery.lte(
      "season_year",
      Number(filters.to)
    );
  }

  const results = invalidRange
    ? null
    : await Promise.all([
        bandsQuery.range(
          bandFrom,
          bandFrom + PAGE_SIZE - 1
        ),
        competitionsQuery.range(
          competitionFrom,
          competitionFrom + PAGE_SIZE - 1
        ),
      ]);

  const bandsResult = results?.[0];
  const competitionsResult = results?.[1];

  const bands = bandsResult?.data ?? [];
  const competitions = competitionsResult?.data ?? [];

  const bandCount = bandsResult?.count ?? 0;
  const competitionCount =
    competitionsResult?.count ?? 0;

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-6 py-10">
      <SearchForm filters={filters} />

      {invalidRange && (
        <div
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"
        >
          The starting season cannot be later than the
          ending season. Adjust your year range and
          search again.
        </div>
      )}

      {historicalSearchUnavailable && (
        <div
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"
        >
          Historical-name matching is temporarily
          unavailable. Current ensemble names and
          competition names can still be searched.
        </div>
      )}

      {historicalResultsLimited && (
        <div
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"
        >
          This historical-name search matched more than
          500 name records. Narrow your search to ensure
          all matching ensembles can be found.
        </div>
      )}

      {!invalidRange && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <a
              href="#ensembles"
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-[#861F41]"
            >
              <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
                Matching Ensembles
              </p>

              <p className="mt-2 text-4xl font-bold tabular-nums text-[#002144]">
                {bandsResult?.error
                  ? "—"
                  : bandCount.toLocaleString("en-US")}
              </p>

              <p className="mt-2 text-sm text-slate-600">
                Current and historical name matches
              </p>
            </a>

            <a
              href="#competitions"
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-[#861F41]"
            >
              <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
                Matching Competitions
              </p>

              <p className="mt-2 text-4xl font-bold tabular-nums text-[#002144]">
                {competitionsResult?.error
                  ? "—"
                  : competitionCount.toLocaleString("en-US")}
              </p>

              <p className="mt-2 text-sm text-slate-600">
                Published historical events
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
                  Ensemble Records
                </p>

                <h2 className="mt-2 font-serif text-3xl font-bold text-[#002144]">
                  Bands &amp; Drum Corps
                </h2>
              </div>

              <Link
                href="/bands"
                className="text-sm font-bold text-[#861F41] hover:underline"
              >
                View Band Directory &rarr;
              </Link>
            </div>

            {bandsResult?.error ? (
              <p
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-900"
              >
                Unable to load ensemble search results.
              </p>
            ) : bands.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
                <h3 className="font-bold text-[#002144]">
                  No matching ensembles
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Try a different name, city, or ensemble type.
                </p>
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  {bands.map((band) => (
                    <article
                      key={band.id}
                      className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-[#861F41]"
                    >
                      <BandLogo
                        name={band.name}
                        bandId={band.id}
                        logoPath={band.logo_path}
                        supabaseUrl={supabaseUrl}
                        size="medium"
                      />

                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold uppercase tracking-wider text-[#861F41]">
                          {kindLabel(band.kind)}
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
                  count={bandCount}
                  section="bands"
                  filters={filters}
                />
              </>
            )}
          </section>

          <section
            id="competitions"
            className="scroll-mt-8 space-y-6 border-t border-slate-200 pt-10"
          >
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
                  Competition Records
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

            {competitionsResult?.error ? (
              <p
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-900"
              >
                Unable to load competition search results.
              </p>
            ) : competitions.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
                <h3 className="font-bold text-[#002144]">
                  No matching published competitions
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Try changing the season range,
                  organization, competition type, or location.
                </p>
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  {competitions.map((competition) => (
                    <article
                      key={competition.id}
                      className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-[#861F41]"
                    >
                      <OrganizationMark
                        code={competition.organization_code}
                        size="medium"
                      />

                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold uppercase tracking-wider text-[#861F41]">
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

                        <p className="mt-2 text-sm font-medium text-slate-600">
                          {competitionTypeLabel(
                            competition.competition_type
                          )}
                        </p>

                        <p className="mt-2 text-sm text-slate-600">
                          {dateLabel(
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
                  ))}
                </div>

                <Pagination
                  page={filters.cp}
                  count={competitionCount}
                  section="competitions"
                  filters={filters}
                />
              </>
            )}
          </section>
        </>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="font-bold text-[#002144]">
          About Historical Search
        </h2>

        <p className="mt-2 text-sm leading-7 text-slate-600">
          This search includes non-archived ensemble
          profiles and published, non-archived
          competitions. Historical names are searched
          when recorded in the band-name archive.
          Draft competitions and archived records
          are excluded from public results.
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
            Advanced Archive Search
          </h1>

          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            Search ensembles by current or former names,
            explore published competitions, and narrow
            your research by place, organization, or era.
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
              Searching historical records...
            </div>
          </div>
        }
      >
        <SearchContent searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
