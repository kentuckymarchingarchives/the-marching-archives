
export type ScoringMethod =
  | "weighted_sum"
  | "weighted_average"
  | "grouped";

export type CaptionGroup = {
  id: string;
  name: string;
  captionIds: string[];
  method: "sum" | "average";
  multiplier: number;
};

export type ScoringFormula = {
  method: ScoringMethod;
  groups?: CaptionGroup[];
  penalty: number;
};

export type FormulaCaption = {
  id: string;
  name: string;
  maxScore: number;
  multiplier: number;
};

export type FormulaResult = {
  status: "complete" | "incomplete" | "invalid";
  subtotal: number | null;
  penalty: number;
  total: number | null;
  message: string;
  groupResults: {
    name: string;
    score: number;
  }[];
};

const ROUNDING_FACTOR = 10000;

function roundScore(value: number): number {
  return (
    Math.round(
      (value + Number.EPSILON) * ROUNDING_FACTOR
    ) / ROUNDING_FACTOR
  );
}

function invalid(message: string): FormulaResult {
  return {
    status: "invalid",
    subtotal: null,
    penalty: 0,
    total: null,
    message,
    groupResults: [],
  };
}

function incomplete(message: string): FormulaResult {
  return {
    status: "incomplete",
    subtotal: null,
    penalty: 0,
    total: null,
    message,
    groupResults: [],
  };
}

export function defaultScoringFormula(): ScoringFormula {
  return {
    method: "weighted_sum",
    penalty: 0,
  };
}

export function calculateScoringFormula(
  captions: FormulaCaption[],
  scores: Record<string, number | null>,
  formula: ScoringFormula
): FormulaResult {
  if (
    !Number.isFinite(formula.penalty) ||
    formula.penalty < 0 ||
    formula.penalty > 999999
  ) {
    return invalid(
      "Penalty must be a finite, nonnegative number."
    );
  }

  if (!captions.length) {
    return incomplete(
      "Add scoring captions before calculating a total."
    );
  }

  const captionIds = new Set<string>();

  for (const caption of captions) {
    if (!caption.id || captionIds.has(caption.id)) {
      return invalid(
        "Caption identifiers must be unique."
      );
    }

    captionIds.add(caption.id);

    if (
      !Number.isFinite(caption.maxScore) ||
      caption.maxScore <= 0 ||
      !Number.isFinite(caption.multiplier) ||
      caption.multiplier < 0
    ) {
      return invalid(
        `Invalid settings for ${caption.name}.`
      );
    }
  }

  const weightedScores = new Map<string, number>();

  for (const caption of captions) {
    const score = scores[caption.id];

    if (score === null || score === undefined) {
      return incomplete(
        `A score is missing for ${caption.name}.`
      );
    }

    if (
      typeof score !== "number" ||
      !Number.isFinite(score) ||
      score < 0 ||
      score > caption.maxScore
    ) {
      return invalid(
        `${caption.name} must be between 0 and ${caption.maxScore}.`
      );
    }

    weightedScores.set(
      caption.id,
      score * caption.multiplier
    );
  }

  let subtotal = 0;
  const groupResults: FormulaResult["groupResults"] = [];

  if (formula.method === "weighted_sum") {
    subtotal = [...weightedScores.values()].reduce(
      (sum, value) => sum + value,
      0
    );
  } else if (formula.method === "weighted_average") {
    const weightSum = captions.reduce(
      (sum, caption) => sum + caption.multiplier,
      0
    );

    if (weightSum <= 0) {
      return invalid(
        "Weighted average requires positive total weight."
      );
    }

    const weightedSum = [
      ...weightedScores.values(),
    ].reduce((sum, value) => sum + value, 0);

    subtotal = weightedSum / weightSum;
  } else if (formula.method === "grouped") {
    const groups = formula.groups ?? [];

    if (!groups.length) {
      return incomplete(
        "Configure at least one scoring group."
      );
    }

    const included = new Set<string>();

    for (const group of groups) {
      if (
        !group.name.trim() ||
        !group.captionIds.length ||
        !Number.isFinite(group.multiplier) ||
        group.multiplier < 0 ||
        !["sum", "average"].includes(group.method)
      ) {
        return invalid(
          "A scoring group has invalid settings."
        );
      }

      const groupValues: number[] = [];

      for (const captionId of group.captionIds) {
        if (!captionIds.has(captionId)) {
          return invalid(
            `${group.name} references an unknown caption.`
          );
        }

        if (included.has(captionId)) {
          return invalid(
            "A caption is assigned to multiple scoring groups."
          );
        }

        included.add(captionId);
        groupValues.push(
          weightedScores.get(captionId)!
        );
      }

      const sum = groupValues.reduce(
        (acc, value) => acc + value,
        0
      );

      const groupScore =
        (group.method === "average"
          ? sum / groupValues.length
          : sum) * group.multiplier;

      subtotal += groupScore;

      groupResults.push({
        name: group.name,
        score: roundScore(groupScore),
      });
    }

    if (included.size !== captions.length) {
      return invalid(
        "Every caption must belong to exactly one scoring group."
      );
    }
  } else {
    return invalid("Unknown scoring formula.");
  }

  if (!Number.isFinite(subtotal)) {
    return invalid(
      "The calculated subtotal is invalid."
    );
  }

  const total = roundScore(
    subtotal - formula.penalty
  );

  if (
    !Number.isFinite(total) ||
    total < 0 ||
    total > 999999
  ) {
    return invalid(
      "The final score is outside the permitted range."
    );
  }

  return {
    status: "complete",
    subtotal: roundScore(subtotal),
    penalty: roundScore(formula.penalty),
    total,
    message: "Calculated successfully.",
    groupResults,
  };
}
