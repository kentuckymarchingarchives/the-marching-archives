
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN } from "@/lib/band-validation";
import { organizationClasses } from "@/lib/competition-config";

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

const initialError = (
  message: string,
  savedCount = 0
): SpreadsheetSaveState => ({
  status: "error",
  message,
  savedCount,
});

function decimal(
  value: string,
  label: string,
  max = 999999
): number | null {
  if (value === "") return null;

  if (!/^\d+(?:\.\d{1,4})?$/.test(value)) {
    throw new Error(
      `${label} must be a nonnegative number with no more than four decimal places.`
    );
  }

  const number = Number(value);

  if (!Number.isFinite(number) || number > max) {
    throw new Error(`Invalid ${label}.`);
  }

  return number;
}

function rank(value: string): number | null {
  if (value === "") return null;

  if (!/^\d+$/.test(value)) {
    throw new Error("Placements must be whole numbers.");
  }

  const number = Number(value);

  if (
    !Number.isSafeInteger(number) ||
    number < 1 ||
    number > 1000000
  ) {
    throw new Error("Invalid placement.");
  }

  return number;
}

function isRow(value: unknown): value is SubmittedRow {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return false;
  }

  const item = value as Record<string, unknown>;

  return (
    typeof item.entryId === "string" &&
    UUID_PATTERN.test(item.entryId) &&
    (item.classification === null ||
      typeof item.classification === "string") &&
    (item.totalMode === "automatic" ||
      item.totalMode === "manual") &&
    typeof item.manualTotal === "string" &&
    typeof item.classPlacement === "string" &&
    typeof item.overallPlacement === "string" &&
    typeof item.notes === "string" &&
    !!item.captions &&
    typeof item.captions === "object" &&
    !Array.isArray(item.captions) &&
    Object.values(item.captions).every(
      (score) => typeof score === "string"
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

  if (
    !UUID_PATTERN.test(competitionId) ||
    !UUID_PATTERN.test(roundId)
  ) {
    return initialError("Invalid competition or round.");
  }

  if (
    typeof payload !== "string" ||
    payload.length > 500000
  ) {
    return initialError("Invalid spreadsheet submission.");
  }

  let submitted: unknown;

  try {
    submitted = JSON.parse(payload);
  } catch {
    return initialError("Unable to read spreadsheet data.");
  }

  if (
    !Array.isArray(submitted) ||
    submitted.length < 1 ||
    submitted.length > 500 ||
    !submitted.every(isRow)
  ) {
    return initialError(
      "Choose between 1 and 500 valid modified rows."
    );
  }

  const rows = submitted as SubmittedRow[];

  const uniqueIds = new Set(rows.map((row) => row.entryId));

  if (uniqueIds.size !== rows.length) {
    return initialError("Duplicate spreadsheet entries found.");
  }

  const supabase = await createClient();

  const { data: auth, error: authError } =
    await supabase.auth.getClaims();

  if (authError || !auth?.claims?.sub) {
    return initialError(
      "Your staff session has expired. Sign in again."
    );
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
    return initialError(
      "Active staff authorization is required."
    );
  }

  const { data: competition, error: competitionError } =
    await supabase
      .from("competitions")
      .select(
        "id, organization_code, publication_status, archived_at"
      )
      .eq("id", competitionId)
      .maybeSingle();

  if (competitionError || !competition) {
    return initialError("Competition not found.");
  }

  if (
    competition.publication_status !== "draft" ||
    competition.archived_at
  ) {
    return initialError(
      "Only active draft competitions can be edited."
    );
  }

  const { data: round, error: roundError } =
    await supabase
      .from("competition_rounds")
      .select("id, class_scope, archived_at")
      .eq("id", roundId)
      .eq("competition_id", competitionId)
      .maybeSingle();

  if (roundError || !round || round.archived_at) {
    return initialError("Round not found or archived.");
  }

  const { data: entryData, error: entriesError } =
    await supabase
      .from("competition_entries")
      .select("id")
      .eq("round_id", roundId)
      .in("id", [...uniqueIds]);

  if (
    entriesError ||
    (entryData ?? []).length !== uniqueIds.size
  ) {
    return initialError(
      "One or more entries no longer belong to this round."
    );
  }

  const { data: captionData, error: captionsError } =
    await supabase
      .from("score_captions")
      .select("id, name, max_score, multiplier")
      .eq("round_id", roundId)
      .order("sort_order", { ascending: true });

  if (captionsError) {
    return initialError("Unable to validate scoring captions.");
  }

  const captions = captionData ?? [];
  const captionIds = new Set(
    captions.map((caption) => caption.id)
  );

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
    // Validate the ENTIRE submission before writing anything.
    for (const row of rows) {
      if (
        row.classification &&
        !allowedClasses.includes(row.classification)
      ) {
        throw new Error(
          "A row has an invalid classification."
        );
      }

      if (
        round.class_scope &&
        row.classification !== round.class_scope
      ) {
        throw new Error(
          "A classification does not match this round."
        );
      }

      if (row.notes.length > 5000) {
        throw new Error("Result notes are too long.");
      }

      const submittedCaptionIds = Object.keys(row.captions);

      if (
        submittedCaptionIds.length !== captionIds.size ||
        submittedCaptionIds.some(
          (captionId) => !captionIds.has(captionId)
        )
      ) {
        throw new Error(
          "The scoring captions changed. Reload the spreadsheet."
        );
      }

      const captionScores = captions.map((caption) => {
        const value = decimal(
          row.captions[caption.id],
          caption.name,
          Number(caption.max_score)
        );

        return {
          caption_id: caption.id,
          score: value,
        };
      });

      let calculated: number | null = null;

      if (
        captions.length > 0 &&
        captionScores.every((item) => item.score !== null)
      ) {
        const total = captionScores.reduce(
          (sum, item) => {
            const caption = captions.find(
              (candidate) => candidate.id === item.caption_id
            )!;

            return (
              sum +
              Number(item.score) *
                Number(caption.multiplier)
            );
          },
          0
        );

        calculated = Number(total.toFixed(4));

        if (
          !Number.isFinite(calculated) ||
          calculated < 0 ||
          calculated > 999999
        ) {
          throw new Error(
            "Calculated total is outside the permitted range."
          );
        }
      }

      const totalScore =
        row.totalMode === "manual"
          ? decimal(row.manualTotal, "Official total")
          : calculated;

      validated.push({
        entryId: row.entryId,
        classification: row.classification || null,
        totalScore,
        classPlacement: rank(row.classPlacement),
        overallPlacement: rank(row.overallPlacement),
        notes: row.notes.trim() || null,
        captionScores,
      });
    }
  } catch (error) {
    return initialError(
      error instanceof Error
        ? error.message
        : "Invalid spreadsheet values."
    );
  }

  let savedCount = 0;

  for (const row of validated) {
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
      console.error(
        "Spreadsheet save failed:",
        error.message
      );

      revalidatePath(
        `/staff/competitions/${competitionId}/rounds/${roundId}`
      );

      return initialError(
        `Saving stopped after ${savedCount} of ${validated.length} modified rows. Earlier rows may have been saved. Reload the spreadsheet before retrying.`,
        savedCount
      );
    }

    savedCount++;
  }

  revalidatePath(
    `/staff/competitions/${competitionId}/rounds/${roundId}`
  );

  revalidatePath(
    `/staff/competitions/${competitionId}/rounds/${roundId}/spreadsheet`
  );

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
