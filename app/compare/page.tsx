import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type Params = { left?: string; right?: string };
type Props = { searchParams: Promise<Params> };
type Band = { id: string; name: string; slug: string | null };
type Entry = { round_id: string; overall_placement: number | null; class_placement: number | null; total_score: number | string | null };
type Round = { id: string; competition_id: string; round_kind: string | null };
type Competition = { id: string; season_year: number; competition_type: string | null; publication_status: string; archived_at: string | null };
type Summary = { band: Band; appearances: number; overallWins: number; classWins: number; podiums: number; seasons: number; championshipFinals: number; scoreCount: number; averageScore: number | null; incomplete: boolean };

const LIMIT = 1000;

async function getSummary(supabase: Awaited<ReturnType<typeof createClient>>, band: Band): Promise<Summary> {
  const { data, error, count } = await supabase.from("competition_entries")
    .select("round_id, overall_placement, class_placement, total_score", { count: "exact" })
    .eq("band_id", band.id).limit(LIMIT);
  if (error) throw new Error("Could not load comparison results.");
  const entries = (data ?? []) as Entry[];
  const roundIds = [...new Set(entries.map(e => e.round_id))];
  const rounds: Round[] = [];
  for (let i = 0; i < roundIds.length; i += 75) {
    const result = await supabase.from("competition_rounds")
      .select("id, competition_id, round_kind").in("id", roundIds.slice(i, i + 75)).is("archived_at", null);
    if (result.error) throw new Error("Could not load competition rounds.");
    rounds.push(...(result.data ?? []) as Round[]);
  }
  const competitionIds = [...new Set(rounds.map(r => r.competition_id))];
  const competitions: Competition[] = [];
  for (let i = 0; i < competitionIds.length; i += 75) {
    const result = await supabase.from("competitions")
      .select("id, season_year, competition_type, publication_status, archived_at")
      .in("id", competitionIds.slice(i, i + 75)).eq("publication_status", "published").is("archived_at", null);
    if (result.error) throw new Error("Could not load published competitions.");
    competitions.push(...(result.data ?? []) as Competition[]);
  }
  const roundMap = new Map(rounds.map(r => [r.id, r]));
  const competitionMap = new Map(competitions.map(c => [c.id, c]));
  const seasons = new Set<number>();
  let appearances = 0, overallWins = 0, classWins = 0, podiums = 0, championshipFinals = 0, scoreSum = 0, scoreCount = 0;
  for (const e of entries) {
    const round = roundMap.get(e.round_id);
    const competition = round ? competitionMap.get(round.competition_id) : undefined;
    if (!round || !competition) continue;
    appearances++;
    seasons.add(competition.season_year);
    if (e.overall_placement === 1) overallWins++;
    if (e.class_placement === 1) classWins++;
    if (e.overall_placement !== null && e.overall_placement >= 1 && e.overall_placement <= 3) podiums++;
    if (competition.competition_type === "championship" && round.round_kind === "finals") championshipFinals++;
    if (e.total_score !== null) {
      const score = Number(e.total_score);
      if (Number.isFinite(score)) { scoreSum += score; scoreCount++; }
    }
  }
  return { band, appearances, overallWins, classWins, podiums, seasons: seasons.size, championshipFinals,
    scoreCount, averageScore: scoreCount ? scoreSum / scoreCount : null, incomplete: (count ?? 0) > entries.length };
}

function number(v: number) { return v.toLocaleString("en-US"); }

async function CompareContent({ searchParams }: Props) {
  const query = await searchParams;
  const left = typeof query.left === "string" ? query.left.slice(0, 200) : "";
  const right = typeof query.right === "string" ? query.right.slice(0, 200) : "";
  const supabase = await createClient();
  const { data: available, error: listError, count: bandCount } = await supabase.from("bands")
    .select("id, slug, name", { count: "exact" }).is("archived_at", null).order("name").limit(500);
  if (listError) throw new Error("Could not load ensemble directory.");
  const bands = (available ?? []) as Band[];
  const ids = [...new Set([left, right].filter(Boolean))];
  const { data: selected, error: selectedError } = ids.length
    ? await supabase.from("bands").select("id, slug, name").is("archived_at", null).in("id", ids)
    : { data: [] as Band[], error: null };
  if (selectedError) throw new Error("Could not load selected ensembles.");
  const selectedBands = (selected ?? []) as Band[];
  const bandMap = new Map(selectedBands.map(b => [b.id, b]));
  const summaries = await Promise.all([left, right].map(id => {
    const band = bandMap.get(id);
    return band ? getSummary(supabase, band) : Promise.resolve(null);
  }));
  const [first, second] = summaries;
  const measures: { label: string; key: keyof Summary; description: string }[] = [
    { label: "Recorded appearances", key: "appearances", description: "Published round entries" },
    { label: "Overall first places", key: "overallWins", description: "Recorded first overall" },
    { label: "Class first places", key: "classWins", description: "Recorded first in class" },
    { label: "Overall podiums", key: "podiums", description: "Overall placements 1–3" },
    { label: "Seasons represented", key: "seasons", description: "Distinct seasons with published entries" },
    { label: "Championship finals appearances", key: "championshipFinals", description: "Entries in designated championship finals rounds" },
  ];
  return (
    <main className="min-h-screen bg-[#f6f7f9] pb-20">
      <section className="bg-[#002144] px-6 pb-20 pt-12 text-white">
        <div className="mx-auto max-w-6xl">
          <Link href="/bands" className="text-sm font-semibold text-slate-200 hover:text-white">← Bands & Corps</Link>
          <p className="mt-8 text-xs font-bold uppercase tracking-[0.2em] text-[#e6a9bc]">Archive analytics</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight md:text-5xl">Compare ensembles</h1>
          <p className="mt-4 max-w-2xl text-slate-200">Explore the competitive history of two bands or drum corps using published archive records.</p>
        </div>
      </section>
      <div className="mx-auto max-w-6xl space-y-8 px-6">
        <form method="get" action="/compare" className="relative -mt-10 grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-lg md:grid-cols-[1fr_1fr_auto] md:items-end">
          {(["left", "right"] as const).map((field, i) => (
            <label key={field} className="block text-sm font-semibold text-[#002144]">
              {i === 0 ? "First ensemble" : "Second ensemble"}
              <select name={field} defaultValue={field === "left" ? left : right} className="mt-2 block h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-[#002144] focus:border-[#861F41]">
                <option value="">Choose an ensemble</option>
                {selectedBands.filter(b => !bands.some(option => option.id === b.id)).concat(bands).map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </label>
          ))}
          <button className="h-12 rounded-lg bg-[#861F41] px-7 font-bold text-white hover:bg-[#6d1733]">Compare</button>
          {(bandCount ?? 0) > bands.length && <p className="text-xs text-amber-800 md:col-span-3">The selector currently shows the first 500 ensembles alphabetically. Additional ensemble search is planned.</p>}
        </form>
        {left && right && left === right ? (
          <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">Choose two different ensembles to compare.</p>
        ) : first && second ? (
          <>
            {(first.incomplete || second.incomplete) && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">One or both ensembles have more than {number(LIMIT)} entries. These figures are incomplete and should not be treated as career totals.</p>}
            <div className="grid gap-4 md:grid-cols-2">
              {[first, second].map(s => (
                <Link key={s.band.id} href={`/bands/${s.band.slug || s.band.id}`} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-[#861F41]">
                  <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">Ensemble profile</p>
                  <h2 className="mt-2 text-2xl font-extrabold text-[#002144]">{s.band.name}</h2>
                  <p className="mt-3 text-sm text-slate-500">View full historical record →</p>
                </Link>
              ))}
            </div>
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="Comparison metrics">
              <div className="grid grid-cols-[1fr_1.3fr_1fr] gap-2 bg-[#002144] px-4 py-5 text-center text-sm font-bold text-white sm:px-6">
                <span>{first.band.name}</span><span>Recorded measure</span><span>{second.band.name}</span>
              </div>
              {measures.map(metric => (
                <div key={metric.key} className="grid grid-cols-[1fr_1.3fr_1fr] items-center gap-2 border-t border-slate-100 px-4 py-5 text-center sm:px-6">
                  <strong className="text-xl tabular-nums text-[#002144]">{number(first[metric.key] as number)}</strong>
                  <div><p className="text-sm font-bold text-[#002144]">{metric.label}</p><p className="mt-1 text-xs text-slate-500">{metric.description}</p></div>
                  <strong className="text-xl tabular-nums text-[#002144]">{number(second[metric.key] as number)}</strong>
                </div>
              ))}
            </section>
            <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm leading-7 text-slate-600">Figures count published round entries, not unique competition events. Results depend on available archival coverage. Raw total scores are intentionally not compared across organizations or seasons because their judging scales may differ. Championship-finals appearances do not establish official championship titles.</p>
          </>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center text-slate-600">Select two ensembles above to see their side-by-side competitive histories.</div>
        )}
      </div>
    </main>
  );
}

export default function ComparePage(props: Props) {
  return <Suspense fallback={<main className="p-10 text-center text-slate-600">Loading comparison…</main>}><CompareContent searchParams={props.searchParams} /></Suspense>;
}
