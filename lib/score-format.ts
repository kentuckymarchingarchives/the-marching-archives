/** Presentation-only score formatting. Never rounds stored or submitted values. */
export function formatTotalScore(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const score = Number(value);
  return Number.isFinite(score) ? score.toFixed(3) : "—";
}

/** Captions show at least two decimals, expanding when extra precision is meaningful. */
export function formatCaptionScore(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const score = Number(value);
  if (!Number.isFinite(score)) return "—";
  // Retain up to four decimal places, as supported by existing score-entry inputs.
  return score.toFixed(4).replace(/(\.\d{2}\d*?)0+$/, "$1");
}
