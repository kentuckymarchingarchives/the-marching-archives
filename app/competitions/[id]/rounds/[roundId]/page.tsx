
import { Suspense } from "react";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import {
  getPublicCompetition,
  isRecordId,
  validPublicIdentifier,
  competitionPublicUrl,
  roundPublicUrl,
} from "@/lib/public-competition-routes";

import BandLogo from "@/components/BandLogo";
import RecordCitation from "@/components/RecordCitation";

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
  logo_path: string | null;
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

function scoreText(
  value: number | string | null | undefined
): string {
  if (value === null || value === undefined) return "—";

  const valueNumber = Number(value);

  if (!Number.isFinite(valueNumber)) return "—";

  return valueNumber
    .toFixed(4)
    .replace(/0+$/, "")
    .replace(/\.$/, "");
}

function rankText(value: number | null, tied: boolean): string {
  if (value === null) return "—";
  return `${value}${tied ? " (T)" : ""}`;
}

function sortEntries(
  a: Entry,
  b: Entry,
  field: "overall_placement" | "class_placement",
  bands: Map<string, Band>
): number {
  const first = a[field];
  const second = b[field];

  if (first !== null && second !== null) {
    if (first !== second) return first - second;
  } else if (first !== null) {
    return -1;
  } else if (second !== null) {
    return 1;
  }

  const aScore =
    a.total_score === null ? null : Number(a.total_score);
  const bScore =
    b.total_score === null ? null : Number(b.total_score);

  if (aScore !== null && bScore !== null && aScore !== bScore) {
    return bScore - aScore;
  }

  return (bands.get(a.band_id)?.name ?? "").localeCompare(
    bands.get(b.band_id)?.name ?? ""
  );
}

function safeUrl(value: string | null): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol)
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function ResultsTable({
  entries,
  bands,
  overallTies,
  classTies,
  mode,
  supabaseUrl,
}: {
  entries: Entry[];
  bands: Map<string, Band>;
  overallTies: Map<number, number>;
  classTies: Map<string, number>;
  mode: "overall" | "class";
  supabaseUrl: string;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-100">
      <table className="w-full 180 text-left text-sm">
        <thead className="bg-slate-100 text-[#002144]">
          <tr>
            <th scope="col" className="px-5 py-4">
              {mode === "overall" ? "Overall" : "Class Place"}
            </th>
            <th scope="col" className="px-5 py-4">
              Band / Drum Corps
            </th>
            <th scope="col" className="px-5 py-4">
              Class
            </th>
            <th scope="col" className="px-5 py-4">
              {mode === "overall" ? "Class Place" : "Overall"}
            </th>
            <th scope="col" className="px-5 py-4 text-right">
              Total Score
            </th>
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
              <tr
                key={entry.id}
                className="transition odd:bg-white even:bg-slate-50/60 hover:bg-[#861F41]/5"
              >
                <td className="whitespace-nowrap px-5 py-4 text-base font-extrabold tabular-nums text-[#002144]">
                  {mode === "overall"
                    ? rankText(entry.overall_placement, tiedOverall)
                    : rankText(entry.class_placement, tiedClass)}
                </td>

                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    {band && (
                      <BandLogo
                        name={band.name}
                        bandId={band.id}
                        logoPath={band.logo_path}
                        supabaseUrl={supabaseUrl}
                        size="small"
                      />
                    )}

                    <div className="min-w-0">
                      {band ? (
                        <Link
                          href={`/bands/${band.slug}`}
                          className="font-bold text-[#002144] hover:text-[#861F41] hover:underline"
                        >
                          {band.name}
                        </Link>
                      ) : (
                        <span>Ensemble unavailable</span>
                      )}

                      <a
                        href={`#details-${entry.id}`}
                        className="mt-1 block text-xs font-semibold text-[#861F41] hover:underline"
                      >
                        Score Details &darr;
                      </a>
                    </div>
                  </div>
                </td>

                <td className="px-5 py-4 text-slate-600">
                  {entry.classification ?? "—"}
                </td>

                <td className="px-5 py-4 text-slate-600">
                  {mode === "overall"
                    ? rankText(entry.class_placement, tiedClass)
                    : rankText(entry.overall_placement, tiedOverall)}
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
                No results are available.
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

  const { data: round, error: roundError } = await supabase
    .from("competition_rounds")
    .select("id, slug, name, round_kind, class_scope")
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

  if (id !== competition.slug || roundId !== round.slug) {
    permanentRedirect(canonical);
  }

  const [entriesResult, captionsResult] = await Promise.all([
    supabase
      .from("competition_entries")
      .select(
        "id, band_id, classification, total_score, class_placement, overall_placement, notes",
        { count: "exact" }
      )
      .eq("round_id", round.id)
      .order("overall_placement", {
        ascending: true,
        nullsFirst: false,
      })
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

  if (entriesResult.error || captionsResult.error) {
    throw new Error("Unable to load published results.");
  }

  const fetched = (entriesResult.data ?? []) as Entry[];
  const captions = (captionsResult.data ?? []) as Caption[];

  const bandIds = [
    ...new Set(fetched.map((entry) => entry.band_id)),
  ];

  const entryIds = fetched.map((entry) => entry.id);

  const [bandsResult, scoresResult] = await Promise.all([
    bandIds.length > 0
      ? supabase
          .from("bands")
          .select("id, slug, name, logo_path")
          .in("id", bandIds)
          .is("archived_at", null)
      : Promise.resolve({
          data: [] as Band[],
          error: null,
        }),

    entryIds.length > 0
      ? supabase
          .from("caption_scores")
          .select("entry_id, caption_id, score", {
            count: "exact",
          })
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

  const bands = new Map<string, Band>(
    ((bandsResult.data ?? []) as Band[]).map((band) => [
      band.id,
      band,
    ])
  );

  const entries = fetched.filter((entry) =>
    bands.has(entry.band_id)
  );

  const captionScores =
    (scoresResult.data ?? []) as CaptionScore[];

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
      overallTies.set(
        entry.overall_placement,
        (overallTies.get(entry.overall_placement) ?? 0) + 1
      );
    }

    if (
      entry.classification !== null &&
      entry.class_placement !== null
    ) {
      const key =
        `${entry.classification}:${entry.class_placement}`;

      classTies.set(key, (classTies.get(key) ?? 0) + 1);
    }
  }

  const overall = [...entries].sort((a, b) =>
    sortEntries(a, b, "overall_placement", bands)
  );

  const classes = [
    ...new Set(
      entries
        .map((entry) => entry.classification)
        .filter((value): value is string => Boolean(value))
    ),
  ].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );

  const incomplete =
    (entriesResult.count ?? 0) > fetched.length ||
    (captionsResult.count ?? 0) > captions.length ||
    (scoresResult.count ?? 0) > captionScores.length ||
    entries.length !== fetched.length;

  const source = safeUrl(competition.source_url);

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  return (
    <div className="mx-auto max-w-7xl space-y-9 px-5 py-8 sm:px-8 sm:py-12">
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

      <header className="relative overflow-hidden rounded-3xl bg-[#002144] p-7 text-white shadow-lg sm:p-10">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-[#861F41]/50 blur-3xl" />
        <div className="relative">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-rose-200">
            {competition.organization_code} · {competition.season_year} Season
          </p>
          <p className="mt-5 text-sm font-semibold text-slate-200">
            {competition.name}
          </p>
          <h1 className="mt-2 max-w-4xl text-3xl font-extrabold tracking-tight sm:text-5xl">
            {round.name} <span className="text-[#efb1c5]">Results</span>
          </h1>
          <div className="mt-6 flex flex-wrap gap-2 text-sm text-slate-200">
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">
              {[competition.city, competition.state, competition.country].filter(Boolean).join(", ") || "Location not recorded"}
            </span>
            {round.class_scope && (
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">
                Class {round.class_scope}
              </span>
            )}
          </div>
        </div>
      </header>

      {incomplete && (
        <div
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900"
        >
          Some historical records exceed the current display
          limit or belong to unavailable ensembles.
          This view may be incomplete.
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
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
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase text-slate-500">
              {title}
            </p>
            <p className="mt-2 text-3xl font-bold text-[#002144]">
              {value}
            </p>
          </div>
        ))}
      </section>

      <nav aria-label="Results sections" className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <a href="#overall" className="rounded-xl bg-[#002144] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#153e64]">
          Overall Results
        </a>
        {classes.length > 0 && (
          <a href="#classes" className="rounded-xl bg-[#861F41] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#a02e55]">
            Class Results
          </a>
        )}
        <a href="#details" className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-bold text-[#002144] transition hover:bg-slate-100">
          Caption Breakdowns
        </a>
        {!incomplete && (
          <a
            href={`${canonical}/export`}
            className="rounded-xl border border-[#861F41]/30 bg-white px-5 py-3 text-sm font-bold text-[#861F41] hover:bg-rose-50"
          >
            Download CSV
          </a>
        )}
        <a href="#sources" className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50">
          Sources
        </a>
      </nav>

      <section id="overall" className="scroll-mt-28 space-y-5">
        <h2 className="text-2xl font-extrabold tracking-tight text-[#002144] sm:text-3xl">
          Overall Results
        </h2>

        <p className="text-sm leading-6 text-slate-500">Browse all recorded placements. Select Score Details on any ensemble to see individual caption scores.</p>
        <ResultsTable
          entries={overall}
          bands={bands}
          overallTies={overallTies}
          classTies={classTies}
          mode="overall"
          supabaseUrl={supabaseUrl}
        />
      </section>

      {classes.length > 0 && (
        <section id="classes" className="scroll-mt-28 space-y-7">
          <h2 className="text-2xl font-extrabold tracking-tight text-[#002144] sm:text-3xl">
            Class Results
          </h2>

          {classes.map((classification) => {
            const classEntries = entries
              .filter(
                (entry) =>
                  entry.classification === classification
              )
              .sort((a, b) =>
                sortEntries(
                  a,
                  b,
                  "class_placement",
                  bands
                )
              );

            return (
              <div key={classification} className="space-y-4">
                <h3 className="text-xl font-bold text-[#002144]">
                  Class {classification}
                </h3>

                <ResultsTable
                  entries={classEntries}
                  bands={bands}
                  overallTies={overallTies}
                  classTies={classTies}
                  mode="class"
                  supabaseUrl={supabaseUrl}
                />
              </div>
            );
          })}
        </section>
      )}

      <section id="details" className="scroll-mt-28 space-y-5">
        <h2 className="text-2xl font-extrabold tracking-tight text-[#002144] sm:text-3xl">
          Individual Score Breakdowns
        </h2>

        {overall.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-600">
            No published results are available for this round.
          </div>
        ) : (
          overall.map((entry) => {
            const band = bands.get(entry.band_id);

            return (
              <details
                key={entry.id}
                id={`details-${entry.id}`}
                className="group scroll-mt-28 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm open:border-[#861F41]/40"
              >
                <summary className="flex cursor-pointer list-none items-center gap-4 p-5 transition hover:bg-slate-50 marker:hidden">
                  {band && (
                    <BandLogo
                      name={band.name}
                      bandId={band.id}
                      logoPath={band.logo_path}
                      supabaseUrl={supabaseUrl}
                      size="medium"
                    />
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-[#002144]">
                      {band?.name ?? "Ensemble unavailable"}
                    </p>

                    <p className="mt-1 text-sm text-slate-600">
                      {entry.classification ?? "Unclassified"}
                      {" · "}
                      Total: {scoreText(entry.total_score)}
                    </p>
                  </div>

                  <span className="shrink-0 rounded-lg bg-[#861F41]/10 px-3 py-2 text-xs font-bold text-[#861F41] group-open:bg-[#861F41] group-open:text-white">
                    View breakdown
                  </span>
                </summary>

                <div className="space-y-5 border-t border-slate-100 p-6">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-slate-500">
                        Overall Place
                      </p>
                      <p className="mt-1 font-bold text-[#002144]">
                        {rankText(
                          entry.overall_placement,
                          entry.overall_placement !== null &&
                            (overallTies.get(
                              entry.overall_placement
                            ) ?? 0) > 1
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500">
                        Class Place
                      </p>
                      <p className="mt-1 font-bold text-[#002144]">
                        {rankText(
                          entry.class_placement,
                          entry.classification !== null &&
                            entry.class_placement !== null &&
                            (classTies.get(
                              `${entry.classification}:${entry.class_placement}`
                            ) ?? 0) > 1
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500">
                        Total Score
                      </p>
                      <p className="mt-1 font-bold tabular-nums text-[#002144]">
                        {scoreText(entry.total_score)}
                      </p>
                    </div>
                  </div>

                  {captions.length > 0 ? (
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full min-w-115 text-left text-sm">
                        <thead className="bg-[#002144] text-white">
                          <tr>
                            <th className="px-4 py-3">Caption</th>
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
                              <td className="px-4 py-3 font-medium text-[#002144]">
                                {caption.name}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums">
                                {scoreText(
                                  scores.get(
                                    `${entry.id}:${caption.id}`
                                  )
                                )}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums text-slate-500">
                                {scoreText(caption.max_score)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-600">
                      No caption breakdown has been recorded.
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
                      className="inline-block text-sm font-bold text-[#861F41] hover:underline"
                    >
                      View Band Profile &rarr;
                    </Link>
                  )}
                </div>
              </details>
            );
          })
        )}
      </section>

      <RecordCitation
        competition={competition.name}
        season={competition.season_year}
        round={round.name}
        path={canonical}
      />

      <section id="sources" className="scroll-mt-28 rounded-2xl border border-slate-200 bg-white p-7">
        <h2 className="text-2xl font-bold text-[#002144]">
          Sources &amp; Accuracy
        </h2>

        <p className="mt-3 text-sm leading-7 text-slate-600">
          Results are displayed as recorded in The Marching
          Archives. Historical scoring systems may differ
          between competitions. Missing values are shown
          as —, and (T) denotes a shared recorded placement.
        </p>

        {source && (
          <a
            href={source}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block font-bold text-[#861F41] hover:underline"
          >
            View Recorded Source &rarr;
          </a>
        )}
      </section>

      <Link
        href={competitionPublicUrl(competition.slug)}
        className="inline-block rounded-lg bg-[#002144] px-6 py-3 text-sm font-bold text-white"
      >
        &larr; Competition Profile
      </Link>
    </div>
  );
}

export default function PublicRoundResultsPage(props: Props) {
  return (
    <main className="min-h-screen bg-[#F4F6F9]">
      <Suspense
        fallback={
          <div
            role="status"
            className="mx-auto max-w-7xl px-6 py-10 text-sm text-slate-600"
          >
            Loading round results...
          </div>
        }
      >
        <RoundContent params={props.params} />
      </Suspense>
    </main>
  );
}
