"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN } from "@/lib/band-validation";

export async function updateCorrection(form: FormData) {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (authError || !userId) throw new Error("Sign in required.");
  const { data: staff, error: staffError } = await supabase.from("staff_members")
    .select("role, status").eq("user_id", userId).maybeSingle();
  if (staffError || staff?.status !== "active" || !["owner", "admin", "editor"].includes(staff.role))
    throw new Error("Staff access required.");
  const id = String(form.get("id") ?? "");
  const status = String(form.get("status") ?? "");
  const notes = String(form.get("staff_notes") ?? "").trim();
  if (!UUID_PATTERN.test(id) || !["new", "reviewing", "resolved", "dismissed"].includes(status) || notes.length > 4000)
    throw new Error("Invalid correction update.");
  const { error } = await supabase.from("archive_correction_submissions").update({
    status, staff_notes: notes || null,
    reviewed_by: status === "new" ? null : userId,
    reviewed_at: status === "new" ? null : new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) throw new Error("Failed to update the submission.");
  revalidatePath("/staff/corrections");
}
