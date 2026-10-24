
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN } from "@/lib/band-validation";
import { validateImportRows } from "@/lib/results-csv";

function read(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function uuid(form: FormData, key: string): string {
  const value = read(form, key);
  if (!UUID_PATTERN.test(value)) {
    throw new Error(`Invalid ${key}.`);
  }
  return value;
}

async function staffClient() {
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
    !["owner", "admin", "editor"].includes(staff.role)
  ) {
    throw new Error("Active staff access required.");
  }

  return supabase;
}

function toolsPath(
  competitionId: string,
  roundId: string
) {
  return `/staff/competitions/${competitionId}/rounds/${roundId}/tools`;
}

function finish(
  competitionId: string,
  roundId: string,
  message: string
): never {
  revalidatePath(
    `/staff/competitions/${competitionId}/rounds/${roundId}`
  );
  revalidatePath(toolsPath(competitionId, roundId));

  redirect(
    `${toolsPath(competitionId, roundId)}?message=${message}`
  );
}

async function checkRound(
  competitionId: string,
  roundId: string
) {
  const supabase = await staffClient();

  const { data: round, error } = await supabase
    .from("competition_rounds")
    .select("id")
    .eq("id", roundId)
    .eq("competition_id", competitionId)
    .maybeSingle();

  if (error || !round) {
    throw new Error(
      "Round does not belong to this competition."
    );
  }

  return supabase;
}

export async function deleteRoundResult(form: FormData) {
  const competitionId = uuid(form, "competition_id");
  const roundId = uuid(form, "round_id");
  const entryId = uuid(form, "entry_id");

  if (read(form, "confirm_delete") !== "DELETE") {
    throw new Error("Deletion was not confirmed.");
  }

  const supabase = await checkRound(
    competitionId,
    roundId
  );

  const { error } = await supabase.rpc(
    "tma_delete_round_entry",
    {
      p_round_id: roundId,
      p_entry_id: entryId,
    }
  );

  if (error) {
    console.error("Delete result:", error.message);
    throw new Error(
      `Unable to delete entry: ${error.message}`
    );
  }

  finish(competitionId, roundId, "deleted");
}

export async function bulkImportRoundResults(
  form: FormData
) {
  const competitionId = uuid(form, "competition_id");
  const roundId = uuid(form, "round_id");

  if (read(form, "confirm_import") !== "yes") {
    throw new Error("Confirm the import first.");
  }

  const payload = read(form, "payload");

  if (payload.length > 200000) {
    throw new Error("Import file is too large.");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(payload);
  } catch {
    throw new Error("Invalid import data.");
  }

  const rows = validateImportRows(parsed);
  const supabase = await checkRound(
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
    console.error("Bulk import:", error.message);
    throw new Error(
      `Import rejected: ${error.message}`
    );
  }

  finish(competitionId, roundId, "imported");
}

export async function calculateRoundResults(
  form: FormData
) {
  const competitionId = uuid(form, "competition_id");
  const roundId = uuid(form, "round_id");
  const mode = read(form, "mode");

  if (!["missing_totals", "placements"].includes(mode)) {
    throw new Error("Unknown calculation.");
  }

  if (read(form, "confirm_calculate") !== "yes") {
    throw new Error("Confirm the calculation first.");
  }

  const supabase = await checkRound(
    competitionId,
    roundId
  );

  const { error } = await supabase.rpc(
    "tma_auto_round_results",
    {
      p_round_id: roundId,
      p_mode: mode,
    }
  );

  if (error) {
    console.error("Calculate results:", error.message);
    throw new Error(
      `Calculation failed: ${error.message}`
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
