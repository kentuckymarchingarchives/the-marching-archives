
import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN } from "@/lib/band-validation";

import {
  addEntryPenalty,
  updateEntryPenalty,
  deleteEntryPenalty,
} from "@/app/staff/competitions/penalty-actions";

export const instant = false;

type Props = {
  params: Promise<{
    id: string;
    roundId: string;
  }>;
  searchParams: Promise<{ notice?: string }>;
};

type Entry = {
  id: string;
  band_id: string;
  classification: string | null;
  total_score: number | string | null;
};

type Penalty = {
  id: string;
  entry_id: string;
  amount: number | string;
  reason: string;
  source_url: string | null;
  created_at: string;
  updated_at: string;
};

const inputClass =
  "mt-2 block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-[#002144]";

const notices: Record<string, string> = {
  added: "Penalty recorded successfully.",
  updated: "Penalty updated and audit history recorded.",
  deleted: "Penalty removed. The change remains in audit history.",
};

function formatAmount(value: number): string {
  return value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

function Fields({
  penalty,
}: {
  penalty?: Penalty;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <label className="text-sm font-bold text-[#002144]">
        Penalty Amount *
        <input
          name="amount"
          type="number"
          min="0.0001"
          max="999999"
          step="0.0001"
          defaultValue={penalty?.amount ?? ""}
          required
          className={inputClass}
          placeholder="0.5000"
        />
      </label>

      <label className="text-sm font-bold text-[#002144]">
        Reason *
        <input
          name="reason"
          type="text"
          minLength={3}
          maxLength={500}
          required
          defaultValue={penalty?.reason ?? ""}
          className={inputClass}
          placeholder="Example: Timing violation"
        />
      </label>

      <label className="text-sm font-bold text-[#002144]">
        Source URL
        <input
          name="source_url"
          type="url"
          maxLength={2000}
          defaultValue={penalty?.source_url ?? ""}
          className={inputClass}
          placeholder="https://..."
        />
      </label>
    </div>
  );
}

async function PenaltiesContent({
  params,
  searchParams,
}: Props) {
  const { id, roundId } = await params;
  const { notice } = await searchParams;

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

  const editable =
    competition.publication_status === "draft" &&
    !competition.archived_at &&
    !round.archived_at;

  const { data, count, error: entriesError } =
    await supabase
      .from("competition_entries")
      .select(
        "id, band_id, classification, total_score",
        { count: "exact" }
      )
      .eq("round_id", roundId)
      .order("id", { ascending: true })
      .limit(500);

  if (entriesError) {
    throw new Error("Unable to load competition entries.");
  }

  const entries = (data ?? []) as Entry[];
  const incomplete = (count ?? 0) > entries.length;

  const bandIds = [
    ...new Set(entries.map((entry) => entry.band_id)),
  ];

  const names = new Map<string, string>();

  for (let i = 0; i < bandIds.length; i += 75) {
    const { data: bands, error } = await supabase
      .from("bands")
      .select("id, name")
      .in("id", bandIds.slice(i, i + 75));

    if (error) {
      throw new Error("Unable to load band names.");
    }

    for (const band of bands ?? []) {
      names.set(band.id, band.name);
    }
  }

  const penaltyMap = new Map<string, Penalty[]>();

  const entryIds = entries.map((entry) => entry.id);

  for (let i = 0; i < entryIds.length; i += 50) {
    const { data: penalties, count: penaltyCount, error } =
      await supabase
        .from("round_entry_penalties")
        .select(
          "id, entry_id, amount, reason, source_url, created_at, updated_at",
          { count: "exact" }
        )
        .in("entry_id", entryIds.slice(i, i + 50))
        .order("created_at", { ascending: true })
        .limit(1000);

    if (
      error ||
      (penaltyCount ?? 0) > (penalties?.length ?? 0)
    ) {
      throw new Error(
        "Unable to safely load all recorded penalties."
      );
    }

    for (const penalty of (penalties ?? []) as Penalty[]) {
      penaltyMap.set(penalty.entry_id, [
        ...(penaltyMap.get(penalty.entry_id) ?? []),
        penalty,
      ]);
    }
  }

  const ordered = [...entries].sort((a, b) =>
    (names.get(a.band_id) ?? "").localeCompare(
      names.get(b.band_id) ?? ""
    )
  );

  const totalPenalties = [...penaltyMap.values()]
    .flat()
    .reduce(
      (sum, penalty) => sum + Number(penalty.amount),
      0
    );

  const base =
    `/staff/competitions/${id}/rounds/${roundId}`;

  return (
    <main className="min-h-screen bg-[#F4F6F9]">
      <section className="bg-[#002144] px-6 py-12 text-white">
        <div className="mx-auto max-w-6xl">
          <Link
            href={base}
            className="text-sm font-bold text-[#E0B4C2] hover:underline"
          >
            &larr; Round Results
          </Link>

          <p className="mt-8 text-xs font-bold uppercase tracking-widest text-[#E0B4C2]">
            Results Administration
          </p>

          <h1 className="mt-3 font-serif text-4xl font-bold">
            Individual Penalties
          </h1>

          <p className="mt-3 text-slate-300">
            {competition.name} · {round.name}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
        <div className="flex flex-wrap gap-3">
          <Link
            href={`${base}/spreadsheet`}
            className="rounded-lg bg-[#861F41] px-5 py-3 text-sm font-bold text-white"
          >
            Results Spreadsheet
          </Link>

          <Link
            href={`${base}/formula`}
            className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-[#002144]"
          >
            Scoring Formula
          </Link>
        </div>

        {notice && notices[notice] && (
          <p
            role="status"
            className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm font-semibold text-emerald-900"
          >
            {notices[notice]}
          </p>
        )}

        {!editable && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            This round is published or archived.
            Penalty records are read-only.
          </p>
        )}

        {incomplete && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-900"
          >
            More than 500 entries exist in this round.
            The penalty list is incomplete, so editing
            is disabled until pagination is implemented.
          </p>
        )}

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            {
              label: "Bands Displayed",
              value: ordered.length,
            },
            {
              label: "Penalty Records",
              value: [...penaltyMap.values()].reduce(
                (sum, group) => sum + group.length,
                0
              ),
            },
            {
              label: "Total Recorded Deductions",
              value: formatAmount(totalPenalties),
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <p className="text-xs font-bold uppercase tracking-wider text-[#861F41]">
                {item.label}
              </p>
              <p className="mt-3 text-2xl font-bold tabular-nums text-[#002144]">
                {item.value}
              </p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-serif text-xl font-bold text-[#002144]">
            How Penalties Are Recorded
          </h2>

          <p className="mt-3 text-sm leading-7 text-slate-600">
            Record the deduction amount, reason, and
            source for each individual band. You may
            record multiple penalties for one performance.
            Changes are captured in an audit table.
          </p>

          <p className="mt-3 text-sm font-semibold leading-7 text-[#861F41]">
            Penalties are not yet subtracted from the
            saved official total score. Existing totals
            may already include deductions, and we must
            not subtract them a second time.
          </p>
        </section>

        <section className="space-y-5">
          <h2 className="font-serif text-2xl font-bold text-[#002144]">
            Band Penalty Records
          </h2>

          {ordered.map((entry) => {
            const bandName =
              names.get(entry.band_id) ??
              "Unknown Ensemble";

            const penalties =
              penaltyMap.get(entry.id) ?? [];

            const deduction = penalties.reduce(
              (sum, penalty) =>
                sum + Number(penalty.amount),
              0
            );

            return (
              <article
                key={entry.id}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-[#002144]">
                      {bandName}
                    </h3>

                    <p className="mt-2 text-sm text-slate-600">
                      {entry.classification ??
                        "Unclassified"}
                      {" · "}
                      Saved official score:{" "}
                      {entry.total_score ?? "Not recorded"}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs font-bold uppercase tracking-wide text-[#861F41]">
                      Recorded Deductions
                    </p>

                    <p className="mt-2 text-2xl font-bold tabular-nums text-[#002144]">
                      {formatAmount(deduction)}
                    </p>
                  </div>
                </div>

                {penalties.length > 0 && (
                  <div className="mt-6 space-y-4">
                    {penalties.map((penalty) => (
                      <div
                        key={penalty.id}
                        className="rounded-xl border border-slate-200 bg-[#F4F6F9] p-5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-bold text-[#002144]">
                              {penalty.reason}
                            </p>

                            <p className="mt-2 text-sm text-slate-600">
                              Recorded deduction:{" "}
                              <strong>
                                {formatAmount(
                                  Number(penalty.amount)
                                )}
                              </strong>
                            </p>

                            {penalty.source_url && (
                              <a
                                href={penalty.source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-2 inline-block text-xs font-bold text-[#861F41] hover:underline"
                              >
                                Open Supporting Source
                              </a>
                            )}
                          </div>
                        </div>

                        {editable && !incomplete && (
                          <div className="mt-5 space-y-3">
                            <details>
                              <summary className="cursor-pointer text-sm font-bold text-[#861F41]">
                                Edit Penalty
                              </summary>

                              <form
                                action={updateEntryPenalty}
                                className="mt-4 space-y-4"
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
                                  name="penalty_id"
                                  value={penalty.id}
                                />

                                <Fields penalty={penalty} />

                                <button
                                  type="submit"
                                  className="rounded-lg bg-[#002144] px-5 py-3 text-sm font-bold text-white"
                                >
                                  Save Changes
                                </button>
                              </form>
                            </details>

                            <details>
                              <summary className="cursor-pointer text-sm font-bold text-red-700">
                                Remove Penalty
                              </summary>

                              <form
                                action={deleteEntryPenalty}
                                className="mt-3 space-y-3 rounded-lg border border-red-200 bg-red-50 p-4"
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
                                  name="penalty_id"
                                  value={penalty.id}
                                />

                                <label className="block text-sm font-bold text-red-900">
                                  Type REMOVE to confirm
                                  <input
                                    name="confirm_remove"
                                    type="text"
                                    required
                                    pattern="REMOVE"
                                    autoComplete="off"
                                    className="mt-2 block rounded-lg border border-red-300 bg-white px-4 py-2"
                                  />
                                </label>

                                <button
                                  type="submit"
                                  className="rounded-lg bg-red-800 px-5 py-3 text-sm font-bold text-white"
                                >
                                  Confirm Removal
                                </button>
                              </form>
                            </details>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {editable && !incomplete && (
                  <details className="mt-6">
                    <summary className="cursor-pointer rounded-lg bg-[#861F41] px-5 py-3 text-center text-sm font-bold text-white">
                      + Add Penalty
                    </summary>

                    <form
                      action={addEntryPenalty}
                      className="mt-4 space-y-5 rounded-xl border border-slate-200 p-5"
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

                      <Fields />

                      <button
                        type="submit"
                        className="rounded-lg bg-[#002144] px-6 py-3 text-sm font-bold text-white"
                      >
                        Record Penalty
                      </button>
                    </form>
                  </details>
                )}
              </article>
            );
          })}

          {ordered.length === 0 && (
            <p className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-600">
              No ensembles have been entered into this round.
              Add them through the round results editor first.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

export default function PenaltiesPage(props: Props) {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#F4F6F9] p-10">
          <p role="status" className="text-sm text-slate-600">
            Loading individual penalties...
          </p>
        </main>
      }
    >
      <PenaltiesContent {...props} />
    </Suspense>
  );
}
