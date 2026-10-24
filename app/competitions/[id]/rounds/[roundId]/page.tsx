
import { Suspense } from "react";
import Link from "next/link";
import {
  notFound,
  permanentRedirect,
} from "next/navigation";

import {
  getPublicCompetition,
  isRecordId,
  validPublicIdentifier,
  competitionPublicUrl,
  roundPublicUrl,
} from "@/lib/public-competition-routes";

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
  total_score: number | string | null;
  class_placement: number | null;
  overall_placement: number | null;
  notes: string | null;
};

type Band = {
  id: string;
  slug: string;
  name: string;
};

type Caption = {
  id: string;
  name: string;
  max_score: number;
  sort_order: number;
};

type CaptionScore = {
  entry_id: string;
  caption_id: string;
  score: number;
};

function score(value: number | string | null | undefined) {
  if (value === null || value === undefined) {
    return "—";
  }

  const number = Number(value);
  if (!Number.isFinite(number)) return "—";

  return number
    .toFixed(4)
    .replace(/0+$/, "")
    .replace(/\.$/, "");
}

function placement(
  value: number | null,
  tied: boolean
) {
  if (value === null) return "—";
  return `${value}${tied ? " (T)" : ""}`;
}

function sourceUrl(value: string | null) {
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

function sortEntries(
  a: Entry,
  b: Entry,
  column: "overall_placement" | "class_placement",
  bands: Map<string, Band>
) {
  const first = a[column];
  const second = b[column];

  if (first !== null && second !== null) {
    if (first !== second) return first - second;
  } else if (first !== null) {
    return -1;
  } else if (second !== null) {
    return 1;
  }

  if (a.total_score !== null && b.total_score !== null) {
    const difference =
      Number(b.total_score) - Number(a.total_score);

    if (difference !== 0) return difference;
  }

  return (bands.get(a.band_id)?.name ?? "")
    .localeCompare(bands.get(b.band_id)?.name ?? "");
}

function ResultsTable({
  entries,
  bands,
  overallTies,
  classTies,
  mode,
}: {
  entries: Entry[];
  bands: Map<string, Band>;
  overallTies: Map<number, number>;
  classTies: Map<string, number>;
  mode: "overall" | "class";
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[650px] text-left text-sm">
        <thead className="bg-[#002144] text-white">
          <tr>
            <th className="px-5 py-4">
              {mode === "overall" ? "Overall" : "Class Place"}
            </th>
            <th className="px-5 py-4">Band / Corps</th>
            <th className="px-5 py-4">Class</th>
            <th className="px-5 py-4">
              {mode === "overall" ? "Class Place" : "Overall"}
            </th>
            <th className="px-5 py-4 text-right">Score</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100">
          {entries.map((entry) => {
            const band = bands.get(entry.band_id);

            const tiedOverall =
              entry.overall_placement !== null &&
              (overallTies.get(entry.overall_placement) ?? 0) > 1;

            const tiedClass =
              entry.classification !== null &&
              entry.class_placement !== null &&
              (classTies.get(
                `${entry.classification}:${entry.class_placement}`
              ) ?? 0) > 1;

            return (
              <tr key={entry.id} className="hover:bg-slate-50">
                <td className="px-5 py-4 font-bold text-[#002144]">
                  {mode === "overall"
                    ? placement(entry.overall_placement, tiedOverall)
                    : placement(entry.class_placement, tiedClass)}
                </td>

                <td className="px-5 py-4">
                  {band ? (
                    <Link
                      href={`/bands/${band.slug}`}
                      className="font-bold text-[#002144] hover:text-[#861F41] hover:underline"
                    >
                      {band.name}
                    </Link>
                  ) : (
                    <span className="text-slate-500">
                      Ensemble unavailable
                    </span>
                  )}

                  <a
                    href={`#details-${entry.id}`}
                    className="mt-1 block text-xs font-semibold text-[#861F41]"
                  >
                    Score Details ↓
                  </a>
                </td>

                <td className="px-5 py-4 text-slate-600">
                  {entry.classification ?? "—"}
                </td>

                <td className="px-5 py-4 text-slate-600">
                  {mode === "overall"
                    ? placement(entry.class_placement, tiedClass)
                    : placement(entry.overall_placement, tiedOverall)}
                </td>

                <td className="px-5 py-4 text-right font-bold tabular-nums text-[#002144]">
                  {score(entry.total_score)}
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
                No public results found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

async function RoundContent({ params }: Props) {
  const { id, roundId } = await params;

  if (!validPublicIdentifier(roundId)) {
    notFound();
  }

  const { supabase, competition } =
    await getPublicCompetition(id);

  const { data: round, error: roundError } =
    await supabase
      .from("competition_rounds")
      .select(
        "id, slug, name, round_kind, class_scope"
      )
      .eq(isRecordId(roundId) ? "id" : "slug", roundId)
      .eq("competition_id", competition.id)
      .is("archived_at", null)
      .maybeSingle();

  if (roundError) {
    throw new Error("Unable to load competition round.");
  }

  if (!round) notFound();

  const canonical = roundPublicUrl(
    competition.slug,
    round.slug
  );

  if (
    id !== competition.slug ||
    roundId !== round.slug
  ) {
    permanentRedirect(canonical);
  }

  const [entryResult, captionResult] =
    await Promise.all([
      supabase
        .from("competition_entries")
        .select(
          "id, band_id, classification, total_score, class_placement, overall_placement, notes",
          { count: "exact" }
        )
        .eq("round_id", round.id)
        .limit(500),

      supabase
        .from("score_captions")
        .select(
          "id, name, max_score, sort_order",
          { count: "exact" }
        )
        .eq("round_id", round.id)
        .order("sort_order", { ascending: true })
        .limit(100),
    ]);

  if (entryResult.error || captionResult.error) {
    throw new Error("Unable to load published results.");
  }

  const fetched = (entryResult.data ?? []) as Entry[];
  const captions = (captionResult.data ?? []) as Caption[];

  const bandIds = [...new Set(
    fetched.map((entry) => entry.band_id)
  )];

  const entryIds = fetched.map((entry) => entry.id);

  const [bandResult, scoreResult] = await Promise.all([
    bandIds.length
      ? supabase
          .from("bands")
          .select("id, name, slug")
          .in("id", bandIds)
          .is("archived_at", null)
      : Promise.resolve({
          data: [] as Band[],
          error: null,
        }),

    entryIds.length
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

  if (bandResult.error || scoreResult.error) {
    throw new Error("Unable to load band and score data.");
  }

  const bands = new Map<string, Band>(
    ((bandResult.data ?? []) as Band[]).map(
      (band) => [band.id, band]
    )
  );

  const entries = fetched.filter(
    (entry) => bands.has(entry.band_id)
  );

  const captionScores =
    (scoreResult.data ?? []) as CaptionScore[];

  const captionIds = new Set(
    captions.map((caption) => caption.id)
  );

  const scores = new Map<string, number>();

  for (const item of captionScores) {
    if (captionIds.has(item.caption_id)) {
      scores.set(
        `${item.entry_id}:${item.caption_id}`,
        item.score
      );
    }
  }

  const overallTies = new Map<number, number>();
  const classTies = new Map<string, number>();

  for (const entry of entries) {
    if (entry.overall_placement !== null) {
      const rank = entry.overall_placement;

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

  const overall = [...entries].sort(
    (a, b) =>
      sortEntries(
        a, b, "overall_placement", bands
      )
  );

  const classes = [...new Set(
    entries
      .map((entry) => entry.classification)
      .filter((item): item is string => Boolean(item))
  )].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );

  const incomplete =
    (entryResult.count ?? 0) > fetched.length ||
    (captionResult.count ?? 0) > captions.length ||
    (scoreResult.count ?? 0) > captionScores.length ||
    entries.length !== fetched.length;

  const source = sourceUrl(competition.source_url);

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-6 py-10">
      <nav className="flex flex-wrap gap-2 text-sm">
        <Link
          href="/competitions"
          className="font-semibold text-[#861F41]"
        >
          Competitions
        </Link>
        <span className="text-slate-400">/</span>
        <Link
          href={competitionPublicUrl(competition.slug)}
          className="font-semibold text-[#861F41]"
        >
          {competition.name}
        </Link>
        <span className="text-slate-400">/</span>
        <span className="text-slate-600">{round.name}</span>
      </nav>

      <header className="space-y-4">
        <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
          {competition.organization_code}
          {" · "}
          {competition.season_year} Season
        </p>

        <p className="text-lg font-semibold text-[#002144]">
          {competition.name}
        </p>

        <h1 className="font-serif text-4xl font-bold text-[#002144] md:text-5xl">
          {round.name} Results
        </h1>

        <p className="text-sm text-slate-600">
          {[
            competition.city,
            competition.state,
            competition.country,
          ].filter(Boolean).join(", ")}
        </p>

        {round.class_scope && (
          <p className="text-sm font-semibold text-[#861F41]">
            Class {round.class_scope}
          </p>
        )}
      </header>

      {incomplete && (
        <div
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"
        >
          This page may not show every historical entry
          because some records exceed the current display
          limit or belong to unavailable ensembles.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Ensembles", entries.length],
          [
            "Recorded Scores",
            entries.filter(
              (entry) => entry.total_score !== null
            ).length,
          ],
          ["Scoring Captions", captions.length],
        ].map(([title, value]) => (
          <div
            key={String(title)}
            className="rounded-xl border border-slate-200 bg-white p-6"
          >
            <p className="text-xs font-semibold uppercase text-slate-500">
              {title}
            </p>
            <p className="mt-2 text-3xl font-bold text-[#002144]">
              {value}
            </p>
          </div>
        ))}
      </div>

      <nav className="flex flex-wrap gap-3">
        <a
          href="#overall"
          className="rounded-lg bg-[#002144] px-5 py-3 text-sm font-bold text-white"
        >
          Overall Results
        </a>
        {classes.length > 0 && (
          <a
            href="#classes"
            className="rounded-lg bg-[#861F41] px-5 py-3 text-sm font-bold text-white"
          >
            Class Results
          </a>
        )}
        <a
          href="#details"
          className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-[#002144]"
        >
          Score Breakdowns
        </a>
      </nav>

      <section id="overall" className="scroll-mt-6 space-y-5">
        <h2 className="font-serif text-3xl font-bold text-[#002144]">
          Overall Results
        </h2>

        <ResultsTable
          entries={overall}
          bands={bands}
          overallTies={overallTies}
          classTies={classTies}
          mode="overall"
        />

        <p className="text-xs text-slate-500">
          (T) indicates a shared recorded placement.
          Missing information is shown as —.
        </p>
      </section>

      {classes.length > 0 && (
        <section id="classes" className="scroll-mt-6 space-y-7">
          <h2 className="font-serif text-3xl font-bold text-[#002144]">
            Class Results
          </h2>

          {classes.map((classification) => {
            const classEntries = entries
              .filter(
                (entry) =>
                  entry.classification === classification
              )
              .sort(
                (a, b) =>
                  sortEntries(
                    a, b, "class_placement", bands
                  )
              );

            return (
              <div
                key={classification}
                className="space-y-4"
              >
                <h3 className="text-xl font-bold text-[#002144]">
                  Class {classification}
                </h3>

                <ResultsTable
                  entries={classEntries}
                  bands={bands}
                  overallTies={overallTies}
                  classTies={classTies}
                  mode="class"
                />
              </div>
            );
          })}
        </section>
      )}

      <section id="details" className="scroll-mt-6 space-y-5">
        <h2 className="font-serif text-3xl font-bold text-[#002144]">
          Individual Score Breakdowns
        </h2>

        {overall.map((entry) => {
          const band = bands.get(entry.band_id);

          return (
            <details
              key={entry.id}
              id={`details-${entry.id}`}
              className="scroll-mt-6 rounded-2xl border border-slate-200 bg-white"
            >
              <summary className="cursor-pointer p-6">
                <span className="font-bold text-[#002144]">
                  {band?.name ?? "Unknown Ensemble"}
                </span>
                <span className="ml-3 text-sm text-slate-600">
                  Total: {score(entry.total_score)}
                </span>
              </summary>

              <div className="space-y-5 border-t border-slate-100 p-6">
                <div className="grid gap-4 text-sm sm:grid-cols-3">
                  <div>
                    <p className="text-slate-500">Class</p>
                    <p className="mt-1 font-bold">
                      {entry.classification ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Class Place</p>
                    <p className="mt-1 font-bold">
                      {entry.class_placement ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Overall Place</p>
                    <p className="mt-1 font-bold">
                      {entry.overall_placement ?? "—"}
                    </p>
                  </div>
                </div>

                {captions.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-[#002144] text-white">
                        <tr>
                          <th className="px-4 py-3">Caption</th>
                          <th className="px-4 py-3 text-right">
                            Score
                          </th>
                          <th className="px-4 py-3 text-right">
                            Maximum
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100">
                        {captions.map((caption) => (
                          <tr key={caption.id}>
                            <td className="px-4 py-3">
                              {caption.name}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              {score(
                                scores.get(
                                  `${entry.id}:${caption.id}`
                                )
                              )}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              {score(caption.max_score)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-slate-600">
                    No caption breakdown was recorded.
                  </p>
                )}

                {entry.notes && (
                  <p className="whitespace-pre-wrap text-sm leading-7 text-slate-600">
                    {entry.notes}
                  </p>
                )}

                {band && (
                  <Link
                    href={`/bands/${band.slug}`}
                    className="inline-block text-sm font-bold text-[#861F41]"
                  >
                    View Band Profile →
                  </Link>
                )}
              </div>
            </details>
          );
        })}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-7">
        <h2 className="text-2xl font-bold text-[#002144]">
          Sources & Accuracy
        </h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          Results are displayed as recorded in The
          Marching Archives. Historical scoring systems
          may differ, and caption totals may not add
          directly to official scores.
        </p>

        {source && (
          <a
            href={source}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block font-bold text-[#861F41]"
          >
            View Recorded Source ↗
          </a>
        )}
      </section>

      <Link
        href={competitionPublicUrl(competition.slug)}
        className="inline-block rounded-lg bg-[#002144] px-6 py-3 text-sm font-bold text-white"
      >
        ← Competition Profile
      </Link>
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
          <div className="mx-auto max-w-7xl px-6 py-10 text-sm text-slate-600">
            Loading round results...
          </div>
        }
      >
        <RoundContent params={props.params} />
      </Suspense>
    </main>
  );
}
