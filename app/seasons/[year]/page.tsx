import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { competitionPublicUrl } from "@/lib/public-competition-routes";

const PAGE_SIZE = 24;
const ORGS = ["KMEA", "MSBA", "BOA", "DCI"] as const;
const nowYear = new Date().getUTCFullYear();

type Props = {
  params: Promise<{ year: string }>;
  searchParams: Promise<{ organization?: string; page?: string }>;
};

function queryHref(year: number, org: string, page: number) {
  const params = new URLSearchParams();
  if (org) params.set("organization", org);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return `/seasons/${year}${qs ? `?${qs}` : ""}`;
}

function formatDate(raw: string | null) {
  if (!raw) return "Date unrecorded";
  const date = new Date(`${raw}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? "Date unrecorded" : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
function typeLabel(value: string | null) {
  return value ? value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Competition";
}

async function SeasonYearContent({ params, searchParams }: Props) {
  const [{ year: yearText }, filters] = await Promise.all([params, searchParams]);
  if (!/^\d{4}$/.test(yearText)) notFound();
  const year = Number(yearText);
  if (year < 1800 || year > nowYear + 1) notFound();

  const organization = ORGS.includes(filters.organization as typeof ORGS[number]) ? filters.organization! : "";
  const rawPage = Number(filters.page ?? "1");
  const page = Number.isSafeInteger(rawPage) && rawPage >= 1 && rawPage <= 10000 ? rawPage : 1;
  const supabase = await createClient();
  let query = supabase.from("competitions")
    .select("id,slug,name,season_year,competition_date,competition_type,organization_code,city,state", { count: "exact" })
    .eq("publication_status", "published")
    .is("archived_at", null)
    .eq("season_year", year)
    .order("competition_date", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true });
  if (organization) query = query.eq("organization_code", organization);
  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await query.range(from, from + PAGE_SIZE - 1);
  const total = count ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return <main className="min-h-screen bg-[#f6f7f9]">
    <header className="bg-[#002144] px-5 py-14 text-white sm:px-8"><div className="mx-auto max-w-6xl">
      <nav className="mb-6 text-sm text-slate-300"><Link href="/" className="hover:text-white">Home</Link> <span className="px-1">/</span> <Link href="/seasons" className="hover:text-white">Seasons</Link> / {year}</nav>
      <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#efb8ca]">Season archive</p><h1 className="mt-3 text-4xl font-extrabold sm:text-5xl">{year} Season</h1>
      <p className="mt-4 max-w-2xl text-slate-200">Published competitions and their recorded historical results. Select a competition to view its rounds and scores.</p>
    </div></header>
    <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><form method="get" className="flex flex-wrap items-end gap-3">
        <label className="min-w-48 flex-1 text-sm font-bold text-[#002144]">Organization
          <select name="organization" defaultValue={organization} className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm"><option value="">All organizations</option>{ORGS.map((org) => <option key={org} value={org}>{org}</option>)}</select>
        </label><button className="rounded-lg bg-[#861F41] px-6 py-3 text-sm font-bold text-white" type="submit">Apply filter</button><Link href={`/seasons/${year}`} className="rounded-lg border px-5 py-3 text-sm font-semibold text-slate-600">Clear</Link>
      </form></section>
      {organization === "KMEA" && <aside className="mt-6 rounded-xl border border-[#002144]/15 bg-[#002144]/5 p-5 text-sm leading-7 text-[#002144]"><strong>KMEA season structure:</strong> Modern Kentucky seasons typically include six regular-season weeks, Week 7 Regionals/Quarterfinals, and Week 8 State Semifinals and Finals. Historical formats can differ; events below are listed by recorded date rather than assigned an assumed week.</aside>}
      <div className="mt-9 flex flex-wrap items-end justify-between gap-2"><h2 className="text-2xl font-extrabold text-[#002144]">Competitions</h2>{!error && <p className="text-sm text-slate-500">{total.toLocaleString("en-US")} published {total === 1 ? "event" : "events"}</p>}</div>
      {error ? <p role="alert" className="mt-6 rounded-xl bg-red-50 p-6 text-red-800">Unable to load season records. Please try again.</p> : data?.length ?
        <div className="mt-5 grid gap-4 md:grid-cols-2">{data.map((competition) => <article key={competition.id} className="flex flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wide text-[#861F41]"><span>{competition.organization_code}</span><span>·</span><span>{typeLabel(competition.competition_type)}</span></div>
          <h3 className="mt-3 text-xl font-extrabold leading-snug text-[#002144]"><Link className="hover:text-[#861F41] hover:underline" href={competitionPublicUrl(competition.slug)}>{competition.name}</Link></h3>
          <p className="mt-3 text-sm text-slate-600">{formatDate(competition.competition_date)} · {[competition.city, competition.state].filter(Boolean).join(", ") || "Location not recorded"}</p>
          <Link className="mt-auto pt-6 text-sm font-extrabold text-[#861F41] hover:underline" href={competitionPublicUrl(competition.slug)}>View rounds &amp; results →</Link>
        </article>)}</div> : <div className="mt-5 rounded-xl border border-slate-200 bg-white p-9 text-center"><h3 className="text-lg font-bold text-[#002144]">No published competitions found</h3><p className="mt-2 text-sm text-slate-600">The archive may not yet have results for this year and organization.</p><Link className="mt-4 inline-block font-semibold text-[#861F41]" href={`/seasons/${year}`}>View all organizations →</Link></div>}
      {!error && totalPages > 1 && <nav aria-label="Season competition pages" className="mt-8 flex items-center justify-center gap-4">{page > 1 && <Link className="rounded-lg border bg-white px-4 py-2 font-semibold" href={queryHref(year, organization, page - 1)}>← Previous</Link>}<span className="text-sm text-slate-600">Page {page} of {totalPages}</span>{page < totalPages && <Link className="rounded-lg border bg-white px-4 py-2 font-semibold" href={queryHref(year, organization, page + 1)}>Next →</Link>}</nav>}
      <div className="mt-12 border-t border-slate-200 pt-7 text-sm"><Link className="font-semibold text-[#861F41]" href="/seasons">← Browse another season</Link> <span className="mx-2 text-slate-300">|</span> <Link className="font-semibold text-[#861F41]" href={`/competitions?year=${year}${organization ? `&organization=${organization}` : ""}`}>Advanced competition filters →</Link></div>
    </div>
  </main>;
}


export default function SeasonYearPage(props: Props) {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#f6f7f9]"><div className="mx-auto max-w-6xl px-5 py-16 text-slate-600">Loading season results…</div></main>}>
      <SeasonYearContent {...props} />
    </Suspense>
  );
}
