import { Suspense } from "react";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN } from "@/lib/band-validation";
import { BAND_SLUG_PATTERN } from "@/lib/band-slugs";
import { competitionPublicUrl, roundPublicUrl } from "@/lib/public-competition-routes";
import InteractiveBandTimeline, { type TimelineSeason, type TimelineEntry } from "@/components/InteractiveBandTimeline";


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

function eventUrl(item: Performance): string {
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
  const seasons: TimelineSeason[] = years.map(year => ({
    year,
    nameChanges: names.filter(n => n.start_year === year).map(n => ({
      id: n.id, name: n.historical_name, endYear: n.end_year,
    })),
    entries: (yearGroups.get(year) ?? []).map(item => ({
      id: item.entry.id,
      competitionName: item.competition.name,
      competitionDate: item.competition.competition_date,
      organization: item.competition.organization_code,
      roundName: item.round.name,
      url: eventUrl(item),
      overallPlacement: item.entry.overall_placement,
      classPlacement: item.entry.class_placement,
      classification: item.entry.classification,
      totalScore: item.entry.total_score == null ? null : String(item.entry.total_score),
      championshipFinals: isChampionshipFinal(item),
    } satisfies TimelineEntry)),
  }));

  return (
    <main className="min-h-screen bg-[#F6F8FA] text-[#002144]">
      <section className="bg-[#002144] text-white">
        <div className="mx-auto max-w-6xl px-5 pb-12 pt-10 sm:px-8">
          <nav aria-label="Breadcrumb" className="flex flex-wrap gap-2 text-sm text-slate-300">
            <Link href="/bands" className="hover:text-white">Bands &amp; Corps</Link>
            <span aria-hidden="true">/</span>
            <Link href={`/bands/${band.slug}`} className="hover:text-white">{band.name}</Link>
            <span aria-hidden="true">/</span><span aria-current="page" className="text-white">Timeline</span>
          </nav>
          <p className="mt-8 text-xs font-bold uppercase tracking-[.2em] text-[#efb8ca]">The archive / Ensemble history</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">{band.name}: Historical Timeline</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-200">Explore documented competition appearances and historical names, year by year.</p>
          <Link href={`/bands/${band.slug}`} className="mt-6 inline-flex rounded-lg border border-white/30 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">← Back to ensemble profile</Link>
        </div>
      </section>
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        {truncated && <div role="status" className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">More than {MAX_ENTRIES.toLocaleString()} entries are recorded. This timeline displays a partial selection and its counts may be incomplete.</div>}
        <InteractiveBandTimeline
          seasons={seasons}
          undatedNames={names.filter(n => n.start_year === null).map(n => ({ id: n.id, name: n.historical_name, endYear: n.end_year }))}
          bandName={band.name}
        />
      </div>
    </main>
  );
}

export default function BandTimelinePage(props: Props) {
  return (
    <Suspense fallback={<main className="mx-auto max-w-6xl p-8 text-sm text-slate-600" role="status">Loading historical timeline…</main>}>
      <TimelineContents params={props.params} />
    </Suspense>
  );
}
