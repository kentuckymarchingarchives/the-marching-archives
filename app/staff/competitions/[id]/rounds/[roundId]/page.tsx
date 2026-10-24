
import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN } from "@/lib/band-validation";
import { organizationClasses } from "@/lib/competition-config";

import {
  addRoundEntry,
  addRoundCaption,
  saveEntryResults,
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

const successMessages: Record<string, string> = {
  added: "Band added to this round.",
  caption: "Caption created successfully.",
  saved: "Result changes saved.",
};

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
      .select("id, name, round_kind, class_scope")
      .eq("id", roundId)
      .eq("competition_id", id)
      .maybeSingle();

  if (roundError || !round) {
    notFound();
  }

  const classes = organizationClasses(
    competition.organization_code
  );

  const isDraft =
    competition.publication_status === "draft";

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

  const entryIds = (entries ?? []).map((entry) => entry.id);
  const bandIds = (entries ?? []).map((entry) => entry.band_id);

  const [
    { data: enteredBands, error: bandNamesError },
    { data: scoreRows, error: scoresError },
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

  if (bandNamesError || scoresError) {
    throw new Error("Unable to load band names or caption scores.");
  }

  const bandNames = new Map(
    (enteredBands ?? []).map((band) => [
      band.id,
      band,
    ])
  );

  const scores = new Map(
    (scoreRows ?? []).map((score) => [
      `${score.entry_id}:${score.caption_id}`,
      score.score,
    ])
  );

  const bandSearch = (filters.band_q ?? "")
    .trim()
    .slice(0, 100);

  let bandsQuery = supabase
    .from("bands")
    .select("id, name, kind")
    .order("name", { ascending: true })
    .limit(100);

  if (bandSearch) {
    bandsQuery = bandsQuery.ilike(
      "name",
      `%${bandSearch.replace(/[%_\\]/g, "\\$&")}%`
    );
  }

  const { data: availableBands, error: availableError } =
    isDraft
      ? await bandsQuery
      : {
          data: [] as {
            id: string;
            name: string;
            kind: string;
          }[],
          error: null,
        };

  if (availableError) {
    throw new Error("Unable to search available bands.");
  }

  const enteredBandIds = new Set(bandIds);

  const options = (availableBands ?? []).filter(
    (band) => !enteredBandIds.has(band.id)
  );

  const message =
    filters.message &&
    successMessages[filters.message]
      ? successMessages[filters.message]
      : null;

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-5 py-10">
      <Link
        href={`/staff/competitions/${id}`}
        className="text-sm font-semibold text-[#861F41]"
      >
        ← Competition Details
      </Link>

      <div>
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

        <p className="mt-3 text-sm text-slate-500">
          {round.class_scope
            ? `Class restricted to ${round.class_scope}`
            : "Open to all eligible classifications"}
        </p>
      </div>

      {message && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900"
        >
          {message}
        </div>
      )}

      {!isDraft && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          This competition is published. Its results
          are locked against changes in this editor.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs uppercase tracking-wider text-slate-500">
            Entered Bands
          </p>
          <p className="mt-2 text-3xl font-bold text-[#002144]">
            {entries?.length ?? 0}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs uppercase tracking-wider text-slate-500">
            Captions
          </p>
          <p className="mt-2 text-3xl font-bold text-[#002144]">
            {captions?.length ?? 0}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs uppercase tracking-wider text-slate-500">
            Publication
          </p>
          <p className="mt-2 text-lg font-bold text-[#002144]">
            {isDraft ? "Draft" : "Published"}
          </p>
        </div>
      </div>

      {isDraft && (
        <section className="space-y-5">
          <h2 className="text-2xl font-bold text-[#002144]">
            Add a Band or Corps
          </h2>

          <form
            method="get"
            className="rounded-xl border border-slate-200 bg-white p-5"
          >
            <label className="text-sm font-semibold text-[#002144]">
              Find a Band
              <div className="mt-2 flex flex-wrap gap-3">
                <input
                  type="search"
                  name="band_q"
                  defaultValue={bandSearch}
                  placeholder="Search the band database..."
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 px-4 py-3"
                />

                <button
                  type="submit"
                  className="rounded-lg bg-[#002144] px-5 py-3 font-semibold text-white"
                >
                  Find Band
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
                key={bandSearch}
                defaultValue=""
                className={inputClass}
              >
                <option value="">Select a band</option>
                {options.map((band) => (
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
              Competition Class
              <select
                name="classification"
                defaultValue={round.class_scope ?? ""}
                className={inputClass}
              >
                <option value="">
                  Unclassified / Exhibition
                </option>

                {classes.map((className) => (
                  <option
                    key={className}
                    value={className}
                  >
                    {className}
                  </option>
                ))}
              </select>
            </label>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={options.length === 0}
                className="rounded-lg bg-[#861F41] px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                + Add to Round
              </button>

              <p className="mt-3 text-xs text-slate-500">
                Showing up to 100 matching, unentered bands.
                If a band is missing, search its name above
                or create its profile in Band Management.
              </p>

              <Link
                href="/staff/bands/new"
                className="mt-2 inline-block text-sm font-semibold text-[#861F41]"
              >
                Create a New Band Profile →
              </Link>
            </div>
          </form>
        </section>
      )}

      <section className="space-y-5">
        <h2 className="text-2xl font-bold text-[#002144]">
          Scoring Captions
        </h2>

        <p className="text-sm leading-6 text-slate-600">
          Define only captions documented by the
          official scoring source. Each round has
          independent caption definitions.
        </p>

        {captions?.length ? (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {captions.map((caption) => (
              <div
                key={caption.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"
              >
                <p className="font-semibold text-[#002144]">
                  {caption.name}
                </p>

                <p className="text-xs text-slate-500">
                  Max {caption.max_score} · Multiplier{" "}
                  {caption.multiplier}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            No captions have been defined yet.
            You can still enter total scores.
          </p>
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
              Caption Name *
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
                required
                defaultValue="100"
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
                required
                defaultValue="1"
                className={inputClass}
              />
            </label>

            <div className="md:col-span-3">
              <button
                type="submit"
                className="rounded-lg bg-[#002144] px-6 py-3 text-sm font-bold text-white"
              >
                + Add Caption
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="space-y-5">
        <h2 className="text-2xl font-bold text-[#002144]">
          Round Results
        </h2>

        <p className="text-sm leading-6 text-slate-600">
          Enter officially documented totals and placements.
          Leave unknown values blank rather than guessing.
        </p>

        {entries?.length ? (
          <div className="space-y-5">
            {entries.map((entry) => {
              const band = bandNames.get(entry.band_id);

              return (
                <form
                  key={entry.id}
                  action={saveEntryResults}
                  className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6"
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

                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="text-xl font-bold text-[#002144]">
                        {band?.name ?? "Unknown Band"}
                      </h3>

                      {band?.slug && (
                        <Link
                          href={`/bands/${band.slug}`}
                          className="mt-1 inline-block text-xs font-semibold text-[#861F41]"
                        >
                          View Band Profile →
                        </Link>
                      )}
                    </div>

                    {entry.overall_placement && (
                      <span className="rounded-full bg-[#002144] px-4 py-2 text-xs font-bold text-white">
                        Overall #{entry.overall_placement}
                      </span>
                    )}
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
                        {classes.map((className) => (
                          <option
                            key={className}
                            value={className}
                          >
                            {className}
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
                        disabled={!isDraft}
                        defaultValue={
                          entry.total_score ?? ""
                        }
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
                        disabled={!isDraft}
                        defaultValue={
                          entry.class_placement ?? ""
                        }
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
                        disabled={!isDraft}
                        defaultValue={
                          entry.overall_placement ?? ""
                        }
                        className={inputClass}
                      />
                    </label>
                  </div>

                  {captions && captions.length > 0 && (
                    <div>
                      <h4 className="mb-3 text-sm font-bold text-[#002144]">
                        Caption Breakdown
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
                                scores.get(
                                  `${entry.id}:${caption.id}`
                                ) ?? ""
                              }
                              className={inputClass}
                            />

                            <span className="mt-1 block text-xs font-normal text-slate-500">
                              Maximum: {caption.max_score}
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
                      disabled={!isDraft}
                      defaultValue={entry.notes ?? ""}
                      placeholder="Ties, penalties, disqualifications, or historical notes..."
                      className={inputClass}
                    />
                  </label>

                  {isDraft && (
                    <button
                      type="submit"
                      className="rounded-lg bg-[#861F41] px-6 py-3 text-sm font-bold text-white hover:bg-[#701832]"
                    >
                      Save Result
                    </button>
                  )}
                </form>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-600">
            No bands have been entered in this round yet.
          </div>
        )}

        <p className="text-xs text-slate-500">
          Showing up to 500 round entries.
          Larger archival records will require pagination.
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
