import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { competitionPublicUrl, roundPublicUrl } from "@/lib/public-competition-routes";

type Query = { year?: string; organization?: string; class?: string; page?: string };
type Props = { searchParams: Promise<Query> };
type Event = {
  id: string; slug: string | null; name: string; season_year: number;
  organization_code: string; competition_type: string;
  competition_date: string | null; city: string | null; state: string | null;
};
type Round = { id: string; competition_id: string; slug: string | null; name: string; round_kind: string; class_scope: string | null };
const ORGANIZATIONS = ["KMEA", "MSBA", "BOA", "DCI"];
const TYPES = ["smbc", "championships", "grand_nationals", "world_championship"];
const PAGE_SIZE = 15;
const field = "mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-[#002144] focus:border-[#861F41] focus:outline-2 focus:outline-offset-2 focus:outline-[#861F41]";

function nice(s: string) { return s.replaceAll("_", " ").replace(/\b\w/g, x => x.toUpperCase()); }
function dateLabel(date: string | null) {
  if (!date) return "Date not recorded";
  const d = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? "Date not recorded" : d.toLocaleDateString("en-US", { timeZone: "UTC", dateStyle: "medium" });
}
function hrefFor(q: {year: string; organization: string; classFilter: string}, page: number) {
  const p = new URLSearchParams();
  if (q.year) p.set("year", q.year);
  if (q.organization) p.set("organization", q.organization);
  if (q.classFilter) p.set("class", q.classFilter);
  p.set("page", String(page));
  return `/championships?${p.toString()}`;
}

async function ChampionshipContent({ searchParams }: Props) {
  const raw = await searchParams;
  const year = /^\d{4}$/.test(raw.year ?? "") && Number(raw.year) >= 1800 && Number(raw.year) <= 2200 ? raw.year! : "";
  const organization = ORGANIZATIONS.includes(raw.organization ?? "") ? raw.organization! : "";
  const classFilter = /^[a-zA-Z0-9 .-]{1,35}$/.test(raw.class ?? "") ? raw.class!.trim() : "";
  const pageCandidate = Number(raw.page ?? "1");
  const page = Number.isSafeInteger(pageCandidate) && pageCandidate >= 1 && pageCandidate <= 10000 ? pageCandidate : 1;
  const supabase = await createClient();
  let query = supabase.from("competitions")
    .select("id,slug,name,season_year,organization_code,competition_type,competition_date,city,state", { count: "exact" })
    .eq("publication_status", "published").is("archived_at", null)
    .in("competition_type", TYPES)
    .order("season_year", { ascending: false })
    .order("competition_date", { ascending: false, nullsFirst: false })
    .order("id", { ascending: true });
  if (year) query = query.eq("season_year", Number(year));
  if (organization) query = query.eq("organization_code", organization);
  const start = (page - 1) * PAGE_SIZE;
  const response = await query.range(start, start + PAGE_SIZE - 1);
  const events = (response.data ?? []) as Event[];
  const count = response.count ?? 0;
  let rounds: Round[] = [];
  let roundsError = false;
  if (!response.error && events.length) {
    const roundResponse = await supabase.from("competition_rounds")
      .select("id,competition_id,slug,name,round_kind,class_scope")
      .in("competition_id", events.map(e => e.id))
      .is("archived_at", null)
      .order("sort_order", { ascending: true })
      .limit(500);
    rounds = (roundResponse.data ?? []) as Round[];
    roundsError = !!roundResponse.error || rounds.length === 500;
  }
  const byEvent = new Map<string, Round[]>();
  for (const round of rounds) byEvent.set(round.competition_id, [...(byEvent.get(round.competition_id) ?? []), round]);
  const visible = events.map(e => ({ event: e, finals: (byEvent.get(e.id) ?? []).filter(r => r.round_kind === "finals" || /\bfinals?\b/i.test(r.name)) }))
    .filter(({ finals }) => !classFilter || finals.some(r => (r.class_scope ?? "").toLowerCase().includes(classFilter.toLowerCase())));
  const pages = Math.ceil(count / PAGE_SIZE);
  return <>
    <section className="relative overflow-hidden bg-[#002144] px-5 py-20 text-white sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="text-sm text-slate-300"><Link href="/" className="hover:underline">Home</Link> / Championship Records</div>
        <p className="mt-7 text-xs font-bold uppercase tracking-[0.22em] text-[#e6a9bc]">Historical archive</p>
        <p className="mt-7 text-xs font-extrabold uppercase tracking-[.23em] text-[#e8afc2]">Championship archive</p><h1 className="mt-3 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-6xl">Where history <span className="text-[#e8afc2]">was made.</span></h1>
        <p className="mt-5 max-w-3xl leading-8 text-slate-200">Browse published championship events and open their recorded finals results by year, organization, and classification.</p>
        <Link href="/records" className="mt-5 inline-flex rounded-lg border border-white/30 px-4 py-2 text-sm font-bold text-white hover:bg-white/10">Explore championship milestones →</Link>
      </div>
    </section>
    <main className="mx-auto max-w-7xl px-5 pb-20 sm:px-8">
      <form action="/championships" method="get" className="relative -mt-8 grid gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-lg sm:grid-cols-3">
        <label className="text-sm font-bold text-[#002144]">Season
          <input className={field} name="year" type="number" min="1800" max="2200" defaultValue={year} placeholder="All years" />
        </label>
        <label className="text-sm font-bold text-[#002144]">Organization
          <select className={field} name="organization" defaultValue={organization}><option value="">All organizations</option>{ORGANIZATIONS.map(o => <option value={o} key={o}>{o}</option>)}</select>
        </label>
        <label className="text-sm font-bold text-[#002144]">Finals classification
          <input className={field} name="class" maxLength={35} defaultValue={classFilter} placeholder="e.g., 3A" />
        </label>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
          <button type="submit" className="rounded-xl bg-[#861F41] px-6 py-3 font-bold text-white hover:bg-[#6c1735]">Apply filters</button>
          <Link href="/championships" className="rounded-xl border border-slate-300 px-6 py-3 font-semibold text-[#002144] hover:bg-slate-50">Clear</Link>
        </div>
      </form>
      <div className="mt-11 flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">Explore results</p><h2 className="mt-2 text-2xl font-extrabold text-[#002144]">Championship events</h2></div>
        {!response.error && <p className="text-sm text-slate-500">{count.toLocaleString()} published events · Page {page}{pages ? ` of ${pages}` : ""}</p>}
      </div>
      {response.error || roundsError ? <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">Unable to load complete championship records. Please try again.</div> :
        visible.length ? <div className="mt-6 grid gap-5 lg:grid-cols-2">
          {visible.map(({ event, finals }) => <article key={event.id} className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition-shadow hover:shadow-md">
            <div className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wide"><span className="rounded-full bg-[#002144]/10 px-3 py-1 text-[#002144]">{event.organization_code}</span><span className="rounded-full bg-[#861F41]/10 px-3 py-1 text-[#861F41]">{event.season_year}</span><span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{nice(event.competition_type)}</span></div>
            <h3 className="mt-5 text-xl font-extrabold text-[#002144]">{event.name}</h3>
            <p className="mt-2 text-sm text-slate-600">{dateLabel(event.competition_date)}{event.city ? ` · ${event.city}` : ""}{event.state ? `, ${event.state}` : ""}</p>
            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Recorded finals rounds</p>
              {finals.length ? <div className="mt-3 flex flex-wrap gap-2">{finals.filter(r => r.slug && event.slug).map(r => <Link key={r.id} href={roundPublicUrl(event.slug!, r.slug!)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-[#861F41] hover:border-[#861F41]">{r.name}{r.class_scope ? ` · ${r.class_scope}` : ""} →</Link>)}</div> : <p className="mt-2 text-sm text-slate-500">No finals round is currently documented.</p>}
              {event.slug && <Link className="mt-5 inline-block text-sm font-bold text-[#002144] hover:underline" href={competitionPublicUrl(event.slug)}>View complete competition →</Link>}
            </div>
          </article>)}
        </div> : <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-9 text-center text-slate-600">No championship events match these filters on this page. Try another selection.</div>}
      {pages > 1 && <nav aria-label="Championship pagination" className="mt-8 flex items-center justify-center gap-4 text-sm font-bold">
        {page > 1 && <Link href={hrefFor({year,organization,classFilter},page-1)} className="rounded-lg border border-slate-200 bg-white px-5 py-3 text-[#002144]">← Previous</Link>}
        <span className="text-slate-500">Page {page} of {pages}</span>
        {page < pages && <Link href={hrefFor({year,organization,classFilter},page+1)} className="rounded-lg border border-slate-200 bg-white px-5 py-3 text-[#002144]">Next →</Link>}
      </nav>}
      <aside className="mt-10 rounded-2xl border-l-4 border-[#861F41] bg-white p-6 text-sm leading-7 text-slate-600"><strong className="text-[#002144]">How to interpret these records:</strong> Championship events are identified by their recorded competition type. Finals links lead to published round results. A first-place placement is not automatically an independently verified official championship title. Class filtering applies to finals rounds displayed on each page of events; counts and pagination refer to events before that filter.</aside>
    </main>
  </>;
}
export default function ChampionshipsPage(props: Props) {
  return <Suspense fallback={<main className="mx-auto max-w-7xl p-8">Loading championship records…</main>}><ChampionshipContent {...props} /></Suspense>;
}
