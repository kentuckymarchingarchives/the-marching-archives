
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN } from "@/lib/band-validation";

function read(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function requireManager() {
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
    !["owner", "admin"].includes(staff.role)
  ) {
    throw new Error(
      "Only Owners and Administrators may approve or publish results."
    );
  }

  return supabase;
}

function competitionId(form: FormData): string {
  const id = read(form, "competition_id");

  if (!UUID_PATTERN.test(id)) {
    throw new Error("Invalid competition identifier.");
  }

  return id;
}

function finish(
  id: string,
  message: string
): never {
  revalidatePath("/staff/competitions");
  revalidatePath(`/staff/competitions/${id}`);
  revalidatePath(`/staff/competitions/${id}/review`);
  revalidatePath(`/staff/competitions/${id}/publish`);
  revalidatePath("/competitions");
  revalidatePath("/bands");

  redirect(
    `/staff/competitions/${id}/publish?message=${message}`
  );
}

export async function approveCompetition(
  form: FormData
) {
  const id = competitionId(form);

  const notes = read(form, "review_notes");

  if (
    notes.length < 10 ||
    notes.length > 2000
  ) {
    throw new Error(
      "Review notes must be between 10 and 2000 characters."
    );
  }

  if (
    read(form, "verified") !== "yes"
  ) {
    throw new Error(
      "Confirm that you manually verified the historical results."
    );
  }

  const supabase = await requireManager();

  const { error } = await supabase.rpc(
    "tma_approve_competition",
    {
      p_competition_id: id,
      p_notes: notes,
    }
  );

  if (error) {
    console.error(
      "Approve competition:",
      error.message
    );

    throw new Error(
      `Approval failed: ${error.message}`
    );
  }

  finish(id, "approved");
}

export async function publishCompetition(
  form: FormData
) {
  const id = competitionId(form);

  if (read(form, "confirm_publish") !== "yes") {
    throw new Error(
      "Confirm publication before continuing."
    );
  }

  const supabase = await requireManager();

  const { error } = await supabase.rpc(
    "tma_publish_competition",
    {
      p_competition_id: id,
    }
  );

  if (error) {
    console.error(
      "Publish competition:",
      error.message
    );

    throw new Error(
      `Publishing failed: ${error.message}`
    );
  }

  finish(id, "published");
}

export async function unpublishCompetition(
  form: FormData
) {
  const id = competitionId(form);

  if (
    read(form, "confirmation") !== "UNPUBLISH"
  ) {
    throw new Error(
      "Type UNPUBLISH to confirm."
    );
  }

  const supabase = await requireManager();

  const { error } = await supabase.rpc(
    "tma_unpublish_competition",
    {
      p_competition_id: id,
    }
  );

  if (error) {
    console.error(
      "Unpublish competition:",
      error.message
    );

    throw new Error(
      `Unable to unpublish: ${error.message}`
    );
  }

  finish(id, "unpublished");
}
