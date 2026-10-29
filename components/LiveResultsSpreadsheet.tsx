
"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import {
  saveSpreadsheetResults,
  type SpreadsheetSaveState,
} from "@/app/staff/competitions/spreadsheet-actions";

export type SpreadsheetCaption = {
  id: string;
  name: string;
  max_score: number;
  multiplier: number;
};

export type SpreadsheetRow = {
  entryId: string;
  bandName: string;
  classification: string | null;
  totalMode: "automatic" | "manual";
  manualTotal: string;
  classPlacement: string;
  overallPlacement: string;
  notes: string;
  captions: Record<string, string>;
};

type Props = {
  competitionId: string;
  roundId: string;
  editable: boolean;
  classes: string[];
  captions: SpreadsheetCaption[];
  initialRows: SpreadsheetRow[];
  incomplete: boolean;
};

const initialState: SpreadsheetSaveState = {
  status: "idle",
  message: "",
  savedCount: 0,
};

function validNumber(value: string): number | null {
  if (value.trim() === "") return null;

  const number = Number(value);

  return Number.isFinite(number) && number >= 0
    ? number
    : null;
}

function calculatedTotal(
  row: SpreadsheetRow,
  captions: SpreadsheetCaption[]
): number | null {
  if (!captions.length) return null;

  let total = 0;

  for (const caption of captions) {
    const value = validNumber(
      row.captions[caption.id] ?? ""
    );

    if (value === null) return null;

    total += value * caption.multiplier;
  }

  return Number(total.toFixed(4));
}

function officialTotal(
  row: SpreadsheetRow,
  captions: SpreadsheetCaption[]
): number | null {
  return row.totalMode === "manual"
    ? validNumber(row.manualTotal)
    : calculatedTotal(row, captions);
}

function scoreText(value: number | null): string {
  return value === null
    ? "—"
    : value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

function computeRankings(
  rows: SpreadsheetRow[],
  captions: SpreadsheetCaption[]
) {
  const scored = rows
    .map((row) => ({
      id: row.entryId,
      classification: row.classification,
      score: officialTotal(row, captions),
    }))
    .filter(
      (
        value
      ): value is {
        id: string;
        classification: string | null;
        score: number;
      } => value.score !== null
    );

  const overall = new Map<string, number>();
  const byClass = new Map<string, number>();

  function assign(
    records: typeof scored,
    destination: Map<string, number>
  ) {
    const sorted = [...records].sort(
      (a, b) =>
        b.score - a.score || a.id.localeCompare(b.id)
    );

    let previousScore: number | null = null;
    let currentRank = 0;

    sorted.forEach((record, index) => {
      if (
        previousScore === null ||
        Math.abs(record.score - previousScore) > 0.00001
      ) {
        currentRank = index + 1;
      }

      destination.set(record.id, currentRank);
      previousScore = record.score;
    });
  }

  assign(scored, overall);

  const groups = new Map<string, typeof scored>();

  for (const record of scored) {
    if (!record.classification) continue;

    groups.set(record.classification, [
      ...(groups.get(record.classification) ?? []),
      record,
    ]);
  }

  for (const group of groups.values()) {
    assign(group, byClass);
  }

  return { overall, byClass };
}

export default function LiveResultsSpreadsheet({
  competitionId,
  roundId,
  editable,
  classes,
  captions,
  initialRows,
  incomplete,
}: Props) {
  const router = useRouter();

  const [rows, setRows] =
    useState<SpreadsheetRow[]>(initialRows);

  const [state, action, pending] = useActionState(
    saveSpreadsheetResults,
    initialState
  );

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [state, router]);

  const dirty = useMemo(
    () =>
      rows.filter((row, index) => {
        return (
          JSON.stringify(row) !==
          JSON.stringify(initialRows[index])
        );
      }),
    [rows, initialRows]
  );

  const rankings = useMemo(
    () => computeRankings(rows, captions),
    [rows, captions]
  );

  const scoredCount = rows.filter(
    (row) => officialTotal(row, captions) !== null
  ).length;

  function updateRow(
    entryId: string,
    changes: Partial<SpreadsheetRow>
  ) {
    setRows((previous) =>
      previous.map((row) =>
        row.entryId === entryId
          ? { ...row, ...changes }
          : row
      )
    );
  }

  function updateCaption(
    entryId: string,
    captionId: string,
    value: string
  ) {
    setRows((previous) =>
      previous.map((row) =>
        row.entryId === entryId
          ? {
              ...row,
              captions: {
                ...row.captions,
                [captionId]: value,
              },
            }
          : row
      )
    );
  }

  const inputClass =
    "w-full min-w-20 rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-[#002144] focus:border-[#861F41] focus:outline-none focus:ring-2 focus:ring-[#861F41]/20 disabled:bg-slate-100";

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
            Spreadsheet Status
          </p>

          <p className="mt-2 font-bold text-[#002144]">
            {rows.length} bands · {scoredCount} with totals
          </p>

          <p className="mt-2 text-sm text-slate-600">
            {dirty.length} unsaved modified{" "}
            {dirty.length === 1 ? "row" : "rows"}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href={`/staff/competitions/${competitionId}/rounds/${roundId}#captions`}
            className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-[#002144] hover:bg-slate-50"
          >
            Manage Custom Captions
          </Link>

          <Link
            href={`/staff/competitions/${competitionId}/rounds/${roundId}`}
            className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-bold text-[#002144] hover:bg-slate-50"
          >
            Individual Results Editor
          </Link>
        </div>
      </div>

      {!editable && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          Results are read-only because this competition
          is published or archived.
        </div>
      )}

      {incomplete && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-900"
        >
          This round has more than 500 entries.
          The spreadsheet is displaying only part of
          the lineup. Saving is disabled until
          pagination support is added.
        </div>
      )}

      {!captions.length && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          No custom captions are configured.
          Add your scoring captions before using
          automatic total calculation. You can
          still enter official totals manually.
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-bold text-[#002144]">
          How the Live Calculator Works
        </h2>

        <p className="mt-3 text-sm leading-7 text-slate-600">
          Automatic totals are calculated from all
          configured captions and multipliers. If
          any caption is blank, the calculated total
          remains blank. Switch a band's Total Mode
          to Manual to enter the official result
          independently of the caption calculation.
        </p>

        <p className="mt-2 text-sm leading-7 text-slate-600">
          Live ranks are previews based on official
          or calculated totals. They do not overwrite
          historical placements. Enter the official
          class and overall placements separately.
        </p>
      </div>

      <form action={action} className="space-y-5">
        <input
          type="hidden"
          name="competition_id"
          value={competitionId}
        />

        <input
          type="hidden"
          name="round_id"
          value={roundId}
        />

        <input
          type="hidden"
          name="payload"
          value={JSON.stringify(dirty)}
          readOnly
        />

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-max w-full border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-[#002144] text-white">
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 z-20 min-w-52 border-r border-white/15 bg-[#002144] px-4 py-4"
                >
                  Ensemble
                </th>

                <th scope="col" className="px-3 py-4">
                  Class
                </th>

                {captions.map((caption) => (
                  <th
                    scope="col"
                    key={caption.id}
                    className="min-w-32 px-3 py-4"
                  >
                    <span className="block">
                      {caption.name}
                    </span>

                    <span className="mt-1 block text-xs font-normal text-slate-300">
                      Max {caption.max_score}
                      {" · "}
                      ×{caption.multiplier}
                    </span>
                  </th>
                ))}

                <th scope="col" className="px-3 py-4">
                  Calculated
                </th>

                <th scope="col" className="px-3 py-4">
                  Total Mode
                </th>

                <th scope="col" className="px-3 py-4">
                  Official Total
                </th>

                <th scope="col" className="px-3 py-4">
                  Preview Rank
                </th>

                <th scope="col" className="px-3 py-4">
                  Class Place
                </th>

                <th scope="col" className="px-3 py-4">
                  Overall Place
                </th>

                <th scope="col" className="px-3 py-4">
                  Notes
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {rows.map((row, index) => {
                const calculated = calculatedTotal(
                  row,
                  captions
                );

                const total = officialTotal(
                  row,
                  captions
                );

                const modified =
                  JSON.stringify(row) !==
                  JSON.stringify(initialRows[index]);

                return (
                  <tr
                    key={row.entryId}
                    className={
                      modified
                        ? "bg-amber-50"
                        : "hover:bg-slate-50"
                    }
                  >
                    <th
                      scope="row"
                      className={`sticky left-0 z-[1] max-w-60 border-r border-slate-200 px-4 py-3 font-bold text-[#002144] ${
                        modified
                          ? "bg-amber-50"
                          : "bg-white"
                      }`}
                    >
                      {row.bandName}

                      {modified && (
                        <span className="mt-1 block text-xs font-semibold text-amber-800">
                          Unsaved changes
                        </span>
                      )}
                    </th>

                    <td className="px-3 py-3">
                      <select
                        aria-label={`${row.bandName} classification`}
                        value={row.classification ?? ""}
                        disabled={!editable || pending}
                        onChange={(event) =>
                          updateRow(row.entryId, {
                            classification:
                              event.target.value || null,
                          })
                        }
                        className={inputClass}
                      >
                        <option value="">None</option>
                        {classes.map((classification) => (
                          <option
                            key={classification}
                            value={classification}
                          >
                            {classification}
                          </option>
                        ))}
                      </select>
                    </td>

                    {captions.map((caption) => (
                      <td
                        key={caption.id}
                        className="px-3 py-3"
                      >
                        <input
                          aria-label={`${row.bandName} ${caption.name} score`}
                          type="number"
                          min="0"
                          max={caption.max_score}
                          step="0.0001"
                          value={
                            row.captions[caption.id] ?? ""
                          }
                          disabled={!editable || pending}
                          onChange={(event) =>
                            updateCaption(
                              row.entryId,
                              caption.id,
                              event.target.value
                            )
                          }
                          className={inputClass}
                        />
                      </td>
                    ))}

                    <td className="px-3 py-3 text-center font-bold tabular-nums text-[#002144]">
                      {scoreText(calculated)}
                    </td>

                    <td className="px-3 py-3">
                      <select
                        aria-label={`${row.bandName} total mode`}
                        value={row.totalMode}
                        disabled={!editable || pending}
                        onChange={(event) =>
                          updateRow(row.entryId, {
                            totalMode:
                              event.target.value as
                                | "automatic"
                                | "manual",
                          })
                        }
                        className={inputClass}
                      >
                        <option value="automatic">
                          Automatic
                        </option>
                        <option value="manual">
                          Manual
                        </option>
                      </select>
                    </td>

                    <td className="px-3 py-3">
                      {row.totalMode === "manual" ? (
                        <input
                          aria-label={`${row.bandName} official total`}
                          type="number"
                          min="0"
                          max="999999"
                          step="0.0001"
                          value={row.manualTotal}
                          disabled={!editable || pending}
                          onChange={(event) =>
                            updateRow(row.entryId, {
                              manualTotal:
                                event.target.value,
                            })
                          }
                          className={inputClass}
                        />
                      ) : (
                        <span className="block min-w-24 rounded-md bg-emerald-50 px-3 py-2 text-center font-bold tabular-nums text-emerald-900">
                          {scoreText(total)}
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-3 text-xs text-slate-600">
                      <span className="block whitespace-nowrap">
                        Overall:{" "}
                        {rankings.overall.get(row.entryId) ??
                          "—"}
                      </span>

                      <span className="mt-1 block whitespace-nowrap">
                        Class:{" "}
                        {rankings.byClass.get(row.entryId) ??
                          "—"}
                      </span>
                    </td>

                    <td className="px-3 py-3">
                      <input
                        aria-label={`${row.bandName} class placement`}
                        type="number"
                        min="1"
                        step="1"
                        value={row.classPlacement}
                        disabled={!editable || pending}
                        onChange={(event) =>
                          updateRow(row.entryId, {
                            classPlacement:
                              event.target.value,
                          })
                        }
                        className={inputClass}
                      />
                    </td>

                    <td className="px-3 py-3">
                      <input
                        aria-label={`${row.bandName} overall placement`}
                        type="number"
                        min="1"
                        step="1"
                        value={row.overallPlacement}
                        disabled={!editable || pending}
                        onChange={(event) =>
                          updateRow(row.entryId, {
                            overallPlacement:
                              event.target.value,
                          })
                        }
                        className={inputClass}
                      />
                    </td>

                    <td className="px-3 py-3">
                      <input
                        aria-label={`${row.bandName} historical notes`}
                        type="text"
                        maxLength={5000}
                        value={row.notes}
                        disabled={!editable || pending}
                        onChange={(event) =>
                          updateRow(row.entryId, {
                            notes: event.target.value,
                          })
                        }
                        className={`${inputClass} min-w-56`}
                        placeholder="Optional notes"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {rows.length === 0 && (
            <div className="p-10 text-center text-sm text-slate-600">
              No bands are entered in this round.
              Add bands using the individual results
              editor before entering scores here.
            </div>
          )}
        </div>

        {state.status !== "idle" && (
          <div
            role={state.status === "error" ? "alert" : "status"}
            className={`rounded-xl border p-5 text-sm font-semibold ${
              state.status === "error"
                ? "border-red-200 bg-red-50 text-red-900"
                : "border-emerald-200 bg-emerald-50 text-emerald-900"
            }`}
          >
            {state.message}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-600">
            Changes aren't saved until you select
            Save All Changes.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={pending || dirty.length === 0}
              onClick={() => setRows(initialRows)}
              className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-bold text-[#002144] disabled:opacity-50"
            >
              Discard Unsaved Changes
            </button>

            <button
              type="submit"
              disabled={
                !editable ||
                incomplete ||
                pending ||
                dirty.length === 0
              }
              className="rounded-lg bg-[#861F41] px-7 py-3 text-sm font-bold text-white hover:bg-[#701832] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending
                ? "Saving Results..."
                : `Save All Changes (${dirty.length})`}
            </button>
          </div>
        </div>
      </form>

      <p className="text-xs leading-6 text-slate-500">
        Saving uses the existing database result function.
        Each changed entry is committed separately.
        If a later entry fails, previously saved entries
        may remain saved. Reload before retrying
        any partially completed save.
      </p>
    </section>
  );
}
