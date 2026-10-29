import {
  calculateScoringFormula,
  type FormulaCaption,
  type FormulaResult,
  type ScoringFormula,
} from "@/lib/scoring-formulas";

export function normalizePenalty(amount: number): number {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Invalid penalty amount.");
  }
  return Math.round(amount * 10000) / 10000;
}

export function calculatePenaltyAwareScore(
  captions: FormulaCaption[],
  scores: Record<string, number | null>,
  formula: ScoringFormula,
  individualPenalty: number
): FormulaResult {
  const totalDeduction = normalizePenalty(
    formula.penalty + normalizePenalty(individualPenalty)
  );
  if (totalDeduction > 999999) {
    return {
      status: "invalid", subtotal: null,
      penalty: totalDeduction, total: null,
      message: "Combined deductions exceed the permitted limit.",
      groupResults: [],
    };
  }
  return calculateScoringFormula(captions, scores, {
    ...formula, penalty: totalDeduction,
  });
}

export function totalPenaltyForEntries(
  records: { entry_id: string; amount: number | string }[]
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const record of records) {
    const amount = Number(record.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Invalid recorded penalty amount.");
    }
    totals[record.entry_id] = normalizePenalty(
      (totals[record.entry_id] ?? 0) + amount
    );
  }
  return totals;
}
