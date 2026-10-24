
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN } from "@/lib/band-validation";
import { readableLabel } from "@/lib/competition-config";

export const instant = false;

type Props = {
  params: Promise<{
    id: string;
    roundId: string;
  }>;
};

type Entry = {
  id: string;
  band_id: string;
  classification: string | null;
  total_score: number | null;
  class_placement: number | null;
  overall_placement: number | null;
  notes: string | null;
};

type Band = {
  id: string;
  name: string;
  slug: string;
};

type Caption = {
  id: string;
  name: string;
  max_score: number;
  multiplier: number;
  sort_order: number;
};

type CaptionScore = {
  entry_id: string;
  caption_id: string;
  score: number;
};

function scoreText(
  value: number | string | null | undefined
): string {
  if (value === null || value === undefined) {
    return "—";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  // Four digits accommodate historical scores
  // recorded to finer precision.
  return number.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")
    .replace(/^(\d+)$/, "$1.000");
}

function rankText(
  rank: number | null,
  tied: boolean
): string {
  if (rank === null) return "—";
  return `${rank}${tied ? " (T)" : ""}`;
}

function formatDate(value: string | null): string {
  if (!value) return "Date not recorded";

  const date = new Date(`${value}T12:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    return "Date not recorded";
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function safeSource(value: string | null) {
  if (!value) return null;

  try {
    const url = new URL(value);

    return ["http:", "https:"].includes(url.protocol)
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function sortByRank(
  a: Entry,
  b: Entry,
  field: "overall_placement" | "class_placement",
  bandMap: Map<string, Band>
): number {
  const aRank = a[field];
  const bRank = b[field];

  if (aRank !== null && bRank !== null) {
    if (aRank !== bRank) return aRank - bRank;
  } else {
    if (aRank !== null) return -1;
    if (bRank !== null) return 1;
  }

  if (a.total_score !== null && b.total_score !== null) {
    const difference =
      Number(b.total_score) - Number(a.total_score);

    if (difference !== 0) return difference;
  }

  return (bandMap.get(a.band_id)?.name ?? "").localeCompare(
    bandMap.get(b.band_id)?.name ?? ""
  );
}

function ResultTable({
  entries,
  bandMap,
  overallTies,
  classTies,
  placement,
}: {
  entries: Entry[];
  bandMap: Map<string, Band>;
  overallTies: Map<number, number>;
  classTies: Map<string, number>;
  placement: "overall" | "class";
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[620px] text-left text-sm">
        <thead className="bg-[#002144] text-white">
          <tr>
            <th scope="col" className="px-5 py-4">
              {placement === "overall" ? "Overall" : "Class Place"}
            </th>

            <th scope="col" className="px-5 py-4">
              Band / Drum Corps
            </th>

            <th scope="col" className="px-5 py-4">
              Class
            </th>

            <th scope="col" className="px-5 py-4">
              {placement === "overall"
                ? "Class Place"
                : "Overall"}
            </th>

            <th scope="col" className="px-5 py-4 text-right">
              Total Score
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100">
          {entries.map((entry) => {
            const band = bandMap.get(entry.band_id);

            const overallTie =
              entry.overall_placement !== null &&
              (overallTies.get(
                Number(entry.overall_placement)
              ) ?? 0) > 1;

            const classKey =
              `${entry.classification}:${entry.class_placement}`;

            const classTie =
              entry.classification !== null &&
              entry.class_placement !== null &&
              (classTies.get(classKey) ?? 0) > 1;

            return (
              <tr
                key={entry.id}
                className="transition hover:bg-slate-50"
              >
                <td className="whitespace-nowrap px-5 py-4 font-bold text-[#002144]">
                  {placement === "overall"
                    ? rankText(
                        entry.overall_placement,
                        overallTie
                      )
                    : rankText(
                        entry.class_placement,
                        classTie
                      )}
                </td>

                <td className="px-5 py-4">
                  <div className="font-bold text-[#002144]">
                    {band ? (
                      <Link
                        href={`/bands/${band.slug}`}
                        className="hover:text-[#861F41] hover:underline"
                      >
                        {band.name}
                      </Link>
                    ) : (
                      "Ensemble unavailable"
                    )}
                  </div>

                  <a
                    href={`#details-${entry.id}`}
                    className="mt-1 inline-block text-xs font-semibold text-[#861F41] hover:underline"
                  >
                    Score Details ↓
                  </a>
                </td>

                <td className="px-5 py-4 text-slate-600">
                  {entry.classification ?? "—"}
                </td>

                <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                  {placement === "overall"
                    ? rankText(
                        entry.class_placement,
                        classTie
                      )
                    : rankText(
                        entry.overall_placement,
                        overallTie
                      )}
                </td>

                <td className="px-5 py-4 text-right font-bold tabular-nums text-[#002144]">
                  {scoreText(entry.total_score)}
                </td>
              </tr>
            );
          })}

          {entries.length === 0 && (
            <tr>
              <td
                colSpan={5}
                className="px-5 py-10 text-center text-slate-500"
              >
                No results are available in this section.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

async function RoundResults({
  params,
}: Props) {
  const { id, roundId } = await params;

  if (
    !UUID_PATTERN.test(id) ||
    !UUID_PATTERN.test(roundId)
  ) {
    notFound();
  }

  const supabase = await createClient();

  // Publication restrictions are checked explicitly.
  // These checks apply even if the visitor happens
  // to be signed in as TMA staff.

  const { data: competition, error: competitionError } =
    await supabase
      .from("competitions")
      .select(
        "id, name, season_year, organization_code, competition_date, city, state, country, source_url, publication_status, archived_at"
      )
      .eq("id", id)
      .eq("publication_status", "published")
      .is("archived_at", null)
      .maybeSingle();

  if (competitionError) {
    throw new Error("Unable to load competition.");
  }

  if (!competition) {
    notFound();
  }

  const { data: round, error: roundError } =
    await supabase
      .from("competition_rounds")
      .select(
        "id, name, round_kind, class_scope"
      )
      .eq("id", roundId)
      .eq("competition_id", competition.id)
      .is("archived_at", null)
      .maybeSingle();

  if (roundError) {
    throw new Error("Unable to load round.");
  }

  if (!round) {
    notFound();
  }

  const [
    entriesResult,
    captionsResult,
  ] = await Promise.all([
    supabase
      .from("competition_entries")
      .select(
        "id, band_id, classification, total_score, class_placement, overall_placement, notes",
        { count: "exact" }
      )
      .eq("round_id", roundId)
      .order("overall_placement", {
        ascending: true,
        nullsFirst: false,
      })
      .limit(500),

    supabase
      .from("score_captions")
      .select(
        "id, name, max_score, multiplier, sort_order",
        { count: "exact" }
      )
      .eq("round_id", roundId)
      .order("sort_order", { ascending: true })
      .limit(100),
  ]);

  if (entriesResult.error || captionsResult.error) {
    throw new Error("Unable to load published results.");
  }

  const fetchedEntries =
    (entriesResult.data ?? []) as Entry[];

  const captions =
    (captionsResult.data ?? []) as Caption[];

  const bandIds = [
    ...new Set(fetchedEntries.map((entry) => entry.band_id)),
  ];

  const entryIds = fetchedEntries.map((entry) => entry.id);

  const [
    bandsResult,
    scoresResult,
  ] = await Promise.all([
    bandIds.length > 0
      ? supabase
          .from("bands")
          .select("id, name, slug")
          .in("id", bandIds)
          .is("archived_at", null)
      : Promise.resolve({
          data: [] as Band[],
          error: null,
        }),

    entryIds.length > 0
      ? supabase
          .from("caption_scores")
          .select(
            "entry_id, caption_id, score",
            { count: "exact" }
          )
          .in("entry_id", entryIds)
          .limit(5000)
      : Promise.resolve({
          data: [] as CaptionScore[],
          count: 0,
          error: null,
        }),
  ]);

  if (bandsResult.error || scoresResult.error) {
    throw new Error("Unable to load result details.");
  }

  const bandMap = new Map<string, Band>(
    ((bandsResult.data ?? []) as Band[]).map(
      (band) => [band.id, band]
    )
  );

  // Exclude archived or unavailable bands even when
  // staff RLS permissions would otherwise expose them.

  const entries = fetchedEntries.filter(
    (entry) => bandMap.has(entry.band_id)
  );

  const captionScores =
    (scoresResult.data ?? []) as CaptionScore[];

  const captionIds = new Set(
    captions.map((caption) => caption.id)
  );

  const scoresByEntry = new Map<
    string,
    Map<string, number>
  >();

  for (const score of captionScores) {
    if (!captionIds.has(score.caption_id)) {
      continue;
    }

    if (!scoresByEntry.has(score.entry_id)) {
      scoresByEntry.set(score.entry_id, new Map());
    }

    scoresByEntry.get(score.entry_id)!.set(
      score.caption_id,
      score.score
    );
  }

  const overallTies = new Map<number, number>();
  const classTies = new Map<string, number>();

  for (const entry of entries) {
    if (entry.overall_placement !== null) {
      const rank = Number(entry.overall_placement);

      overallTies.set(
        rank,
        (overallTies.get(rank) ?? 0) + 1
      );
    }

    if (
      entry.classification !== null &&
      entry.class_placement !== null
    ) {
      const key =
        `${entry.classification}:${entry.class_placement}`;

      classTies.set(
        key,
        (classTies.get(key) ?? 0) + 1
      );
    }
  }

  const overallResults = [...entries].sort(
    (a, b) =>
      sortByRank(a, b, "overall_placement", bandMap)
  );

  const classifications = [
    ...new Set(
      entries
        .map((entry) => entry.classification)
        .filter(
          (value): value is string => Boolean(value)
        )
    ),
  ].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );

  const recordedScores = entries.filter(
    (entry) => entry.total_score !== null
  ).length;

  const source = safeSource(competition.source_url);

  const incompleteDisplay =
    (entriesResult.count ?? 0) > fetchedEntries.length ||
    (captionsResult.count ?? 0) > captions.length ||
    (scoresResult.count ?? 0) > captionScores.length ||
    fetchedEntries.length > entries.length;

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-6 py-10">
      <nav className="flex flex-wrap gap-x-3 gap-y-2 text-sm">
        <Link
          href="/competitions"
          className="font-semibold text-[#861F41] hover:underline"
        >
          Competitions
        </Link>

        <span className="text-slate-400">/</span>

        <Link
          href={`/competitions/${id}`}
          className="font-semibold text-[#861F41] hover:underline"
        >
          {competition.name}
        </Link>

        <span className="text-slate-400">/</span>

        <span className="text-slate-600">
          {round.name}
        </span>
      </nav>

      <header className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-[#002144] px-4 py-2 text-xs font-bold text-white">
            {competition.organization_code}
          </span>

          <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-[#002144]">
            {competition.season_year} Season
          </span>

          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-800">
            Published Results
          </span>
        </div>

        <p className="text-sm font-bold uppercase tracking-widest text-[#861F41]">
          {competition.name}
        </p>

        <h1 className="font-serif text-4xl font-bold text-[#002144] md:text-5xl">
          {round.name} Results
        </h1>

        <p className="text-sm text-slate-600">
          {readableLabel(round.round_kind)}
          {" · "}
          {formatDate(competition.competition_date)}
        </p>

        <p className="text-sm text-slate-600">
          {[
            competition.city,
            competition.state,
            competition.country,
          ]
            .filter(Boolean)
            .join(", ")}
        </p>

        {round.class_scope && (
          <p className="text-sm font-bold text-[#861F41]">
            Class: {round.class_scope}
          </p>
        )}
      </header>

      {incompleteDisplay && (
        <div
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900"
        >
          Some results or scoring details are not
          included in this view because they exceed
          the current display limit or their band
          records are unavailable. Do not treat this
          page as a complete historical recap.
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Ensembles
          </p>
          <p className="mt-2 text-3xl font-bold text-[#002144]">
            {entries.length}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Recorded Total Scores
          </p>
          <p className="mt-2 text-3xl font-bold text-[#002144]">
            {recordedScores}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Caption Categories
          </p>
          <p className="mt-2 text-3xl font-bold text-[#002144]">
            {captions.length}
          </p>
        </div>
      </section>

      <nav
        aria-label="Results sections"
        className="flex flex-wrap gap-3"
      >
        <a
          href="#overall"
          className="rounded-lg bg-[#002144] px-5 py-3 text-sm font-bold text-white hover:bg-[#123B63]"
        >
          Overall Results
        </a>

        {classifications.length > 0 && (
          <a
            href="#classes"
            className="rounded-lg bg-[#861F41] px-5 py-3 text-sm font-bold text-white hover:bg-[#A02B52]"
          >
            Class Results
          </a>
        )}

        <a
          href="#details"
          className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-[#002144] hover:bg-slate-50"
        >
          Caption Breakdowns
        </a>
      </nav>

      <section id="overall" className="scroll-mt-6 space-y-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
            Officially Recorded Placements
          </p>

          <h2 className="mt-2 font-serif text-3xl font-bold text-[#002144]">
            Overall Results
          </h2>

          <p className="mt-3 text-sm leading-7 text-slate-600">
            Bands are ordered by their recorded overall
            placements. Where placements are unavailable,
            scores help organize the remaining entries,
            but no placement is inferred.
          </p>
        </div>

        <ResultTable
          entries={overallResults}
          bandMap={bandMap}
          overallTies={overallTies}
          classTies={classTies}
          placement="overall"
        />

        <p className="text-xs leading-6 text-slate-500">
          (T) means multiple ensembles have the same
          recorded placement. Missing scores and placements
          are shown as —.
        </p>
      </section>

      {classifications.length > 0 && (
        <section id="classes" className="scroll-mt-6 space-y-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
              Classification Breakdown
            </p>

            <h2 className="mt-2 font-serif text-3xl font-bold text-[#002144]">
              Class Results
            </h2>

            <p className="mt-3 text-sm text-slate-600">
              Each class displays the recorded
              within-class placements and total scores.
            </p>
          </div>

          <nav className="flex flex-wrap gap-2">
            {classifications.map((classification) => (
              <a
                key={classification}
                href={`#class-${encodeURIComponent(classification)}`}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-[#861F41] hover:border-[#861F41]"
              >
                Class {classification}
              </a>
            ))}
          </nav>

          {classifications.map((classification) => {
            const classEntries = entries
              .filter(
                (entry) =>
                  entry.classification === classification
              )
              .sort(
                (a, b) =>
                  sortByRank(
                    a,
                    b,
                    "class_placement",
                    bandMap
                  )
              );

            return (
              <div
                key={classification}
                id={`class-${classification}`}
                className="scroll-mt-6 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-xl font-bold text-[#002144]">
                    Class {classification}
                  </h3>

                  <span className="text-sm text-slate-500">
                    {classEntries.length} ensembles
                  </span>
                </div>

                <ResultTable
                  entries={classEntries}
                  bandMap={bandMap}
                  overallTies={overallTies}
                  classTies={classTies}
                  placement="class"
                />
              </div>
            );
          })}
        </section>
      )}

      <section id="details" className="scroll-mt-6 space-y-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
            Detailed Historical Scores
          </p>

          <h2 className="mt-2 font-serif text-3xl font-bold text-[#002144]">
            Individual Score Breakdowns
          </h2>

          <p className="mt-3 text-sm leading-7 text-slate-600">
            Expand an ensemble to see its available caption
            scores, total score, placements, and documented
            result notes.
          </p>
        </div>

        {overallResults.length > 0 ? (
          <div className="space-y-4">
            {overallResults.map((entry) => {
              const band = bandMap.get(entry.band_id);

              const savedScores =
                scoresByEntry.get(entry.id) ??
                new Map<string, number>();

              const hasDetails =
                captions.length > 0 ||
                Boolean(entry.notes);

              return (
                <details
                  key={entry.id}
                  id={`details-${entry.id}`}
                  className="group scroll-mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-4 p-6 marker:hidden">
                    <div>
                      <p className="text-lg font-bold text-[#002144] group-hover:text-[#861F41]">
                        {band?.name ?? "Ensemble unavailable"}
                      </p>

                      <p className="mt-2 text-sm text-slate-600">
                        {entry.classification ?? "Unclassified"}
                        {" · "}
                        Total: {scoreText(entry.total_score)}
                      </p>
                    </div>

                    <span className="text-sm font-bold text-[#861F41]">
                      Expand Details
                    </span>
                  </summary>

                  <div className="space-y-5 border-t border-slate-100 p-6">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <p className="text-xs uppercase text-slate-500">
                          Overall Placement
                        </p>
                        <p className="mt-2 font-bold text-[#002144]">
                          {entry.overall_placement ?? "—"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs uppercase text-slate-500">
                          Class Placement
                        </p>
                        <p className="mt-2 font-bold text-[#002144]">
                          {entry.class_placement ?? "—"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs uppercase text-slate-500">
                          Total Score
                        </p>
                        <p className="mt-2 font-bold tabular-nums text-[#002144]">
                          {scoreText(entry.total_score)}
                        </p>
                      </div>
                    </div>

                    {captions.length > 0 ? (
                      <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full min-w-[480px] text-left text-sm">
                          <thead className="bg-[#002144] text-white">
                            <tr>
                              <th className="px-4 py-3">
                                Caption
                              </th>
                              <th className="px-4 py-3 text-right">
                                Recorded Score
                              </th>
                              <th className="px-4 py-3 text-right">
                                Maximum
                              </th>
                            </tr>
                          </thead>

                          <tbody className="divide-y divide-slate-100">
                            {captions.map((caption) => (
                              <tr key={caption.id}>
                                <td className="px-4 py-3 font-semibold text-[#002144]">
                                  {caption.name}
                                </td>

                                <td className="px-4 py-3 text-right tabular-nums">
                                  {scoreText(
                                    savedScores.get(caption.id)
                                  )}
                                </td>

                                <td className="px-4 py-3 text-right tabular-nums text-slate-500">
                                  {scoreText(
                                    caption.max_score
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-600">
                        No caption breakdown was recorded
                        for this competition round.
                      </p>
                    )}

                    {entry.notes && (
                      <div>
                        <h4 className="font-bold text-[#002144]">
                          Result Notes
                        </h4>

                        <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                          {entry.notes}
                        </p>
                      </div>
                    )}

                    {band && (
                      <Link
                        href={`/bands/${band.slug}`}
                        className="inline-block text-sm font-bold text-[#861F41] hover:underline"
                      >
                        View Band Profile →
                      </Link>
                    )}

                    {!hasDetails && (
                      <p className="text-xs text-slate-500">
                        Only overall result information
                        is available.
                      </p>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600">
            No published result entries are available
            for this round.
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-7">
        <h2 className="text-2xl font-bold text-[#002144]">
          Source & Accuracy
        </h2>

        <p className="mt-3 text-sm leading-7 text-slate-600">
          These are the historical scores and placements
          recorded in The Marching Archives. Different
          competitions may use different scoring systems,
          and a caption breakdown may not sum directly
          to the officially reported total.
        </p>

        {source && (
          <a
            href={source}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-block text-sm font-bold text-[#861F41] hover:underline"
          >
            View Recorded Competition Source ↗
          </a>
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/competitions/${id}`}
          className="rounded-lg bg-[#002144] px-6 py-3 text-sm font-bold text-white"
        >
          ← Competition Profile
        </Link>

        <Link
          href="/competitions"
          className="rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-bold text-[#002144]"
        >
          Browse More Competitions
        </Link>
      </div>
    </div>
  );
}

export default function PublicRoundResultsPage(
  props: Props
) {
  return (
    <main className="min-h-screen bg-[#F4F6F9]">
      <Suspense
        fallback={
          <div
            role="status"
            className="mx-auto max-w-7xl px-6 py-10 text-sm text-slate-600"
          >
            Loading historical competition results...
          </div>
        }
      >
        <RoundResults params={props.params} />
      </Suspense>
    </main>
  );
}
