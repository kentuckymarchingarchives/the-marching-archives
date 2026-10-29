
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN } from "@/lib/band-validation";
import { organizationClasses } from "@/lib/competition-config";
import {
  calculateScoringFormula,
  defaultScoringFormula,
  type ScoringFormula,
} from "@/lib/scoring-formulas";

export type SpreadsheetSaveState = {
  status: "idle" | "success" | "error";
  message: string;
  savedCount: number;
};

type SubmittedRow = {
  entryId: string;
  classification: string | null;
  totalMode: "automatic" | "manual";
  manualTotal: string;
  classPlacement: string;
  overallPlacement: string;
  notes: string;
  captions: Record<string, string>;
};

function fail(
  message: string,
  savedCount = 0
): SpreadsheetSaveState {
  return {
    status: "error",
    message,
    savedCount,
  };
}

function decimal(
  raw: string,
  label: string,
  max = 999999
): number | null {
  if (raw === "") return null;

  if (!/^\d+(?:\.\d{1,4})?$/.test(raw)) {
    throw new Error(
      `${label} must contain no more than four decimal places.`
    );
  }

  const value = Number(raw);

  if (!Number.isFinite(value) || value > max) {
    throw new Error(`Invalid ${label}.`);
  }

  return value;
}

function placement(raw: string): number | null {
  if (raw === "") return null;

  if (!/^\d+$/.test(raw)) {
    throw new Error("Placements must be whole numbers.");
  }

  const value = Number(raw);

  if (
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > 1000000
  ) {
    throw new Error("Invalid placement.");
  }

  return value;
}

function isRow(value: unknown): value is SubmittedRow {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return false;
  }

  const row = value as Record<string, unknown>;

  return (
    typeof row.entryId === "string" &&
    UUID_PATTERN.test(row.entryId) &&
    (row.classification === null ||
      typeof row.classification === "string") &&
    (row.totalMode === "automatic" ||
      row.totalMode === "manual") &&
    typeof row.manualTotal === "string" &&
    typeof row.classPlacement === "string" &&
    typeof row.overallPlacement === "string" &&
    typeof row.notes === "string" &&
    !!row.captions &&
    typeof row.captions === "object" &&
    !Array.isArray(row.captions) &&
    Object.values(row.captions).every(
      (item) => typeof item === "string"
    )
  );
}

export async function saveSpreadsheetResults(
  _previous: SpreadsheetSaveState,
  form: FormData
): Promise<SpreadsheetSaveState> {
  const competitionId = String(
    form.get("competition_id") ?? ""
  );
  const roundId = String(form.get("round_id") ?? "");
  const payload = form.get("payload");
  const expectedFormula = form.get("formula_snapshot");

  if (
    !UUID_PATTERN.test(competitionId) ||
    !UUID_PATTERN.test(roundId) ||
    typeof payload !== "string" ||
    payload.length > 500000 ||
    typeof expectedFormula !== "string" ||
    expectedFormula.length > 30000
  ) {
    return fail("Invalid spreadsheet submission.");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(payload);
  } catch {
    return fail("Unable to read spreadsheet rows.");
  }

  if (
    !Array.isArray(parsed) ||
    parsed.length < 1 ||
    parsed.length > 500 ||
    !parsed.every(isRow)
  ) {
    return fail("Submit between 1 and 500 modified rows.");
  }

  const rows: SubmittedRow[] = parsed;
  const entryIds = rows.map((row) => row.entryId);

  if (new Set(entryIds).size !== rows.length) {
    return fail("Duplicate entry IDs were submitted.");
  }

  const supabase = await createClient();

  const { data: auth, error: authError } =
    await supabase.auth.getClaims();

  if (authError || !auth?.claims?.sub) {
    return fail("Please sign into your staff account.");
  }

  const { data: staff, error: staffError } =
    await supabase
      .from("staff_members")
      .select("role, status")
      .eq("user_id", auth.claims.sub)
      .maybeSingle();

  if (
    staffError ||
    staff?.status !== "active" ||
    !["owner", "admin", "editor"].includes(staff.role)
  ) {
    return fail("Active staff access is required.");
  }

  const { data: competition } = await supabase
    .from("competitions")
    .select(
      "organization_code, publication_status, archived_at"
    )
    .eq("id", competitionId)
    .maybeSingle();

  const { data: round } = await supabase
    .from("competition_rounds")
    .select("class_scope, archived_at")
    .eq("id", roundId)
    .eq("competition_id", competitionId)
    .maybeSingle();

  if (!competition || !round) {
    return fail("Competition round not found.");
  }

  if (
    competition.publication_status !== "draft" ||
    competition.archived_at ||
    round.archived_at
  ) {
    return fail(
      "Only active draft rounds can be edited."
    );
  }

  const { data: existing, error: entryError } =
    await supabase
      .from("competition_entries")
      .select("id")
      .eq("round_id", roundId)
      .in("id", entryIds);

  if (
    entryError ||
    (existing ?? []).length !== entryIds.length
  ) {
    return fail(
      "One or more band entries no longer belong to this round."
    );
  }

  const { data: captionData, error: captionError } =
    await supabase
      .from("score_captions")
      .select("id, name, max_score, multiplier")
      .eq("round_id", roundId)
      .order("sort_order", { ascending: true });

  if (captionError) {
    return fail("Unable to load current scoring captions.");
  }

  const { data: savedFormula, error: formulaError } =
    await supabase
      .from("round_scoring_formulas")
      .select("method, penalty, groups")
      .eq("round_id", roundId)
      .maybeSingle();

  if (formulaError) {
    return fail("Unable to load the round scoring formula.");
  }

  const formula: ScoringFormula = savedFormula
    ? {
        method: savedFormula.method as
          ScoringFormula["method"],
        penalty: Number(savedFormula.penalty),
        groups: Array.isArray(savedFormula.groups)
          ? (savedFormula.groups as
              ScoringFormula["groups"])
          : [],
      }
    : defaultScoringFormula();

  if (JSON.stringify(formula) !== expectedFormula) {
    return fail(
      "The scoring formula changed since you opened this spreadsheet. Reload before saving."
    );
  }

  const captions = captionData ?? [];
  const captionIds = new Set(
    captions.map((caption) => caption.id)
  );

  const formulaCaptions = captions.map((caption) => ({
    id: caption.id,
    name: caption.name,
    maxScore: Number(caption.max_score),
    multiplier: Number(caption.multiplier),
  }));

  const allowedClasses = organizationClasses(
    competition.organization_code
  );

  const validated: {
    entryId: string;
    classification: string | null;
    totalScore: number | null;
    classPlacement: number | null;
    overallPlacement: number | null;
    notes: string | null;
    captionScores: {
      caption_id: string;
      score: number | null;
    }[];
  }[] = [];

  try {
    // Validate all rows before making database changes.
    for (const row of rows) {
      if (
        row.classification &&
        !allowedClasses.includes(row.classification)
      ) {
        throw new Error(
          "An entry has an invalid classification."
        );
      }

      if (
        round.class_scope &&
        row.classification !== round.class_scope
      ) {
        throw new Error(
          "An entry's classification does not match the round."
        );
      }

      if (row.notes.length > 5000) {
        throw new Error("Result notes exceed 5,000 characters.");
      }

      const submittedIds = Object.keys(row.captions);

      if (
        submittedIds.length !== captionIds.size ||
        submittedIds.some(
          (captionId) => !captionIds.has(captionId)
        )
      ) {
        throw new Error(
          "Scoring captions have changed. Reload the spreadsheet."
        );
      }

      const scoreValues: Record<string, number | null> = {};

      const captionScores = captions.map((caption) => {
        const score = decimal(
          row.captions[caption.id],
          caption.name,
          Number(caption.max_score)
        );

        scoreValues[caption.id] = score;

        return {
          caption_id: caption.id,
          score,
        };
      });

      let totalScore: number | null;

      if (row.totalMode === "manual") {
        totalScore = decimal(
          row.manualTotal,
          "Official total"
        );
      } else {
        const calculation = calculateScoringFormula(
          formulaCaptions,
          scoreValues,
          formula
        );

        if (calculation.status === "invalid") {
          throw new Error(
            `Unable to calculate an entry: ${calculation.message}`
          );
        }

        totalScore = calculation.total;
      }

      validated.push({
        entryId: row.entryId,
        classification: row.classification || null,
        totalScore,
        classPlacement: placement(row.classPlacement),
        overallPlacement: placement(
          row.overallPlacement
        ),
        notes: row.notes.trim() || null,
        captionScores,
      });
    }
  } catch (error) {
    return fail(
      error instanceof Error
        ? error.message
        : "Invalid spreadsheet data."
    );
  }

  let savedCount = 0;

  for (const row of validated) {
    // Reuse the existing one-entry transaction.
    const { error } = await supabase.rpc(
      "save_round_entry_result",
      {
        p_entry_id: row.entryId,
        p_round_id: roundId,
        p_classification: row.classification,
        p_total_score: row.totalScore,
        p_class_placement: row.classPlacement,
        p_overall_placement: row.overallPlacement,
        p_notes: row.notes,
        p_caption_scores: row.captionScores,
      }
    );

    if (error) {
      console.error("Spreadsheet save:", error.message);

      revalidatePath(
        `/staff/competitions/${competitionId}` +
        `/rounds/${roundId}/spreadsheet`
      );

      return fail(
        `Save stopped after ${savedCount} of ${validated.length} entries. Previously saved entries may remain committed. Reload and review before retrying.`,
        savedCount
      );
    }

    savedCount++;
  }

  const base =
    `/staff/competitions/${competitionId}` +
    `/rounds/${roundId}`;

  revalidatePath(base);
  revalidatePath(`${base}/spreadsheet`);
  revalidatePath(`${base}/tools`);
  revalidatePath(
    `/staff/competitions/${competitionId}/review`
  );
  revalidatePath(
    `/staff/competitions/${competitionId}/publish`
  );

  return {
    status: "success",
    message: `${savedCount} modified ${
      savedCount === 1 ? "entry" : "entries"
    } saved successfully.`,
    savedCount,
  };
}
