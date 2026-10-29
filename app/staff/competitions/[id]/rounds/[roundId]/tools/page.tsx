
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
  deleted: "Round entry deleted successfully.",
  imported: "CSV results imported successfully.",
  calculated: "Missing total scores calculated.",
  ranked: "Placements recalculated from recorded totals.",
};

type Entry = {
  id: string;
  band_id: string;
  classification: string | null;
  total_score: number | string | null;
  overall_placement: number | null;
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
        "id, name, season_year, organization_code, publication_status, archived_at"
      )
      .eq("id", id)
      .maybeSingle();

  const { data: round, error: roundError } =
    await supabase
      .from("competition_rounds")
      .select("id, name, archived_at")
      .eq("id", roundId)
      .eq("competition_id", id)
      .maybeSingle();

  if (
    competitionError ||
    roundError ||
    !competition ||
    !round
  ) {
    notFound();
  }

  const [
    entriesResponse,
    formulaResponse,
  ] = await Promise.all([
    supabase
      .from("competition_entries")
      .select(
        "id, band_id, classification, total_score, overall_placement",
        { count: "exact" }
      )
      .eq("round_id", roundId)
      .order("overall_placement", {
        ascending: true,
        nullsFirst: false,
      })
      .limit(500),

    supabase
      .from("round_scoring_formulas")
      .select("method, penalty")
      .eq("round_id", roundId)
      .maybeSingle(),
  ]);

  if (entriesResponse.error || formulaResponse.error) {
    throw new Error(
      "Unable to load round tools or scoring formula."
    );
  }

  const entries =
    (entriesResponse.data ?? []) as Entry[];

  const incomplete =
    (entriesResponse.count ?? 0) > entries.length;

  const bandIds = [
    ...new Set(entries.map((entry) => entry.band_id)),
  ];

  const bandNames = new Map<string, string>();

  for (let i = 0; i < bandIds.length; i += 75) {
    const { data, error } = await supabase
      .from("bands")
      .select("id, name")
      .in("id", bandIds.slice(i, i + 75));

    if (error) {
      throw new Error(
        "Unable to load participating band names."
      );
    }

    for (const band of data ?? []) {
      bandNames.set(band.id, band.name);
    }
  }

  const draft =
    competition.publication_status === "draft" &&
    !competition.archived_at &&
    !round.archived_at;

  const method =
    formulaResponse.data?.method ?? "weighted_sum";

  const penalty = Number(
    formulaResponse.data?.penalty ?? 0
  );

  const compatibleTotals =
    method === "weighted_sum" &&
    Number.isFinite(penalty) &&
    penalty === 0;

  const spreadsheetPath =
    `/staff/competitions/${id}` +
    `/rounds/${roundId}/spreadsheet`;

  const formulaPath =
    `/staff/competitions/${id}` +
    `/rounds/${roundId}/formula`;

  const basePath =
    `/staff/competitions/${id}` +
    `/rounds/${roundId}`;

  const scoredCount = entries.filter(
    (entry) => entry.total_score !== null
  ).length;

  const messageText =
    message && messages[message]
      ? messages[message]
      : null;

  return (
    <main className="min-h-screen bg-[#F4F6F9]">
      <div className="mx-auto max-w-6xl space-y-9 px-6 py-10">
        <Link
          href={basePath}
          className="text-sm font-bold text-[#861F41] hover:underline"
        >
          &larr; Back to Round Results
        </Link>

        <header>
          <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
            {competition.organization_code}
            {" · "}
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

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            {
              label: "Round Entries",
              value: entriesResponse.count ?? entries.length,
            },
            {
              label: "Displayed Scored Entries",
              value: scoredCount,
            },
            {
              label: "Publication Status",
              value: draft ? "Draft" : "Read Only",
            },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-xl border border-slate-200 bg-white p-5"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {card.label}
              </p>

              <p className="mt-3 text-2xl font-bold text-[#002144]">
                {card.value}
              </p>
            </div>
          ))}
        </section>

        {incomplete && (
          <div
            role="alert"
            className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"
          >
            This round has more than 500 entries.
            The displayed list is partial, although
            the database calculations may operate
            on more entries than are shown here.
          </div>
        )}

        {!draft && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            This competition is published or archived.
            Result-changing tools are disabled.
          </div>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
            Formula Compatibility
          </p>

          <h2 className="mt-2 text-xl font-bold text-[#002144]">
            Current Round Scoring
          </h2>

          <p className="mt-3 text-sm text-slate-600">
            Method:{" "}
            <strong>
              {method.replaceAll("_", " ")}
            </strong>
            {" · "}
            Deduction: <strong>{penalty}</strong>
          </p>

          {compatibleTotals ? (
            <p className="mt-3 text-sm leading-7 text-emerald-800">
              The saved formula is compatible with
              the original weighted-sum total calculator.
            </p>
          ) : (
            <p className="mt-3 text-sm leading-7 text-amber-900">
              This round uses an advanced formula.
              Calculate totals through the live
              spreadsheet so caption groups, averaging,
              and deductions are applied correctly.
            </p>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={spreadsheetPath}
              className="rounded-lg bg-[#861F41] px-5 py-3 text-sm font-bold text-white hover:bg-[#701832]"
            >
              Open Live Spreadsheet
            </Link>

            <Link
              href={formulaPath}
              className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-[#002144] hover:bg-slate-50"
            >
              Configure Formula
            </Link>
          </div>
        </section>

        {draft && (
          <>
            <section id="import" className="space-y-5">
              <h2 className="font-serif text-2xl font-bold text-[#002144]">
                1. Bulk CSV Import
              </h2>

              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <BulkResultsImport
                  competitionId={id}
                  roundId={roundId}
                />
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <p className="text-sm font-bold text-[#002144]">
                  Required CSV columns
                </p>

                <code className="mt-3 block overflow-x-auto rounded-lg bg-[#F4F6F9] p-3 text-xs">
                  band_slug,classification,total_score,class_placement,overall_placement,notes
                </code>

                <p className="mt-3 text-sm leading-7 text-slate-600">
                  CSV imports use recorded official
                  totals and placements. Blank imported
                  fields clear corresponding existing
                  fields for matching entries, while
                  caption scores are preserved.
                </p>
              </div>
            </section>

            <section
              id="automatic"
              className="space-y-5"
            >
              <h2 className="font-serif text-2xl font-bold text-[#002144]">
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
                    Fill missing totals using all
                    existing caption scores and their
                    multipliers. Existing totals are
                    preserved.
                  </p>

                  {!compatibleTotals && (
                    <p className="rounded-lg bg-amber-50 p-4 text-sm font-semibold text-amber-900">
                      Unavailable for this scoring formula.
                      Use the Live Spreadsheet.
                    </p>
                  )}

                  <label className="flex items-start gap-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      name="confirm_calculate"
                      value="yes"
                      required
                      disabled={!compatibleTotals}
                      className="mt-1"
                    />

                    <span>
                      I verified that weighted caption
                      summation is the correct total
                      calculation for this round.
                    </span>
                  </label>

                  <button
                    type="submit"
                    disabled={!compatibleTotals}
                    className="rounded-lg bg-[#002144] px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
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
                    Rank bands by their currently saved
                    total scores. This replaces recorded
                    class and overall placements for
                    scored entries. Unscored entries
                    are left unchanged.
                  </p>

                  <p className="text-sm font-semibold text-[#861F41]">
                    Verify that score-based ranking,
                    including tied placements, matches
                    the historical competition rules.
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
                      I understand that saved placements
                      may be replaced, and I have
                      verified the ranking rules.
                    </span>
                  </label>

                  <button
                    type="submit"
                    className="rounded-lg bg-[#861F41] px-5 py-3 text-sm font-bold text-white hover:bg-[#701832]"
                  >
                    Calculate Placements
                  </button>
                </form>
              </div>
            </section>

            <section id="delete" className="space-y-5">
              <h2 className="font-serif text-2xl font-bold text-[#002144]">
                3. Remove Incorrect Entries
              </h2>

              <p className="text-sm leading-7 text-slate-600">
                Removing an entry deletes its results
                from this round only. Its band profile
                and entries in other rounds remain intact.
              </p>

              <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex flex-wrap items-center justify-between gap-5 p-5"
                  >
                    <div>
                      <p className="font-bold text-[#002144]">
                        {bandNames.get(entry.band_id) ??
                          "Unknown Ensemble"}
                      </p>

                      <p className="mt-1 text-xs text-slate-600">
                        {entry.classification ??
                          "Unclassified"}
                        {" · "}
                        Score:{" "}
                        {entry.total_score ?? "Unknown"}
                        {" · "}
                        Overall:{" "}
                        {entry.overall_placement ?? "—"}
                      </p>
                    </div>

                    <form
                      action={deleteRoundResult}
                      className="flex flex-wrap items-end gap-2"
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
                        Type DELETE
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
                        className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-bold text-red-800 hover:bg-red-100"
                      >
                        Delete Entry
                      </button>
                    </form>
                  </div>
                ))}

                {entries.length === 0 && (
                  <p className="p-7 text-sm text-slate-600">
                    No entries are recorded for this round.
                  </p>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

export default function ResultsToolsPage(props: Props) {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#F4F6F9] p-10">
          <p
            role="status"
            className="text-sm text-slate-600"
          >
            Loading results tools...
          </p>
        </main>
      }
    >
      <ToolsContent {...props} />
    </Suspense>
  );
}
