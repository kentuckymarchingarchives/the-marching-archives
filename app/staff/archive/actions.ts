
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN } from "@/lib/band-validation";

function read(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function manageArchive(form: FormData) {
  const kind = read(form, "kind");
  const id = read(form, "record_id");
  const operation = read(form, "operation");

  if (!["band", "competition", "round"].includes(kind)) {
    throw new Error("Invalid record type.");
  }

  if (!UUID_PATTERN.test(id)) {
    throw new Error("Invalid record ID.");
  }

  if (!["archive", "restore", "delete"].includes(operation)) {
    throw new Error("Invalid operation.");
  }

  if (
    operation === "delete" &&
    read(form, "confirmation") !== "DELETE FOREVER"
  ) {
    throw new Error(
      "Type DELETE FOREVER to permanently delete a record."
    );
  }

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
      "Only owners and administrators may manage archived records."
    );
  }

  const { error } = await supabase.rpc(
    "tma_manage_archive",
    {
      p_kind: kind,
      p_id: id,
      p_operation: operation,
    }
  );

  if (error) {
    console.error("Archive operation:", error.message);

    throw new Error(
      `The ${operation} operation was not completed: ${error.message}`
    );
  }

  revalidatePath("/staff/archive");
  revalidatePath("/staff/bands");
  revalidatePath("/staff/competitions");
  revalidatePath("/bands");

  if (kind === "band") {
    revalidatePath(`/bands`, "layout");
  }

  if (kind === "competition" || kind === "round") {
    revalidatePath("/staff/competitions", "layout");
  }

  redirect(
    `/staff/archive?message=${encodeURIComponent(
      `${kind}-${operation}`
    )}`
  );
}
