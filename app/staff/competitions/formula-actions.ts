
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN } from "@/lib/band-validation";
import type {
  CaptionGroup,
  ScoringFormula,
} from "@/lib/scoring-formulas";

export type FormulaSaveState = {
  status: "idle" | "success" | "error";
  message: string;
};

function failure(message: string): FormulaSaveState {
  return { status: "error", message };
}

export async function saveRoundScoringFormula(
  _previous: FormulaSaveState,
  form: FormData
): Promise<FormulaSaveState> {
  const competitionId = String(
    form.get("competition_id") ?? ""
  );
  const roundId = String(form.get("round_id") ?? "");
  const raw = form.get("formula");

  if (
    !UUID_PATTERN.test(competitionId) ||
    !UUID_PATTERN.test(roundId) ||
    typeof raw !== "string" ||
    raw.length > 30000
  ) {
    return failure("Invalid formula submission.");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return failure("Could not read scoring configuration.");
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed)
  ) {
    return failure("Invalid scoring configuration.");
  }

  const formula = parsed as ScoringFormula;

  if (
    ![
      "weighted_sum",
      "weighted_average",
      "grouped",
    ].includes(formula.method) ||
    typeof formula.penalty !== "number" ||
    !Number.isFinite(formula.penalty) ||
    formula.penalty < 0 ||
    formula.penalty > 999999 ||
    Math.round(formula.penalty * 10000) !==
      formula.penalty * 10000
  ) {
    return failure("Invalid method or penalty deduction.");
  }

  const supabase = await createClient();

  const { data: auth, error: authError } =
    await supabase.auth.getClaims();

  if (authError || !auth?.claims?.sub) {
    return failure("Please sign into your staff account.");
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
    return failure("Active staff access is required.");
  }

  const { data: competition, error: competitionError } =
    await supabase
      .from("competitions")
      .select("publication_status, archived_at")
      .eq("id", competitionId)
      .maybeSingle();

  const { data: round, error: roundError } =
    await supabase
      .from("competition_rounds")
      .select("id, archived_at")
      .eq("id", roundId)
      .eq("competition_id", competitionId)
      .maybeSingle();

  if (
    competitionError ||
    roundError ||
    !competition ||
    !round
  ) {
    return failure("Competition round not found.");
  }

  if (
    competition.publication_status !== "draft" ||
    competition.archived_at ||
    round.archived_at
  ) {
    return failure(
      "Only active draft rounds can change scoring formulas."
    );
  }

  const { data: captionData, error: captionError } =
    await supabase
      .from("score_captions")
      .select("id")
      .eq("round_id", roundId);

  if (captionError) {
    return failure("Unable to validate custom captions.");
  }

  const allCaptionIds = new Set(
    (captionData ?? []).map((caption) => caption.id)
  );

  let groups: CaptionGroup[] = [];

  if (formula.method === "grouped") {
    if (
      !Array.isArray(formula.groups) ||
      formula.groups.length < 1 ||
      formula.groups.length > 30
    ) {
      return failure("Create at least one valid scoring group.");
    }

    const used = new Set<string>();
    const groupNames = new Set<string>();

    for (const item of formula.groups) {
      if (
        !item ||
        typeof item !== "object" ||
        typeof item.id !== "string" ||
        item.id.length < 1 ||
        item.id.length > 100 ||
        typeof item.name !== "string" ||
        item.name.trim().length < 1 ||
        item.name.length > 100 ||
        !["sum", "average"].includes(item.method) ||
        typeof item.multiplier !== "number" ||
        !Number.isFinite(item.multiplier) ||
        item.multiplier < 0 ||
        item.multiplier > 999999 ||
        Math.round(item.multiplier * 10000) !==
          item.multiplier * 10000 ||
        !Array.isArray(item.captionIds) ||
        !item.captionIds.length
      ) {
        return failure("A scoring group has invalid settings.");
      }

      if (groupNames.has(item.name.trim().toLowerCase())) {
        return failure("Scoring group names must be unique.");
      }

      groupNames.add(item.name.trim().toLowerCase());

      for (const captionId of item.captionIds) {
        if (
          typeof captionId !== "string" ||
          !allCaptionIds.has(captionId) ||
          used.has(captionId)
        ) {
          return failure(
            "Each caption must belong to exactly one valid group."
          );
        }
        used.add(captionId);
      }
    }

    if (used.size !== allCaptionIds.size) {
      return failure(
        "Assign every custom caption to exactly one group."
      );
    }

    groups = formula.groups.map((item) => ({
      id: item.id,
      name: item.name.trim(),
      method: item.method,
      multiplier: item.multiplier,
      captionIds: [...item.captionIds],
    }));
  }

  const { error: saveError } = await supabase
    .from("round_scoring_formulas")
    .upsert(
      {
        round_id: roundId,
        method: formula.method,
        penalty: formula.penalty,
        groups,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "round_id" }
    );

  if (saveError) {
    console.error("Scoring formula save:", saveError.message);
    return failure(
      "Unable to save formula settings. Verify that the SQL migration was applied."
    );
  }

  const base =
    `/staff/competitions/${competitionId}` +
    `/rounds/${roundId}`;

  revalidatePath(`${base}/formula`);
  revalidatePath(`${base}/spreadsheet`);
  revalidatePath(base);

  return {
    status: "success",
    message:
      "Scoring formula saved. The spreadsheet will use it for new automatic calculations. Existing official totals were not changed.",
  };
}
