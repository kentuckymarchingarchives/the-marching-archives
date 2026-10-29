
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN } from "@/lib/band-validation";

function read(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function id(form: FormData, key: string): string {
  const value = read(form, key);
  if (!UUID_PATTERN.test(value)) {
    throw new Error(`Invalid ${key}.`);
  }
  return value;
}

function sourceUrl(raw: string): string | null {
  if (!raw) return null;

  if (raw.length > 2000) {
    throw new Error("Source URL is too long.");
  }

  let parsed: URL;

  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("Enter a valid source URL.");
  }

  if (
    !["https:", "http:"].includes(parsed.protocol) ||
    !parsed.hostname
  ) {
    throw new Error("Source URL must use HTTP or HTTPS.");
  }

  return parsed.toString();
}

function penaltyAmount(raw: string): number {
  if (!/^\d+(?:\.\d{1,4})?$/.test(raw)) {
    throw new Error(
      "Penalty must be a positive number with up to four decimal places."
    );
  }

  const amount = Number(raw);

  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 999999
  ) {
    throw new Error("Invalid penalty amount.");
  }

  return amount;
}

function details(form: FormData) {
  const amount = penaltyAmount(read(form, "amount"));
  const reason = read(form, "reason");
  const url = sourceUrl(read(form, "source_url"));

  if (reason.length < 3 || reason.length > 500) {
    throw new Error(
      "Penalty reason must be between 3 and 500 characters."
    );
  }

  return { amount, reason, source_url: url };
}

async function requireEditableRound(
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
    !["owner", "admin", "editor"].includes(staff.role)
  ) {
    throw new Error("Active staff access required.");
  }

  const { data: competition, error: competitionError } =
    await supabase
      .from("competitions")
      .select("id, publication_status, archived_at")
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
    !round ||
    competition.publication_status !== "draft" ||
    competition.archived_at ||
    round.archived_at
  ) {
    throw new Error(
      "Penalties may only be changed in active draft rounds."
    );
  }

  return { supabase, userId: auth.claims.sub };
}

function finish(
  competitionId: string,
  roundId: string,
  notice: string
): never {
  const base =
    `/staff/competitions/${competitionId}/rounds/${roundId}`;

  revalidatePath(`${base}/penalties`);
  revalidatePath(`${base}/spreadsheet`);
  revalidatePath(`${base}/tools`);
  revalidatePath(`${base}`);
  revalidatePath(
    `/staff/competitions/${competitionId}/review`
  );
  revalidatePath(
    `/staff/competitions/${competitionId}/publish`
  );

  redirect(
    `${base}/penalties?notice=${encodeURIComponent(notice)}`
  );
}

async function requireEntry(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entryId: string,
  roundId: string
) {
  const { data, error } = await supabase
    .from("competition_entries")
    .select("id")
    .eq("id", entryId)
    .eq("round_id", roundId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Band entry not found in this round.");
  }
}

export async function addEntryPenalty(form: FormData) {
  const competitionId = id(form, "competition_id");
  const roundId = id(form, "round_id");
  const entryId = id(form, "entry_id");

  const values = details(form);

  const { supabase, userId } =
    await requireEditableRound(competitionId, roundId);

  await requireEntry(supabase, entryId, roundId);

  const { error } = await supabase
    .from("round_entry_penalties")
    .insert({
      entry_id: entryId,
      ...values,
      created_by: userId,
      updated_by: userId,
    });

  if (error) {
    console.error("Add penalty:", error.message);
    throw new Error("Unable to add penalty.");
  }

  finish(competitionId, roundId, "added");
}

export async function updateEntryPenalty(form: FormData) {
  const competitionId = id(form, "competition_id");
  const roundId = id(form, "round_id");
  const penaltyId = id(form, "penalty_id");

  const values = details(form);

  const { supabase, userId } =
    await requireEditableRound(competitionId, roundId);

  const { data: penalty, error: lookupError } =
    await supabase
      .from("round_entry_penalties")
      .select("id, entry_id")
      .eq("id", penaltyId)
      .maybeSingle();

  if (lookupError || !penalty) {
    throw new Error("Penalty not found.");
  }

  await requireEntry(
    supabase,
    penalty.entry_id,
    roundId
  );

  const { data: updated, error } = await supabase
    .from("round_entry_penalties")
    .update({
      ...values,
      updated_by: userId,
    })
    .eq("id", penaltyId)
    .eq("entry_id", penalty.entry_id)
    .select("id")
    .maybeSingle();

  if (error || !updated) {
    console.error("Update penalty:", error?.message);
    throw new Error("Unable to update penalty.");
  }

  finish(competitionId, roundId, "updated");
}

export async function deleteEntryPenalty(form: FormData) {
  const competitionId = id(form, "competition_id");
  const roundId = id(form, "round_id");
  const penaltyId = id(form, "penalty_id");

  if (read(form, "confirm_remove") !== "REMOVE") {
    throw new Error("Type REMOVE to delete the penalty.");
  }

  const { supabase } =
    await requireEditableRound(competitionId, roundId);

  const { data: penalty, error: lookupError } =
    await supabase
      .from("round_entry_penalties")
      .select("id, entry_id")
      .eq("id", penaltyId)
      .maybeSingle();

  if (lookupError || !penalty) {
    throw new Error("Penalty not found.");
  }

  await requireEntry(
    supabase,
    penalty.entry_id,
    roundId
  );

  const { data: removed, error } = await supabase
    .from("round_entry_penalties")
    .delete()
    .eq("id", penaltyId)
    .eq("entry_id", penalty.entry_id)
    .select("id")
    .maybeSingle();

  if (error || !removed) {
    console.error("Delete penalty:", error?.message);
    throw new Error("Unable to remove penalty.");
  }

  finish(competitionId, roundId, "deleted");
}
