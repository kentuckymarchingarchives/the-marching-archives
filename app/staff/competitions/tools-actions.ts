
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN } from "@/lib/band-validation";
import { validateImportRows } from "@/lib/results-csv";

function read(form: FormData, key: string): string {
  const value = form.get(key);

  return typeof value === "string"
    ? value.trim()
    : "";
}

function uuid(form: FormData, key: string): string {
  const value = read(form, key);

  if (!UUID_PATTERN.test(value)) {
    throw new Error(`Invalid ${key}.`);
  }

  return value;
}

function toolsPath(
  competitionId: string,
  roundId: string
): string {
  return (
    `/staff/competitions/${competitionId}` +
    `/rounds/${roundId}/tools`
  );
}

function roundPath(
  competitionId: string,
  roundId: string
): string {
  return (
    `/staff/competitions/${competitionId}` +
    `/rounds/${roundId}`
  );
}

function finish(
  competitionId: string,
  roundId: string,
  message: string
): never {
  const base = roundPath(competitionId, roundId);

  revalidatePath(base);
  revalidatePath(toolsPath(competitionId, roundId));
  revalidatePath(`${base}/spreadsheet`);
  revalidatePath(
    `/staff/competitions/${competitionId}/review`
  );
  revalidatePath(
    `/staff/competitions/${competitionId}/publish`
  );

  redirect(
    `${toolsPath(competitionId, roundId)}` +
    `?message=${encodeURIComponent(message)}`
  );
}

async function requireDraftRound(
  competitionId: string,
  roundId: string
) {
  const supabase = await createClient();

  const { data: auth, error: authError } =
    await supabase.auth.getClaims();

  if (authError || !auth?.claims?.sub) {
    redirect("/staff/login");
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
    !["owner", "admin", "editor"].includes(
      staff.role
    )
  ) {
    throw new Error(
      "Active staff access is required."
    );
  }

  const {
    data: competition,
    error: competitionError,
  } = await supabase
    .from("competitions")
    .select(
      "id, publication_status, archived_at"
    )
    .eq("id", competitionId)
    .maybeSingle();

  if (competitionError || !competition) {
    throw new Error("Competition not found.");
  }

  if (
    competition.publication_status !== "draft" ||
    competition.archived_at
  ) {
    throw new Error(
      "Results can only be modified for active draft competitions."
    );
  }

  const { data: round, error: roundError } =
    await supabase
      .from("competition_rounds")
      .select("id, archived_at")
      .eq("id", roundId)
      .eq("competition_id", competitionId)
      .maybeSingle();

  if (roundError || !round || round.archived_at) {
    throw new Error(
      "The round does not belong to this active competition."
    );
  }

  return { supabase };
}

async function requireCompatibleTotalFormula(
  competitionId: string,
  roundId: string
) {
  const { supabase } = await requireDraftRound(
    competitionId,
    roundId
  );

  const { data: formula, error } = await supabase
    .from("round_scoring_formulas")
    .select("method, penalty")
    .eq("round_id", roundId)
    .maybeSingle();

  if (error) {
    throw new Error(
      "Unable to verify the round scoring formula. No totals were changed."
    );
  }

  // A round with no saved formula uses the
  // original weighted-sum calculation.
  const method = formula?.method ?? "weighted_sum";
  const penalty = Number(formula?.penalty ?? 0);

  if (
    method !== "weighted_sum" ||
    !Number.isFinite(penalty) ||
    penalty !== 0
  ) {
    throw new Error(
      "This round uses an advanced scoring formula. " +
      "Calculate automatic totals through the Live " +
      "Results Spreadsheet instead. No results " +
      "were changed."
    );
  }

  return supabase;
}

/**
 * Delete a single round entry.
 *
 * The database function handles the dependent
 * result records. The band profile itself is
 * not deleted.
 */
export async function deleteRoundResult(
  form: FormData
) {
  const competitionId = uuid(
    form,
    "competition_id"
  );

  const roundId = uuid(form, "round_id");
  const entryId = uuid(form, "entry_id");

  if (read(form, "confirm_delete") !== "DELETE") {
    throw new Error(
      "Type DELETE to confirm removal."
    );
  }

  const { supabase } = await requireDraftRound(
    competitionId,
    roundId
  );

  const { data: entry, error: entryError } =
    await supabase
      .from("competition_entries")
      .select("id")
      .eq("id", entryId)
      .eq("round_id", roundId)
      .maybeSingle();

  if (entryError || !entry) {
    throw new Error(
      "The selected entry no longer belongs to this round."
    );
  }

  const { error } = await supabase.rpc(
    "tma_delete_round_entry",
    {
      p_round_id: roundId,
      p_entry_id: entryId,
    }
  );

  if (error) {
    console.error(
      "Delete round result:",
      error.message
    );

    throw new Error(
      "Unable to remove the selected round entry."
    );
  }

  finish(competitionId, roundId, "deleted");
}

/**
 * Import competition results using the
 * existing validated CSV workflow.
 *
 * Imported official totals and placements
 * remain historical source data.
 */
export async function bulkImportRoundResults(
  form: FormData
) {
  const competitionId = uuid(
    form,
    "competition_id"
  );

  const roundId = uuid(form, "round_id");

  if (read(form, "confirm_import") !== "yes") {
    throw new Error(
      "Confirm the import before continuing."
    );
  }

  const payload = read(form, "payload");

  if (payload.length > 200000) {
    throw new Error(
      "The import file is too large."
    );
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(payload);
  } catch {
    throw new Error(
      "The imported data is not valid JSON."
    );
  }

  const rows = validateImportRows(parsed);

  const { supabase } = await requireDraftRound(
    competitionId,
    roundId
  );

  const { error } = await supabase.rpc(
    "tma_bulk_import_results",
    {
      p_round_id: roundId,
      p_rows: rows,
    }
  );

  if (error) {
    console.error(
      "Bulk results import:",
      error.message
    );

    throw new Error(
      "The results import was rejected. " +
      "Review the CSV values and try again."
    );
  }

  finish(competitionId, roundId, "imported");
}

/**
 * Calculate missing totals or placements.
 *
 * Missing totals:
 *   Only compatible with weighted_sum
 *   and a zero round-level deduction.
 *
 * Placements:
 *   Use already recorded official totals,
 *   regardless of formula type.
 */
export async function calculateRoundResults(
  form: FormData
) {
  const competitionId = uuid(
    form,
    "competition_id"
  );

  const roundId = uuid(form, "round_id");
  const mode = read(form, "mode");

  if (
    mode !== "missing_totals" &&
    mode !== "placements"
  ) {
    throw new Error(
      "Unknown calculation method."
    );
  }

  if (
    read(form, "confirm_calculate") !== "yes"
  ) {
    throw new Error(
      "Confirm the calculation first."
    );
  }

  let supabase;

  if (mode === "missing_totals") {
    supabase =
      await requireCompatibleTotalFormula(
        competitionId,
        roundId
      );
  } else {
    const checked = await requireDraftRound(
      competitionId,
      roundId
    );

    supabase = checked.supabase;
  }

  const { error } = await supabase.rpc(
    "tma_auto_round_results",
    {
      p_round_id: roundId,
      p_mode: mode,
    }
  );

  if (error) {
    console.error(
      "Calculate round results:",
      error.message
    );

    throw new Error(
      "Automatic calculation failed. " +
      "No successful calculation was confirmed."
    );
  }

  finish(
    competitionId,
    roundId,
    mode === "placements"
      ? "ranked"
      : "calculated"
  );
}
