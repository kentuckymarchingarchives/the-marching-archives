
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  UUID_PATTERN,
  validateBandFields,
  validateHistoricalName,
} from "@/lib/band-validation";

async function requireStaff() {
  const supabase = await createClient();

  const { data: auth, error: authError } =
    await supabase.auth.getClaims();

  const userId = auth?.claims?.sub;

  if (authError || !userId) {
    redirect("/staff/login");
  }

  const { data: staff, error: staffError } =
    await supabase
      .from("staff_members")
      .select("role, status")
      .eq("user_id", userId)
      .maybeSingle();

  if (
    staffError ||
    !staff ||
    staff.status !== "active" ||
    !["owner", "admin", "editor"].includes(staff.role)
  ) {
    throw new Error(
      "You do not have permission to manage bands."
    );
  }

  return supabase;
}

function getId(formData: FormData, key: string) {
  const value = formData.get(key);

  if (
    typeof value !== "string" ||
    !UUID_PATTERN.test(value)
  ) {
    throw new Error("Invalid record identifier.");
  }

  return value;
}

export async function createBand(formData: FormData) {
  const supabase = await requireStaff();
  const values = validateBandFields(formData);

  const { data, error } = await supabase
    .from("bands")
    .insert(values)
    .select("id")
    .single();

  if (error || !data) {
    console.error("Create band:", error?.message);
    throw new Error("Unable to create band.");
  }

  revalidatePath("/staff/bands");
  revalidatePath("/bands");

  redirect(`/staff/bands/${data.id}?created=1`);
}

export async function updateBand(formData: FormData) {
  const supabase = await requireStaff();
  const bandId = getId(formData, "band_id");
  const values = validateBandFields(formData);

  const { data, error } = await supabase
    .from("bands")
    .update(values)
    .eq("id", bandId)
    .select("id")
    .single();

  if (error || !data) {
    console.error("Update band:", error?.message);
    throw new Error("Unable to update band.");
  }

  revalidatePath("/staff/bands");
  revalidatePath(`/staff/bands/${bandId}`);
  revalidatePath("/bands");
  revalidatePath(`/bands/${bandId}`);

  redirect(`/staff/bands/${bandId}?saved=1`);
}

export async function addHistoricalName(
  formData: FormData
) {
  const supabase = await requireStaff();
  const bandId = getId(formData, "band_id");
  const values = validateHistoricalName(formData);

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
    .from("band_names")
    .insert({
      band_id: bandId,
      ...values,
    });

  if (error) {
    console.error(
      "Add historical name:",
      error.message
    );

    throw new Error(
      "Unable to add historical name."
    );
  }

  revalidatePath(`/staff/bands/${bandId}`);
  revalidatePath(`/bands/${bandId}`);

  redirect(`/staff/bands/${bandId}?name_added=1`);
}

export async function removeHistoricalName(
  formData: FormData
) {
  const supabase = await requireStaff();

  const bandId = getId(formData, "band_id");
  const nameId = getId(formData, "name_id");

  const { data, error } = await supabase
    .from("band_names")
    .delete()
    .eq("id", nameId)
    .eq("band_id", bandId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    throw new Error(
      "Historical name not found or could not be removed."
    );
  }

  revalidatePath(`/staff/bands/${bandId}`);
  revalidatePath(`/bands/${bandId}`);

  redirect(
    `/staff/bands/${bandId}?name_removed=1`
  );
}
