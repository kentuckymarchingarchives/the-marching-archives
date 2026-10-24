
"use client";

import { useState } from "react";
import {
  readImportCSV,
  type ImportRow,
} from "@/lib/results-csv";

import { bulkImportRoundResults } from
  "@/app/staff/competitions/tools-actions";

type Props = {
  competitionId: string;
  roundId: string;
};

export default function BulkResultsImport({
  competitionId,
  roundId,
}: Props) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [error, setError] = useState("");
  const [filename, setFilename] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  async function handleFile(
    file: File | undefined
  ) {
    setRows([]);
    setError("");
    setConfirmed(false);
    setFilename(file?.name ?? "");

    if (!file) return;

    if (file.size > 200000) {
      setError("Choose a CSV file under 200 KB.");
      return;
    }

    try {
      const content = await file.text();
      const parsed = readImportCSV(content);
      setRows(parsed);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to read CSV file."
      );
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-bold text-[#002144]">
          Import CSV Results
        </h3>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          Import up to 100 bands at a time.
          Existing entries for the same band in
          this round will have their classification,
          total, placements, and notes updated.
          Caption scores are not changed.
        </p>
      </div>

      <label className="block text-sm font-semibold text-[#002144]">
        Choose CSV File
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(event) =>
            handleFile(event.target.files?.[0])
          }
          className="mt-2 block w-full rounded-lg border border-slate-300 bg-white p-3 text-sm"
        />
      </label>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </p>
      )}

      {rows.length > 0 && (
        <>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <strong>{rows.length} rows ready for review.</strong>
            {" "}File: {filename}
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="bg-[#002144] text-white">
                <tr>
                  <th className="p-3">Band Slug</th>
                  <th className="p-3">Class</th>
                  <th className="p-3">Score</th>
                  <th className="p-3">Class Rank</th>
                  <th className="p-3">Overall Rank</th>
                  <th className="p-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {rows.map((row) => (
                  <tr key={row.band_slug}>
                    <td className="p-3 font-semibold">
                      {row.band_slug}
                    </td>
                    <td className="p-3">
                      {row.classification ?? "—"}
                    </td>
                    <td className="p-3 tabular-nums">
                      {row.total_score ?? "—"}
                    </td>
                    <td className="p-3">
                      {row.class_placement ?? "—"}
                    </td>
                    <td className="p-3">
                      {row.overall_placement ?? "—"}
                    </td>
                    <td className="p-3 text-slate-500">
                      {row.notes ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <form
            action={bulkImportRoundResults}
            className="space-y-4"
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
              name="payload"
              value={JSON.stringify(rows)}
            />

            <label className="flex items-start gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                name="confirm_import"
                value="yes"
                required
                checked={confirmed}
                onChange={(event) =>
                  setConfirmed(event.target.checked)
                }
                className="mt-1"
              />

              <span>
                I reviewed these rows. I understand
                that matching band entries in this
                round will be updated, including
                replacing their existing total scores,
                placements, classification, and notes.
              </span>
            </label>

            <button
              type="submit"
              disabled={!confirmed}
              className="rounded-lg bg-[#861F41] px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              Import {rows.length} Results
            </button>
          </form>
        </>
      )}
    </div>
  );
}
