
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN } from "@/lib/band-validation";
import { BAND_SLUG_PATTERN } from "@/lib/band-slugs";
import { roundPublicUrl } from "@/lib/public-competition-routes";

export const instant = false;

type Props = {
  params: Promise<{ id: string }>;
};

type Entry = {
  id: string;
  round_id: string;
  classification: string | null;
  class_placement: number | null;
  overall_placement: number | null;
};

type Round = {
  id: string;
  competition_id: string;
  name: string;
  slug: string;
  round_kind: string;
};

type Competition = {
  id: string;
  slug: string;
  name: string;
  season_year: number;
  organization_code: string;
  competition_type: string;
};

const championshipTypes = new Set([
  "smbc",
  "championships",
  "grand_nationals",
  "world_championship",
]);

function Metric({
  title,
  count,
  explanation,
}: {
  title: string;
  count: number;
  explanation: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
        {title}
      </p>

      <p className="mt-3 text-4xl font-bold tabular-nums text-[#002144]">
        {count}
      </p>

      <p className="mt-3 text-sm leading-6 text-slate-600">
        {explanation}
      </p>
    </div>
  );
}

async function AchievementsContent({ params }: Props) {
  const { id } = await params;

  if (
    !id ||
    id.length > 150 ||
    (!UUID_PATTERN.test(id) && !BAND_SLUG_PATTERN.test(id))
  ) {
    notFound();
  }

  const supabase = await createClient();

  const { data: band, error: bandError } = await supabase
    .from("bands")
    .select("id, name, slug")
    .eq(UUID_PATTERN.test(id) ? "id" : "slug", id)
    .is("archived_at", null)
    .maybeSingle();

  if (bandError || !band) notFound();

  const { data, count, error } = await supabase
    .from("competition_entries")
    .select(
      "id, round_id, classification, class_placement, overall_placement",
      { count: "exact" }
    )
    .eq("band_id", band.id)
    .limit(1000);

  if (error) {
    throw new Error(
      "Unable to load ensemble achievements."
    );
  }

  const entries = (data ?? []) as Entry[];
  const incomplete = (count ?? 0) > entries.length;

  const roundIds = [
    ...new Set(entries.map((entry) => entry.round_id)),
  ];

  const rounds: Round[] = [];

  for (let i = 0; i < roundIds.length; i += 75) {
    const { data: batch, error: batchError } =
      await supabase
        .from("competition_rounds")
        .select(
          "id, competition_id, name, slug, round_kind"
        )
        .in("id", roundIds.slice(i, i + 75))
        .is("archived_at", null);

    if (batchError) {
      throw new Error(
        "Unable to load achievement rounds."
      );
    }

    rounds.push(...((batch ?? []) as Round[]));
  }

  const competitionIds = [
    ...new Set(
      rounds.map((round) => round.competition_id)
    ),
  ];

  const competitions: Competition[] = [];

  for (let i = 0; i < competitionIds.length; i += 75) {
    const { data: batch, error: batchError } =
      await supabase
        .from("competitions")
        .select(
          "id, slug, name, season_year, organization_code, competition_type"
        )
        .in("id", competitionIds.slice(i, i + 75))
        .eq("publication_status", "published")
        .is("archived_at", null);

    if (batchError) {
      throw new Error(
        "Unable to load championship records."
      );
    }

    competitions.push(
      ...((batch ?? []) as Competition[])
    );
  }

  const roundMap = new Map(
    rounds.map((round) => [round.id, round])
  );

  const competitionMap = new Map(
    competitions.map((competition) => [
      competition.id,
      competition,
    ])
  );

  const published = entries.flatMap((entry) => {
    const round = roundMap.get(entry.round_id);
    const competition = round
      ? competitionMap.get(round.competition_id)
      : null;

    return round && competition
      ? [{ entry, round, competition }]
      : [];
  });

  const overallFirsts = published.filter(
    ({ entry }) => entry.overall_placement === 1
  );

  const classFirsts = published.filter(
    ({ entry }) => entry.class_placement === 1
  );

  const overallPodiums = published.filter(
    ({ entry }) =>
      entry.overall_placement !== null &&
      entry.overall_placement >= 1 &&
      entry.overall_placement <= 3
  );

  const classPodiums = published.filter(
    ({ entry }) =>
      entry.class_placement !== null &&
      entry.class_placement >= 1 &&
      entry.class_placement <= 3
  );

  const championshipFinalFirsts = published.filter(
    ({ entry, round, competition }) =>
      round.round_kind === "finals" &&
      championshipTypes.has(
        competition.competition_type
      ) &&
      (entry.class_placement === 1 ||
        entry.overall_placement === 1)
  );

  championshipFinalFirsts.sort((a, b) => {
    return (
      b.competition.season_year -
      a.competition.season_year
    );
  });

  const metrics = [
    {
      title: "Overall First Places",
      count: overallFirsts.length,
      explanation:
        "Results explicitly recorded as first overall.",
    },
    {
      title: "Class First Places",
      count: classFirsts.length,
      explanation:
        "Results explicitly recorded as first in class.",
    },
    {
      title: "Overall Podiums",
      count: overallPodiums.length,
      explanation:
        "Overall placements of first, second, or third.",
    },
    {
      title: "Class Podiums",
      count: classPodiums.length,
      explanation:
        "Class placements of first, second, or third.",
    },
  ];

  const recentFirstPlaces = published
    .filter(({ entry }) => entry.class_placement === 1 || entry.overall_placement === 1)
    .sort((a, b) => b.competition.season_year - a.competition.season_year)
    .slice(0, 12);

  return (
    <main className="min-h-screen bg-[#f6f7f9]">
      <section className="bg-[#002144] text-white">
        <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
          <nav aria-label="Breadcrumb" className="text-sm text-slate-300">
            <Link href="/bands" className="hover:text-white">Bands &amp; Corps</Link>
            <span aria-hidden="true" className="mx-2">/</span>
            <Link href={`/bands/${band.slug}`} className="hover:text-white">{band.name}</Link>
            <span aria-hidden="true" className="mx-2">/</span>
            <span className="font-semibold text-white">Achievements</span>
          </nav>
          <p className="mt-9 text-xs font-bold uppercase tracking-[0.2em] text-[#e7b3c5]">
            Published competition history
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-5xl">
            {band.name}
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-200">
            Explore documented victories, podium finishes, and championship-final results.
            Counts reflect recorded round placements—not unverified awards.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href={`/bands/${band.slug}`} className="rounded-lg bg-white px-5 py-3 text-sm font-bold text-[#002144] hover:bg-slate-100">
              Back to Profile
            </Link>
            <Link href={`/bands/${band.slug}/statistics`} className="rounded-lg border border-white/30 px-5 py-3 text-sm font-bold text-white hover:bg-white/10">
              View Statistics
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-10 px-5 py-10 sm:px-8">
        {incomplete && (
          <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
            More than 1,000 entries exist for this ensemble. The figures below are partial,
            not career totals. Additional records are not included in this view.
          </div>
        )}
        <nav aria-label="Achievement sections" className="flex flex-wrap gap-2 text-sm font-semibold">
          <a href="#overview" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-[#002144] hover:border-[#861F41]">Overview</a>
          <a href="#recent-wins" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-[#002144] hover:border-[#861F41]">First Places</a>
          <a href="#championship-finals" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-[#002144] hover:border-[#861F41]">Championship Finals</a>
          <a href="#methodology" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-[#002144] hover:border-[#861F41]">Methodology</a>
        </nav>

        <section id="overview" className="scroll-mt-28 space-y-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#861F41]">At a glance</p>
            <h2 className="mt-2 text-2xl font-extrabold text-[#002144]">Recorded Achievements</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.map((metric) => <Metric key={metric.title} {...metric} />)}
          </div>
        </section>

        <section id="recent-wins" className="scroll-mt-28 space-y-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#861F41]">Competition record</p>
            <h2 className="mt-2 text-2xl font-extrabold text-[#002144]">Recent First-Place Results</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">The twelve most recent published round results with a recorded first-place finish, in class or overall.</p>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase tracking-wide text-[#002144]">
                <tr><th scope="col" className="px-5 py-4">Season</th><th scope="col" className="px-5 py-4">Competition / Round</th><th scope="col" className="px-5 py-4">Class</th><th scope="col" className="px-5 py-4">Class Place</th><th scope="col" className="px-5 py-4">Overall Place</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentFirstPlaces.map(({ entry, round, competition }) => (
                  <tr key={entry.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4 font-bold text-[#002144]">{competition.season_year}</td>
                    <td className="px-5 py-4"><Link className="font-semibold text-[#861F41] hover:underline" href={roundPublicUrl(competition.slug, round.slug)}>{competition.name}</Link><p className="mt-1 text-xs text-slate-500">{round.name} · {competition.organization_code}</p></td>
                    <td className="px-5 py-4">{entry.classification || "—"}</td>
                    <td className="px-5 py-4 tabular-nums">{entry.class_placement ?? "—"}</td>
                    <td className="px-5 py-4 tabular-nums">{entry.overall_placement ?? "—"}</td>
                  </tr>
                ))}
                {recentFirstPlaces.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-600">No first-place results have been published for this ensemble.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section id="championship-finals" className="scroll-mt-28 space-y-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#861F41]">Championship events</p>
            <h2 className="mt-2 text-2xl font-extrabold text-[#002144]">Championship-Final First Places</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
              These are first-place placements in final rounds of competitions categorized as championship events.
              They are <strong>not verified championship title counts</strong>. Class and overall awards may follow different rules.
            </p>
          </div>
          <div className="max-w-sm"><Metric title="Finals First Places" count={championshipFinalFirsts.length} explanation="Recorded first in class or overall in a championship final; official title not confirmed." /></div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase tracking-wide text-[#002144]">
                <tr><th scope="col" className="px-5 py-4">Season</th><th scope="col" className="px-5 py-4">Competition / Round</th><th scope="col" className="px-5 py-4">Class</th><th scope="col" className="px-5 py-4">Class Place</th><th scope="col" className="px-5 py-4">Overall Place</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {championshipFinalFirsts.map(({ entry, round, competition }) => (
                  <tr key={entry.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4 font-bold text-[#002144]">{competition.season_year}</td>
                    <td className="px-5 py-4"><Link href={roundPublicUrl(competition.slug, round.slug)} className="font-semibold text-[#861F41] hover:underline">{competition.name}</Link><p className="mt-1 text-xs text-slate-500">{round.name} · {competition.organization_code}</p></td>
                    <td className="px-5 py-4">{entry.classification || "—"}</td>
                    <td className="px-5 py-4 tabular-nums">{entry.class_placement ?? "—"}</td>
                    <td className="px-5 py-4 tabular-nums">{entry.overall_placement ?? "—"}</td>
                  </tr>
                ))}
                {championshipFinalFirsts.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-600">No matching published championship-final first-place results.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section id="methodology" className="scroll-mt-28 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <h2 className="text-xl font-extrabold text-[#002144]">How these figures are calculated</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Each figure counts recorded <strong>round results</strong> from published, non-archived competitions.
            A first place is counted when the stored class or overall placement equals one.
            Podiums include first through third, including ties if recorded.
            An ensemble can appear more than once at the same event if it performed in multiple rounds.
          </p>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            This database does not yet store verified standalone award records, such as caption awards or officially designated class championships.
            Those should be recorded separately with historical sources rather than inferred from score placement alone.
          </p>
        </section>
      </div>
    </main>
  );
}

export default function AchievementsPage(props: Props) {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#F4F6F9] px-6 py-12">
          <p
            role="status"
            className="mx-auto max-w-6xl text-sm text-slate-600"
          >
            Loading historical achievements...
          </p>
        </main>
      }
    >
      <AchievementsContent params={props.params} />
    </Suspense>
  );
}
