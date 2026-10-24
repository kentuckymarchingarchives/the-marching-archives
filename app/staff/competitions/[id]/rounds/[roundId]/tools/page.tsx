
import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN } from "@/lib/band-validation";

import BulkResultsImport from "@/components/BulkResultsImport";

import {
  deleteRoundResult,
  calculateRoundResults,
} from "@/app/staff/competitions/tools-actions";

export const instant = false;

type Props = {
  params: Promise<{
    id: string;
    roundId: string;
  }>;
  searchParams: Promise<{
    message?: string;
  }>;
};

const messages: Record<string, string> = {
  deleted: "Result entry deleted successfully.",
  imported: "CSV results imported successfully.",
  calculated: "Missing total scores calculated.",
  ranked: "Placements recalculated from recorded totals.",
};

async function ToolsContent({
  params,
  searchParams,
}: Props) {
  const { id, roundId } = await params;
  const { message } = await searchParams;

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

  const { data: staff, error: staffError } =
    await supabase
      .from("staff_members")
      .select("role, status")
      .eq("user_id", auth.claims.sub)
      .maybeSingle();

  if (
    staffError ||
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
      .select("id, name")
      .eq("id", roundId)
      .eq("competition_id", id)
      .maybeSingle();

  if (roundError || !round) {
    notFound();
  }

  const { data: entries, error: entriesError } =
    await supabase
      .from("competition_entries")
      .select(
        "id, band_id, classification, total_score, overall_placement"
      )
      .eq("round_id", roundId)
      .order("overall_placement", {
        ascending: true,
        nullsFirst: false,
      })
      .limit(500);

  if (entriesError) {
    throw new Error("Unable to load entries.");
  }

  const bandIds = (entries ?? []).map(
    (entry) => entry.band_id
  );

  const { data: bands, error: bandsError } =
    bandIds.length
      ? await supabase
          .from("bands")
          .select("id, name")
          .in("id", bandIds)
      : {
          data: [] as {
            id: string;
            name: string;
          }[],
          error: null,
        };

  if (bandsError) {
    throw new Error("Unable to load band names.");
  }

  const names = new Map(
    (bands ?? []).map((band) => [
      band.id,
      band.name,
    ])
  );

  const draft =
    competition.publication_status === "draft";

  const messageText =
    message && messages[message]
      ? messages[message]
      : null;

  const scoredCount = (entries ?? []).filter(
    (entry) => entry.total_score !== null
  ).length;

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-6 py-10">
      <Link
        href={`/staff/competitions/${id}/rounds/${roundId}`}
        className="text-sm font-semibold text-[#861F41]"
      >
        ← Back to Round Results
      </Link>

      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
          {competition.organization_code} ·{" "}
          {competition.season_year}
        </p>

        <h1 className="mt-3 font-serif text-4xl font-bold text-[#002144]">
          Results Tools
        </h1>

        <p className="mt-3 text-slate-600">
          {competition.name} — {round.name}
        </p>
      </header>

      {messageText && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm font-semibold text-emerald-900"
        >
          {messageText}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs uppercase tracking-wider text-slate-500">
            Round Entries
          </p>
          <p className="mt-2 text-3xl font-bold text-[#002144]">
            {entries?.length ?? 0}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs uppercase tracking-wider text-slate-500">
            With Total Scores
          </p>
          <p className="mt-2 text-3xl font-bold text-[#002144]">
            {scoredCount}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs uppercase tracking-wider text-slate-500">
            Status
          </p>
          <p className="mt-2 text-xl font-bold text-[#002144]">
            {draft ? "Draft" : "Published"}
          </p>
        </div>
      </div>

      {!draft && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          These tools are disabled because this competition
          is published. Results must not be changed
          through the draft editor.
        </div>
      )}

      {draft && (
        <>
          <section
            id="import"
            className="scroll-mt-6 space-y-5"
          >
            <h2 className="text-2xl font-bold text-[#002144]">
              1. Bulk Import
            </h2>

            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <BulkResultsImport
                competitionId={id}
                roundId={roundId}
              />
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
              <p className="font-bold text-[#002144]">
                Required CSV column order
              </p>

              <code className="mt-3 block overflow-x-auto rounded-lg bg-white p-3 text-xs text-[#002144]">
                band_slug,classification,total_score,class_placement,overall_placement,notes
              </code>

              <p className="mt-3 leading-6">
                Empty cells mean unknown values. When importing
                a band that is already in this round, those
                empty cells will clear the corresponding
                existing fields. Caption scores are preserved.
              </p>
            </div>
          </section>

          <section
            id="automatic"
            className="scroll-mt-6 space-y-5"
          >
            <h2 className="text-2xl font-bold text-[#002144]">
              2. Automatic Calculations
            </h2>

            <div className="grid gap-5 lg:grid-cols-2">
              <form
                action={calculateRoundResults}
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
                  name="mode"
                  value="missing_totals"
                />

                <h3 className="text-xl font-bold text-[#002144]">
                  Calculate Missing Totals
                </h3>

                <p className="text-sm leading-7 text-slate-600">
                  Calculate the sum of each caption score
                  multiplied by its configured multiplier.
                  Only entries with every caption present
                  and no existing total will be updated.
                </p>

                <p className="text-sm font-semibold text-[#861F41]">
                  This does not automatically account for
                  penalties, averaging, dropped judges,
                  or historical scoring exceptions.
                </p>

                <label className="flex items-start gap-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name="confirm_calculate"
                    value="yes"
                    required
                    className="mt-1"
                  />
                  <span>
                    I verified that the weighted caption
                    sum is the correct total formula
                    for this round.
                  </span>
                </label>

                <button
                  type="submit"
                  className="rounded-lg bg-[#002144] px-6 py-3 text-sm font-bold text-white"
                >
                  Calculate Missing Totals
                </button>
              </form>

              <form
                action={calculateRoundResults}
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
                  name="mode"
                  value="placements"
                />

                <h3 className="text-xl font-bold text-[#002144]">
                  Calculate Placements
                </h3>

                <p className="text-sm leading-7 text-slate-600">
                  Rank scored entries from highest total
                  to lowest. Matching scores receive the
                  same rank, and the next rank skips
                  the occupied positions.
                </p>

                <p className="text-sm font-semibold text-[#861F41]">
                  This replaces existing overall and
                  class placements for scored entries.
                  Unscored entries are left unchanged.
                </p>

                <label className="flex items-start gap-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name="confirm_calculate"
                    value="yes"
                    required
                    className="mt-1"
                  />
                  <span>
                    I verified that score-based ranking
                    and shared ranks are appropriate
                    for this round.
                  </span>
                </label>

                <button
                  type="submit"
                  className="rounded-lg bg-[#861F41] px-6 py-3 text-sm font-bold text-white"
                >
                  Calculate Placements
                </button>
              </form>
            </div>
          </section>

          <section
            id="delete"
            className="scroll-mt-6 space-y-5"
          >
            <div>
              <h2 className="text-2xl font-bold text-[#002144]">
                3. Delete Round Entries
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Remove an incorrect or duplicate performance
                from this specific round. The band's main
                archive profile and entries in other
                competition rounds are unaffected.
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {entries?.length ? (
                entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex flex-wrap items-center justify-between gap-5 border-b border-slate-100 p-5"
                  >
                    <div>
                      <p className="font-bold text-[#002144]">
                        {names.get(entry.band_id) ??
                          "Unknown Band"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {entry.classification ?? "Unclassified"}
                        {" · "}
                        Score: {entry.total_score ?? "Unknown"}
                        {" · "}
                        Overall: {entry.overall_placement ?? "—"}
                      </p>
                    </div>

                    <form
                      action={deleteRoundResult}
                      className="flex flex-wrap items-center gap-2"
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

                      <label className="text-xs font-semibold text-red-800">
                        Type DELETE to confirm
                        <input
                          name="confirm_delete"
                          required
                          pattern="DELETE"
                          autoComplete="off"
                          placeholder="DELETE"
                          className="mt-1 block w-28 rounded-lg border border-red-200 px-3 py-2 text-sm"
                        />
                      </label>

                      <button
                        type="submit"
                        className="self-end rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-bold text-red-800 hover:bg-red-100"
                      >
                        Delete Entry
                      </button>
                    </form>
                  </div>
                ))
              ) : (
                <p className="p-7 text-sm text-slate-600">
                  No entries to delete.
                </p>
              )}
            </div>

            <p className="text-xs text-slate-500">
              Showing up to 500 entries. Deletions
              are immediate and cannot be undone
              through this interface.
            </p>
          </section>
        </>
      )}
    </div>
  );
}

export default function ResultsToolsPage(props: Props) {
  return (
    <main className="min-h-screen bg-[#F4F6F9]">
      <Suspense
        fallback={
          <div
            role="status"
            className="p-10 text-sm text-slate-600"
          >
            Loading results tools...
          </div>
        }
      >
        <ToolsContent {...props} />
      </Suspense>
    </main>
  );
}
