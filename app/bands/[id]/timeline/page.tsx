import { Suspense } from "react";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN } from "@/lib/band-validation";
import { BAND_SLUG_PATTERN } from "@/lib/band-slugs";
import { competitionPublicUrl, roundPublicUrl } from "@/lib/public-competition-routes";
import BandProfileNavigation from "@/components/BandProfileNavigation";

export const instant = false;

type Props = { params: Promise<{ id: string }> };
type Entry = {
  id: string;
  round_id: string;
  total_score: number | string | null;
  overall_placement: number | null;
  class_placement: number | null;
  classification: string | null;
};
type Round = {
  id: string;
  competition_id: string;
  name: string;
  slug: string | null;
  round_kind: string;
  archived_at: string | null;
};
type Competition = {
  id: string;
  slug: string | null;
  name: string;
  season_year: number;
  competition_date: string | null;
  organization_code: string;
  competition_type: string;
  publication_status: string;
  archived_at: string | null;
};
type HistoricalName = {
  id: string;
  historical_name: string;
  start_year: number | null;
  end_year: number | null;
};
type Performance = {
  entry: Entry;
  round: Round;
  competition: Competition;
};

const MAX_ENTRIES = 2000;

async function fetchBatches<T>(
  ids: string[],
  fetchBatch: (ids: string[]) => Promise<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const all: T[] = [];
  const unique = [...new Set(ids)];
  for (let index = 0; index < unique.length; index += 75) {
    const result = await fetchBatch(unique.slice(index, index + 75));
    if (result.error) throw new Error("Unable to load the historical timeline.");
    all.push(...(result.data ?? []));
  }
  return all;
}

function formatScore(value: number | string | null): string {
  if (value == null || value === "") return "—";
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(3) : "—";
}

function formatDate(date: string | null): string {
  if (!date) return "Date not recorded";
  const parsed = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(parsed.getTime())
    ? "Date not recorded"
    : parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function roundUrl(item: Performance): string {
  const identifier = item.competition.slug ?? item.competition.id;
  return item.round.slug
    ? roundPublicUrl(identifier, item.round.slug)
    : competitionPublicUrl(identifier);
}

function isChampionshipFinal(item: Performance): boolean {
  return ["championships", "smbc"].includes(item.competition.competition_type) && item.round.round_kind === "finals";
}

async function TimelineContents({ params }: Props) {
  const { id } = await params;
  if (!id || id.length > 150 || !(UUID_PATTERN.test(id) || BAND_SLUG_PATTERN.test(id))) notFound();

  const supabase = await createClient();
  const bandBase = supabase.from("bands").select("id, slug, name, archived_at");
  const { data: band, error: bandError } = UUID_PATTERN.test(id)
    ? await bandBase.eq("id", id).maybeSingle()
    : await bandBase.eq("slug", id).maybeSingle();
  if (bandError || !band || band.archived_at) notFound();
  if (UUID_PATTERN.test(id)) permanentRedirect(`/bands/${band.slug}/timeline`);

  const [{ data: rawEntries, count, error: entriesError }, { data: rawNames, error: namesError }] = await Promise.all([
    supabase.from("competition_entries")
      .select("id, round_id, total_score, overall_placement, class_placement, classification", { count: "exact" })
      .eq("band_id", band.id).order("id", { ascending: true }).limit(MAX_ENTRIES),
    supabase.from("band_names")
      .select("id, historical_name, start_year, end_year")
      .eq("band_id", band.id).order("start_year", { ascending: true, nullsFirst: false }),
  ]);
  if (entriesError || namesError) throw new Error("Unable to retrieve the ensemble timeline.");

  const entries = (rawEntries ?? []) as Entry[];
  const truncated = (count ?? entries.length) > entries.length;
  const rounds = await fetchBatches<Round>(entries.map(e => e.round_id), async ids => {
    const { data, error } = await supabase.from("competition_rounds")
      .select("id, competition_id, name, slug, round_kind, archived_at").in("id", ids);
    return { data: data as Round[] | null, error };
  });
  const roundMap = new Map(rounds.filter(r => !r.archived_at).map(r => [r.id, r]));
  const competitions = await fetchBatches<Competition>(rounds.map(r => r.competition_id), async ids => {
    const { data, error } = await supabase.from("competitions")
      .select("id, slug, name, season_year, competition_date, organization_code, competition_type, publication_status, archived_at")
      .in("id", ids).eq("publication_status", "published").is("archived_at", null);
    return { data: data as Competition[] | null, error };
  });
  const competitionMap = new Map(competitions.map(c => [c.id, c]));
  const performances: Performance[] = entries.flatMap(entry => {
    const round = roundMap.get(entry.round_id);
    const competition = round ? competitionMap.get(round.competition_id) : undefined;
    return round && competition ? [{ entry, round, competition }] : [];
  });
  performances.sort((a, b) =>
    b.competition.season_year - a.competition.season_year ||
    (b.competition.competition_date ?? "").localeCompare(a.competition.competition_date ?? "") ||
    a.competition.name.localeCompare(b.competition.name)
  );

  const names = (rawNames ?? []) as HistoricalName[];
  const yearGroups = new Map<number, Performance[]>();
  for (const item of performances) {
    const year = item.competition.season_year;
    if (!yearGroups.has(year)) yearGroups.set(year, []);
    yearGroups.get(year)!.push(item);
  }
  const years = [...new Set([...yearGroups.keys(), ...names.flatMap(n => n.start_year !== null ? [n.start_year] : [])])].sort((a,b) => b-a);
  const overallWins = performances.filter(p => p.entry.overall_placement === 1).length;
  const overallPodiums = performances.filter(p => p.entry.overall_placement !== null && p.entry.overall_placement <= 3).length;
  const finals = performances.filter(isChampionshipFinal).length;

  return (
    <main className="min-h-screen bg-[#F4F6F9] text-[#002144]">
      <section className="bg-[#002144] text-white">
        <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
          <nav aria-label="Breadcrumb" className="flex flex-wrap gap-2 text-sm text-slate-300">
            <Link href="/bands" className="hover:text-white">Bands &amp; Corps</Link>
            <span>/</span>
            <Link href={`/bands/${band.slug}`} className="hover:text-white">{band.name}</Link>
            <span>/</span><span className="text-white">Timeline</span>
          </nav>
          <p className="mt-7 text-xs font-bold uppercase tracking-[.2em] text-[#e7a9bb]">Ensemble history</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">{band.name}: Historical Timeline</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-200">Explore recorded competition appearances and historical ensemble names, organized chronologically by season.</p>
        </div>
      </section>
      <BandProfileNavigation slug={band.slug} />
      <div className="mx-auto max-w-6xl space-y-8 px-5 py-10 sm:px-8">
        {truncated && <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">This ensemble has more than {MAX_ENTRIES.toLocaleString()} recorded entries. The timeline is partial; additional historical records are not included.</div>}
        <section aria-label="Recorded timeline summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Published round entries", performances.length],
            ["Overall first places", overallWins],
            ["Overall podium finishes", overallPodiums],
            ["Championship finals rounds", finals],
          ].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-[#861F41]">{label}</p><p className="mt-3 text-3xl font-bold tabular-nums">{value}</p></div>)}
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5 text-sm leading-7 text-slate-600">
          <h2 className="text-lg font-bold text-[#002144]">About this timeline</h2>
          <p className="mt-2">This page reflects <strong>published, non-archived competition records</strong> currently documented in the archive. Semifinals and Finals are separate round appearances. Missing years do not prove the ensemble did not compete. Recorded first-place finishes and championship-finals appearances are not, by themselves, confirmation of official championship titles.</p>
        </section>
        {years.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-600">No dated competition results or historical name changes have been recorded for this ensemble yet.</div>
        ) : (
          <section aria-label="Season timeline" className="space-y-6">
            <h2 className="text-2xl font-extrabold">Season-by-season history</h2>
            <div className="space-y-7 border-l-2 border-[#861F41]/30 pl-6 sm:pl-8">
              {years.map(year => {
                const season = yearGroups.get(year) ?? [];
                const seasonNames = names.filter(n => n.start_year === year);
                return (
                  <article key={year} className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                    <span aria-hidden="true" className="absolute -left-8.5 top-8 h-3 w-3 rounded-full border-2 border-white bg-[#861F41] sm:-left-10.5" />
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-2xl font-extrabold">{year}</h3>
                      <span className="text-xs font-semibold text-slate-500">{season.length} recorded round {season.length === 1 ? "appearance" : "appearances"}</span>
                    </div>
                    {seasonNames.length > 0 && <div className="mt-4 space-y-2">{seasonNames.map(n => <p key={n.id} className="rounded-lg bg-[#F4F6F9] px-4 py-3 text-sm"><span className="font-bold text-[#861F41]">Historical name recorded:</span> {n.historical_name}{n.end_year != null ? ` (${year}–${n.end_year})` : ` (from ${year})`}</p>)}</div>}
                    {season.length > 0 && <ol className="mt-5 divide-y divide-slate-100">{season.map(item => {
                      const isFinal = isChampionshipFinal(item);
                      const isWin = item.entry.overall_placement === 1;
                      const isPodium = item.entry.overall_placement !== null && item.entry.overall_placement <= 3;
                      return <li key={item.entry.id} className="py-4 first:pt-0 last:pb-0">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-slate-500">{formatDate(item.competition.competition_date)} · {item.competition.organization_code} · {item.round.name}</p>
                            <Link className="mt-1 inline-block font-bold text-[#002144] hover:text-[#861F41] hover:underline" href={roundUrl(item)}>{item.competition.name}</Link>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs">
                              {isWin && <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-800">Recorded overall 1st</span>}
                              {!isWin && isPodium && <span className="rounded-full bg-sky-50 px-3 py-1 font-semibold text-sky-800">Overall podium</span>}
                              {isFinal && <span className="rounded-full bg-purple-50 px-3 py-1 font-semibold text-purple-800">Championship finals appearance</span>}
                            </div>
                          </div>
                          <div className="text-right text-xs text-slate-600">
                            <p>Overall: <strong className="text-[#002144]">{item.entry.overall_placement ?? "—"}</strong></p>
                            <p className="mt-1">Class: <strong className="text-[#002144]">{item.entry.class_placement ?? "—"}</strong>{item.entry.classification ? ` (${item.entry.classification})` : ""}</p>
                            <p className="mt-1">Score: <strong className="tabular-nums text-[#002144]">{formatScore(item.entry.total_score)}</strong></p>
                          </div>
                        </div>
                      </li>;
                    })}</ol>}
                  </article>
                );
              })}
            </div>
          </section>
        )}
        {names.some(n => n.start_year === null) && <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-bold">Other historical names (dates not recorded)</h2><ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">{names.filter(n => n.start_year === null).map(n => <li key={n.id}>{n.historical_name}{n.end_year !== null ? ` (through ${n.end_year})` : ""}</li>)}</ul></section>}
      </div>
    </main>
  );
}

export default function BandTimelinePage(props: Props) {
  return <Suspense fallback={<main className="mx-auto max-w-6xl p-8 text-sm text-slate-600" role="status">Loading historical timeline…</main>}><TimelineContents params={props.params} /></Suspense>;
}
