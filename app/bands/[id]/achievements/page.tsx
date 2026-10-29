
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

  return (
    <main className="min-h-screen bg-[#F4F6F9]">
      <div className="mx-auto max-w-6xl space-y-9 px-6 py-12">
        <Link
          href={`/bands/${band.slug}`}
          className="text-sm font-bold text-[#861F41] hover:underline"
        >
          &larr; Back to Ensemble Profile
        </Link>

        <header>
          <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
            Historical Achievements
          </p>

          <h1 className="mt-3 font-serif text-4xl font-bold text-[#002144]">
            {band.name}
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
            Explore documented first-place finishes and
            podium placements. These figures use published
            competition records rather than manually
            entered award totals.
          </p>
        </header>

        {incomplete && (
          <div
            role="alert"
            className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"
          >
            More than 1,000 entries were found. These
            achievements are incomplete and should
            not be interpreted as career totals.
          </div>
        )}

        <section className="space-y-5">
          <h2 className="font-serif text-2xl font-bold text-[#002144]">
            Recorded Achievements
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.map((metric) => (
              <Metric key={metric.title} {...metric} />
            ))}
          </div>
        </section>

        <section className="space-y-5">
          <div>
            <h2 className="font-serif text-2xl font-bold text-[#002144]">
              Championship Event Finals
            </h2>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
              These are first-place finishes recorded
              in final rounds of events classified
              as championships in TMA. This is not
              yet an official title count: some events
              award multiple class titles, and class
              or overall first place may not establish
              an official championship without
              verification.
            </p>
          </div>

          <Metric
            title="Championship Finals First Places"
            count={championshipFinalFirsts.length}
            explanation="First-place class or overall results in designated championship final rounds; not verified title totals."
          />

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-[#002144] text-white">
                <tr>
                  <th className="px-5 py-4">Season</th>
                  <th className="px-5 py-4">Event / Round</th>
                  <th className="px-5 py-4">Class</th>
                  <th className="px-5 py-4">Class Rank</th>
                  <th className="px-5 py-4">Overall Rank</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {championshipFinalFirsts.map(
                  ({ entry, round, competition }) => (
                    <tr key={entry.id}>
                      <td className="px-5 py-4 font-bold text-[#002144]">
                        {competition.season_year}
                      </td>

                      <td className="px-5 py-4">
                        <Link
                          href={roundPublicUrl(
                            competition.slug,
                            round.slug
                          )}
                          className="font-bold text-[#861F41] hover:underline"
                        >
                          {competition.name}
                        </Link>

                        <p className="mt-1 text-xs text-slate-600">
                          {round.name}
                          {" · "}
                          {competition.organization_code}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        {entry.classification || "—"}
                      </td>

                      <td className="px-5 py-4">
                        {entry.class_placement ?? "—"}
                      </td>

                      <td className="px-5 py-4">
                        {entry.overall_placement ?? "—"}
                      </td>
                    </tr>
                  )
                )}

                {championshipFinalFirsts.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-10 text-center text-slate-600"
                    >
                      No matching championship-final
                      first-place records have been
                      published for this ensemble.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-bold text-[#002144]">
            Historical Interpretation
          </h2>

          <p className="mt-3 text-sm leading-7 text-slate-600">
            Every count refers to a recorded round
            result. Ties are counted when a first,
            second, or third placement is explicitly
            recorded. A band competing in multiple
            rounds of one event may appear more
            than once in career placement statistics.
          </p>

          <p className="mt-3 text-sm leading-7 text-slate-600">
            Official class championships, overall
            championships, caption awards, and
            championship appearances will be
            distinguished once their historical
            designation rules and source records
            are verified.
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
