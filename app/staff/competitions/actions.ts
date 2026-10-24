
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN } from "@/lib/band-validation";

import {
  COMPETITION_TYPES,
  SMBC_STAGES,
  ROUND_KINDS,
  allowedFormats,
  organizationClasses,
  makeRoundTemplates,
} from "@/lib/competition-config";

async function requireStaff() {
  const supabase = await createClient();

  const { data: auth, error: authError } =
    await supabase.auth.getClaims();

  const userId = auth?.claims?.sub;

  if (authError || !userId) {
    redirect("/staff/login");
  }

  const { data: staff, error } = await supabase
    .from("staff_members")
    .select("role, status")
    .eq("user_id", userId)
    .maybeSingle();

  if (
    error ||
    staff?.status !== "active" ||
    !["owner", "admin", "editor"].includes(staff.role)
  ) {
    throw new Error("Staff access is required.");
  }

  return supabase;
}

function read(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function nullable(value: string) {
  return value || null;
}

function getId(formData: FormData, key: string) {
  const value = read(formData, key);
  if (!UUID_PATTERN.test(value)) {
    throw new Error("Invalid competition identifier.");
  }
  return value;
}

function readDetails(formData: FormData) {
  const name = read(formData, "name");
  const yearString = read(formData, "season_year");
  const date = read(formData, "competition_date");
  const city = read(formData, "city");
  const state = read(formData, "state");
  const country = read(formData, "country");
  const sourceUrl = read(formData, "source_url");
  const notes = read(formData, "notes");

  const year = Number(yearString);

  if (name.length < 3 || name.length > 200) {
    throw new Error("Enter a valid competition name.");
  }

  if (
    !/^\d{4}$/.test(yearString) ||
    year < 1800 ||
    year > 2200
  ) {
    throw new Error("Enter a valid season year.");
  }

  if (date) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      Number.isNaN(Date.parse(`${date}T00:00:00Z`)) ||
      new Date(`${date}T00:00:00Z`)
        .toISOString()
        .slice(0, 10) !== date
    ) {
      throw new Error("Enter a valid competition date.");
    }
  }

  if (
    city.length > 120 ||
    state.length > 120 ||
    country.length < 2 ||
    country.length > 120 ||
    sourceUrl.length > 2000 ||
    notes.length > 5000
  ) {
    throw new Error("One or more fields are too long.");
  }

  if (sourceUrl) {
    let url: URL;
    try {
      url = new URL(sourceUrl);
    } catch {
      throw new Error("Enter a valid source URL.");
    }
    if (!["https:", "http:"].includes(url.protocol)) {
      throw new Error("Source URL must use HTTP or HTTPS.");
    }
  }

  return {
    name,
    season_year: year,
    competition_date: nullable(date),
    city: nullable(city),
    state: nullable(state),
    country,
    source_url: nullable(sourceUrl),
    notes: nullable(notes),
  };
}

export async function createCompetition(formData: FormData) {
  const supabase = await requireStaff();
  const details = readDetails(formData);

  const organization = read(formData, "organization_code");
  const type = read(formData, "competition_type");
  const format = read(formData, "competition_format");
  const rawStage = read(formData, "smbc_stage");

  if (
    !(COMPETITION_TYPES[organization] ?? []).some(
      (option) => option.value === type
    )
  ) {
    throw new Error("Invalid organization or competition type.");
  }

  if (!allowedFormats(organization, type).includes(format)) {
    throw new Error("Invalid competition format.");
  }

  const isSmbc = organization === "KMEA" && type === "smbc";
  const stage = isSmbc ? rawStage : null;

  if (
    isSmbc &&
    !SMBC_STAGES.some((option) => option.value === stage)
  ) {
    throw new Error("Select a valid SMBC stage.");
  }

  const { data: competition, error } = await supabase
    .from("competitions")
    .insert({
      ...details,
      organization_code: organization,
      competition_type: type,
      competition_format: format,
      smbc_stage: stage,
      publication_status: "draft",
    })
    .select("id")
    .single();

  if (error || !competition) {
    console.error("Create competition:", error?.message);
    throw new Error("Unable to create competition.");
  }

  const templates = makeRoundTemplates(
    organization,
    type,
    format,
    stage
  );

  if (templates.length > 0) {
    const { error: roundError } = await supabase
      .from("competition_rounds")
      .insert(
        templates.map((round) => ({
          ...round,
          competition_id: competition.id,
        }))
      );

    if (roundError) {
      console.error("Create rounds:", roundError.message);

      // Remove the incomplete draft if rounds failed.
      const { error: cleanupError } = await supabase
        .from("competitions")
        .delete()
        .eq("id", competition.id);

      if (cleanupError) {
        console.error(
          "Cleanup failed:",
          cleanupError.message
        );
      }

      throw new Error(
        "Competition rounds could not be created. Check the database before retrying."
      );
    }
  }

  revalidatePath("/staff/competitions");

  redirect(
    `/staff/competitions/${competition.id}?created=1`
  );
}

export async function updateCompetition(formData: FormData) {
  const supabase = await requireStaff();

  const competitionId = getId(
    formData,
    "competition_id"
  );
  const details = readDetails(formData);

  // Organization, format, and stage are intentionally
  // excluded from updates so historical rounds
  // cannot be silently reconfigured.

  const { data, error } = await supabase
    .from("competitions")
    .update(details)
    .eq("id", competitionId)
    .select("id")
    .single();

  if (error || !data) {
    console.error("Update competition:", error?.message);
    throw new Error("Unable to save competition.");
  }

  revalidatePath("/staff/competitions");
  revalidatePath(`/staff/competitions/${competitionId}`);

  redirect(
    `/staff/competitions/${competitionId}?saved=1`
  );
}

export async function addCompetitionRound(formData: FormData) {
  const supabase = await requireStaff();

  const competitionId = getId(
    formData,
    "competition_id"
  );

  const name = read(formData, "round_name");
  const kind = read(formData, "round_kind");
  const classScope = read(formData, "class_scope");

  if (name.length < 2 || name.length > 120) {
    throw new Error("Enter a valid round name.");
  }

  if (
    !ROUND_KINDS.some((round) => round.value === kind)
  ) {
    throw new Error("Choose a valid round type.");
  }

  const { data: competition, error: competitionError } =
    await supabase
      .from("competitions")
      .select("organization_code, publication_status")
      .eq("id", competitionId)
      .maybeSingle();

  if (competitionError || !competition) {
    throw new Error("Competition not found.");
  }

  if (competition.publication_status !== "draft") {
    throw new Error(
      "New rounds can only be added to draft competitions."
    );
  }

  if (
    classScope &&
    !organizationClasses(
      competition.organization_code
    ).includes(classScope)
  ) {
    throw new Error("Invalid round classification.");
  }

  const { data: existing, error: listError } =
    await supabase
      .from("competition_rounds")
      .select("sort_order")
      .eq("competition_id", competitionId)
      .order("sort_order", { ascending: false })
      .limit(1);

  if (listError) {
    throw new Error("Unable to check existing rounds.");
  }

  const nextOrder = (existing?.[0]?.sort_order ?? 0) + 1;

  const { error } = await supabase
    .from("competition_rounds")
    .insert({
      competition_id: competitionId,
      name,
      round_kind: kind,
      class_scope: classScope || null,
      sort_order: nextOrder,
    });

  if (error) {
    console.error("Add round:", error.message);
    throw new Error("Unable to add competition round.");
  }

  revalidatePath(`/staff/competitions/${competitionId}`);

  redirect(
    `/staff/competitions/${competitionId}?round_added=1`
  );
}
