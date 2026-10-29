
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN } from "@/lib/band-validation";
import { organizationClasses } from "@/lib/competition-config";

function read(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getId(form: FormData, key: string): string {
  const value = read(form, key);

  if (!UUID_PATTERN.test(value)) {
    throw new Error(`Invalid ${key}.`);
  }

  return value;
}

function decimal(input: string, label: string): number | null {
  if (input === "") return null;

  if (!/^\d+(?:\.\d{1,4})?$/.test(input)) {
    throw new Error(
      `${label} must be a nonnegative number with up to four decimal places.`
    );
  }

  const value = Number(input);

  if (!Number.isFinite(value) || value > 999999) {
    throw new Error(`Invalid ${label}.`);
  }

  return value;
}

function placement(input: string): number | null {
  if (!input) return null;

  if (!/^\d+$/.test(input)) {
    throw new Error("Placements must be whole numbers.");
  }

  const value = Number(input);

  if (
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > 1000000
  ) {
    throw new Error("Invalid placement.");
  }

  return value;
}

function returnUrl(
  competitionId: string,
  roundId: string,
  message: string,
  anchor: string
) {
  return (
    `/staff/competitions/${competitionId}` +
    `/rounds/${roundId}?message=${message}` +
    `#${anchor}`
  );
}

function refresh(competitionId: string, roundId: string) {
  revalidatePath(
    `/staff/competitions/${competitionId}/rounds/${roundId}`
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
    !["owner", "admin", "editor"].includes(staff.role)
  ) {
    throw new Error("Active staff access is required.");
  }

  const { data: competition, error: competitionError } =
    await supabase
      .from("competitions")
      .select("id, organization_code, publication_status")
      .eq("id", competitionId)
      .maybeSingle();

  if (competitionError || !competition) {
    throw new Error("Competition not found.");
  }

  if (competition.publication_status !== "draft") {
    throw new Error(
      "Published competition results are locked."
    );
  }

  const { data: round, error: roundError } =
    await supabase
      .from("competition_rounds")
      .select("id, class_scope")
      .eq("id", roundId)
      .eq("competition_id", competitionId)
      .maybeSingle();

  if (roundError || !round) {
    throw new Error("Round not found.");
  }

  return { supabase, competition, round };
}

export async function addRoundEntry(form: FormData) {
  const competitionId = getId(form, "competition_id");
  const roundId = getId(form, "round_id");
  const bandId = getId(form, "band_id");

  const { supabase, competition, round } =
    await requireDraftRound(competitionId, roundId);

  const classification =
    read(form, "classification") || null;

  if (
    classification &&
    !organizationClasses(
      competition.organization_code
    ).includes(classification)
  ) {
    throw new Error("Invalid classification.");
  }

  if (
    round.class_scope &&
    classification !== round.class_scope
  ) {
    throw new Error("Classification does not match round.");
  }

  const { data: band, error: bandError } =
    await supabase
      .from("bands")
      .select("id")
      .eq("id", bandId)
      .maybeSingle();

  if (bandError || !band) {
    throw new Error("Band not found.");
  }

  const { error } = await supabase
    .from("competition_entries")
    .insert({
      round_id: roundId,
      band_id: bandId,
      classification,
    });

  if (error) {
    if (error.code === "23505") {
      throw new Error(
        "This band is already entered in this round."
      );
    }

    console.error("Add band:", error.message);
    throw new Error("Unable to add band.");
  }

  refresh(competitionId, roundId);

  redirect(
    returnUrl(
      competitionId,
      roundId,
      "added",
      "add-band"
    )
  );
}

export async function addRoundCaption(form: FormData) {
  const competitionId = getId(form, "competition_id");
  const roundId = getId(form, "round_id");

  const { supabase } =
    await requireDraftRound(competitionId, roundId);

  const name = read(form, "name");
  const max = decimal(
    read(form, "max_score"),
    "Maximum score"
  );
  const multiplier = decimal(
    read(form, "multiplier"),
    "Multiplier"
  );

  if (name.length < 2 || name.length > 100) {
    throw new Error("Invalid caption name.");
  }

  if (max === null || max <= 0) {
    throw new Error("Maximum score must be above zero.");
  }

  if (multiplier === null) {
    throw new Error("Multiplier is required.");
  }

  const { data: existing, error: listError } =
    await supabase
      .from("score_captions")
      .select("sort_order")
      .eq("round_id", roundId)
      .order("sort_order", { ascending: false })
      .limit(1);

  if (listError) {
    throw new Error("Unable to read existing captions.");
  }

  const { error } = await supabase
    .from("score_captions")
    .insert({
      round_id: roundId,
      name,
      max_score: max,
      multiplier,
      sort_order:
        (existing?.[0]?.sort_order ?? 0) + 1,
    });

  if (error) {
    console.error("Add caption:", error.message);
    throw new Error("Unable to create caption.");
  }

  refresh(competitionId, roundId);

  redirect(
    returnUrl(
      competitionId,
      roundId,
      "caption",
      "captions"
    )
  );
}

export async function updateRoundCaption(form: FormData) {
  const competitionId = getId(form, "competition_id");
  const roundId = getId(form, "round_id");
  const captionId = getId(form, "caption_id");

  const { supabase } =
    await requireDraftRound(competitionId, roundId);

  const name = read(form, "name");
  const max = decimal(
    read(form, "max_score"),
    "Maximum score"
  );
  const multiplier = decimal(
    read(form, "multiplier"),
    "Multiplier"
  );

  if (name.length < 2 || name.length > 100) {
    throw new Error("Invalid caption name.");
  }

  if (max === null || max <= 0 || multiplier === null) {
    throw new Error("Invalid caption settings.");
  }

  // Prevent lowering the maximum below a saved score.
  const { data: existingScores, error: scoresError } =
    await supabase
      .from("caption_scores")
      .select("score")
      .eq("caption_id", captionId)
      .gt("score", max)
      .limit(1);

  if (scoresError) {
    throw new Error("Unable to validate existing scores.");
  }

  if (existingScores?.length) {
    throw new Error(
      "The new maximum is below an existing caption score."
    );
  }

  const { data: updated, error } = await supabase
    .from("score_captions")
    .update({
      name,
      max_score: max,
      multiplier,
    })
    .eq("id", captionId)
    .eq("round_id", roundId)
    .select("id")
    .maybeSingle();

  if (error || !updated) {
    console.error("Update caption:", error?.message);
    throw new Error("Unable to update caption.");
  }

  refresh(competitionId, roundId);

  redirect(
    returnUrl(
      competitionId,
      roundId,
      "caption_saved",
      `caption-${captionId}`
    )
  );
}

export async function saveEntryResults(form: FormData) {
  const competitionId = getId(form, "competition_id");
  const roundId = getId(form, "round_id");
  const entryId = getId(form, "entry_id");

  const { supabase, competition, round } =
    await requireDraftRound(competitionId, roundId);

  const classification =
    read(form, "classification") || null;

  if (
    classification &&
    !organizationClasses(
      competition.organization_code
    ).includes(classification)
  ) {
    throw new Error("Invalid classification.");
  }

  if (
    round.class_scope &&
    classification !== round.class_scope
  ) {
    throw new Error("Classification does not match round.");
  }

  const totalScore = decimal(
    read(form, "total_score"),
    "Total score"
  );
  const classPlacement = placement(
    read(form, "class_placement")
  );
  const overallPlacement = placement(
    read(form, "overall_placement")
  );
  const notes = read(form, "notes");

  if (notes.length > 5000) {
    throw new Error("Notes are too long.");
  }

  const { data: captions, error: captionsError } =
    await supabase
      .from("score_captions")
      .select("id, name, max_score")
      .eq("round_id", roundId);

  if (captionsError) {
    throw new Error("Unable to load captions.");
  }

  const captionScores = (captions ?? []).map(
    (caption) => {
      const value = decimal(
        read(form, `caption_${caption.id}`),
        caption.name
      );

      if (
        value !== null &&
        value > Number(caption.max_score)
      ) {
        throw new Error(
          `${caption.name} exceeds its maximum score.`
        );
      }

      return {
        caption_id: caption.id,
        score: value,
      };
    }
  );

  // All result fields and caption scores are saved
  // inside one database transaction.
  const { error } = await supabase.rpc(
    "save_round_entry_result",
    {
      p_entry_id: entryId,
      p_round_id: roundId,
      p_classification: classification,
      p_total_score: totalScore,
      p_class_placement: classPlacement,
      p_overall_placement: overallPlacement,
      p_notes: notes || null,
      p_caption_scores: captionScores,
    }
  );

  if (error) {
    console.error("Save result:", error.message);
    throw new Error(
      "The result could not be saved. No partial changes were committed."
    );
  }

  refresh(competitionId, roundId);

  redirect(
    returnUrl(
      competitionId,
      roundId,
      "saved",
      `entry-${entryId}`
    )
  );
}

/**
 * Remove one lineup entry without deleting the band
 * or any of its appearances in other rounds.
 */
export async function removeRoundEntry(form: FormData) {
  const competitionId = getId(form, "competition_id");
  const roundId = getId(form, "round_id");
  const entryId = getId(form, "entry_id");

  if (read(form, "confirm_remove") !== "REMOVE") {
    throw new Error("Type REMOVE to confirm lineup removal.");
  }

  const { supabase } =
    await requireDraftRound(competitionId, roundId);

  const { data: entry, error: entryError } = await supabase
    .from("competition_entries")
    .select("id")
    .eq("id", entryId)
    .eq("round_id", roundId)
    .maybeSingle();

  if (entryError || !entry) {
    throw new Error(
      "This band is no longer entered in this round."
    );
  }

  // Reuse the existing protected deletion function.
  // This must never delete the actual band profile.
  const { error } = await supabase.rpc(
    "tma_delete_round_entry",
    {
      p_round_id: roundId,
      p_entry_id: entryId,
    }
  );

  if (error) {
    console.error("Remove round entry:", error.message);
    throw new Error(
      `Unable to remove the band: ${error.message}`
    );
  }

  refresh(competitionId, roundId);
  revalidatePath(`/staff/competitions/${competitionId}`);
  revalidatePath(
    `/staff/competitions/${competitionId}/rounds/${roundId}/tools`
  );
  revalidatePath(`/staff/competitions/${competitionId}/review`);
  revalidatePath(`/staff/competitions/${competitionId}/publish`);

  redirect(
    returnUrl(
      competitionId,
      roundId,
      "removed",
      "lineup"
    )
  );
}
