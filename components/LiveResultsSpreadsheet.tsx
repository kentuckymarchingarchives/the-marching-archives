
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

import {
  saveSpreadsheetResults,
  type SpreadsheetSaveState,
} from "@/app/staff/competitions/spreadsheet-actions";

import {
  calculateScoringFormula,
  type ScoringFormula,
} from "@/lib/scoring-formulas";

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
};

const initialState: SpreadsheetSaveState = {
  status: "idle",
  message: "",
  savedCount: 0,
};

const inputClass =
  "w-full min-w-20 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-[#002144] focus:border-[#861F41] focus:outline-none focus:ring-2 focus:ring-[#861F41]/20 disabled:bg-slate-100";

function parseScore(value: string): number | null {
  if (!/^\d+(?:\.\d{1,4})?$/.test(value)) {
    return null;
  }

  const score = Number(value);

  return Number.isFinite(score) ? score : null;
}

function calculate(
  row: SpreadsheetRow,
  captions: SpreadsheetCaption[],
  formula: ScoringFormula
) {
  const values: Record<string, number | null> = {};

  for (const caption of captions) {
    values[caption.id] = parseScore(
      row.captions[caption.id] ?? ""
    );
  }

  return calculateScoringFormula(
    captions.map((caption) => ({
      id: caption.id,
      name: caption.name,
      maxScore: caption.max_score,
      multiplier: caption.multiplier,
    })),
    values,
    formula
  );
}

function officialTotal(
  row: SpreadsheetRow,
  captions: SpreadsheetCaption[],
  formula: ScoringFormula
): number | null {
  return row.totalMode === "manual"
    ? parseScore(row.manualTotal)
    : calculate(row, captions, formula).total;
}

function scoreText(value: number | null): string {
  if (value === null) return "—";

  return value
    .toFixed(4)
    .replace(/0+$/, "")
    .replace(/\.$/, "");
}

function rankingsFor(
  rows: SpreadsheetRow[],
  captions: SpreadsheetCaption[],
  formula: ScoringFormula
) {
  const scored = rows.flatMap((row) => {
    const score = officialTotal(row, captions, formula);

    return score === null
      ? []
      : [{
          id: row.entryId,
          classification: row.classification,
          score,
        }];
  });

  const overall = new Map<string, number>();
  const byClass = new Map<string, number>();

  function apply(
    records: typeof scored,
    target: Map<string, number>
  ) {
    const ordered = [...records].sort(
      (a, b) =>
        b.score - a.score || a.id.localeCompare(b.id)
    );

    let previous: number | null = null;
    let rank = 0;

    ordered.forEach((record, index) => {
      const current = Math.round(record.score * 10000);

      if (previous === null || previous !== current) {
        rank = index + 1;
      }

      target.set(record.id, rank);
      previous = current;
    });
  }

  apply(scored, overall);

  const groups = new Map<string, typeof scored>();

  for (const row of scored) {
    if (!row.classification) continue;

    groups.set(row.classification, [
      ...(groups.get(row.classification) ?? []),
      row,
    ]);
  }

  for (const group of groups.values()) {
    apply(group, byClass);
  }

  return { overall, byClass };
}

function validateCaption(
  text: string,
  caption: SpreadsheetCaption
): string | null {
  if (text === "") return null;

  const score = parseScore(text);

  if (
    score === null ||
    score > caption.max_score
  ) {
    return (
      `${caption.name} must be between 0 and ` +
      `${caption.max_score}, with up to four decimal places.`
    );
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
}: Props) {
  const router = useRouter();

  const [rows, setRows] =
    useState<SpreadsheetRow[]>(initialRows);

  const [state, action, pending] = useActionState(
    saveSpreadsheetResults,
    initialState
  );

  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [confirmFill, setConfirmFill] = useState(false);

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
    () => rankingsFor(rows, captions, formula),
    [rows, captions, formula]
  );

  const scoredCount = rows.filter(
    (row) =>
      officialTotal(row, captions, formula) !== null
  ).length;

  const canEdit = editable && !incomplete && !pending;

  const base =
    `/staff/competitions/${competitionId}` +
    `/rounds/${roundId}`;

  function changeRow(
    id: string,
    changes: Partial<SpreadsheetRow>
  ) {
    setRows((previous) =>
      previous.map((row) =>
        row.entryId === id
          ? { ...row, ...changes }
          : row
      )
    );
  }

  function changeCaption(
    id: string,
    captionId: string,
    value: string
  ) {
    setRows((previous) =>
      previous.map((row) =>
        row.entryId === id
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

    const text = event.clipboardData.getData("text");

    if (!text.includes("\t") && !text.includes("\n")) {
      return;
    }

    event.preventDefault();
    setError("");
    setNotice("");

    const normalized = text.replace(/\r\n?/g, "\n");
    const trimmed = normalized.endsWith("\n")
      ? normalized.slice(0, -1)
      : normalized;

    const grid = trimmed
      .split("\n")
      .map((line) => line.split("\t"));

    if (
      startRow + grid.length > rows.length ||
      grid.some(
        (line) =>
          startColumn + line.length >
          captions.length
      )
    ) {
      setError(
        "The copied range exceeds the available band rows or caption columns. No changes were made."
      );
      return;
    }

    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        const caption = captions[startColumn + c];
        const issue = validateCaption(
          grid[r][c].trim(),
          caption
        );

        if (issue) {
          setError(
            `Pasted row ${r + 1}: ${issue} Nothing was pasted.`
          );
          return;
        }
      }
    }

    setRows((previous) => {
      const next = previous.map((row) => ({
        ...row,
        captions: { ...row.captions },
      }));

      for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
          const caption = captions[startColumn + c];

          next[startRow + r].captions[caption.id] =
            grid[r][c].trim();
        }
      }

      return next;
    });

    setNotice(
      `Pasted scores for ${grid.length} band row(s). Verify alignment before saving.`
    );
  }

  function fillPlacements() {
    if (!canEdit || !confirmFill) return;

    const current = rankingsFor(
      rows,
      captions,
      formula
    );

    setRows((previous) =>
      previous.map((row) => {
        const overall = current.overall.get(row.entryId);

        if (overall === undefined) return row;

        const classRank = current.byClass.get(
          row.entryId
        );

        return {
          ...row,
          overallPlacement: String(overall),
          classPlacement:
            classRank === undefined
              ? row.classPlacement
              : String(classRank),
        };
      })
    );

    setConfirmFill(false);
    setNotice(
      "Placements filled in the spreadsheet only. Verify historical rankings before saving."
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    for (const row of dirty) {
      for (const caption of captions) {
        const issue = validateCaption(
          row.captions[caption.id] ?? "",
          caption
        );

        if (issue) {
          event.preventDefault();
          setError(`${row.bandName}: ${issue}`);
          return;
        }
      }

      if (
        row.totalMode === "manual" &&
        row.manualTotal !== "" &&
        (parseScore(row.manualTotal) === null ||
          Number(row.manualTotal) > 999999)
      ) {
        event.preventDefault();
        setError(
          `${row.bandName}: Invalid official total.`
        );
        return;
      }

      if (
        row.totalMode === "automatic" &&
        calculate(row, captions, formula).status ===
          "invalid"
      ) {
        event.preventDefault();
        setError(
          `${row.bandName}: Invalid automatic calculation.`
        );
        return;
      }
    }

    setError("");
    setNotice("");
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

          <p className="mt-1 text-sm text-slate-600">
            {dirty.length} modified row(s) not yet saved
          </p>

          <p className="mt-2 text-xs text-slate-500">
            Formula: {formula.method.replaceAll("_", " ")}
            {formula.penalty > 0
              ? ` · Deduction ${formula.penalty}`
              : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href={`${base}/formula`}
            className="rounded-lg bg-[#002144] px-5 py-3 text-sm font-bold text-white"
          >
            Configure Scoring Formula
          </Link>
          
          <Link
            href={`${base}/penalties`}
            className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-[#002144] hover:bg-slate-50"
          >
            Individual Penalties
          </Link>

          <Link
            href={`${base}#captions`}
            className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-bold text-[#002144]"
          >
            Custom Captions
          </Link>

          <Link
            href={base}
            className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-bold text-[#002144]"
          >
            Individual Editor
          </Link>
        </div>
      </div>

      {!editable && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          Published or archived results are read-only.
        </p>
      )}

      {incomplete && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
          More than 500 entries are present.
          Editing is disabled until pagination is supported.
        </p>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-[#002144]">
          Spreadsheet Tools
        </h2>

        <p className="mt-3 text-sm leading-7 text-slate-600">
          To bulk paste, copy caption values from Excel
          or Google Sheets, select the first matching
          caption cell below, and press Ctrl + V.
          Pasting fills caption columns and band rows.
          It does not match bands by name.
        </p>

        <p className="mt-3 text-sm leading-7 text-slate-600">
          The calculated column uses the saved round
          formula. A manual official total always takes
          precedence when Total Mode is Manual.
          Rank previews are informational until verified.
        </p>

        <label className="mt-5 flex items-start gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={confirmFill}
            disabled={!canEdit}
            onChange={(event) =>
              setConfirmFill(event.target.checked)
            }
            className="mt-1"
          />

          I understand that filling placements replaces
          the current placement cells for scored bands.
          I will verify the official historical rankings.
        </label>

        <button
          type="button"
          onClick={fillPlacements}
          disabled={!canEdit || !confirmFill}
          className="mt-4 rounded-lg bg-[#002144] px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          Fill Placements from Scores
        </button>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-900"
        >
          {error}
        </p>
      )}

      {notice && (
        <p
          role="status"
          className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900"
        >
          {notice}
        </p>
      )}

      <form
        action={action}
        onSubmit={submit}
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
        <input
          type="hidden"
          name="formula_snapshot"
          value={JSON.stringify(formula)}
          readOnly
        />
        <input
          type="hidden"
          name="payload"
          value={JSON.stringify(dirty)}
          readOnly
        />

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-max border-collapse text-left text-sm">
            <thead className="bg-[#002144] text-white">
              <tr>
                <th className="sticky left-0 z-10 min-w-52 bg-[#002144] px-4 py-4">
                  Ensemble
                </th>
                <th className="px-3 py-4">Class</th>

                {captions.map((caption) => (
                  <th
                    key={caption.id}
                    className="min-w-32 px-3 py-4"
                  >
                    {caption.name}
                    <span className="mt-1 block text-xs font-normal text-slate-300">
                      Max {caption.max_score}
                      {" · "}×{caption.multiplier}
                    </span>
                  </th>
                ))}

                <th className="px-3 py-4">Calculated</th>
                <th className="px-3 py-4">Total Mode</th>
                <th className="px-3 py-4">Official Total</th>
                <th className="px-3 py-4">Preview Rank</th>
                <th className="px-3 py-4">Class Place</th>
                <th className="px-3 py-4">Overall Place</th>
                <th className="px-3 py-4">Notes</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {rows.map((row, rowIndex) => {
                const result = calculate(
                  row,
                  captions,
                  formula
                );

                const total = officialTotal(
                  row,
                  captions,
                  formula
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
                      className={`sticky left-0 z-[1] max-w-60 border-r border-slate-200 px-4 py-3 text-left font-bold text-[#002144] ${
                        modified
                          ? "bg-amber-50"
                          : "bg-white"
                      }`}
                    >
                      {row.bandName}
                      {modified && (
                        <span className="mt-1 block text-xs text-amber-800">
                          Unsaved
                        </span>
                      )}
                    </th>

                    <td className="px-3 py-3">
                      <select
                        aria-label={`${row.bandName} class`}
                        className={inputClass}
                        value={row.classification ?? ""}
                        disabled={!canEdit}
                        onChange={(event) =>
                          changeRow(row.entryId, {
                            classification:
                              event.target.value || null,
                          })
                        }
                      >
                        <option value="">None</option>
                        {classes.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </td>

                    {captions.map((caption, column) => (
                      <td key={caption.id} className="px-3 py-3">
                        <input
                          aria-label={`${row.bandName} ${caption.name}`}
                          type="number"
                          min="0"
                          max={caption.max_score}
                          step="0.0001"
                          className={inputClass}
                          value={
                            row.captions[caption.id] ?? ""
                          }
                          disabled={!canEdit}
                          onChange={(event) =>
                            changeCaption(
                              row.entryId,
                              caption.id,
                              event.target.value
                            )
                          }
                          onPaste={(event) =>
                            pasteCaptions(
                              event,
                              rowIndex,
                              column
                            )
                          }
                        />
                      </td>
                    ))}

                    <td
                      title={result.message}
                      className="px-3 py-3 text-center font-bold tabular-nums text-[#002144]"
                    >
                      {scoreText(result.total)}
                    </td>

                    <td className="px-3 py-3">
                      <select
                        aria-label={`${row.bandName} total mode`}
                        value={row.totalMode}
                        disabled={!canEdit}
                        onChange={(event) =>
                          changeRow(row.entryId, {
                            totalMode: event.target.value as
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
                          className={inputClass}
                          onChange={(event) =>
                            changeRow(row.entryId, {
                              manualTotal:
                                event.target.value,
                            })
                          }
                        />
                      ) : (
                        <span className="block min-w-24 rounded-lg bg-emerald-50 px-3 py-2 text-center font-bold tabular-nums text-emerald-900">
                          {scoreText(total)}
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-3 text-xs text-slate-600">
                      <span className="block">
                        Overall:{" "}
                        {rankings.overall.get(row.entryId) ??
                          "—"}
                      </span>
                      <span className="mt-1 block">
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
                        className={inputClass}
                        onChange={(event) =>
                          changeRow(row.entryId, {
                            classPlacement:
                              event.target.value,
                          })
                        }
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
                        className={inputClass}
                        onChange={(event) =>
                          changeRow(row.entryId, {
                            overallPlacement:
                              event.target.value,
                          })
                        }
                      />
                    </td>

                    <td className="px-3 py-3">
                      <input
                        aria-label={`${row.bandName} notes`}
                        type="text"
                        maxLength={5000}
                        value={row.notes}
                        disabled={!canEdit}
                        className={`${inputClass} min-w-56`}
                        onChange={(event) =>
                          changeRow(row.entryId, {
                            notes: event.target.value,
                          })
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {rows.length === 0 && (
            <p className="p-8 text-center text-sm text-slate-600">
              No bands are entered in this round yet.
              Add them through the Individual Editor.
            </p>
          )}
        </div>

        {state.status !== "idle" && (
          <div
            role={
              state.status === "error"
                ? "alert"
                : "status"
            }
            className={`rounded-xl border p-5 text-sm ${
              state.status === "error"
                ? "border-red-200 bg-red-50 text-red-900"
                : "border-emerald-200 bg-emerald-50 text-emerald-900"
            }`}
          >
            {state.message}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-[#002144]">
            {dirty.length} modified row(s)
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!canEdit || dirty.length === 0}
              onClick={() => {
                setRows(initialRows);
                setError("");
                setNotice("Unsaved changes discarded.");
              }}
              className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-bold text-[#002144] disabled:opacity-50"
            >
              Discard Changes
            </button>

            <button
              type="submit"
              disabled={!canEdit || dirty.length === 0}
              className="rounded-lg bg-[#861F41] px-7 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {pending
                ? "Saving..."
                : `Save All Changes (${dirty.length})`}
            </button>
          </div>
        </div>
      </form>

      <p className="text-xs leading-6 text-slate-500">
        Formula calculations use the same shared module
        in the browser and server. Saved official scores
        are preserved unless you deliberately update
        them. Each modified band is saved separately.
      </p>
    </section>
  );
}
