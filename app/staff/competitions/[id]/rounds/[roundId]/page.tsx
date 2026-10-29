
import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN } from "@/lib/band-validation";
import { organizationClasses } from "@/lib/competition-config";
import ResultsScrollKeeper from "@/components/ResultsScrollKeeper";

import {
  addRoundEntry,
  addRoundCaption,
  updateRoundCaption,
  saveEntryResults,
  removeRoundEntry,
} from "@/app/staff/competitions/results-actions";

export const instant = false;

type Props = {
  params: Promise<{
    id: string;
    roundId: string;
  }>;
  searchParams: Promise<{
    band_q?: string;
    message?: string;
  }>;
};

const inputClass =
  "mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-[#002144]";

const messages: Record<string, string> = {
  added: "Band added to this round.",
  caption: "New scoring caption added.",
  caption_saved: "Caption settings updated.",
  saved: "Result and caption scores saved successfully.",
  removed:
    "Band removed from this round. Its band profile and other competition results were not changed.",
};

function displayScore(value: number | string | null) {
  if (value === null || value === undefined) {
    return "—";
  }

  return Number(value).toFixed(3);
}

async function ResultsContent({
  params,
  searchParams,
}: Props) {
  const { id, roundId } = await params;
  const filters = await searchParams;

  if (
    !UUID_PATTERN.test(id) ||
    !UUID_PATTERN.test(roundId)
  ) {
    notFound();
  }

  const supabase = await createClient();

  const { data: auth, error: authError } =
    await supabase.auth.getClaims();

  if (authError || !auth?.claims?.sub) {
    redirect("/staff/login");
  }

  const { data: staff } = await supabase
    .from("staff_members")
    .select("role, status")
    .eq("user_id", auth.claims.sub)
    .maybeSingle();

  if (
    staff?.status !== "active" ||
    !["owner", "admin", "editor"].includes(staff.role)
  ) {
    redirect("/staff/login?error=unauthorized");
  }

  const { data: competition, error: competitionError } =
    await supabase
      .from("competitions")
      .select(
        "id, name, season_year, organization_code, publication_status"
      )
      .eq("id", id)
      .maybeSingle();

  if (competitionError || !competition) {
    notFound();
  }

  const { data: round, error: roundError } =
    await supabase
      .from("competition_rounds")
      .select("id, name, class_scope")
      .eq("id", roundId)
      .eq("competition_id", id)
      .maybeSingle();

  if (roundError || !round) {
    notFound();
  }

  const isDraft =
    competition.publication_status === "draft";

  const classes = organizationClasses(
    competition.organization_code
  );

  const [
    { data: entries, error: entriesError },
    { data: captions, error: captionsError },
  ] = await Promise.all([
    supabase
      .from("competition_entries")
      .select(
        "id, band_id, classification, total_score, class_placement, overall_placement, notes"
      )
      .eq("round_id", roundId)
      .order("overall_placement", {
        ascending: true,
        nullsFirst: false,
      })
      .order("class_placement", {
        ascending: true,
        nullsFirst: false,
      })
      .limit(500),

    supabase
      .from("score_captions")
      .select(
        "id, name, max_score, multiplier, sort_order"
      )
      .eq("round_id", roundId)
      .order("sort_order", { ascending: true }),
  ]);

  if (entriesError || captionsError) {
    throw new Error("Unable to load round results.");
  }

  const entryIds = (entries ?? []).map(
    (entry) => entry.id
  );

  const bandIds = (entries ?? []).map(
    (entry) => entry.band_id
  );

  const [
    { data: enteredBands, error: bandsError },
    { data: captionScores, error: scoresError },
  ] = await Promise.all([
    bandIds.length
      ? supabase
          .from("bands")
          .select("id, name, slug")
          .in("id", bandIds)
      : Promise.resolve({
          data: [] as {
            id: string;
            name: string;
            slug: string;
          }[],
          error: null,
        }),

    entryIds.length
      ? supabase
          .from("caption_scores")
          .select("entry_id, caption_id, score")
          .in("entry_id", entryIds)
      : Promise.resolve({
          data: [] as {
            entry_id: string;
            caption_id: string;
            score: number;
          }[],
          error: null,
        }),
  ]);

  if (bandsError || scoresError) {
    throw new Error(
      "Unable to load band or score details."
    );
  }

  const bandMap = new Map(
    (enteredBands ?? []).map((band) => [
      band.id,
      band,
    ])
  );

  const scoreMap = new Map(
    (captionScores ?? []).map((score) => [
      `${score.entry_id}:${score.caption_id}`,
      score.score,
    ])
  );

  const bandSearch = (filters.band_q ?? "")
    .trim()
    .slice(0, 100);

  let bandsQuery = supabase
    .from("bands")
    .select("id, name")
    .order("name", { ascending: true })
    .limit(100);

  if (bandSearch) {
    bandsQuery = bandsQuery.ilike(
      "name",
      `%${bandSearch.replace(/[%_\\]/g, "\\$&")}%`
    );
  }

  const { data: searchedBands, error: searchError } =
    isDraft
      ? await bandsQuery
      : {
          data: [] as {
            id: string;
            name: string;
          }[],
          error: null,
        };

  if (searchError) {
    throw new Error("Unable to search bands.");
  }

  const enteredIds = new Set(bandIds);

  const availableBands = (searchedBands ?? []).filter(
    (band) => !enteredIds.has(band.id)
  );

  const overallCounts = new Map<number, number>();
  const classCounts = new Map<string, number>();

  for (const entry of entries ?? []) {
    if (entry.overall_placement !== null) {
      const rank = Number(entry.overall_placement);

      overallCounts.set(
        rank,
        (overallCounts.get(rank) ?? 0) + 1
      );
    }

    if (
      entry.classification &&
      entry.class_placement !== null
    ) {
      const key =
        `${entry.classification}:${entry.class_placement}`;

      classCounts.set(
        key,
        (classCounts.get(key) ?? 0) + 1
      );
    }
  }

  const resultRows = [...(entries ?? [])].sort(
    (a, b) => {
      if (
        a.overall_placement !== null &&
        b.overall_placement !== null
      ) {
        return (
          Number(a.overall_placement) -
          Number(b.overall_placement)
        );
      }

      if (a.overall_placement !== null) return -1;
      if (b.overall_placement !== null) return 1;

      if (
        a.total_score !== null &&
        b.total_score !== null
      ) {
        return (
          Number(b.total_score) -
          Number(a.total_score)
        );
      }

      return (
        bandMap.get(a.band_id)?.name ?? ""
      ).localeCompare(
        bandMap.get(b.band_id)?.name ?? ""
      );
    }
  );

  const message =
    filters.message && messages[filters.message]
      ? messages[filters.message]
      : null;

  return (
    <div
      data-results-editor
      className="mx-auto max-w-6xl space-y-10 px-5 py-10"
    >
      <ResultsScrollKeeper roundId={roundId} />

      <Link
        href={`/staff/competitions/${id}`}
        className="text-sm font-semibold text-[#861F41]"
      >
        &larr; Competition Details
      </Link>

      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
          {competition.organization_code} ·{" "}
          {competition.season_year}
        </p>

        <h1 className="mt-3 font-serif text-4xl font-bold text-[#002144]">
          {round.name}
        </h1>

        <p className="mt-2 text-slate-600">
          {competition.name}
        </p>

        <p className="mt-2 text-sm text-slate-500">
          {round.class_scope
            ? `Classification: ${round.class_scope}`
            : "All eligible classifications"}
        </p>
      </header>

      {message && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-900"
        >
          {message}
        </div>
      )}

      {!isDraft && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          Published competition results are read-only.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs uppercase tracking-wider text-slate-500">
            Bands Entered
          </p>
          <p className="mt-2 text-3xl font-bold text-[#002144]">
            {entries?.length ?? 0}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs uppercase tracking-wider text-slate-500">
            Scoring Captions
          </p>
          <p className="mt-2 text-3xl font-bold text-[#002144]">
            {captions?.length ?? 0}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs uppercase tracking-wider text-slate-500">
            Record Status
          </p>
          <p className="mt-2 text-xl font-bold text-[#002144]">
            {isDraft ? "Draft" : "Published"}
          </p>
        </div>
      </div>

      <section id="overview" className="scroll-mt-6 space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-[#002144]">
            Results Overview
          </h2>

          <p className="mt-2 text-sm text-slate-600">
            Quick reference for all entered performances.
            Select Edit to jump to a band's scoring form.
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[650px] text-left text-sm">
            <thead className="bg-[#002144] text-white">
              <tr>
                <th className="px-5 py-4">Overall</th>
                <th className="px-5 py-4">Ensemble</th>
                <th className="px-5 py-4">Class</th>
                <th className="px-5 py-4">Class Rank</th>
                <th className="px-5 py-4 text-right">
                  Score
                </th>
                <th className="px-5 py-4 text-right">
                  Edit
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {resultRows.map((entry) => {
                const band = bandMap.get(entry.band_id);

                const overallTie =
                  entry.overall_placement !== null &&
                  (overallCounts.get(
                    Number(entry.overall_placement)
                  ) ?? 0) > 1;

                const classTie =
                  entry.classification &&
                  entry.class_placement !== null &&
                  (classCounts.get(
                    `${entry.classification}:${entry.class_placement}`
                  ) ?? 0) > 1;

                return (
                  <tr
                    key={entry.id}
                    className="hover:bg-slate-50"
                  >
                    <td className="px-5 py-4 font-semibold text-[#002144]">
                      {entry.overall_placement ?? "—"}
                      {overallTie && (
                        <span className="ml-1 text-xs text-[#861F41]">
                          (T)
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4 font-semibold text-[#002144]">
                      {band?.name ?? "Unknown Band"}
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {entry.classification ?? "—"}
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {entry.class_placement ?? "—"}
                      {classTie && (
                        <span className="ml-1 text-xs text-[#861F41]">
                          (T)
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4 text-right font-bold tabular-nums text-[#002144]">
                      {displayScore(entry.total_score)}
                    </td>

                    <td className="px-5 py-4 text-right">
                      <a
                        href={`#entry-${entry.id}`}
                        className="font-semibold text-[#861F41] hover:underline"
                      >
                        Edit &darr;
                      </a>
                    </td>
                  </tr>
                );
              })}

              {resultRows.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-10 text-center text-slate-500"
                  >
                    No results have been entered yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-slate-500">
          (T) indicates a shared placement.
          The archive preserves entered rankings rather
          than calculating or adjusting them automatically.
        </p>
      </section>

      {/* Phase 8.5.2 — Round lineup management */}
      {isDraft && (
        <section
          id="lineup"
          className="scroll-mt-6 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-[#002144]">
                Manage Round Lineup
              </h2>

              <p className="mt-2 text-sm text-slate-600">
                Remove ensembles accidentally entered
                into this round. Any scores and placements
                recorded for that entry will also be deleted.
              </p>
            </div>

            <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-[#002144]">
              {resultRows.length} entered
            </span>
          </div>

          <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
            {resultRows.length > 0 ? (
              resultRows.map((entry) => {
                const band = bandMap.get(entry.band_id);
                const bandName =
                  band?.name ?? "Unknown Band";

                const hasResults =
                  entry.total_score !== null ||
                  entry.class_placement !== null ||
                  entry.overall_placement !== null ||
                  (captionScores ?? []).some(
                    (score) =>
                      score.entry_id === entry.id
                  );

                return (
                  <div key={entry.id} className="p-5">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-bold text-[#002144]">
                          {bandName}
                        </p>

                        <p className="mt-1 text-xs text-slate-600">
                          {entry.classification ??
                            "Unclassified"}
                          {hasResults
                            ? " · Recorded results will be deleted"
                            : " · No recorded scores or placements"}
                        </p>
                      </div>

                      <details className="w-full sm:w-auto">
                        <summary className="inline-flex cursor-pointer list-none items-center rounded-lg border border-red-300 bg-white px-4 py-2.5 text-sm font-bold text-red-800 hover:bg-red-50">
                          Remove from Round
                        </summary>

                        <form
                          action={removeRoundEntry}
                          className="mt-3 w-full space-y-3 rounded-xl border border-red-200 bg-red-50 p-4 sm:w-96"
                        >
                          <input
                            type="hidden"
                            name="competition_id"
                            value={id}
                          />
                          <input
                            type="hidden"
                            name="round_id"
                            value={roundId}
                          />
                          <input
                            type="hidden"
                            name="entry_id"
                            value={entry.id}
                          />

                          <p className="text-sm font-bold text-red-900">
                            Remove {bandName} from{" "}
                            {round.name}?
                          </p>

                          <p className="text-xs leading-6 text-red-900">
                            The band remains in the TMA
                            directory and other rounds.
                            Scores, placements, notes, and
                            caption scores associated with
                            this round entry will be
                            permanently deleted.
                          </p>

                          <label className="block text-xs font-bold text-red-900">
                            Type REMOVE to confirm

                            <input
                              name="confirm_remove"
                              type="text"
                              required
                              pattern="REMOVE"
                              autoComplete="off"
                              placeholder="REMOVE"
                              className="mt-2 block w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-sm text-[#002144]"
                            />
                          </label>

                          <button
                            type="submit"
                            className="cursor-pointer rounded-lg bg-red-800 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-900"
                          >
                            Confirm Removal
                          </button>
                        </form>
                      </details>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="p-6 text-sm text-slate-600">
                There are no bands in this round yet.
              </p>
            )}
          </div>
        </section>
      )}

      {isDraft && (
        <section
          id="add-band"
          className="scroll-mt-6 space-y-5"
        >
          <h2 className="text-2xl font-bold text-[#002144]">
            Add a Band or Corps
          </h2>

          <form
            method="get"
            className="rounded-xl border border-slate-200 bg-white p-5"
          >
            <label className="block text-sm font-semibold text-[#002144]">
              Search Band Database

              <div className="mt-2 flex flex-wrap gap-3">
                <input
                  name="band_q"
                  type="search"
                  defaultValue={bandSearch}
                  placeholder="Search by ensemble name..."
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 px-4 py-3"
                />

                <button
                  type="submit"
                  className="rounded-lg bg-[#002144] px-5 py-3 font-semibold text-white"
                >
                  Search
                </button>
              </div>
            </label>
          </form>

          <form
            action={addRoundEntry}
            className="grid gap-5 rounded-xl border border-slate-200 bg-white p-6 md:grid-cols-2"
          >
            <input
              type="hidden"
              name="competition_id"
              value={id}
            />
            <input
              type="hidden"
              name="round_id"
              value={roundId}
            />

            <label className="block text-sm font-semibold text-[#002144]">
              Band / Corps *

              <select
                name="band_id"
                required
                defaultValue=""
                key={bandSearch}
                className={inputClass}
              >
                <option value="">
                  Choose an ensemble
                </option>

                {availableBands.map((band) => (
                  <option
                    key={band.id}
                    value={band.id}
                  >
                    {band.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-semibold text-[#002144]">
              Competition Classification

              <select
                name="classification"
                defaultValue={round.class_scope ?? ""}
                className={inputClass}
              >
                <option value="">
                  Unclassified / Exhibition
                </option>

                {classes.map((classification) => (
                  <option
                    key={classification}
                    value={classification}
                  >
                    {classification}
                  </option>
                ))}
              </select>
            </label>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={!availableBands.length}
                className="rounded-lg bg-[#861F41] px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                + Add to Round
              </button>

              <p className="mt-3 text-xs text-slate-500">
                Up to 100 matching unentered bands
                are displayed.
              </p>

              <Link
                href="/staff/bands/new"
                className="mt-2 inline-block text-sm font-semibold text-[#861F41]"
              >
                Create a New Band Profile &rarr;
              </Link>
            </div>
          </form>
        </section>
      )}

      <section
        id="captions"
        className="scroll-mt-6 space-y-5"
      >
        <div>
          <h2 className="text-2xl font-bold text-[#002144]">
            Caption Management
          </h2>

          <p className="mt-2 text-sm text-slate-600">
            Define and edit scoring captions for this
            round. Enter values documented by the
            historical source.
          </p>
        </div>

        {captions?.length ? (
          <div className="space-y-3">
            {captions.map((caption) => (
              <form
                id={`caption-${caption.id}`}
                key={caption.id}
                action={updateRoundCaption}
                className="scroll-mt-6 grid gap-4 rounded-xl border border-slate-200 bg-white p-5 md:grid-cols-[2fr_1fr_1fr_auto] md:items-end"
              >
                <input
                  type="hidden"
                  name="competition_id"
                  value={id}
                />
                <input
                  type="hidden"
                  name="round_id"
                  value={roundId}
                />
                <input
                  type="hidden"
                  name="caption_id"
                  value={caption.id}
                />

                <label className="text-sm font-semibold text-[#002144]">
                  Caption

                  <input
                    name="name"
                    required
                    maxLength={100}
                    defaultValue={caption.name}
                    disabled={!isDraft}
                    className={inputClass}
                  />
                </label>

                <label className="text-sm font-semibold text-[#002144]">
                  Maximum

                  <input
                    name="max_score"
                    type="number"
                    min="0.0001"
                    max="999999"
                    step="0.0001"
                    required
                    defaultValue={caption.max_score}
                    disabled={!isDraft}
                    className={inputClass}
                  />
                </label>

                <label className="text-sm font-semibold text-[#002144]">
                  Multiplier

                  <input
                    name="multiplier"
                    type="number"
                    min="0"
                    max="999999"
                    step="0.0001"
                    required
                    defaultValue={caption.multiplier}
                    disabled={!isDraft}
                    className={inputClass}
                  />
                </label>

                {isDraft && (
                  <button
                    type="submit"
                    className="rounded-lg bg-[#002144] px-5 py-2.5 text-sm font-bold text-white"
                  >
                    Save Caption
                  </button>
                )}
              </form>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            No captions have been configured.
          </div>
        )}

        {isDraft && (
          <form
            action={addRoundCaption}
            className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 md:grid-cols-3"
          >
            <input
              type="hidden"
              name="competition_id"
              value={id}
            />
            <input
              type="hidden"
              name="round_id"
              value={roundId}
            />

            <label className="text-sm font-semibold text-[#002144]">
              New Caption Name *

              <input
                name="name"
                required
                maxLength={100}
                placeholder="Example: Music"
                className={inputClass}
              />
            </label>

            <label className="text-sm font-semibold text-[#002144]">
              Maximum Score *

              <input
                name="max_score"
                type="number"
                min="0.0001"
                max="999999"
                step="0.0001"
                defaultValue="100"
                required
                className={inputClass}
              />
            </label>

            <label className="text-sm font-semibold text-[#002144]">
              Multiplier *

              <input
                name="multiplier"
                type="number"
                min="0"
                max="999999"
                step="0.0001"
                defaultValue="1"
                required
                className={inputClass}
              />
            </label>

            <div className="md:col-span-3">
              <button
                type="submit"
                className="rounded-lg bg-[#002144] px-6 py-3 text-sm font-bold text-white"
              >
                + Add Scoring Caption
              </button>
            </div>
          </form>
        )}
      </section>

      <section
        id="results"
        className="scroll-mt-6 space-y-5"
      >
        <div>
          <h2 className="text-2xl font-bold text-[#002144]">
            Individual Results
          </h2>

          <p className="mt-2 text-sm text-slate-600">
            Edit one performance at a time. Unknown
            scores and placements may be left blank.
          </p>
        </div>

        {resultRows.length ? (
          <div className="space-y-5">
            {resultRows.map((entry) => {
              const band = bandMap.get(entry.band_id);

              const overallTie =
                entry.overall_placement !== null &&
                (overallCounts.get(
                  Number(entry.overall_placement)
                ) ?? 0) > 1;

              return (
                <form
                  id={`entry-${entry.id}`}
                  key={entry.id}
                  action={saveEntryResults}
                  className="scroll-mt-6 space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <input
                    type="hidden"
                    name="competition_id"
                    value={id}
                  />
                  <input
                    type="hidden"
                    name="round_id"
                    value={roundId}
                  />
                  <input
                    type="hidden"
                    name="entry_id"
                    value={entry.id}
                  />

                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="text-xl font-bold text-[#002144]">
                        {band?.name ?? "Unknown Band"}
                      </h3>

                      {band?.slug && (
                        <Link
                          href={`/bands/${band.slug}`}
                          className="mt-2 inline-block text-xs font-semibold text-[#861F41]"
                        >
                          View Band Profile &rarr;
                        </Link>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {entry.overall_placement !== null && (
                        <span className="rounded-full bg-[#002144] px-4 py-2 text-xs font-bold text-white">
                          {overallTie ? "Tied " : ""}
                          #{entry.overall_placement} Overall
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-4">
                    <label className="text-sm font-semibold text-[#002144]">
                      Classification

                      <select
                        name="classification"
                        defaultValue={
                          entry.classification ?? ""
                        }
                        disabled={!isDraft}
                        className={inputClass}
                      >
                        <option value="">
                          Unclassified
                        </option>

                        {classes.map((classification) => (
                          <option
                            key={classification}
                            value={classification}
                          >
                            {classification}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="text-sm font-semibold text-[#002144]">
                      Total Score

                      <input
                        name="total_score"
                        type="number"
                        min="0"
                        max="999999"
                        step="0.0001"
                        defaultValue={
                          entry.total_score ?? ""
                        }
                        disabled={!isDraft}
                        className={inputClass}
                      />
                    </label>

                    <label className="text-sm font-semibold text-[#002144]">
                      Class Placement

                      <input
                        name="class_placement"
                        type="number"
                        min="1"
                        step="1"
                        defaultValue={
                          entry.class_placement ?? ""
                        }
                        disabled={!isDraft}
                        className={inputClass}
                      />
                    </label>

                    <label className="text-sm font-semibold text-[#002144]">
                      Overall Placement

                      <input
                        name="overall_placement"
                        type="number"
                        min="1"
                        step="1"
                        defaultValue={
                          entry.overall_placement ?? ""
                        }
                        disabled={!isDraft}
                        className={inputClass}
                      />
                    </label>
                  </div>

                  {!!captions?.length && (
                    <div>
                      <h4 className="mb-3 text-sm font-bold text-[#002144]">
                        Caption Scores
                      </h4>

                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {captions.map((caption) => (
                          <label
                            key={caption.id}
                            className="text-sm font-semibold text-[#002144]"
                          >
                            {caption.name}

                            <input
                              name={`caption_${caption.id}`}
                              type="number"
                              min="0"
                              max={caption.max_score}
                              step="0.0001"
                              disabled={!isDraft}
                              defaultValue={
                                scoreMap.get(
                                  `${entry.id}:${caption.id}`
                                ) ?? ""
                              }
                              className={inputClass}
                            />

                            <span className="mt-1 block text-xs font-normal text-slate-500">
                              Max: {caption.max_score}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <label className="block text-sm font-semibold text-[#002144]">
                    Result Notes

                    <textarea
                      name="notes"
                      rows={2}
                      maxLength={5000}
                      defaultValue={entry.notes ?? ""}
                      disabled={!isDraft}
                      placeholder="Historical notes, ties, penalties, or exceptions..."
                      className={inputClass}
                    />
                  </label>

                  {isDraft && (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <button
                        type="submit"
                        className="rounded-lg bg-[#861F41] px-6 py-3 text-sm font-bold text-white hover:bg-[#701832]"
                      >
                        Save Result
                      </button>

                      <a
                        href="#overview"
                        className="text-sm font-semibold text-[#861F41]"
                      >
                        Back to Results Overview &uarr;
                      </a>
                    </div>
                  )}
                </form>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-600">
            There are no bands in this round yet.
          </div>
        )}

        <p className="text-xs text-slate-500">
          Showing up to 500 entries. For large
          competitions, use the existing Round Tools
          page for bulk results management.
        </p>
      </section>
    </div>
  );
}

export default function RoundResultsPage(props: Props) {
  return (
    <main className="min-h-screen bg-[#F4F6F9]">
      <Suspense
        fallback={
          <div
            role="status"
            className="mx-auto max-w-6xl px-5 py-10 text-sm text-slate-600"
          >
            Loading round results...
          </div>
        }
      >
        <ResultsContent {...props} />
      </Suspense>
    </main>
  );
}
