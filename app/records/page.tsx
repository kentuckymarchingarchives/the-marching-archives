import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { competitionPublicUrl, roundPublicUrl } from "@/lib/public-competition-routes";

type Filters = { organization?: string; year?: string; metric?: string };
type Props = { searchParams: Promise<Filters> };
type Competition = { id: string; name: string; slug: string | null; organization_code: string; season_year: number };
type Round = { id: string; competition_id: string; name: string; slug: string | null };
type Entry = { id: string; round_id: string; band_id: string; total_score: number | string | null; overall_placement: number | null; class_placement: number | null };
type Band = { id: string; name: string; slug: string | null };
type RecordRow = { band: Band; competition: Competition; round: Round; entry: Entry; score: number | null };
type CountRow = { band: Band; count: number; examples: RecordRow[] };

const ORGANIZATIONS = ["KMEA", "BOA", "MSBA", "DCI"];
const METRICS = [
  { value: "scores", label: "Highest recorded scores" },
  { value: "wins", label: "Most overall first places" },
  { value: "class-wins", label: "Most class first places" },
  { value: "podiums", label: "Most overall podiums" },
] as const;
type Metric = (typeof METRICS)[number]["value"];
const MAX_COMPETITIONS = 500;
const MAX_ROUNDS = 3000;
const MAX_ENTRIES = 12000;
const INPUT = "mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-[#002144] focus:border-[#861F41] focus:outline-2 focus:outline-offset-2 focus:outline-[#861F41]";

async function loadBatches<T>(ids: string[], load: (ids: string[]) => Promise<{ data: T[] | null; error: { message: string } | null }>, size = 60): Promise<T[]> {
  const result: T[] = [];
  const unique = [...new Set(ids)];
  for (let i = 0; i < unique.length; i += size) {
    const response = await load(unique.slice(i, i + size));
    if (response.error) throw new Error("Unable to load the complete archive records.");
    result.push(...(response.data ?? []));
  }
  return result;
}
function scoreLabel(value: number | string | null): string {
  if (value === null || value === "") return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  const raw = String(value);
  const decimals = raw.includes(".") ? raw.split(".")[1].length : 0;
  return num.toFixed(Math.max(3, Math.min(8, decimals)));
}
function eventHref(row: RecordRow) {
  const competitionId = row.competition.slug ?? row.competition.id;
  return row.round.slug ? roundPublicUrl(competitionId, row.round.slug) : competitionPublicUrl(competitionId);
}

async function RecordsContent({ searchParams }: Props) {
  const args = await searchParams;
  const organization = ORGANIZATIONS.includes(args.organization ?? "") ? args.organization! : "KMEA";
  const metric: Metric = METRICS.some((m) => m.value === args.metric) ? args.metric as Metric : "scores";
  // Default to the most recent documented season instead of calling new Date() during prerendering.
  const requestedYear = /^\d{4}$/.test(args.year ?? "") && Number(args.year) >= 1800 && Number(args.year) <= 2200 ? Number(args.year) : null;
  const supabase = await createClient();
  const { data: latest, error: latestError } = await supabase.from("competitions")
    .select("season_year").eq("organization_code", organization)
    .eq("publication_status", "published").is("archived_at", null)
    .order("season_year", { ascending: false }).limit(1);
  if (latestError) throw new Error("Unable to load the latest documented season.");
  const year = requestedYear ?? (latest?.[0]?.season_year as number | undefined);
  let competitionQuery = supabase.from("competitions")
    .select("id,name,slug,organization_code,season_year", { count: "exact" })
    .eq("publication_status", "published").is("archived_at", null)
    .eq("organization_code", organization).order("id", { ascending: true })
    .limit(MAX_COMPETITIONS + 1);
  if (year !== undefined) competitionQuery = competitionQuery.eq("season_year", year);
  const { data: competitionData, count: competitionCount, error: competitionError } = await competitionQuery;
  if (competitionError) throw new Error("Unable to load documented competitions.");
  const competitions = (competitionData ?? []) as Competition[];
  let incomplete = (competitionCount ?? 0) > MAX_COMPETITIONS || competitions.length > MAX_COMPETITIONS;
  const rounds = await loadBatches<Round>(competitions.slice(0, MAX_COMPETITIONS).map(c => c.id), async ids => {
    const { data, error } = await supabase.from("competition_rounds")
      .select("id,competition_id,name,slug").in("competition_id", ids).is("archived_at", null)
      .order("id", { ascending: true }).limit(1001);
    return { data: data as Round[] | null, error };
  }, 30);
  if (rounds.length > MAX_ROUNDS) incomplete = true;
  const entries: Entry[] = [];
  for (const part of Array.from({ length: Math.ceil(Math.min(rounds.length, MAX_ROUNDS) / 30) }, (_, i) => rounds.slice(i * 30, i * 30 + 30))) {
    const { data, error } = await supabase.from("competition_entries")
      .select("id,round_id,band_id,total_score,overall_placement,class_placement")
      .in("round_id", part.map(r => r.id)).order("id", { ascending: true }).limit(1001);
    if (error) throw new Error("Unable to load documented competition entries.");
    if ((data?.length ?? 0) > 1000) incomplete = true;
    entries.push(...((data ?? []) as Entry[]));
    if (entries.length > MAX_ENTRIES) { incomplete = true; break; }
  }
  const bands = await loadBatches<Band>(entries.slice(0, MAX_ENTRIES).map(e => e.band_id).filter(Boolean), async ids => {
    const { data, error } = await supabase.from("bands").select("id,name,slug").in("id", ids).is("archived_at", null);
    return { data: data as Band[] | null, error };
  });
  const bandMap = new Map(bands.map(b => [b.id, b]));
  const roundMap = new Map(rounds.map(r => [r.id, r]));
  const competitionMap = new Map(competitions.map(c => [c.id, c]));
  const rows: RecordRow[] = entries.slice(0, MAX_ENTRIES).flatMap(entry => {
    const band = bandMap.get(entry.band_id);
    const round = roundMap.get(entry.round_id);
    const competition = round && competitionMap.get(round.competition_id);
    if (!band?.slug || !round || !competition) return [];
    const n = entry.total_score === null ? null : Number(entry.total_score);
    return [{ band, round, competition, entry, score: n !== null && Number.isFinite(n) ? n : null }];
  });
  const scored = [...rows].filter(r => r.score !== null)
    .sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity) || a.band.name.localeCompare(b.band.name))
    .slice(0, 25);
  const matches = rows.filter(r => metric === "wins" ? r.entry.overall_placement === 1 : metric === "class-wins" ? r.entry.class_placement === 1 : r.entry.overall_placement !== null && r.entry.overall_placement >= 1 && r.entry.overall_placement <= 3);
  const counts = new Map<string, CountRow>();
  for (const r of matches) {
    const current = counts.get(r.band.id) ?? { band: r.band, count: 0, examples: [] };
    current.count++;
    if (current.examples.length < 2) current.examples.push(r);
    counts.set(r.band.id, current);
  }
  const counted = [...counts.values()].sort((a,b) => b.count - a.count || a.band.name.localeCompare(b.band.name)).slice(0,25);
  const label = METRICS.find(m => m.value === metric)?.label ?? "Historical records";
  return <>
    <header className="bg-[#002144] text-white"><div className="mx-auto max-w-7xl px-6 py-16 sm:px-8">
      <nav aria-label="Breadcrumb" className="text-sm text-slate-300"><Link href="/" className="hover:text-white">Home</Link> / Records</nav>
      <p className="mt-7 text-xs font-bold uppercase tracking-[0.2em] text-[#e8afc2]">The Marching Archives / Research</p>
      <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-6xl">Historical <span className="text-[#e8afc2]">Records Explorer.</span></h1>
      <p className="mt-5 max-w-2xl text-base leading-8 text-slate-200">Find notable documented scores and placements, with links to the original competition results.</p>
    </div></header>
    <main className="mx-auto max-w-7xl space-y-8 px-6 py-10 sm:px-8">
      <form method="get" action="/records" className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-3">
        <label className="text-sm font-bold text-[#002144]">Organization<select className={INPUT} name="organization" defaultValue={organization}>{ORGANIZATIONS.map(o => <option key={o} value={o}>{o}</option>)}</select></label>
        <label className="text-sm font-bold text-[#002144]">Season<input className={INPUT} name="year" type="number" min="1800" max="2200" defaultValue={year} placeholder="Select a season" /></label>
        <label className="text-sm font-bold text-[#002144]">Record type<select className={INPUT} name="metric" defaultValue={metric}>{METRICS.map(m=><option key={m.value} value={m.value}>{m.label}</option>)}</select></label>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-3"><button type="submit" className="rounded-xl bg-[#861F41] px-6 py-3 text-sm font-bold text-white hover:bg-[#6c1735]">Explore records</button><Link href="/records" className="rounded-xl border border-slate-300 px-6 py-3 text-sm font-bold text-[#002144] hover:bg-slate-50">Reset</Link></div>
      </form>
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">{organization} · {year ?? "No documented season"}</p><h2 className="mt-2 text-2xl font-extrabold text-[#002144]">{label}</h2></div><p className="text-sm text-slate-500">Published competitions only · {competitions.length} events retrieved</p></div>
      {incomplete ? <section role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-amber-900"><h3 className="font-bold">Records exceed this explorer’s query limits</h3><p className="mt-2 text-sm">The requested season contains more records than can be processed reliably. Results are hidden rather than presenting an incomplete ranking. Narrow the period or use an aggregated database query.</p></section> : metric === "scores" ? (
        scored.length ? <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"><table className="w-full min-w-180 text-left text-sm"><thead className="bg-slate-100 text-xs uppercase tracking-wider text-[#002144]"><tr><th className="px-5 py-4">#</th><th className="px-5 py-4">Ensemble</th><th className="px-5 py-4">Competition / Round</th><th className="px-5 py-4 text-right">Score</th></tr></thead><tbody className="divide-y divide-slate-100">{scored.map((r,i) => <tr key={r.entry.id} className="hover:bg-[#fbf3f6]"><td className="px-5 py-4 font-bold text-[#861F41]">{i+1}</td><td className="px-5 py-4"><Link className="font-bold text-[#002144] hover:underline" href={`/bands/${r.band.slug}`}>{r.band.name}</Link></td><td className="px-5 py-4"><Link className="font-semibold text-[#861F41] hover:underline" href={eventHref(r)}>{r.competition.name}</Link><div className="text-xs text-slate-500">{r.round.name} · {r.competition.season_year}</div></td><td className="px-5 py-4 text-right font-bold tabular-nums text-[#002144]">{scoreLabel(r.entry.total_score)}</td></tr>)}</tbody></table></div> : <p className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-600">No documented scores match this selection.</p>
      ) : counted.length ? <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"><table className="w-full min-w-150 text-left text-sm"><thead className="bg-slate-100 text-xs uppercase tracking-wider text-[#002144]"><tr><th className="px-5 py-4">#</th><th className="px-5 py-4">Ensemble</th><th className="px-5 py-4 text-right">Recorded {metric === "wins" ? "overall wins" : metric === "class-wins" ? "class wins" : "podiums"}</th><th className="px-5 py-4">Example result</th></tr></thead><tbody className="divide-y divide-slate-100">{counted.map((r,i)=><tr key={r.band.id} className="hover:bg-[#fbf3f6]"><td className="px-5 py-4 font-bold text-[#861F41]">{i+1}</td><td className="px-5 py-4"><Link href={`/bands/${r.band.slug}`} className="font-bold text-[#002144] hover:underline">{r.band.name}</Link></td><td className="px-5 py-4 text-right font-bold tabular-nums">{r.count}</td><td className="px-5 py-4"><Link href={eventHref(r.examples[0])} className="font-semibold text-[#861F41] hover:underline">{r.examples[0].competition.name} · {r.examples[0].round.name}</Link></td></tr>)}</tbody></table></div> : <p className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-600">No documented results match this selection.</p>}
      <aside className="rounded-2xl border-l-4 border-[#861F41] bg-white p-6 text-sm leading-7 text-slate-600"><strong className="text-[#002144]">Research notes:</strong> This explorer compares records within a single selected organization and season. Different organizations and years may use different scoring systems, so their numeric scores are not necessarily comparable. Wins, class wins and podiums count recorded round entries, not distinct competitions; multiple rounds may count separately. A first-place result does not by itself establish an independently verified championship title. Missing data indicates only that the archive has not documented it.</aside>
      <div className="flex flex-wrap gap-4 text-sm font-bold"><Link href="/championships" className="text-[#861F41] hover:underline">Championship records →</Link><Link href="/leaderboards" className="text-[#861F41] hover:underline">Season leaderboards →</Link></div>
    </main>
  </>;
}
export default function RecordsPage(props: Props) {
  return <Suspense fallback={<main className="mx-auto max-w-7xl px-6 py-12">Loading historical records…</main>}><RecordsContent {...props}/></Suspense>;
}
