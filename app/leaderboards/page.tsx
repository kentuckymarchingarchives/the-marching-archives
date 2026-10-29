import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type Search = { year?: string; organization?: string; rank?: string };
type Props = { searchParams: Promise<Search> };
type Competition = { id: string; season_year: number; organization_code: string };
type Round = { id: string; competition_id: string };
type Entry = { id: string; band_id: string; overall_placement: number | null; class_placement: number | null };
type Ensemble = { id: string; name: string; slug: string | null };
type Standing = { id: string; name: string; slug: string | null; appearances: number; overallWins: number; classWins: number; podiums: number };

const ORGANIZATIONS = ["KMEA", "MSBA", "BOA", "DCI"];
const RANKS = [
  { value: "appearances", label: "Appearances" },
  { value: "overallWins", label: "Overall wins" },
  { value: "classWins", label: "Class wins" },
  { value: "podiums", label: "Overall podiums" },
] as const;
type RankKey = (typeof RANKS)[number]["value"];

// Avoid silently presenting rankings calculated from a truncated dataset.
const COMPETITION_LIMIT = 500;
const ROUND_LIMIT = 5000;
const ENTRY_LIMIT = 20000;

async function inBatches<T>(
  ids: string[],
  load: (ids: string[]) => Promise<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const result: T[] = [];
  const unique = [...new Set(ids)];
  for (let i = 0; i < unique.length; i += 75) {
    const response = await load(unique.slice(i, i + 75));
    if (response.error) throw new Error("Could not load leaderboard records.");
    result.push(...(response.data ?? []));
  }
  return result;
}

function formatCount(count: number) { return count.toLocaleString("en-US"); }

async function LeaderboardContent({ searchParams }: Props) {
  const query = await searchParams;
  const parsedYear = Number(query.year);
  const year = Number.isInteger(parsedYear) && parsedYear >= 1900 && parsedYear <= 2200
    ? parsedYear : new Date().getFullYear();
  const organization = ORGANIZATIONS.includes(query.organization ?? "") ? query.organization! : "KMEA";
  const rank: RankKey = RANKS.some((r) => r.value === query.rank)
    ? query.rank as RankKey : "appearances";

  const supabase = await createClient();
  const { data: competitionRows, count: competitionCount, error: competitionsError } = await supabase
    .from("competitions")
    .select("id, season_year, organization_code", { count: "exact" })
    .eq("publication_status", "published")
    .is("archived_at", null)
    .eq("season_year", year)
    .eq("organization_code", organization)
    .order("id", { ascending: true })
    .limit(COMPETITION_LIMIT);
  if (competitionsError) throw new Error("Could not load published competitions.");
  const competitions = (competitionRows ?? []) as Competition[];

  let truncated = (competitionCount ?? 0) > COMPETITION_LIMIT;
  let rounds: Round[] = [];
  if (competitions.length) {
    rounds = await inBatches<Round>(competitions.map((c) => c.id), async (ids) => {
      const { data, error } = await supabase.from("competition_rounds")
        .select("id, competition_id")
        .in("competition_id", ids)
        .is("archived_at", null)
        .limit(ROUND_LIMIT + 1);
      return { data: data as Round[] | null, error };
    });
  }
  if (rounds.length > ROUND_LIMIT) truncated = true;
  rounds = rounds.slice(0, ROUND_LIMIT);

  let entries: Entry[] = [];
  if (rounds.length) {
    entries = await inBatches<Entry>(rounds.map((r) => r.id), async (ids) => {
      const { data, error } = await supabase.from("competition_entries")
        .select("id, band_id, overall_placement, class_placement")
        .in("round_id", ids)
        .order("id", { ascending: true })
        .limit(1001);
      if ((data?.length ?? 0) > 1000) truncated = true;
      return { data: data as Entry[] | null, error };
    });
  }
  if (entries.length > ENTRY_LIMIT) truncated = true;
  entries = entries.slice(0, ENTRY_LIMIT);

  const standingsMap = new Map<string, Standing>();
  for (const entry of entries) {
    if (!entry.band_id) continue;
    const standing = standingsMap.get(entry.band_id) ?? {
      id: entry.band_id, name: "Unknown ensemble", slug: null,
      appearances: 0, overallWins: 0, classWins: 0, podiums: 0,
    };
    standing.appearances++;
    if (entry.overall_placement === 1) standing.overallWins++;
    if (entry.class_placement === 1) standing.classWins++;
    if (entry.overall_placement !== null && entry.overall_placement >= 1 && entry.overall_placement <= 3) standing.podiums++;
    standingsMap.set(entry.band_id, standing);
  }
  const ensembles = await inBatches<Ensemble>([...standingsMap.keys()], async (ids) => {
    const { data, error } = await supabase.from("bands")
      .select("id, name, slug")
      .in("id", ids)
      .is("archived_at", null);
    return { data: data as Ensemble[] | null, error };
  });
  for (const band of ensembles) {
    const standing = standingsMap.get(band.id);
    if (standing) { standing.name = band.name; standing.slug = band.slug; }
  }
  const standings = [...standingsMap.values()]
    .filter((s) => s.slug)
    .sort((a, b) => b[rank] - a[rank] || b.appearances - a.appearances || a.name.localeCompare(b.name));
  const leaderLabel = RANKS.find((r) => r.value === rank)?.label ?? "Appearances";

  return (
    <>
      <div className="bg-[#002144] text-white">
        <div className="mx-auto max-w-7xl px-6 py-14 sm:px-8">
          <nav aria-label="Breadcrumb" className="mb-5 text-sm text-slate-300"><Link href="/" className="hover:text-white">Home</Link> <span aria-hidden="true">/</span> Leaderboards</nav>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#e6a9bc]">Archive analytics</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">Ensemble leaderboards</h1>
          <p className="mt-5 max-w-2xl leading-7 text-slate-200">Explore results from published competitions, organized by season and governing organization.</p>
        </div>
      </div>
      <main className="mx-auto max-w-7xl px-6 py-10 sm:px-8">
        <form method="get" action="/leaderboards" className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-bold text-[#002144]">Season
            <input type="number" name="year" min="1900" max="2200" defaultValue={year} className="mt-2 block w-full rounded-lg border border-slate-300 p-3" required />
          </label>
          <label className="text-sm font-bold text-[#002144]">Organization
            <select name="organization" defaultValue={organization} className="mt-2 block w-full rounded-lg border border-slate-300 p-3">
              {ORGANIZATIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
          <label className="text-sm font-bold text-[#002144]">Rank by
            <select name="rank" defaultValue={rank} className="mt-2 block w-full rounded-lg border border-slate-300 p-3">
              {RANKS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </label>
          <div className="flex items-end"><button className="w-full rounded-lg bg-[#861F41] px-5 py-3 font-bold text-white hover:bg-[#6b1934]">Update leaderboard</button></div>
        </form>
        <div className="mt-10 flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">{organization} · {year}</p><h2 className="mt-2 text-2xl font-extrabold text-[#002144]">Ranked by {leaderLabel.toLowerCase()}</h2></div>
          <p className="text-sm text-slate-500">{formatCount(standings.length)} ensembles · {formatCount(competitions.length)} published competitions</p>
        </div>
        {truncated ? (
          <div role="alert" className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
            The archive has more records than this page can safely process. Rankings are hidden to avoid misleading results. Narrow the scope or implement a database-aggregated leaderboard for larger seasons.
          </div>
        ) : standings.length ? (
          <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600"><tr><th className="px-5 py-4">Rank</th><th className="px-5 py-4">Ensemble</th><th className="px-4 py-4 text-right">Appearances</th><th className="px-4 py-4 text-right">Overall wins</th><th className="px-4 py-4 text-right">Class wins</th><th className="px-5 py-4 text-right">Podiums</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {standings.map((s, index) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4 font-extrabold tabular-nums text-[#861F41]">{index + 1}</td>
                    <td className="px-5 py-4"><Link href={`/bands/${s.slug}`} className="font-bold text-[#002144] hover:text-[#861F41] hover:underline">{s.name}</Link></td>
                    <td className="px-4 py-4 text-right tabular-nums">{s.appearances}</td>
                    <td className="px-4 py-4 text-right tabular-nums">{s.overallWins}</td>
                    <td className="px-4 py-4 text-right tabular-nums">{s.classWins}</td>
                    <td className="px-5 py-4 text-right tabular-nums">{s.podiums}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-10 text-center"><h3 className="font-bold text-[#002144]">No published results for this selection</h3><p className="mt-2 text-sm text-slate-600">Try another season or organization as the archive grows.</p></div>
        )}
        <p className="mt-6 max-w-4xl text-sm leading-7 text-slate-600">Methodology: one appearance per recorded ensemble entry in a competition round. Overall wins and podiums use overall placement; class wins use class placement. Multiple rounds within one event are counted separately. Only published, non-archived competitions and rounds are considered. These are documented placements, not independently verified championship titles. Rankings do not compare score scales across organizations.</p>
      </main>
    </>
  );
}

export default function LeaderboardsPage(props: Props) {
  return <Suspense fallback={<main className="mx-auto max-w-7xl p-8">Loading leaderboards…</main>}><LeaderboardContent {...props} /></Suspense>;
}
