"use client";

import { useState } from "react";
import { saveSectionSchedule } from "./actions";

function toLocalInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function localToUtc(value: string): string {
  if (!value) return "";
  const date = new Date(value); // datetime-local interpreted in user's browser timezone
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

export default function ScheduleEditor({
  sectionKey,
  startAt,
  endAt,
}: {
  sectionKey: string;
  startAt: string | null;
  endAt: string | null;
}) {
  const [enabled, setEnabled] = useState(Boolean(startAt && endAt));
  const [start, setStart] = useState(() => toLocalInput(startAt));
  const [end, setEnd] = useState(() => toLocalInput(endAt));
  const valid = !enabled || Boolean(start && end && new Date(end).getTime() > new Date(start).getTime());

  return (
    <form action={saveSectionSchedule} className="mt-6 border-t border-slate-200 pt-5">
      <input type="hidden" name="section_key" value={sectionKey} />
      <input type="hidden" name="schedule_start_utc" value={enabled ? localToUtc(start) : ""} />
      <input type="hidden" name="schedule_end_utc" value={enabled ? localToUtc(end) : ""} />

      <label className="flex items-center gap-3 text-sm font-semibold text-[#002144]">
        <input
          type="checkbox"
          name="schedule_enabled"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
          className="h-5 w-5 accent-[#861F41]"
        />
        Schedule an automatic offline window
      </label>

      {enabled && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-bold text-slate-700">
            Offline begins (your local time)
            <input
              type="datetime-local"
              value={start}
              required
              onChange={(event) => setStart(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-[#002144]"
            />
          </label>
          <label className="block text-xs font-bold text-slate-700">
            Automatically returns online (your local time)
            <input
              type="datetime-local"
              value={end}
              required
              onChange={(event) => setEnd(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-[#002144]"
            />
          </label>
        </div>
      )}
      <p className="mt-3 text-xs leading-5 text-slate-500">
        Times are interpreted using your browser timezone and stored in UTC.
        The separate manual Offline switch takes precedence and must be off for automatic restoration.
      </p>
      {!valid && <p role="alert" className="mt-2 text-xs font-semibold text-red-700">End time must be after start time.</p>}
      <button
        type="submit"
        disabled={!valid}
        className="mt-4 rounded-xl border border-[#861F41] px-4 py-2.5 text-sm font-bold text-[#861F41] hover:bg-[#861F41]/5 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {enabled ? "Save schedule" : startAt ? "Cancel existing schedule" : "Save no schedule"}
      </button>
    </form>
  );
}
