import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { competitionPublicUrl } from "@/lib/public-competition-routes";
import OrganizationMark from "@/components/OrganizationMark";

export const instant = false;
const PAGE_SIZE = 20;
const ORGANIZATIONS = ["KMEA", "MSBA", "BOA", "DCI"];
const COMPETITION_TYPES = [
  "regular_season", "smbc", "championships", "regional",
  "super_regional", "grand_nationals", "regular_competition", "world_championship",
];

type Filters = { q?: string; organization?: string; year?: string; type?: string; page?: string };
type Props = { searchParams: Promise<Filters> };

function label(value: string | null): string {
  return value ? value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Not specified";
}
function dateLabel(value: string | null): string {
  if (!value) return "Date not recorded";
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? "Date not recorded" : date.toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" });
}
function pageUrl(filters: Record<string, string>, page: number): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  params.set("page", String(page));
  return `/competitions?${params.toString()}`;
}

async function Directory({ searchParams }: Props) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const organization = ORGANIZATIONS.includes(params.organization ?? "") ? params.organization! : "";
  const year = /^\d{4}$/.test(params.year ?? "") && Number(params.year) >= 1800 && Number(params.year) <= 2200 ? params.year! : "";
  const type = COMPETITION_TYPES.includes(params.type ?? "") ? params.type! : "";
  const requestedPage = Number(params.page ?? "1");
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 && requestedPage <= 10000 ? requestedPage : 1;
  const filters = { q, organization, year, type };
  const activeFilters = [q, organization, year, type].filter(Boolean).length;

  const supabase = await createClient();
  let query = supabase.from("competitions")
    .select("id, slug, name, season_year, organization_code, competition_type, competition_date, city, state, country", { count: "exact" })
    .eq("publication_status", "published")
    .is("archived_at", null)
    .order("season_year", { ascending: false })
    .order("competition_date", { ascending: false, nullsFirst: false })
    .order("id", { ascending: true });
  if (q) query = query.ilike("name", `%${q.replace(/[%_\\]/g, "\\$&")}%`);
  if (organization) query = query.eq("organization_code", organization);
  if (year) query = query.eq("season_year", Number(year));
  if (type) query = query.eq("competition_type", type);
  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await query.range(from, from + PAGE_SIZE - 1);
  const total = count ?? 0;
  const pages = Math.ceil(total / PAGE_SIZE);

  const field = "mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-[#002144] outline-none transition focus:border-[#861F41] focus:ring-2 focus:ring-[#861F41]/20";

  return (
    <div className="mx-auto max-w-7xl px-5 pb-20 sm:px-8">
      <div className="relative -mt-12 rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-[#002144]/6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-[#002144]">Find a competition</h2>
            <p className="mt-1 text-sm text-slate-500">Search published results or narrow the archive by season and organization.</p>
          </div>
          {activeFilters > 0 && <span className="rounded-full bg-[#861F41]/10 px-3 py-1 text-xs font-bold text-[#861F41]">{activeFilters} active {activeFilters === 1 ? "filter" : "filters"}</span>}
        </div>
        <form method="get" action="/competitions" className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-12">
          <label className="text-sm font-semibold text-[#002144] lg:col-span-5">Competition name
            <input name="q" type="search" maxLength={100} defaultValue={q} placeholder="e.g., State Marching Band Championship" className={field} />
          </label>
          <label className="text-sm font-semibold text-[#002144] lg:col-span-3">Organization
            <select name="organization" defaultValue={organization} className={field}>
              <option value="">All organizations</option>
              {ORGANIZATIONS.map((org) => <option key={org} value={org}>{org}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-[#002144] lg:col-span-2">Season
            <input name="year" type="number" min={1800} max={2200} defaultValue={year} placeholder="Any year" className={field} />
          </label>
          <label className="text-sm font-semibold text-[#002144] lg:col-span-2">Event type
            <select name="type" defaultValue={type} className={field}>
              <option value="">All types</option>
              {COMPETITION_TYPES.map((value) => <option key={value} value={value}>{label(value)}</option>)}
            </select>
          </label>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-12">
            <button type="submit" className="rounded-xl bg-[#861F41] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#6e1936]">Apply filters →</button>
            <Link href="/competitions" className="rounded-xl border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">Clear filters</Link>
          </div>
        </form>
      </div>

      <section className="mt-12" aria-labelledby="results-title">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#861F41]">Archive directory</p>
            <h2 id="results-title" className="mt-2 text-3xl font-extrabold tracking-tight text-[#002144]">Published competitions</h2>
          </div>
          {!error && <p className="text-sm font-semibold text-slate-500">{total.toLocaleString("en-US")} {total === 1 ? "competition" : "competitions"}{pages > 1 ? ` · Page ${page} of ${pages}` : ""}</p>}
        </div>

        {error ? (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-8 text-red-800">Unable to load competitions. Please try again.</div>
        ) : data?.length ? (
          <div className="grid gap-5 md:grid-cols-2">
            {data.map((competition) => {
              const href = competitionPublicUrl(competition.slug);
              const location = [competition.city, competition.state, competition.country].filter(Boolean).join(", ") || "Location not recorded";
              return (
                <article key={competition.id} className="group flex min-w-0 flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-[#861F41]/40 hover:shadow-xl hover:shadow-[#002144]/[0.07] sm:p-7">
                  <div className="flex items-start gap-4">
                    <div className="shrink-0"><OrganizationMark code={competition.organization_code} size="medium" linked /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#861F41]">
                        <span>{competition.organization_code}</span><span aria-hidden="true">·</span><span>{competition.season_year} season</span>
                      </div>
                      <h3 className="mt-2 text-xl font-extrabold leading-snug text-[#002144] group-hover:text-[#861F41] sm:text-2xl">
                        <Link href={href} className="focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#861F41]">{competition.name}</Link>
                      </h3>
                      <p className="mt-2 inline-flex rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{label(competition.competition_type)}</p>
                    </div>
                  </div>
                  <div className="mt-6 grid gap-3 border-t border-slate-100 pt-5 text-sm text-slate-600 sm:grid-cols-2">
                    <div><span className="block text-xs font-bold uppercase tracking-wider text-slate-400">Date</span><span className="mt-1 block font-medium">{dateLabel(competition.competition_date)}</span></div>
                    <div><span className="block text-xs font-bold uppercase tracking-wider text-slate-400">Location</span><span className="mt-1 block font-medium">{location}</span></div>
                  </div>
                  <Link href={href} className="mt-6 inline-flex w-fit items-center gap-2 text-sm font-extrabold text-[#861F41] hover:underline">View competition &amp; results <span aria-hidden="true">→</span></Link>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
            <h3 className="text-xl font-extrabold text-[#002144]">No competitions found</h3>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-slate-600">Try a different name, remove a filter, or check back as more verified records are published.</p>
            <Link href="/competitions" className="mt-6 inline-flex rounded-lg bg-[#002144] px-5 py-3 text-sm font-bold text-white">Show all competitions</Link>
          </div>
        )}
      </section>
      {!error && pages > 1 && (
        <nav aria-label="Competition pages" className="mt-9 flex flex-wrap items-center justify-center gap-4">
          {page > 1 ? <Link href={pageUrl(filters, page - 1)} className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-[#002144] hover:border-[#861F41]">← Previous</Link> : <span />}
          <span className="text-sm font-semibold text-slate-600">Page {page} of {pages}</span>
          {page < pages && <Link href={pageUrl(filters, page + 1)} className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-[#002144] hover:border-[#861F41]">Next →</Link>}
        </nav>
      )}
    </div>
  );
}

export default function CompetitionsPage(props: Props) {
  return (
    <main className="min-h-screen bg-[#f6f7f9]">
      <section className="relative overflow-hidden bg-[#002144] px-5 pb-24 pt-14 text-white sm:px-8 sm:pb-28 sm:pt-20">
        <div aria-hidden="true" className="pointer-events-none absolute -right-28 -top-44 h-135 w-135 rounded-full border-90 border-white/[0.035]" />
        <div className="relative mx-auto max-w-7xl">
          <nav aria-label="Breadcrumb" className="mb-7 text-sm text-slate-300"><Link href="/" className="hover:text-white">Home</Link><span className="mx-2" aria-hidden="true">/</span><span className="text-white">Competitions</span></nav>
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#e6a9bc]">Competitive history, preserved</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-tight sm:text-6xl">A record of every <span className="text-[#e8afc2]">competition.</span></h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-200 sm:text-lg">Explore documented competitions, follow championship rounds, and discover the scores and placements that shaped marching history.</p>
        </div>
      </section>
      <Suspense fallback={<div className="mx-auto max-w-7xl px-6 py-12 text-sm text-slate-600">Loading competitions…</div>}>
        <Directory searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
