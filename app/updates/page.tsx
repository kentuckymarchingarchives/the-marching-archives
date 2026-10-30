import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { competitionPublicUrl } from "@/lib/public-competition-routes";

const PAGE_SIZE = 18;

type SearchParams = { page?: string; organization?: string };
type Props = { searchParams: Promise<SearchParams> };
const ORGANIZATIONS = ["KMEA", "MSBA", "BOA", "DCI"] as const;

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric", month: "short", day: "numeric", timeZone: "UTC",
  }).format(date);
}

function pageHref(page: number, organization: string) {
  const params = new URLSearchParams({ page: String(page) });
  if (organization) params.set("organization", organization);
  return `/updates?${params.toString()}`;
}

async function RecentRecords({ searchParams }: Props) {
  const params = await searchParams;
  const requested = Number(params.page ?? "1");
  const page = Number.isSafeInteger(requested) && requested > 0 && requested <= 10000 ? requested : 1;
  const organization = ORGANIZATIONS.includes(params.organization as (typeof ORGANIZATIONS)[number])
    ? params.organization!
    : "";

  const supabase = await createClient();
  let query = supabase
    .from("competitions")
    .select("id, slug, name, season_year, organization_code, competition_date, city, state, published_at, created_at", { count: "exact" })
    .eq("publication_status", "published")
    .is("archived_at", null)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: true });
  if (organization) query = query.eq("organization_code", organization);
  const from = (page - 1) * PAGE_SIZE;
  const { data, error, count } = await query.range(from, from + PAGE_SIZE - 1);
  const total = count ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="mx-auto max-w-6xl px-5 pb-20 sm:px-8">
      <form action="/updates" method="get" className="relative -mt-7 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
        <label className="min-w-48 flex-1 text-sm font-semibold text-[#002144]">
          Organization
          <select name="organization" defaultValue={organization} className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm">
            <option value="">All organizations</option>
            {ORGANIZATIONS.map((code) => <option key={code} value={code}>{code}</option>)}
          </select>
        </label>
        <button className="rounded-lg bg-[#861F41] px-6 py-3 text-sm font-bold text-white hover:bg-[#6b1935]" type="submit">Apply filter</button>
        <Link href="/updates" className="rounded-lg border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700">Clear</Link>
      </form>

      <div className="mb-6 mt-12 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-widest text-[#861F41]">New in the archive</p>
          <h2 className="mt-2 text-2xl font-extrabold text-[#002144]">Recently published competitions</h2>
        </div>
        {!error && <p className="text-sm text-slate-600">{total.toLocaleString("en-US")} recorded · Page {page}{totalPages ? ` of ${totalPages}` : ""}</p>}
      </div>

      {error ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">Could not load recent additions. Please try again.</div>
      ) : !data?.length ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-600">No published competitions match this filter yet. <Link href="/competitions" className="font-bold text-[#861F41] underline">Browse competitions</Link>.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((item) => (
            <article key={item.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wide text-[#861F41]">
                <span>{item.organization_code}</span><span aria-hidden="true">·</span><span>{item.season_year} season</span>
              </div>
              <h3 className="mt-3 text-xl font-extrabold text-[#002144]">
                <Link href={competitionPublicUrl(item.slug)} className="hover:text-[#861F41] hover:underline">{item.name}</Link>
              </h3>
              <dl className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                <div><dt className="font-semibold text-slate-800">Published in archive</dt><dd>{formatDate(item.published_at) ?? "Date not recorded"}</dd></div>
                <div><dt className="font-semibold text-slate-800">Competition date</dt><dd>{formatDate(item.competition_date) ?? "Date not recorded"}</dd></div>
                <div className="sm:col-span-2"><dt className="font-semibold text-slate-800">Location</dt><dd>{[item.city, item.state].filter(Boolean).join(", ") || "Not recorded"}</dd></div>
              </dl>
              <Link href={competitionPublicUrl(item.slug)} className="mt-6 text-sm font-bold text-[#861F41] hover:underline">View competition results →</Link>
            </article>
          ))}
        </div>
      )}

      {!error && totalPages > 1 && (
        <nav aria-label="Recent additions pagination" className="mt-9 flex items-center justify-center gap-4 text-sm font-semibold">
          {page > 1 && <Link className="rounded-lg border border-slate-300 bg-white px-5 py-3" href={pageHref(page - 1, organization)}>← Previous</Link>}
          <span>Page {page} of {totalPages}</span>
          {page < totalPages && <Link className="rounded-lg border border-slate-300 bg-white px-5 py-3" href={pageHref(page + 1, organization)}>Next →</Link>}
        </nav>
      )}
      <p className="mt-10 text-sm leading-6 text-slate-500">This page lists published competition records, not a chronological history of when competitions took place. Entries without a recorded publication timestamp may appear after dated entries. Historical corrections and documents are not yet included in this activity feed.</p>
    </div>
  );
}

export default function UpdatesPage(props: Props) {
  return (
    <main className="min-h-screen bg-[#f6f7f9]">
      <section className="bg-[#002144] px-5 pb-20 pt-14 text-white sm:px-8 sm:pt-20">
        <div className="mx-auto max-w-6xl">
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-slate-300"><Link href="/" className="hover:text-white">Home</Link> <span aria-hidden="true">/</span> Recently Added</nav>
          <p className="text-xs font-bold uppercase tracking-widest text-[#e6a9bc]">Discover what's new</p>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">Recently Added</h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-200">Discover newly published competition records and jump straight to their historical results.</p>
        </div>
      </section>
      <Suspense fallback={<div className="mx-auto max-w-6xl px-6 py-12 text-slate-600">Loading recently added records…</div>}>
        <RecentRecords searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
