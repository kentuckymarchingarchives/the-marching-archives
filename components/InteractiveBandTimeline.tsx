"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export type TimelineEntry = {
  id: string;
  competitionName: string;
  competitionDate: string | null;
  organization: string;
  roundName: string;
  url: string;
  overallPlacement: number | null;
  classPlacement: number | null;
  classification: string | null;
  totalScore: string | null;
  championshipFinals: boolean;
};

type NameChange = { id: string; name: string; endYear: number | null };
export type TimelineSeason = { year: number; nameChanges: NameChange[]; entries: TimelineEntry[] };

type Props = {
  bandName: string;
  seasons: TimelineSeason[];
  undatedNames: NameChange[];
};

function score(value: string | null) {
  if (value === null || value.trim() === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const precision = (value.split(".")[1] ?? "").replace(/0+$/, "").length;
  return n.toFixed(Math.max(3, Math.min(precision, 8)));
}

function dateLabel(value: string | null) {
  if (!value) return "Date not recorded";
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return "Date not recorded";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export default function InteractiveBandTimeline({ seasons, undatedNames, bandName }: Props) {
  const [year, setYear] = useState("all");
  const [organization, setOrganization] = useState("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const organizations = useMemo(() => [...new Set(seasons.flatMap(s => s.entries.map(e => e.organization)))].sort(), [seasons]);
  const filtered = useMemo(() => seasons
    .filter(s => year === "all" || String(s.year) === year)
    .map(s => ({ ...s, entries: s.entries.filter(e => organization === "all" || e.organization === organization) }))
    .filter(s => s.entries.length > 0 || (organization === "all" && s.nameChanges.length > 0)), [seasons, year, organization]);
  const allEntries = filtered.flatMap(s => s.entries);
  const allYears = seasons.map(s => s.year);
  const firstPlaces = allEntries.filter(e => e.overallPlacement === 1).length;
  const podiums = allEntries.filter(e => e.overallPlacement !== null && e.overallPlacement >= 1 && e.overallPlacement <= 3).length;
  const finals = allEntries.filter(e => e.championshipFinals).length;
  const isExpanded = (y: number) => expanded[String(y)] ?? (filtered.length <= 3);
  const toggle = (y: number) => setExpanded(current => ({ ...current, [String(y)]: !(current[String(y)] ?? (filtered.length <= 3)) }));

  return (
    <div className="space-y-8">
      <section className="rounded-[26px] border border-[#DFE6EE] bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#861F41]">Interactive archive</p><h2 className="mt-2 text-2xl font-black tracking-tight">Season explorer</h2><p className="mt-2 text-sm text-slate-600">Filter {bandName}&apos;s documented history by year or organization.</p></div>
          <button type="button" onClick={() => {setYear("all");setOrganization("all");setExpanded({});}} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50">Reset filters</button>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold">Season
            <select value={year} onChange={e => {setYear(e.target.value);setExpanded({});}} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-[#002144] focus-visible:outline-2 focus-visible:outline-[#861F41]">
              <option value="all">All documented seasons</option>{allYears.map(y => <option key={y} value={String(y)}>{y}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold">Organization
            <select value={organization} onChange={e => {setOrganization(e.target.value);setExpanded({});}} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-[#002144] focus-visible:outline-2 focus-visible:outline-[#861F41]">
              <option value="all">All organizations</option>{organizations.map(org => <option key={org} value={org}>{org}</option>)}
            </select>
          </label>
        </div>
      </section>
      <section aria-label="Filtered competition history summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {([
          ["Documented seasons",filtered.filter(s => s.entries.length > 0).length],
          ["Round appearances",allEntries.length],
          ["Overall first places",firstPlaces],
          ["Overall podiums",podiums],
        ] as const).map(([label,count]) => <div key={label} className="rounded-xl border border-[#DFE6EE] bg-white p-5"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-3xl font-black tabular-nums">{count}</p></div>)}
      </section>
      <p className="rounded-xl border border-[#DFE6EE] bg-white px-5 py-4 text-sm leading-6 text-slate-600">This timeline displays published, non-archived competition records only. Semifinals and Finals are counted as separate round appearances. Missing seasons do not prove the ensemble did not compete. First places, podiums, and {finals} championship-finals round appearances in the current filter are derived from recorded placements, not independently verified championship titles.</p>
      {filtered.length === 0 ? <section className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-600">No documented history matches these filters.</section> :
      <section aria-label="Season-by-season timeline">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-black">Season-by-season history</h2><span className="text-sm text-slate-500">{filtered.length} {filtered.length === 1 ? "year" : "years"} shown</span></div>
        <div className="space-y-6 border-l-2 border-[#861F41]/30 pl-6 sm:pl-8">
          {filtered.map(s => <article key={s.year} className="relative rounded-2xl border border-[#DFE6EE] bg-white shadow-sm">
            <span aria-hidden="true" className="absolute -left-8.5 top-7 h-3 w-3 rounded-full border-2 border-white bg-[#861F41] sm:-left-10.5" />
            <button type="button" aria-expanded={isExpanded(s.year)} aria-controls={`timeline-year-${s.year}`} onClick={() => toggle(s.year)} className="flex w-full items-center justify-between gap-3 rounded-2xl p-5 text-left hover:bg-slate-50 sm:p-7">
              <span><span className="block text-3xl font-black">{s.year}</span><span className="mt-1 block text-sm text-slate-500">{s.entries.length} recorded round {s.entries.length === 1 ? "appearance" : "appearances"}</span></span>
              <span className="rounded-lg bg-[#F6F8FA] px-3 py-2 text-sm font-semibold text-[#861F41]">{isExpanded(s.year) ? "Hide −" : "Explore +"}</span>
            </button>
            {isExpanded(s.year) && <div id={`timeline-year-${s.year}`} className="border-t border-slate-100 px-5 pb-6 pt-3 sm:px-7">
              {organization === "all" && s.nameChanges.map(n => <p key={n.id} className="my-3 rounded-lg bg-[#F6F8FA] p-3 text-sm"><strong className="text-[#861F41]">Historical name recorded:</strong> {n.name} ({s.year}{n.endYear !== null ? `–${n.endYear}` : " onward"})</p>)}
              <ol className="divide-y divide-slate-100">{s.entries.map(e => <li key={e.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1"><p className="text-xs font-medium text-slate-500">{dateLabel(e.competitionDate)} · {e.organization} · {e.roundName}</p><Link href={e.url} className="mt-1 inline-block font-bold text-[#002144] hover:text-[#861F41] hover:underline">{e.competitionName} ↗</Link><div className="mt-2 flex flex-wrap gap-2 text-xs">{e.overallPlacement === 1 && <span className="rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-800">Overall 1st</span>}{e.championshipFinals && <span className="rounded-full bg-purple-50 px-2 py-1 font-semibold text-purple-800">Championship finals round</span>}</div></div>
                <dl className="grid shrink-0 grid-cols-3 gap-4 text-xs sm:text-right"><div><dt className="text-slate-500">Overall</dt><dd className="font-bold">{e.overallPlacement ?? "—"}</dd></div><div><dt className="text-slate-500">Class {e.classification ? `(${e.classification})` : ""}</dt><dd className="font-bold">{e.classPlacement ?? "—"}</dd></div><div><dt className="text-slate-500">Score</dt><dd className="font-bold tabular-nums">{score(e.totalScore)}</dd></div></dl>
              </li>)}</ol>
            </div>}
          </article>)}
        </div>
      </section>}
      {undatedNames.length > 0 && <section className="rounded-xl border border-slate-200 bg-white p-6"><h2 className="text-lg font-bold">Additional historical names (start year unknown)</h2><ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">{undatedNames.map(n => <li key={n.id}>{n.name}{n.endYear !== null ? ` (through ${n.endYear})` : ""}</li>)}</ul></section>}
    </div>
  );
}
