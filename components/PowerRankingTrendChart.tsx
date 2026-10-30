"use client";

import { useId } from "react";

type TrendEdition = {
  id: string;
  label: string;
  rank: number | null;
  description: string;
};

export default function PowerRankingTrendChart({
  editions,
}: {
  editions: TrendEdition[];
}) {
  const titleId = useId();
  const descriptionId = useId();
  const validRanks = editions
    .map((entry) => entry.rank)
    .filter((rank): rank is number => typeof rank === "number" && Number.isFinite(rank) && rank >= 1);

  if (validRanks.length === 0) {
    return (
      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
        No numbered positions are available to graph. Unranked groups and honorable mentions remain visible in the history table.
      </div>
    );
  }

  const left = 58;
  const right = 32;
  const top = 26;
  const bottom = 70;
  const height = 290;
  const width = Math.max(600, editions.length * 92 + left + right);
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const highest = Math.max(5, ...validRanks);
  const axisMax = Math.ceil(highest / 5) * 5;
  const x = (i: number) => left + (editions.length === 1 ? plotWidth / 2 : (i / (editions.length - 1)) * plotWidth);
  const y = (rank: number) => top + ((rank - 1) / Math.max(1, axisMax - 1)) * plotHeight;
  const ticks = [...new Set([1, Math.ceil((axisMax + 1) / 4), Math.ceil((axisMax + 1) / 2), Math.ceil((axisMax * 3 + 1) / 4), axisMax])].sort((a, b) => a - b);
  // A gap interrupts the line; we do not imply a position in an unranked edition.
  const segments: string[] = [];
  let active = "";
  editions.forEach((edition, index) => {
    if (edition.rank === null || !Number.isFinite(edition.rank) || edition.rank < 1) {
      if (active) segments.push(active);
      active = "";
    } else {
      active += `${active ? " L" : "M"}${x(index).toFixed(2)},${y(edition.rank).toFixed(2)}`;
    }
  });
  if (active) segments.push(active);

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5" aria-label="Ranking trend chart">
      <h3 className="text-base font-bold text-[#002144]">Ranking progression</h3>
      <p className="mt-1 text-sm text-slate-600">Higher positions appear toward the top. Dots represent documented ranks, not calculated power scores.</p>
      <div className="mt-4 overflow-x-auto" role="region" aria-label="Scrollable ranking trend graph" tabIndex={0}>
        <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-labelledby={`${titleId} ${descriptionId}`} className="max-w-none">
          <title id={titleId}>Historical ranking positions by edition</title>
          <desc id={descriptionId}>{editions.map(e => `${e.label}: ${e.rank !== null ? `rank ${e.rank}` : e.description}`).join("; ")}. Missing or unnumbered editions interrupt the line.</desc>
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={left} y1={y(tick)} x2={width - right} y2={y(tick)} stroke="#cbd5e1" strokeDasharray="4 5" />
              <text x={left - 12} y={y(tick) + 4} textAnchor="end" fill="#475569" fontSize="12">#{tick}</text>
            </g>
          ))}
          {segments.map((segment, index) => (
            <path key={index} d={segment} stroke="#861F41" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          ))}
          {editions.map((edition, index) => (
            <g key={edition.id}>
              {edition.rank !== null && Number.isFinite(edition.rank) && edition.rank >= 1 && (
                <>
                  <circle cx={x(index)} cy={y(edition.rank)} r="6" fill="#861F41" stroke="white" strokeWidth="2" />
                  <text x={x(index)} y={Math.max(13, y(edition.rank) - 12)} textAnchor="middle" fontSize="12" fontWeight="700" fill="#002144">#{edition.rank}</text>
                </>
              )}
              <text x={x(index)} y={height - 40} textAnchor="middle" fill="#334155" fontSize="12">{index + 1}</text>
            </g>
          ))}
          <text x={left} y={height - 14} fill="#64748b" fontSize="12">Edition number (chronological) →</text>
        </svg>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500">Editions are numbered left to right in the same order as the table below. A gap indicates a missing or unnumbered position; it is not a zero ranking.</p>
    </section>
  );
}
