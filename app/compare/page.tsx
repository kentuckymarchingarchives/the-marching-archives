import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { competitionPublicUrl, roundPublicUrl } from "@/lib/public-competition-routes";

type Search = { left?: string; right?: string; organization?: string };
type PageProps = { searchParams: Promise<Search> };
type Band = { id: string; name: string; slug: string | null };
type Entry = { id: string; round_id: string; overall_placement: number | null; class_placement: number | null; total_score: number | string | null };
type Round = { id: string; competition_id: string; name: string; slug: string | null; round_kind: string | null };
type Competition = { id: string; slug: string | null; name: string; season_year: number; organization_code: string; competition_type: string | null; competition_date: string | null };
type Result = { entry: Entry; round: Round; competition: Competition };
type History = { band: Band; results: Result[]; incomplete: boolean };
type Annual = { year: number; left: number; right: number; leftWins: number; rightWins: number };
const ORGANIZATIONS = ["KMEA", "BOA", "MSBA", "DCI"];
const MAX_ENTRIES = 2000;
const PANEL = "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm";
const INPUT = "mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-[#002144] focus:border-[#861F41] focus:outline-2 focus:outline-offset-2 focus:outline-[#861F41]";

async function batches<T>(ids: string[], query: (part: string[]) => Promise<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const output: T[] = [];
  const unique = [...new Set(ids)];
  for (let i = 0; i < unique.length; i += 60) {
    const response = await query(unique.slice(i, i + 60));
    if (response.error) throw new Error("Could not load published comparison records.");
    output.push(...(response.data ?? []));
  }
  return output;
}

async function history(supabase: Awaited<ReturnType<typeof createClient>>, band: Band): Promise<History> {
  const { data, count, error } = await supabase.from("competition_entries")
    .select("id,round_id,overall_placement,class_placement,total_score", { count: "exact" })
    .eq("band_id", band.id).order("id", { ascending: true }).limit(MAX_ENTRIES);
  if (error) throw new Error("Could not load ensemble results.");
  const entries = (data ?? []) as Entry[];
  const rounds = await batches<Round>(entries.map(e => e.round_id), async ids => {
    const response = await supabase.from("competition_rounds")
      .select("id,competition_id,name,slug,round_kind").in("id", ids).is("archived_at", null);
    return { data: response.data as Round[] | null, error: response.error };
  });
  const competitions = await batches<Competition>(rounds.map(r => r.competition_id), async ids => {
    const response = await supabase.from("competitions")
      .select("id,slug,name,season_year,organization_code,competition_type,competition_date")
      .in("id", ids).eq("publication_status", "published").is("archived_at", null);
    return { data: response.data as Competition[] | null, error: response.error };
  });
  const roundMap = new Map(rounds.map(r => [r.id, r]));
  const competitionMap = new Map(competitions.map(c => [c.id, c]));
  const results = entries.flatMap(entry => {
    const round = roundMap.get(entry.round_id);
    const competition = round && competitionMap.get(round.competition_id);
    return round && competition ? [{ entry, round, competition }] : [];
  });
  return { band, results, incomplete: (count ?? entries.length) > entries.length };
}
function profileHref(band: Band) { return `/bands/${band.slug ?? band.id}`; }
function resultHref(result: Result) {
  const identifier = result.competition.slug ?? result.competition.id;
  return result.round.slug ? roundPublicUrl(identifier, result.round.slug) : competitionPublicUrl(identifier);
}
function score(value: number | string | null) {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const precision = String(value).split(".")[1]?.length ?? 0;
  return n.toFixed(Math.max(3, Math.min(8, precision)));
}
function place(value: number | null) { return value == null ? "—" : `#${value}`; }
function overview(results: Result[]) {
  return {
    appearances: results.length,
    seasons: new Set(results.map(r => r.competition.season_year)).size,
    overallWins: results.filter(r => r.entry.overall_placement === 1).length,
    classWins: results.filter(r => r.entry.class_placement === 1).length,
    podiums: results.filter(r => r.entry.overall_placement != null && r.entry.overall_placement >= 1 && r.entry.overall_placement <= 3).length,
    championshipFinals: results.filter(r => ["championships", "smbc"].includes(r.competition.competition_type ?? "") && r.round.round_kind === "finals").length,
  };
}

async function CompareContent({ searchParams }: PageProps) {
  const args = await searchParams;
  const leftId = typeof args.left === "string" ? args.left.slice(0, 150) : "";
  const rightId = typeof args.right === "string" ? args.right.slice(0, 150) : "";
  const organization = ORGANIZATIONS.includes(args.organization ?? "") ? args.organization! : "KMEA";
  const supabase = await createClient();
  const { data: directory, count, error: directoryError } = await supabase.from("bands")
    .select("id,name,slug", { count: "exact" }).is("archived_at", null).order("name").limit(500);
  if (directoryError) throw new Error("Could not load ensemble directory.");
  const ids = [...new Set([leftId, rightId].filter(Boolean))];
  const selectedQuery = ids.length ? await supabase.from("bands").select("id,name,slug").in("id", ids).is("archived_at", null) : { data: [], error: null };
  if (selectedQuery.error) throw new Error("Could not load the selected ensembles.");
  const bands = (directory ?? []) as Band[];
  const selected = (selectedQuery.data ?? []) as Band[];
  const choices = [...new Map([...bands, ...selected].map(b => [b.id, b])).values()].sort((a, b) => a.name.localeCompare(b.name));
  const byId = new Map(selected.map(b => [b.id, b]));
  const [a, b] = await Promise.all([leftId, rightId].map(id => {
    const band = byId.get(id);
    return band ? history(supabase, band) : Promise.resolve(null);
  }));
  const aResults = a?.results.filter(r => r.competition.organization_code === organization) ?? [];
  const bResults = b?.results.filter(r => r.competition.organization_code === organization) ?? [];
  const aStats = overview(aResults), bStats = overview(bResults);
  const years = [...new Set([...aResults, ...bResults].map(r => r.competition.season_year))].sort((x, y) => x - y);
  const annual: Annual[] = years.map(year => ({
    year,
    left: aResults.filter(r => r.competition.season_year === year).length,
    right: bResults.filter(r => r.competition.season_year === year).length,
    leftWins: aResults.filter(r => r.competition.season_year === year && r.entry.overall_placement === 1).length,
    rightWins: bResults.filter(r => r.competition.season_year === year && r.entry.overall_placement === 1).length,
  }));
  const bRoundMap = new Map(bResults.map(r => [r.round.id, r]));
  const shared = aResults.flatMap(left => {
    const right = bRoundMap.get(left.round.id);
    return right ? [{ left, right }] : [];
  }).sort((x, y) => y.left.competition.season_year - x.left.competition.season_year || (y.left.competition.competition_date ?? "").localeCompare(x.left.competition.competition_date ?? ""));
  const ranked = shared.filter(p => p.left.entry.overall_placement != null && p.right.entry.overall_placement != null);
  const firstAhead = ranked.filter(p => p.left.entry.overall_placement! < p.right.entry.overall_placement!).length;
  const secondAhead = ranked.filter(p => p.left.entry.overall_placement! > p.right.entry.overall_placement!).length;
  const tied = ranked.length - firstAhead - secondAhead;
  const measures: { label: string; left: number; right: number; note: string }[] = [
    { label: "Documented round appearances", left: aStats.appearances, right: bStats.appearances, note: "Published round entries, not unique events" },
    { label: "Seasons documented", left: aStats.seasons, right: bStats.seasons, note: "Distinct seasons in this organization" },
    { label: "Overall first places", left: aStats.overallWins, right: bStats.overallWins, note: "Recorded overall placement #1" },
    { label: "Class first places", left: aStats.classWins, right: bStats.classWins, note: "Recorded class placement #1" },
    { label: "Overall podiums", left: aStats.podiums, right: bStats.podiums, note: "Overall placements #1–3" },
    { label: "Championship finals appearances", left: aStats.championshipFinals, right: bStats.championshipFinals, note: "Only identified championship finals rounds" },
  ];
  const maxYear = Math.max(1, ...annual.flatMap(x => [x.left, x.right]));
  return <main className="min-h-screen bg-[#f6f7f9] pb-20">
    <header className="bg-[#002144] text-white"><div className="mx-auto max-w-7xl px-6 py-16">
      <Link href="/bands" className="text-sm text-slate-200 hover:text-white">← Bands &amp; Corps</Link>
      <p className="mt-8 text-xs font-bold uppercase tracking-[0.2em] text-[#e8afc2]">The Marching Archives / Analytics</p>
      <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">Advanced Band <span className="text-[#e8afc2]">Comparison.</span></h1>
      <p className="mt-4 max-w-3xl text-slate-200">Compare documented achievements, season-by-season results and head-to-head performances in the same competition round.</p>
    </div></header>
    <div className="mx-auto max-w-7xl space-y-8 px-6">
      <form action="/compare" method="get" className="relative -mt-9 grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-lg md:grid-cols-[1fr_1fr_160px_auto] md:items-end">
        {(["left", "right"] as const).map((field, i) => <label key={field} className="text-sm font-semibold text-[#002144]">
          {i === 0 ? "First ensemble" : "Second ensemble"}
          <select className={INPUT} name={field} defaultValue={field === "left" ? leftId : rightId} required>
            <option value="">Choose an ensemble</option>{choices.map(band => <option value={band.id} key={band.id}>{band.name}</option>)}
          </select>
        </label>)}
        <label className="text-sm font-semibold text-[#002144]">Organization
          <select className={INPUT} name="organization" defaultValue={organization}>{ORGANIZATIONS.map(o => <option key={o} value={o}>{o}</option>)}</select>
        </label>
        <button className="rounded-xl bg-[#861F41] px-6 py-3 font-bold text-white hover:bg-[#6b1935]">Compare</button>
        {(count ?? bands.length) > bands.length && <p className="text-xs text-amber-800 md:col-span-4">The dropdown lists the first 500 ensembles alphabetically plus selected ensembles. Additional directory searching may be needed for other bands.</p>}
      </form>
      {leftId && rightId && leftId === rightId ? <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-5">Choose two different ensembles to compare.</p> : a && b ? <>
        {(a.incomplete || b.incomplete) && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">One or both bands have more than {MAX_ENTRIES.toLocaleString()} historical entries. The results below may be incomplete; do not treat the totals or head-to-head counts as complete records.</p>}
        <div className="grid gap-4 md:grid-cols-2">{[a, b].map(h => <Link className={`${PANEL} transition hover:border-[#861F41]`} key={h.band.id} href={profileHref(h.band)}>
          <p className="text-xs font-bold uppercase tracking-[.15em] text-[#861F41]">Ensemble profile</p>
          <h2 className="mt-2 text-2xl font-extrabold text-[#002144]">{h.band.name}</h2><p className="mt-3 text-sm text-slate-600">View profile and timeline →</p>
        </Link>)}</div>
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-labelledby="comparison-heading">
          <div className="bg-[#002144] px-6 py-5 text-white"><h2 id="comparison-heading" className="text-xl font-extrabold">Documented performance snapshot · {organization}</h2></div>
          <div className="grid grid-cols-[1fr_1.4fr_1fr] gap-2 border-b bg-slate-50 px-4 py-3 text-center text-xs font-bold text-[#002144] sm:px-6"><span>{a.band.name}</span><span>Measure</span><span>{b.band.name}</span></div>
          {measures.map(metric => <div key={metric.label} className="grid grid-cols-[1fr_1.4fr_1fr] items-center gap-2 border-b border-slate-100 px-4 py-4 text-center sm:px-6">
            <strong className="text-xl tabular-nums text-[#002144]">{metric.left.toLocaleString()}</strong><div><p className="text-sm font-bold text-[#002144]">{metric.label}</p><p className="mt-1 text-xs text-slate-500">{metric.note}</p></div><strong className="text-xl tabular-nums text-[#002144]">{metric.right.toLocaleString()}</strong>
          </div>)}
        </section>
        <section className={PANEL} aria-labelledby="year-heading"><h2 id="year-heading" className="text-2xl font-extrabold text-[#002144]">Year-by-year appearances</h2><p className="mt-2 text-sm text-slate-600">Recorded round appearances within {organization}. Bar lengths reflect available archive coverage, not performance quality.</p>
          {annual.length === 0 ? <p className="mt-6 text-slate-600">No published appearances are documented in this organization for either ensemble.</p> : <div className="mt-7 space-y-5">{annual.map(y => <div key={y.year} className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-[72px_1fr]">
            <p className="font-bold text-[#002144]">{y.year}</p><div className="space-y-2">
              <div className="flex items-center gap-3"><div className="h-3.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#002144]" style={{ width: `${(y.left / maxYear) * 100}%` }} /></div><span className="w-10 text-right text-sm tabular-nums text-slate-700">{y.left}</span></div>
              <div className="flex items-center gap-3"><div className="h-3.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#861F41]" style={{ width: `${(y.right / maxYear) * 100}%` }} /></div><span className="w-10 text-right text-sm tabular-nums text-slate-700">{y.right}</span></div>
            </div>
          </div>)}</div>}
          <div className="mt-6 flex flex-wrap gap-5 text-xs text-slate-700"><span><span className="mr-2 inline-block h-3 w-3 rounded-sm bg-[#002144]" />{a.band.name}</span><span><span className="mr-2 inline-block h-3 w-3 rounded-sm bg-[#861F41]" />{b.band.name}</span></div>
        </section>
        <section className={PANEL} aria-labelledby="shared-heading"><h2 id="shared-heading" className="text-2xl font-extrabold text-[#002144]">Head-to-head · Shared rounds</h2><p className="mt-2 text-sm text-slate-600">Only published rounds where both ensembles have results. Placement comparisons require both overall placements to be recorded.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-4">{[{label:"Shared rounds",value:shared.length},{label:`${a.band.name} ahead`,value:firstAhead},{label:`${b.band.name} ahead`,value:secondAhead},{label:"Same placement",value:tied}].map(stat => <div key={stat.label} className="rounded-xl bg-slate-50 p-4"><p className="text-2xl font-extrabold tabular-nums text-[#002144]">{stat.value}</p><p className="mt-1 text-xs text-slate-600">{stat.label}</p></div>)}</div>
          {ranked.length < shared.length && <p className="mt-4 text-xs text-slate-600">{shared.length-ranked.length} shared round(s) lack one or both overall placements and are excluded from ahead/tied counts.</p>}
          {shared.length === 0 ? <p className="mt-6 text-slate-600">No shared published rounds found for these ensembles in {organization}.</p> : <div className="mt-6 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-[#002144] text-white"><tr><th className="p-3">Event / Round</th><th className="p-3">Year</th><th className="p-3">{a.band.name}</th><th className="p-3">{b.band.name}</th></tr></thead><tbody>{shared.slice(0, 50).map(pair => <tr key={pair.left.round.id} className="border-b border-slate-100 align-top">
            <td className="p-3"><Link href={resultHref(pair.left)} className="font-semibold text-[#861F41] hover:underline">{pair.left.competition.name}</Link><p className="text-xs text-slate-500">{pair.left.round.name}</p></td><td className="p-3 tabular-nums">{pair.left.competition.season_year}</td><td className="p-3">{place(pair.left.entry.overall_placement)}<p className="text-xs text-slate-500">Score: {score(pair.left.entry.total_score)}</p></td><td className="p-3">{place(pair.right.entry.overall_placement)}<p className="text-xs text-slate-500">Score: {score(pair.right.entry.total_score)}</p></td>
          </tr>)}</tbody></table>{shared.length > 50 && <p className="mt-3 text-xs text-slate-600">Showing 50 of {shared.length} shared rounds.</p>}</div>}
        </section>
        <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm leading-7 text-slate-600">Historical comparisons are based on the currently documented, published entries and may not represent a band's entire competitive career. Totals count round appearances. Raw scores are displayed as recorded but are not directly compared across organizations or judging eras. A championship finals appearance is not the same as a championship title.</p>
      </> : <div className={`${PANEL} py-12 text-center text-slate-600`}>Select two ensembles and an organization to explore their documented competitive history.</div>}
    </div>
  </main>;
}
export default function ComparePage(props: PageProps) {
  return <Suspense fallback={<main className="p-10 text-center text-slate-600">Loading comparison…</main>}><CompareContent searchParams={props.searchParams} /></Suspense>;
}
