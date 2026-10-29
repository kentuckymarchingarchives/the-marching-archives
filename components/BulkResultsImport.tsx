"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  CSV_HEADERS,
  readImportCSV,
  type ImportRow,
} from "@/lib/results-csv";
import { bulkImportRoundResults } from "@/app/staff/competitions/tools-actions";

type Props = {
  competitionId: string;
  roundId: string;
};

const TEMPLATE = [
  CSV_HEADERS.join(","),
  'example-band,4A,89.375,2,5,"Official recap, page 3"',
  'another-band,3A,87.250,1,8,""',
].join("\r\n");

function ImportButton({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-[#861F41] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#6f1935] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Importing…" : `Confirm import of ${count} ${count === 1 ? "result" : "results"}`}
    </button>
  );
}

export default function BulkResultsImport({ competitionId, roundId }: Props) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [error, setError] = useState("");
  const [filename, setFilename] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [replaceAcknowledged, setReplaceAcknowledged] = useState(false);
  const [fileKey, setFileKey] = useState(0);

  const stats = useMemo(() => ({
    total: rows.length,
    scored: rows.filter((row) => row.total_score !== null).length,
    classRanked: rows.filter((row) => row.class_placement !== null).length,
    overallRanked: rows.filter((row) => row.overall_placement !== null).length,
  }), [rows]);

  async function handleFile(file?: File) {
    setRows([]);
    setError("");
    setConfirmed(false);
    setReplaceAcknowledged(false);
    setFilename(file?.name ?? "");
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please choose a .csv file.");
      return;
    }
    if (file.size > 200000) {
      setError("CSV must be 200 KB or smaller.");
      return;
    }
    try {
      const parsed = readImportCSV(await file.text());
      setRows(parsed);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read the CSV file.");
    }
  }

  function clearFile() {
    setRows([]);
    setError("");
    setFilename("");
    setConfirmed(false);
    setReplaceAcknowledged(false);
    setFileKey((current) => current + 1);
  }

  return (
    <div className="space-y-6 text-[#002144]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">Round results · CSV</p>
          <h3 className="mt-2 text-xl font-bold">Import historical results</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Import 1–100 results into this draft round. Upload a CSV, review every row, and confirm before anything is saved.
          </p>
        </div>
        <a
          href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`}
          download="tma-round-results-template.csv"
          className="rounded-lg border border-[#002144]/20 bg-white px-4 py-2.5 text-sm font-bold text-[#002144] hover:bg-slate-50"
        >
          Download CSV template
        </a>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-bold">1. Prepare your spreadsheet</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Use the exact column names shown below. <strong>band_slug</strong> must match an existing ensemble in the archive. Save your sheet as CSV UTF-8.
          </p>
          <code className="mt-3 block overflow-x-auto rounded-md bg-white p-3 text-xs text-slate-700">
            {CSV_HEADERS.join(",")}
          </code>
          <p className="mt-2 text-xs text-slate-500">Optional cells may be blank. Scores accept up to four decimal places. The template includes example rows—replace them before importing.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-bold">2. Choose your CSV file</p>
          <label htmlFor="tma-import-file" className="mt-3 block text-sm text-slate-600">CSV file (200 KB maximum)</label>
          <input
            key={fileKey}
            id="tma-import-file"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => void handleFile(event.target.files?.[0])}
            className="mt-2 block w-full rounded-lg border border-slate-300 bg-white p-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:font-semibold"
          />
          {filename && <button type="button" onClick={clearFile} className="mt-3 text-sm font-semibold text-[#861F41] underline underline-offset-2">Clear selected file</button>}
        </div>
      </div>

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">{error}</p>}

      {rows.length > 0 && (
        <div className="space-y-5">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900" role="status">
            <strong>CSV validated locally.</strong> {filename} — {stats.total} {stats.total === 1 ? "row" : "rows"} ready for review. Database matching happens when you confirm the import.
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Rows", value: stats.total },
              { label: "With total scores", value: stats.scored },
              { label: "With class ranks", value: stats.classRanked },
              { label: "With overall ranks", value: stats.overallRanked },
            ].map((stat) => (
              <div key={stat.label} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="text-2xl font-bold tabular-nums">{stat.value}</div>
                <div className="mt-1 text-xs text-slate-600">{stat.label}</div>
              </div>
            ))}
          </div>

          <section aria-label="CSV import preview" className="space-y-2">
            <h4 className="font-bold">3. Review the imported rows</h4>
            <p className="text-xs text-slate-600">This is a preview, not a saved import. Scroll horizontally to see all columns.</p>
            <div className="max-h-110 overflow-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-210 text-left text-sm">
                <thead className="sticky top-0 bg-[#002144] text-white">
                  <tr>
                    { ["CSV line", "Ensemble slug", "Class", "Total score", "Class place", "Overall place", "Notes"].map((heading) => <th key={heading} className="whitespace-nowrap px-3 py-3 font-semibold">{heading}</th>) }
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {rows.map((row, index) => (
                    <tr key={row.band_slug} className="even:bg-slate-50">
                      <td className="px-3 py-2 text-slate-500 tabular-nums">{index + 2}</td>
                      <td className="px-3 py-2 font-semibold">{row.band_slug}</td>
                      <td className="px-3 py-2">{row.classification ?? "—"}</td>
                      <td className="px-3 py-2 tabular-nums">{row.total_score === null ? "—" : row.total_score.toFixed(3)}</td>
                      <td className="px-3 py-2 tabular-nums">{row.class_placement ?? "—"}</td>
                      <td className="px-3 py-2 tabular-nums">{row.overall_placement ?? "—"}</td>
                      <td className="max-w-72 px-3 py-2 text-slate-600">{row.notes ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-bold">Important: matching results may be overwritten</p>
            <p className="mt-2 leading-6">
              If a band already has a result in this round, the import updates its classification, total score, placements, and notes. Existing caption scores are not changed. Blank optional CSV cells can replace existing values with empty values. The import does not create new band profiles, and it only applies to this round.
            </p>
          </div>

          <form action={bulkImportRoundResults} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
            <h4 className="font-bold">4. Confirm and save</h4>
            <input type="hidden" name="competition_id" value={competitionId} />
            <input type="hidden" name="round_id" value={roundId} />
            <input type="hidden" name="payload" value={JSON.stringify(rows)} />
            <label className="flex items-start gap-3 text-sm leading-6 text-slate-700">
              <input type="checkbox" name="confirm_import" value="yes" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1.5" />
              <span>I checked the CSV rows and understand that these values will be saved to the selected round.</span>
            </label>
            <label className="flex items-start gap-3 text-sm leading-6 text-slate-700">
              <input type="checkbox" checked={replaceAcknowledged} onChange={(e) => setReplaceAcknowledged(e.target.checked)} className="mt-1.5" />
              <span>I understand this may update previously entered totals, placements, classes, and notes.</span>
            </label>
            {confirmed && replaceAcknowledged ? <ImportButton count={rows.length} /> : (
              <button type="button" disabled className="rounded-lg bg-[#861F41] px-5 py-3 text-sm font-bold text-white opacity-50">Confirm import of {rows.length} results</button>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
