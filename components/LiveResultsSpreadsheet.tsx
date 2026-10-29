"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ClipboardEvent, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { calculatePenaltyAwareScore } from "@/lib/penalty-calculations";
import { type ScoringFormula } from "@/lib/scoring-formulas";

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
  formula: ScoringFormula;
  penaltyTotals: Record<string, number>;
};

const initialState: SpreadsheetSaveState = {
  status: "idle",
  message: "",
  savedCount: 0,
};

const inputClass =
  "w-full min-w-20 rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-[#002144] focus:border-[#861F41] focus:outline-none focus:ring-2 focus:ring-[#861F41]/20 disabled:bg-slate-100";

function parseScore(value: string): number | null {
  if (!/^\d+(?:\.\d{1,4})?$/.test(value)) return null;
  const score = Number(value);
  return Number.isFinite(score) && score <= 999999 ? score : null;
}

function calculatedTotal(
  row: SpreadsheetRow,
  captions: SpreadsheetCaption[],
  formula: ScoringFormula,
  penaltyTotals: Record<string, number>
): number | null {
  const values: Record<string, number | null> = {};
  for (const caption of captions) {
    values[caption.id] = parseScore(row.captions[caption.id] ?? "");
  }
  return calculatePenaltyAwareScore(
    captions.map((caption) => ({
      id: caption.id, name: caption.name,
      maxScore: caption.max_score, multiplier: caption.multiplier,
    })),
    values,
    formula,
    penaltyTotals[row.entryId] ?? 0
  ).total;
}

function officialTotal(
  row: SpreadsheetRow,
  captions: SpreadsheetCaption[],
  formula: ScoringFormula,
  penaltyTotals: Record<string, number>
): number | null {
  return row.totalMode === "manual"
    ? parseScore(row.manualTotal)
    : calculatedTotal(row, captions, formula, penaltyTotals);
}

function scoreText(value: number | null): string {
  if (value === null) return "—";

  return value
    .toFixed(4)
    .replace(/0+$/, "")
    .replace(/\.$/, "");
}

type RankedRecord = {
  id: string;
  classification: string | null;
  score: number;
};

function computeRankings(
  rows: SpreadsheetRow[],
  captions: SpreadsheetCaption[],
  formula: ScoringFormula,
  penaltyTotals: Record<string, number>
) {
  const scored: RankedRecord[] = [];

  for (const row of rows) {
    const score = officialTotal(row, captions, formula, penaltyTotals);

    if (score !== null) {
      scored.push({
        id: row.entryId,
        classification: row.classification,
        score,
      });
    }
  }

  const overall = new Map<string, number>();
  const byClass = new Map<string, number>();

  function assign(
    records: RankedRecord[],
    destination: Map<string, number>
  ) {
    const sorted = [...records].sort(
      (a, b) =>
        b.score - a.score ||
        a.id.localeCompare(b.id)
    );

    let previousScore: number | null = null;
    let currentRank = 0;

    sorted.forEach((record, index) => {
      // Results are recorded to a maximum of
      // four decimal places in this editor.
      const score = Math.round(
        record.score * 10000
      );

      if (
        previousScore === null ||
        score !== previousScore
      ) {
        currentRank = index + 1;
      }

      destination.set(record.id, currentRank);
      previousScore = score;
    });
  }

  assign(scored, overall);

  const groups = new Map<string, RankedRecord[]>();

  for (const record of scored) {
    if (!record.classification) continue;

    const group =
      groups.get(record.classification) ?? [];

    group.push(record);
    groups.set(record.classification, group);
  }

  for (const group of groups.values()) {
    assign(group, byClass);
  }

  return { overall, byClass };
}

function parsePastedGrid(text: string): string[][] {
  const normalized = text.replace(/\r\n?/g, "\n");

  // Spreadsheet applications typically append
  // one final newline to copied ranges.
  const withoutFinalNewline =
    normalized.endsWith("\n")
      ? normalized.slice(0, -1)
      : normalized;

  return withoutFinalNewline
    .split("\n")
    .map((line) => line.split("\t"));
}

function validateCaptionValue(
  value: string,
  caption: SpreadsheetCaption
): string | null {
  if (value === "") return null;

  if (!/^\d+(?:\.\d{1,4})?$/.test(value)) {
    return `${caption.name} must be a nonnegative number with up to four decimal places.`;
  }

  const number = Number(value);

  if (
    !Number.isFinite(number) ||
    number > caption.max_score
  ) {
    return `${caption.name} cannot exceed ${caption.max_score}.`;
  }

  return null;
}

export default function LiveResultsSpreadsheet({
  competitionId,
  roundId,
  editable,
  classes,
  captions,
  initialRows,
  incomplete,
  formula,
  penaltyTotals,
}: Props) {
  const router = useRouter();

  const [rows, setRows] =
    useState<SpreadsheetRow[]>(initialRows);

  const [state, action, pending] = useActionState(
    saveSpreadsheetResults,
    initialState
  );

  const [notice, setNotice] = useState("");
  const [pasteError, setPasteError] = useState("");
  const [confirmRankFill, setConfirmRankFill] =
    useState(false);

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
      rows.filter(
        (row, index) =>
          JSON.stringify(row) !==
          JSON.stringify(initialRows[index])
      ),
    [rows, initialRows]
  );

  const rankings = useMemo(
    () => computeRankings(rows, captions, formula, penaltyTotals),
    [rows, captions, formula, penaltyTotals]
  );

  const scoredCount = rows.filter(
    (row) => officialTotal(row, captions, formula, penaltyTotals) !== null
  ).length;

  const canEdit = editable && !incomplete && !pending;

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

  function pasteCaptions(
    event: ClipboardEvent<HTMLInputElement>,
    startRow: number,
    startColumn: number
  ) {
    if (!canEdit) return;

    const raw = event.clipboardData.getData("text");

    // Leave ordinary single-cell paste to the browser.
    if (!raw.includes("\t") && !raw.includes("\n")) {
      return;
    }

    event.preventDefault();

    setPasteError("");
    setNotice("");

    const grid = parsePastedGrid(raw);

    if (
      !grid.length ||
      grid.some((line) => line.length === 0)
    ) {
      setPasteError("The pasted range is empty.");
      return;
    }

    if (
      startRow + grid.length > rows.length
    ) {
      setPasteError(
        "The pasted range extends beyond the final band row. No changes were made."
      );
      return;
    }

    if (
      grid.some(
        (line) =>
          startColumn + line.length >
          captions.length
      )
    ) {
      setPasteError(
        "The pasted range extends beyond the final caption column. No changes were made."
      );
      return;
    }

    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        const caption = captions[startColumn + c];
        const value = grid[r][c].trim();

        const error = validateCaptionValue(
          value,
          caption
        );

        if (error) {
          setPasteError(
            `Pasted row ${r + 1}, column ${
              c + 1
            }: ${error} No changes were made.`
          );
          return;
        }
      }
    }

    // Validation finished. Apply the range together.
    setRows((previous) => {
      const updated = previous.map((row) => ({
        ...row,
        captions: { ...row.captions },
      }));

      for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
          const caption = captions[startColumn + c];

          updated[startRow + r].captions[
            caption.id
          ] = grid[r][c].trim();
        }
      }

      return updated;
    });

    const cells = grid.reduce(
      (total, line) => total + line.length,
      0
    );

    setNotice(
      `Pasted ${cells} caption ${
        cells === 1 ? "cell" : "cells"
      } across ${grid.length} ${
        grid.length === 1 ? "band" : "bands"
      }. Review the values before saving.`
    );
  }

  function fillPlacements() {
    if (!canEdit || !confirmRankFill) return;

    const current = computeRankings(rows, captions, formula, penaltyTotals);

    setRows((previous) =>
      previous.map((row) => {
        const overall = current.overall.get(
          row.entryId
        );

        const classRank = current.byClass.get(
          row.entryId
        );

        // Unscored entries remain unchanged.
        if (overall === undefined) {
          return row;
        }

        return {
          ...row,
          overallPlacement: String(overall),
          classPlacement:
            classRank !== undefined
              ? String(classRank)
              : row.classPlacement,
        };
      })
    );

    setConfirmRankFill(false);
    setPasteError("");
    setNotice(
      "Score-based placements have been filled into the editable cells. They are not saved yet. Verify them against the official historical results."
    );
  }

  function discardChanges() {
    setRows(initialRows);
    setNotice("Unsaved changes discarded.");
    setPasteError("");
    setConfirmRankFill(false);
  }

  function saveValidationError(): string | null {
    for (const row of dirty) {
      for (const caption of captions) {
        const error = validateCaptionValue(
          row.captions[caption.id] ?? "",
          caption
        );

        if (error) {
          return `${row.bandName}: ${error}`;
        }
      }

      if (
        row.totalMode === "automatic" &&
        captions.length > 0 &&
        captions.every(
          (caption) =>
            (row.captions[caption.id] ?? "") !== ""
        ) &&
        calculatedTotal(row, captions, formula, penaltyTotals) === null
      ) {
        return `${row.bandName}: calculated total is invalid.`;
      }

      if (
        row.totalMode === "manual" &&
        row.manualTotal !== "" &&
        (!/^\d+(?:\.\d{1,4})?$/.test(
          row.manualTotal
        ) ||
          Number(row.manualTotal) > 999999)
      ) {
        return `${row.bandName}: invalid manual total.`;
      }
    }

    return null;
  }

  function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    const error = saveValidationError();

    if (error) {
      event.preventDefault();
      setPasteError(error);
      return;
    }

    setNotice("");
    setPasteError("");
  }

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
          <Link href={`/staff/competitions/${competitionId}/rounds/${roundId}/formula`}
            className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-bold text-[#002144]">
            Configure Formula
          </Link>
          <Link href={`/staff/competitions/${competitionId}/rounds/${roundId}/penalties`}
            className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-bold text-[#002144]">
            Individual Penalties
          </Link>
          <Link
            href={`/staff/competitions/${competitionId}/rounds/${roundId}#captions`}
            className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-bold text-[#002144] hover:bg-slate-50"
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
          This competition is read-only.
          Only active draft results can be edited.
        </div>
      )}

      {incomplete && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-900"
        >
          More than 500 entries exist in this round.
          Editing is disabled until full pagination
          support is added.
        </div>
      )}

      {!captions.length && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          No scoring captions are configured.
          You may enter official totals manually,
          or add custom captions through Caption Management.
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-[#002144]">
          Bulk Paste from a Spreadsheet
        </h2>

        <p className="mt-3 text-sm leading-7 text-slate-600">
          In Excel or Google Sheets, copy a rectangle
          containing caption scores only. In TMA,
          click the corresponding starting caption
          cell and paste with Ctrl + V.
          Values fill across caption columns and
          downward through the displayed band rows.
        </p>

        <p className="mt-2 text-sm leading-7 text-slate-600">
          Make sure the band order matches the copied
          spreadsheet. Pasting does not match bands by
          name. Blank cells clear caption scores.
          Invalid values or ranges are rejected entirely.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-[#002144]">
          Score-Based Placement Tools
        </h2>

        <p className="mt-3 text-sm leading-7 text-slate-600">
          Calculate placements using the current
          official or automatically calculated totals.
          Tied scores receive the same placement,
          and the next placement skips occupied ranks.
          Overall and class rankings are calculated
          independently.
        </p>

        <p className="mt-3 text-sm font-semibold text-[#861F41]">
          These rankings are only suitable when the
          historical competition ranked bands directly
          by these totals. Penalties, adjudication
          decisions, and historical exceptions may
          require manually entered placements.
        </p>

        <label className="mt-5 flex items-start gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={confirmRankFill}
            onChange={(event) =>
              setConfirmRankFill(event.target.checked)
            }
            disabled={!canEdit || rows.length === 0}
            className="mt-1"
          />

          <span>
            I understand this replaces the currently
            entered placement cells for scored bands
            in the spreadsheet. I will verify all
            placements before saving.
          </span>
        </label>

        <button
          type="button"
          onClick={fillPlacements}
          disabled={!canEdit || !confirmRankFill}
          className="mt-5 rounded-lg bg-[#002144] px-6 py-3 text-sm font-bold text-white hover:bg-[#123B63] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Fill Placements from Scores
        </button>
      </section>

      {pasteError && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-900"
        >
          {pasteError}
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm font-medium text-blue-900"
        >
          {notice}
        </div>
      )}

      <form
        action={action}
        onSubmit={handleSubmit}
        className="space-y-5"
      >
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

        <input type="hidden" name="formula_snapshot"
          value={JSON.stringify(formula)} readOnly />
        <input type="hidden" name="penalty_snapshot"
          value={JSON.stringify(penaltyTotals)} readOnly />
        <input type="hidden" name="caption_snapshot"
          value={JSON.stringify(captions)} readOnly />
        <input
          type="hidden"
          name="payload"
          readOnly
          value={JSON.stringify(dirty)}
        />

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-max border-collapse text-left text-sm">
            <thead className="bg-[#002144] text-white">
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 z-10 min-w-52 border-r border-white/15 bg-[#002144] px-4 py-4"
                >
                  Ensemble
                </th>

                <th scope="col" className="px-3 py-4">
                  Class
                </th>

                {captions.map((caption) => (
                  <th
                    key={caption.id}
                    scope="col"
                    className="min-w-32 px-3 py-4"
                  >
                    <span className="block">
                      {caption.name}
                    </span>

                    <span className="mt-1 block text-xs font-normal text-slate-300">
                      Max {caption.max_score}
                      {" · "}×{caption.multiplier}
                    </span>
                  </th>
                ))}

                <th scope="col" className="px-3 py-4">Band Penalties</th>
                <th scope="col" className="px-3 py-4">Final Calculated</th>

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
              {rows.map((row, rowIndex) => {
                const calculated = calculatedTotal(
                  row, captions, formula, penaltyTotals
                );

                const total = officialTotal(
                  row, captions, formula, penaltyTotals
                );

                const modified =
                  JSON.stringify(row) !==
                  JSON.stringify(initialRows[rowIndex]);

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
                      className={`sticky left-0 z-1 max-w-60 border-r border-slate-200 px-4 py-3 font-bold text-[#002144] ${
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
                        disabled={!canEdit}
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

                    {captions.map((caption, columnIndex) => (
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
                          disabled={!canEdit}
                          onChange={(event) =>
                            updateCaption(
                              row.entryId,
                              caption.id,
                              event.target.value
                            )
                          }
                          onPaste={(event) =>
                            pasteCaptions(
                              event,
                              rowIndex,
                              columnIndex
                            )
                          }
                          className={inputClass}
                        />
                      </td>
                    ))}

                    <td className="px-3 py-3 text-center font-semibold tabular-nums text-[#861F41]">
                      {(penaltyTotals[row.entryId] ?? 0).toFixed(4)}
                    </td>
                    <td className="px-3 py-3 text-center font-bold tabular-nums text-[#002144]"
                      title={`Round deduction: ${formula.penalty}; individual penalties: ${penaltyTotals[row.entryId] ?? 0}`}>
                      {scoreText(calculated)}
                    </td>

                    <td className="px-3 py-3">
                      <select
                        aria-label={`${row.bandName} total mode`}
                        value={row.totalMode}
                        disabled={!canEdit}
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
                          disabled={!canEdit}
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
                        disabled={!canEdit}
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
                        disabled={!canEdit}
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
                        disabled={!canEdit}
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
              Use the Individual Results Editor
              to add ensembles before entering scores.
            </div>
          )}
        </div>

        {state.status !== "idle" && (
          <div
            role={
              state.status === "error"
                ? "alert"
                : "status"
            }
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
          <div>
            <p className="font-semibold text-[#002144]">
              {dirty.length} modified{" "}
              {dirty.length === 1 ? "row" : "rows"}
            </p>

            <p className="mt-1 text-xs text-slate-600">
              No database changes occur until you save.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={discardChanges}
              disabled={!canEdit || dirty.length === 0}
              className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-bold text-[#002144] disabled:opacity-50"
            >
              Discard Changes
            </button>

            <button
              type="submit"
              disabled={
                !canEdit ||
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
        Each modified band is saved through the
        existing protected database function.
        Saving multiple bands is not yet a single
        all-or-nothing transaction. If a save fails
        partway through, reload the page to reconcile
        saved and unsaved records.
      </p>
    </section>
  );
}
