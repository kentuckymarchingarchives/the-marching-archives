import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN } from "@/lib/band-validation";
import { BAND_SLUG_PATTERN } from "@/lib/band-slugs";
import { roundPublicUrl } from "@/lib/public-competition-routes";

export const instant = false;

type Props = { params: Promise<{ id: string }> };
type Entry = {
  id: string;
  round_id: string;
  classification: string | null;
  total_score: number | string | null;
  class_placement: number | null;
  overall_placement: number | null;
};
type Round = {
  id: string;
  slug: string | null;
  name: string;
  round_kind: string;
  competition_id: string;
  archived_at: string | null;
};
type Competition = {
  id: string;
  slug: string | null;
  name: string;
  season_year: number;
  organization_code: string;
  competition_type: string;
  competition_date: string | null;
  archived_at: string | null;
};
type HistoryRow = { entry: Entry; round: Round; competition: Competition };

const CHAMPIONSHIP_TYPES = ["smbc", "championships", "grand_nationals", "world_championship"];
const BATCH_SIZE = 75;
const PAGE_SIZE = 500;
const MAX_ENTRIES = 10000;

function score(value: number | string | null): string {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(3) : "—";
}
function dateText(value: string | null): string {
  if (!value) return "Date not recorded";
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? "Date not recorded" : date.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
}
function placement(value: number | null): string {
  return value === null ? "—" : String(value);
}
function isFinals(round: Round): boolean {
  return round.round_kind === "finals" || /\bfinals?\b/i.test(round.name);
}
async function fetchInBatches<T>(ids: string[], load: (ids: string[]) => Promise<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const result: T[] = [];
  const unique = [...new Set(ids)];
  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const batch = await load(unique.slice(i, i + BATCH_SIZE));
    if (batch.error) throw new Error("Unable to retrieve championship history.");
    result.push(...(batch.data ?? []));
  }
  return result;
}

async function ChampionshipHistoryContent({ params }: Props) {
  const { id } = await params;
  if (!id || id.length > 150 || (!UUID_PATTERN.test(id) && !BAND_SLUG_PATTERN.test(id))) notFound();
  const supabase = await createClient();
  const { data: band, error: bandError } = await supabase.from("bands")
    .select("id,slug,name")
    .eq(UUID_PATTERN.test(id) ? "id" : "slug", id)
    .is("archived_at", null)
    .maybeSingle();
  if (bandError) throw new Error("Unable to retrieve ensemble.");
  if (!band) notFound();

  // Read every page up to a visible safety limit; never silently present partial totals.
  const entries: Entry[] = [];
  let truncated = false;
  for (let offset = 0; offset <= MAX_ENTRIES; offset += PAGE_SIZE) {
    const { data, error } = await supabase.from("competition_entries")
      .select("id,round_id,classification,total_score,class_placement,overall_placement")
      .eq("band_id", band.id).order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error("Unable to retrieve ensemble results.");
    const batch = (data ?? []) as Entry[];
    if (offset === MAX_ENTRIES) { truncated = batch.length > 0; break; }
    entries.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }

  const rounds = await fetchInBatches<Round>(entries.map(e => e.round_id), async ids => {
    const { data, error } = await supabase.from("competition_rounds")
      .select("id,slug,name,round_kind,competition_id,archived_at").in("id", ids);
    return { data: data as Round[] | null, error };
  });
  const finals = new Map(rounds.filter(r => !r.archived_at && isFinals(r)).map(r => [r.id, r]));
  const competitions = await fetchInBatches<Competition>([...finals.values()].map(r => r.competition_id), async ids => {
    const { data, error } = await supabase.from("competitions")
      .select("id,slug,name,season_year,organization_code,competition_type,competition_date,archived_at")
      .in("id", ids).in("competition_type", CHAMPIONSHIP_TYPES)
      .eq("publication_status", "published").is("archived_at", null);
    return { data: data as Competition[] | null, error };
  });
  const competitionById = new Map(competitions.map(c => [c.id, c]));
  const history: HistoryRow[] = entries.flatMap(entry => {
    const round = finals.get(entry.round_id);
    const competition = round && competitionById.get(round.competition_id);
    return round && competition ? [{ entry, round, competition }] : [];
  }).sort((a, b) => b.competition.season_year - a.competition.season_year || (b.competition.competition_date ?? "").localeCompare(a.competition.competition_date ?? "") || a.round.name.localeCompare(b.round.name));

  const seasons = new Set(history.map(r => r.competition.season_year));
  const overallPodiums = history.filter(r => r.entry.overall_placement !== null && r.entry.overall_placement <= 3).length;
  const classPodiums = history.filter(r => r.entry.class_placement !== null && r.entry.class_placement <= 3).length;
  const profilePath = `/bands/${band.slug || band.id}`;

  return <>
    <section className="bg-[#002144] px-5 py-14 text-white sm:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm text-slate-300"><Link href="/" className="hover:underline">Home</Link> / <Link href="/bands" className="hover:underline">Bands & Corps</Link> / <Link href={profilePath} className="hover:underline">{band.name}</Link></p>
        <p className="mt-7 text-xs font-extrabold uppercase tracking-[0.2em] text-[#e6a9bc]">Historical competition records</p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-5xl">Championship History</h1>
        <p className="mt-4 max-w-3xl text-slate-200">Recorded championship finals appearances for {band.name}, including classifications, placements and scores.</p>
      </div>
    </section>
    <main className="mx-auto max-w-6xl space-y-8 px-5 py-10 sm:px-8">
      {truncated && <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">This ensemble has more than {MAX_ENTRIES.toLocaleString()} result entries. The championship history shown may be incomplete; summary figures must not be treated as career totals.</div>}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Recorded finals appearances", value: history.length },
          { label: "Seasons represented", value: seasons.size },
          { label: "Overall / class podium finishes", value: `${overallPodiums} / ${classPodiums}` },
        ].map(stat => <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-[#861F41]">{stat.label}</p><p className="mt-3 text-3xl font-extrabold tabular-nums text-[#002144]">{stat.value}</p></div>)}
      </div>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-6"><h2 className="text-2xl font-bold text-[#002144]">Championship finals results</h2><p className="mt-2 text-sm text-slate-600">Select a round to view its published results and supporting evidence.</p></div>
        {history.length === 0 ? <div className="p-8 text-slate-600">No published championship finals appearances are currently recorded for this ensemble.</div> :
          <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-600"><tr><th className="px-5 py-4">Season / Date</th><th className="px-5 py-4">Competition & Round</th><th className="px-5 py-4">Class</th><th className="px-5 py-4 text-right">Overall</th><th className="px-5 py-4 text-right">Class</th><th className="px-5 py-4 text-right">Score</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{history.map(({ entry, round, competition }) => <tr key={entry.id} className="hover:bg-slate-50"><td className="px-5 py-4"><span className="font-bold text-[#002144]">{competition.season_year}</span><p className="mt-1 text-xs text-slate-500">{dateText(competition.competition_date)}</p></td><td className="px-5 py-4"><Link className="font-bold text-[#861F41] hover:underline" href={roundPublicUrl(competition.slug || competition.id, round.slug || round.id)}>{competition.name}</Link><p className="mt-1 text-xs text-slate-500">{competition.organization_code} · {round.name}</p></td><td className="px-5 py-4">{entry.classification || "—"}</td><td className="px-5 py-4 text-right tabular-nums">{placement(entry.overall_placement)}</td><td className="px-5 py-4 text-right tabular-nums">{placement(entry.class_placement)}</td><td className="px-5 py-4 text-right font-semibold tabular-nums">{score(entry.total_score)}</td></tr>)}</tbody>
          </table></div>}
      </section>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm leading-7 text-slate-700"><h2 className="font-bold text-[#002144]">About these records</h2><p className="mt-2">This page includes finals rounds from published, non-archived championship-type competitions only. Placements reflect recorded results, not automatically verified official championship titles. Some events use class-specific finals; overall placement may be unavailable. Scores from different years and judging systems may not be directly comparable.</p></div>
      <div className="flex flex-wrap gap-3"><Link href={profilePath} className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold text-[#002144] hover:bg-slate-50">Back to ensemble profile</Link><Link href="/championships" className="rounded-lg bg-[#861F41] px-5 py-3 font-semibold text-white hover:bg-[#6f1735]">Browse all championships</Link></div>
    </main>
  </>;
}

export default function BandChampionshipHistoryPage(props: Props) {
  return <Suspense fallback={<main className="mx-auto max-w-6xl px-5 py-12 text-slate-600">Loading championship history…</main>}><ChampionshipHistoryContent {...props} /></Suspense>;
}
