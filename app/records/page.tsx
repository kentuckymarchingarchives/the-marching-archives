import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type Query = { year?: string; organization?: string; metric?: string };
type Props = { searchParams: Promise<Query> };
type Event = { id: string; season_year: number; organization_code: string };
type Round = { id: string; competition_id: string; name: string; round_kind: string };
type Entry = {
  id: string;
  band_id: string;
  overall_placement: number | null;
  class_placement: number | null;
};
type Ensemble = { id: string; slug: string | null; name: string };
type Standing = {
  id: string;
  name: string;
  slug: string | null;
  appearances: number;
  overallFirsts: number;
  overallPodiums: number;
  classFirsts: number;
};

const ORGANIZATIONS = ["KMEA", "MSBA", "BOA", "DCI"] as const;
const METRICS = [
  { key: "appearances", label: "Finals appearances" },
  { key: "overallPodiums", label: "Finals overall podiums" },
  { key: "overallFirsts", label: "Finals overall first places" },
  { key: "classFirsts", label: "Finals class first places" },
] as const;
type Metric = (typeof METRICS)[number]["key"];

// If a dataset reaches one of these bounds, hide rankings rather than show partial records.
const MAX_EVENTS = 400;
const MAX_ROUNDS = 1200;
const MAX_ENTRIES = 12000;
const BATCH_SIZE = 50;
const INPUT_CLASS = "mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-[#002144] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#861F41]";

async function batchLoad<T>(
  ids: string[],
  load: (batch: string[]) => Promise<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const output: T[] = [];
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const response = await load(ids.slice(i, i + BATCH_SIZE));
    if (response.error) throw new Error("Unable to retrieve championship archive records.");
    output.push(...(response.data ?? []));
  }
  return output;
}

async function RecordsContent({ searchParams }: Props) {
  const query = await searchParams;
  const candidateYear = Number(query.year);
  const year = /^\d{4}$/.test(query.year ?? "") && Number.isInteger(candidateYear) && candidateYear >= 1900 && candidateYear <= 2200
    ? candidateYear : new Date().getFullYear();
  const organization = ORGANIZATIONS.find((o) => o === query.organization) ?? "KMEA";
  const metric: Metric = METRICS.find((m) => m.key === query.metric)?.key ?? "appearances";
  const supabase = await createClient();

  const eventResponse = await supabase.from("competitions")
    .select("id,season_year,organization_code", { count: "exact" })
    .eq("publication_status", "published")
    .is("archived_at", null)
    .eq("season_year", year)
    .eq("organization_code", organization)
    .in("competition_type", ["smbc", "championships", "grand_nationals", "world_championship"])
    .order("id", { ascending: true })
    .limit(MAX_EVENTS + 1);
  if (eventResponse.error) throw new Error("Unable to load championship events.");
  const events = (eventResponse.data ?? []) as Event[];
  let incomplete = (eventResponse.count ?? 0) > MAX_EVENTS || events.length > MAX_EVENTS;
  const eventIds = events.slice(0, MAX_EVENTS).map((event) => event.id);

  const rawRounds = eventIds.length ? await batchLoad<Round>(eventIds, async (batch) => {
    const response = await supabase.from("competition_rounds")
      .select("id,competition_id,name,round_kind")
      .in("competition_id", batch)
      .is("archived_at", null)
      .order("id", { ascending: true })
      .limit(MAX_ROUNDS + 1);
    return { data: response.data as Round[] | null, error: response.error };
  }) : [];
  if (rawRounds.length > MAX_ROUNDS) incomplete = true;
  const finals = rawRounds.filter((r) => r.round_kind === "finals" || /\bfinals?\b/i.test(r.name));
  const finalRoundIds = finals.slice(0, MAX_ROUNDS).map((r) => r.id);

  const rawEntries = finalRoundIds.length ? await batchLoad<Entry>(finalRoundIds, async (batch) => {
    const response = await supabase.from("competition_entries")
      .select("id,band_id,overall_placement,class_placement")
      .in("round_id", batch)
      .order("id", { ascending: true })
      .limit(1001);
    if ((response.data?.length ?? 0) > 1000) incomplete = true;
    return { data: response.data as Entry[] | null, error: response.error };
  }) : [];
  if (rawEntries.length > MAX_ENTRIES) incomplete = true;

  const tally = new Map<string, Standing>();
  for (const entry of rawEntries.slice(0, MAX_ENTRIES)) {
    if (!entry.band_id) continue;
    const record = tally.get(entry.band_id) ?? {
      id: entry.band_id, name: "Unnamed ensemble", slug: null,
      appearances: 0, overallFirsts: 0, overallPodiums: 0, classFirsts: 0,
    };
    record.appearances += 1;
    if (entry.overall_placement === 1) record.overallFirsts += 1;
    if (entry.overall_placement != null && entry.overall_placement >= 1 && entry.overall_placement <= 3) record.overallPodiums += 1;
    if (entry.class_placement === 1) record.classFirsts += 1;
    tally.set(entry.band_id, record);
  }

  const bandIds = [...tally.keys()];
  const bands = bandIds.length ? await batchLoad<Ensemble>(bandIds, async (batch) => {
    const response = await supabase.from("bands")
      .select("id,slug,name")
      .in("id", batch)
      .is("archived_at", null);
    return { data: response.data as Ensemble[] | null, error: response.error };
  }) : [];
  for (const band of bands) {
    const record = tally.get(band.id);
    if (record) { record.slug = band.slug; record.name = band.name; }
  }
  const standings = [...tally.values()]
    .filter((record) => record.slug && record[metric] > 0)
    .sort((a, b) => b[metric] - a[metric] || b.appearances - a.appearances || a.name.localeCompare(b.name));
  const metricLabel = METRICS.find((m) => m.key === metric)?.label ?? "Finals appearances";

  return <>
    <section className="bg-[#002144] px-5 py-14 text-white sm:px-8">
      <div className="mx-auto max-w-7xl">
        <nav aria-label="Breadcrumb" className="text-sm text-slate-300"><Link href="/" className="hover:underline">Home</Link> / <Link href="/championships" className="hover:underline">Championships</Link> / Milestones</nav>
        <p className="mt-7 text-xs font-bold uppercase tracking-[0.2em] text-[#e6a9bc]">Historical performance records</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">Championship milestones</h1>
        <p className="mt-4 max-w-3xl leading-7 text-slate-200">Explore documented championship finals appearances and placements by season and organization.</p>
      </div>
    </section>
    <main className="mx-auto max-w-7xl px-5 pb-20 sm:px-8">
      <form method="get" action="/records" className="relative -mt-7 grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-lg md:grid-cols-4">
        <label className="text-sm font-bold text-[#002144]">Season
          <input type="number" min="1900" max="2200" name="year" defaultValue={year} className={INPUT_CLASS} required />
        </label>
        <label className="text-sm font-bold text-[#002144]">Organization
          <select name="organization" defaultValue={organization} className={INPUT_CLASS}>{ORGANIZATIONS.map((o) => <option key={o} value={o}>{o}</option>)}</select>
        </label>
        <label className="text-sm font-bold text-[#002144] md:col-span-2">Record type
          <select name="metric" defaultValue={metric} className={INPUT_CLASS}>{METRICS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}</select>
        </label>
        <div className="md:col-span-4"><button type="submit" className="rounded-xl bg-[#861F41] px-6 py-3 font-bold text-white hover:bg-[#6d1733]">View milestones</button></div>
      </form>
      <div className="mt-10 flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">{organization} · {year}</p><h2 className="mt-2 text-2xl font-extrabold text-[#002144]">{metricLabel}</h2></div>
        <p className="text-sm text-slate-500">{events.length} championship event records · {finals.length} finals rounds</p>
      </div>
      {incomplete ? <div role="alert" className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-6 text-amber-900">This selection exceeds the safe loading limit. Rankings are hidden rather than presenting incomplete historical totals. Try a different season or organization.</div> : standings.length ?
        <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-162.5 text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600"><tr><th className="px-5 py-4">Rank</th><th className="px-5 py-4">Ensemble</th><th className="px-5 py-4 text-right">{metricLabel}</th><th className="px-5 py-4 text-right">Finals appearances</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{standings.map((row, index) => <tr key={row.id} className="hover:bg-slate-50"><td className="px-5 py-4 font-extrabold tabular-nums text-[#861F41]">{index + 1}</td><td className="px-5 py-4"><Link href={`/bands/${encodeURIComponent(row.slug!)}`} className="font-bold text-[#002144] hover:underline">{row.name}</Link></td><td className="px-5 py-4 text-right font-semibold tabular-nums">{row[metric]}</td><td className="px-5 py-4 text-right tabular-nums">{row.appearances}</td></tr>)}</tbody>
          </table>
        </div> : <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-slate-600">No documented finals results match this selection yet.</div>}
      <aside className="mt-8 rounded-xl bg-slate-100 p-6 text-sm leading-7 text-slate-600">
        <strong className="text-[#002144]">Methodology:</strong> Only published, non-archived championship events and their recorded finals rounds are included. An appearance means one ensemble entry in a finals round, so multi-class events may create multiple entries. Podiums refer to recorded overall placements of first through third. Class first places use recorded class placements. These are performance milestones, <strong>not independently confirmed official championship titles</strong>. Missing archive records do not prove an ensemble did not participate.
      </aside>
      <div className="mt-7 flex flex-wrap gap-4 text-sm font-bold"><Link href="/championships" className="text-[#861F41] hover:underline">Browse championship events →</Link><Link href="/leaderboards" className="text-[#861F41] hover:underline">View season leaderboards →</Link></div>
    </main>
  </>;
}

export default function ChampionshipRecordsPage(props: Props) {
  return <Suspense fallback={<main className="mx-auto max-w-7xl p-8">Loading championship milestones…</main>}><RecordsContent {...props} /></Suspense>;
}
