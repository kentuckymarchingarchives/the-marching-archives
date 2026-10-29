
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN } from "@/lib/band-validation";
import {
  competitionPublicUrl,
} from "@/lib/public-competition-routes";

export const instant = false;

type Props = {
  params: Promise<{ id: string }>;
};

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
  competition_id: string;
  name: string;
  archived_at: string | null;
};

type Competition = {
  id: string;
  slug: string | null;
  name: string;
  season_year: number;
  organization_code: string;
  competition_date: string | null;
  publication_status: string;
  archived_at: string | null;
};

type RecordRow = {
  entry: Entry;
  round: Round;
  competition: Competition;
};

function numberScore(value: number | string | null) {
  if (value === null || value === undefined) {
    return null;
  }

  const score = Number(value);

  return Number.isFinite(score) ? score : null;
}

function scoreLabel(value: number | null) {
  return value === null ? "—" : value.toFixed(3);
}

function dateLabel(value: string | null) {
  if (!value) return "Date unknown";

  const date = new Date(`${value}T12:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    return "Date unknown";
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
        {label}
      </p>

      <p className="mt-3 text-3xl font-bold tabular-nums text-[#002144]">
        {value}
      </p>

      <p className="mt-2 text-xs leading-5 text-slate-500">
        {detail}
      </p>
    </div>
  );
}

async function loadInChunks<T>(
  ids: string[],
  loader: (batch: string[]) => Promise<{
    data: T[] | null;
    error: { message: string } | null;
  }>
): Promise<T[]> {
  const results: T[] = [];
  const uniqueIds = [...new Set(ids)];

  for (let i = 0; i < uniqueIds.length; i += 75) {
    const batch = uniqueIds.slice(i, i + 75);
    const response = await loader(batch);

    if (response.error) {
      throw new Error(
        "Unable to load historical statistics."
      );
    }

    results.push(...(response.data ?? []));
  }

  return results;
}

async function StatisticsContent({ params }: Props) {
  const { id } = await params;

  if (!id || id.length > 200) {
    notFound();
  }

  const supabase = await createClient();

  const bandQuery = supabase
    .from("bands")
    .select("id, slug, name, archived_at");

  const { data: band, error: bandError } =
    UUID_PATTERN.test(id)
      ? await bandQuery.eq("id", id).maybeSingle()
      : await bandQuery.eq("slug", id).maybeSingle();

  if (bandError || !band || band.archived_at) {
    notFound();
  }

  const { data: rawEntries, count, error: entriesError } =
    await supabase
      .from("competition_entries")
      .select(
        "id, round_id, classification, total_score, class_placement, overall_placement",
        { count: "exact" }
      )
      .eq("band_id", band.id)
      .order("id", { ascending: true })
      .limit(1000);

  if (entriesError) {
    throw new Error(
      "Unable to load ensemble performance records."
    );
  }

  const entries = (rawEntries ?? []) as Entry[];
  const recordLimitReached =
    (count ?? 0) > entries.length;

  const rounds = await loadInChunks<Round>(
    entries.map((entry) => entry.round_id),
    async (batch) => {
      const { data, error } = await supabase
        .from("competition_rounds")
        .select(
          "id, competition_id, name, archived_at"
        )
        .in("id", batch);

      return { data: data as Round[] | null, error };
    }
  );

  const roundMap = new Map(
    rounds
      .filter((round) => !round.archived_at)
      .map((round) => [round.id, round])
  );

  const competitions =
    await loadInChunks<Competition>(
      rounds.map((round) => round.competition_id),
      async (batch) => {
        const { data, error } = await supabase
          .from("competitions")
          .select(
            "id, slug, name, season_year, organization_code, competition_date, publication_status, archived_at"
          )
          .in("id", batch)
          .eq("publication_status", "published")
          .is("archived_at", null);

        return {
          data: data as Competition[] | null,
          error,
        };
      }
    );

  const competitionMap = new Map(
    competitions.map((competition) => [
      competition.id,
      competition,
    ])
  );

  const records: RecordRow[] = [];

  for (const entry of entries) {
    const round = roundMap.get(entry.round_id);

    if (!round) continue;

    const competition = competitionMap.get(
      round.competition_id
    );

    if (!competition) continue;

    records.push({
      entry,
      round,
      competition,
    });
  }

  const scoredRecords = records.filter(
    (record) =>
      numberScore(record.entry.total_score) !== null
  );

  const scores = scoredRecords.map(
    (record) =>
      numberScore(record.entry.total_score) as number
  );

  const firstPlaces = records.filter(
    (record) =>
      record.entry.overall_placement === 1
  ).length;

  const classFirstPlaces = records.filter(
    (record) =>
      record.entry.class_placement === 1
  ).length;

  const podiumFinishes = records.filter(
    (record) => {
      const rank = record.entry.overall_placement;

      return rank !== null && rank >= 1 && rank <= 3;
    }
  ).length;

  const classPodiums = records.filter(
    (record) => {
      const rank = record.entry.class_placement;

      return rank !== null && rank >= 1 && rank <= 3;
    }
  ).length;

  const highestScore = scores.length
    ? Math.max(...scores)
    : null;

  const lowestScore = scores.length
    ? Math.min(...scores)
    : null;

  const averageScore = scores.length
    ? scores.reduce((sum, score) => sum + score, 0) /
      scores.length
    : null;

  const seasons = new Map<
    number,
    {
      appearances: number;
      scored: number;
      scores: number[];
      firstPlaces: number;
      podiums: number;
    }
  >();

  for (const record of records) {
    const year = record.competition.season_year;

    const season = seasons.get(year) ?? {
      appearances: 0,
      scored: 0,
      scores: [],
      firstPlaces: 0,
      podiums: 0,
    };

    season.appearances += 1;

    const score = numberScore(
      record.entry.total_score
    );

    if (score !== null) {
      season.scored += 1;
      season.scores.push(score);
    }

    if (record.entry.overall_placement === 1) {
      season.firstPlaces += 1;
    }

    const rank = record.entry.overall_placement;

    if (rank !== null && rank >= 1 && rank <= 3) {
      season.podiums += 1;
    }

    seasons.set(year, season);
  }

  const seasonRows = [...seasons.entries()].sort(
    (a, b) => b[0] - a[0]
  );

  const recentRecords = [...records]
    .sort((a, b) => {
      const yearDifference =
        b.competition.season_year -
        a.competition.season_year;

      if (yearDifference !== 0) return yearDifference;

      const dateDifference =
        (b.competition.competition_date ?? "")
          .localeCompare(
            a.competition.competition_date ?? ""
          );

      if (dateDifference !== 0) return dateDifference;

      return a.round.name.localeCompare(b.round.name);
    })
    .slice(0, 30);

  const canonicalId = band.slug || band.id;

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-6 py-10">
      <Link
        href={`/bands/${canonicalId}`}
        className="text-sm font-bold text-[#861F41] hover:underline"
      >
        &larr; Back to Ensemble Profile
      </Link>

      <header className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
          Competitive Statistics
        </p>

        <h1 className="font-serif text-4xl font-bold text-[#002144]">
          {band.name}
        </h1>

        <p className="max-w-3xl text-sm leading-7 text-slate-600">
          Historical statistics calculated from
          published competition results currently
          recorded in The Marching Archives.
        </p>
      </header>

      {recordLimitReached && (
        <div
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"
        >
          This ensemble has more than 1,000 recorded
          round entries. Statistics below cover only
          the first 1,000 loaded entries and are not
          complete. Full pagination will be needed
          before these totals can be considered final.
        </div>
      )}

      <section className="space-y-5">
        <h2 className="font-serif text-2xl font-bold text-[#002144]">
          Career Overview
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Appearances"
            value={records.length}
            detail="Published round entries"
          />

          <StatCard
            label="Overall 1st Places"
            value={firstPlaces}
            detail="Recorded 1st-place overall finishes"
          />

          <StatCard
            label="Overall Podiums"
            value={podiumFinishes}
            detail="Recorded overall placements 1–3"
          />

          <StatCard
            label="Seasons"
            value={seasons.size}
            detail="Seasons with published appearances"
          />

          <StatCard
            label="Class 1st Places"
            value={classFirstPlaces}
            detail="Recorded 1st-place class finishes"
          />

          <StatCard
            label="Class Podiums"
            value={classPodiums}
            detail="Recorded class placements 1–3"
          />

          <StatCard
            label="Highest Score"
            value={scoreLabel(highestScore)}
            detail="Highest recorded total score"
          />

          <StatCard
            label="Average Score"
            value={scoreLabel(averageScore)}
            detail={`Across ${scoredRecords.length} scored entries`}
          />
        </div>
      </section>

      <section className="space-y-5">
        <div>
          <h2 className="font-serif text-2xl font-bold text-[#002144]">
            Scoring Statistics
          </h2>

          <p className="mt-2 text-sm text-slate-600">
            Scores are summarized as originally
            recorded. Scoring systems can differ
            between organizations, seasons, and
            competitions.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Highest"
            value={scoreLabel(highestScore)}
            detail="Maximum recorded total"
          />

          <StatCard
            label="Lowest"
            value={scoreLabel(lowestScore)}
            detail="Minimum recorded total"
          />

          <StatCard
            label="Average"
            value={scoreLabel(averageScore)}
            detail="Arithmetic mean of recorded totals"
          />
        </div>
      </section>

      <section className="space-y-5">
        <div>
          <h2 className="font-serif text-2xl font-bold text-[#002144]">
            Season-by-Season History
          </h2>

          <p className="mt-2 text-sm text-slate-600">
            Results are grouped by season year.
            Each round appearance is counted separately.
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-[#002144] text-white">
              <tr>
                <th className="px-5 py-4">Season</th>
                <th className="px-5 py-4">Appearances</th>
                <th className="px-5 py-4">Overall 1sts</th>
                <th className="px-5 py-4">Overall Podiums</th>
                <th className="px-5 py-4">Scored</th>
                <th className="px-5 py-4">Avg. Score</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {seasonRows.map(([year, season]) => {
                const average = season.scores.length
                  ? season.scores.reduce(
                      (sum, value) => sum + value,
                      0
                    ) / season.scores.length
                  : null;

                return (
                  <tr key={year}>
                    <td className="px-5 py-4 font-bold text-[#002144]">
                      {year}
                    </td>
                    <td className="px-5 py-4">
                      {season.appearances}
                    </td>
                    <td className="px-5 py-4">
                      {season.firstPlaces}
                    </td>
                    <td className="px-5 py-4">
                      {season.podiums}
                    </td>
                    <td className="px-5 py-4">
                      {season.scored}
                    </td>
                    <td className="px-5 py-4 font-semibold tabular-nums">
                      {scoreLabel(average)}
                    </td>
                  </tr>
                );
              })}

              {seasonRows.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-10 text-center text-slate-600"
                  >
                    No published competition appearances
                    have been recorded for this ensemble.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-5">
        <div>
          <h2 className="font-serif text-2xl font-bold text-[#002144]">
            Recent Competition Results
          </h2>

          <p className="mt-2 text-sm text-slate-600">
            Up to 30 recently dated published round
            appearances, ordered by season and
            competition date.
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-[#002144] text-white">
              <tr>
                <th className="px-5 py-4">Date</th>
                <th className="px-5 py-4">Competition</th>
                <th className="px-5 py-4">Round</th>
                <th className="px-5 py-4">Class</th>
                <th className="px-5 py-4">Class Rank</th>
                <th className="px-5 py-4">Overall</th>
                <th className="px-5 py-4 text-right">Score</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {recentRecords.map((record) => (
                <tr key={record.entry.id}>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                    {dateLabel(
                      record.competition.competition_date
                    )}
                  </td>

                  <td className="px-5 py-4">
                    <Link
                      href={competitionPublicUrl(
                        record.competition.slug ||
                          record.competition.id
                      )}
                      className="font-bold text-[#861F41] hover:underline"
                    >
                      {record.competition.name}
                    </Link>

                    <p className="mt-1 text-xs text-slate-500">
                      {record.competition.organization_code}
                      {" · "}
                      {record.competition.season_year}
                    </p>
                  </td>

                  <td className="px-5 py-4 text-slate-600">
                    {record.round.name}
                  </td>

                  <td className="px-5 py-4 text-slate-600">
                    {record.entry.classification || "—"}
                  </td>

                  <td className="px-5 py-4">
                    {record.entry.class_placement ?? "—"}
                  </td>

                  <td className="px-5 py-4">
                    {record.entry.overall_placement ?? "—"}
                  </td>

                  <td className="px-5 py-4 text-right font-semibold tabular-nums text-[#002144]">
                    {scoreLabel(
                      numberScore(record.entry.total_score)
                    )}
                  </td>
                </tr>
              ))}

              {recentRecords.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-10 text-center text-slate-600"
                  >
                    No published results are currently
                    available for this ensemble.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="font-bold text-[#002144]">
          How These Statistics Are Calculated
        </h2>

        <p className="mt-3 text-sm leading-7 text-slate-600">
          Statistics use published, non-archived
          competitions and rounds. A semifinal and
          final appearance at the same event count
          as two round appearances. First places
          and podiums use explicitly recorded
          placements rather than inferred rankings.
        </p>

        <p className="mt-3 text-sm leading-7 text-slate-600">
          These statistics do not yet identify official
          state or national championships. Scores from
          different judging systems are shown for
          historical reference, not as standardized
          cross-organization comparisons.
        </p>
      </section>
    </div>
  );
}

export default function BandStatisticsPage(props: Props) {
  return (
    <main className="min-h-screen bg-[#F4F6F9]">
      <Suspense
        fallback={
          <div
            role="status"
            className="mx-auto max-w-7xl px-6 py-12 text-sm text-slate-600"
          >
            Calculating ensemble statistics...
          </div>
        }
      >
        <StatisticsContent params={props.params} />
      </Suspense>
    </main>
  );
}
