
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN } from "@/lib/band-validation";
import { organizationClasses } from "@/lib/competition-config";

function getText(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getId(form: FormData, key: string) {
  const value = getText(form, key);

  if (!UUID_PATTERN.test(value)) {
    throw new Error(`Invalid ${key}.`);
  }

  return value;
}

function optionalDecimal(
  value: string,
  label: string
): number | null {
  if (!value) return null;

  if (!/^\d+(?:\.\d{1,4})?$/.test(value)) {
    throw new Error(
      `${label} must be a nonnegative number with up to four decimals.`
    );
  }

  const result = Number(value);

  if (!Number.isFinite(result) || result > 999999) {
    throw new Error(`Invalid ${label}.`);
  }

  return result;
}

function optionalPlacement(
  value: string
): number | null {
  if (!value) return null;

  const result = Number(value);

  if (
    !/^\d+$/.test(value) ||
    !Number.isSafeInteger(result) ||
    result < 1 ||
    result > 1000000
  ) {
    throw new Error(
      "Placements must be positive whole numbers."
    );
  }

  return result;
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
      "Published competition results are locked. Edit a draft instead."
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
    throw new Error(
      "Round does not belong to this competition."
    );
  }

  return { supabase, competition, round };
}

function resultsUrl(
  competitionId: string,
  roundId: string,
  message: string
) {
  return (
    `/staff/competitions/${competitionId}` +
    `/rounds/${roundId}?message=${message}`
  );
}

export async function addRoundEntry(form: FormData) {
  const competitionId = getId(form, "competition_id");
  const roundId = getId(form, "round_id");
  const bandId = getId(form, "band_id");

  const { supabase, competition, round } =
    await requireDraftRound(competitionId, roundId);

  const classification =
    getText(form, "classification") || null;

  const classes = organizationClasses(
    competition.organization_code
  );

  if (classification && !classes.includes(classification)) {
    throw new Error("Invalid classification.");
  }

  if (
    round.class_scope !== null &&
    classification !== round.class_scope
  ) {
    throw new Error(
      `This round requires ${round.class_scope} classification.`
    );
  }

  const { data: band, error: bandError } =
    await supabase
      .from("bands")
      .select("id")
      .eq("id", bandId)
      .maybeSingle();

  if (bandError || !band) {
    throw new Error("Selected band was not found.");
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

    console.error("Add entry:", error.message);
    throw new Error("Unable to add band to round.");
  }

  revalidatePath(
    `/staff/competitions/${competitionId}/rounds/${roundId}`
  );

  redirect(resultsUrl(competitionId, roundId, "added"));
}

export async function addRoundCaption(form: FormData) {
  const competitionId = getId(form, "competition_id");
  const roundId = getId(form, "round_id");

  const { supabase } =
    await requireDraftRound(competitionId, roundId);

  const name = getText(form, "name");
  const max = optionalDecimal(
    getText(form, "max_score"),
    "Maximum score"
  );
  const multiplier = optionalDecimal(
    getText(form, "multiplier"),
    "Multiplier"
  );

  if (name.length < 2 || name.length > 100) {
    throw new Error("Caption name must have 2–100 characters.");
  }

  if (max === null || max <= 0) {
    throw new Error("Maximum score must be above zero.");
  }

  if (multiplier === null) {
    throw new Error("A caption multiplier is required.");
  }

  const { data: existing, error: listError } =
    await supabase
      .from("score_captions")
      .select("sort_order")
      .eq("round_id", roundId)
      .order("sort_order", { ascending: false })
      .limit(1);

  if (listError) {
    throw new Error("Unable to check existing captions.");
  }

  const nextOrder = (existing?.[0]?.sort_order ?? 0) + 1;

  const { error } = await supabase
    .from("score_captions")
    .insert({
      round_id: roundId,
      name,
      max_score: max,
      multiplier,
      sort_order: nextOrder,
    });

  if (error) {
    console.error("Add caption:", error.message);
    throw new Error(
      "Unable to add caption. Check for a duplicate name."
    );
  }

  revalidatePath(
    `/staff/competitions/${competitionId}/rounds/${roundId}`
  );

  redirect(resultsUrl(competitionId, roundId, "caption"));
}

export async function saveEntryResults(form: FormData) {
  const competitionId = getId(form, "competition_id");
  const roundId = getId(form, "round_id");
  const entryId = getId(form, "entry_id");

  const { supabase, competition, round } =
    await requireDraftRound(competitionId, roundId);

  const { data: entry, error: entryError } =
    await supabase
      .from("competition_entries")
      .select("id")
      .eq("id", entryId)
      .eq("round_id", roundId)
      .maybeSingle();

  if (entryError || !entry) {
    throw new Error("Result entry not found.");
  }

  const classification =
    getText(form, "classification") || null;

  const classes = organizationClasses(
    competition.organization_code
  );

  if (classification && !classes.includes(classification)) {
    throw new Error("Invalid classification.");
  }

  if (
    round.class_scope &&
    classification !== round.class_scope
  ) {
    throw new Error(
      "Classification must match the round's class."
    );
  }

  const totalScore = optionalDecimal(
    getText(form, "total_score"),
    "Total score"
  );

  const classPlacement = optionalPlacement(
    getText(form, "class_placement")
  );

  const overallPlacement = optionalPlacement(
    getText(form, "overall_placement")
  );

  const notes = getText(form, "notes");

  if (notes.length > 5000) {
    throw new Error("Notes cannot exceed 5000 characters.");
  }

  const { data: captions, error: captionError } =
    await supabase
      .from("score_captions")
      .select("id, name, max_score")
      .eq("round_id", roundId);

  if (captionError) {
    throw new Error("Unable to validate caption definitions.");
  }

  // Validate all caption inputs before changing data.
  const suppliedScores = (captions ?? []).map((caption) => {
    const raw = getText(form, `caption_${caption.id}`);
    const value = optionalDecimal(raw, caption.name);

    if (
      value !== null &&
      value > Number(caption.max_score)
    ) {
      throw new Error(
        `${caption.name} exceeds its maximum score.`
      );
    }

    return { captionId: caption.id, value };
  });

  const { error: updateError } = await supabase
    .from("competition_entries")
    .update({
      classification,
      total_score: totalScore,
      class_placement: classPlacement,
      overall_placement: overallPlacement,
      notes: notes || null,
    })
    .eq("id", entryId)
    .eq("round_id", roundId);

  if (updateError) {
    console.error("Save results:", updateError.message);
    throw new Error("Unable to save result details.");
  }

  for (const score of suppliedScores) {
    if (score.value === null) {
      const { error } = await supabase
        .from("caption_scores")
        .delete()
        .eq("entry_id", entryId)
        .eq("caption_id", score.captionId);

      if (error) {
        throw new Error(
          "Result details saved, but a caption score could not be cleared."
        );
      }
    } else {
      const { error } = await supabase
        .from("caption_scores")
        .upsert(
          {
            entry_id: entryId,
            caption_id: score.captionId,
            score: score.value,
          },
          { onConflict: "entry_id,caption_id" }
        );

      if (error) {
        console.error("Caption score:", error.message);
        throw new Error(
          "Result details saved, but a caption score could not be saved."
        );
      }
    }
  }

  revalidatePath(
    `/staff/competitions/${competitionId}/rounds/${roundId}`
  );

  redirect(resultsUrl(competitionId, roundId, "saved"));
}
