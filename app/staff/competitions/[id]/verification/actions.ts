"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN } from "@/lib/band-validation";

async function run(form: FormData, action: "verify" | "revoke") {
  const id = String(form.get("competition_id") ?? "");
  if (!UUID_PATTERN.test(id)) throw new Error("Invalid competition ID.");
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) redirect("/staff/login");
  const { data: staff } = await supabase.from("staff_members")
    .select("role,status").eq("user_id", auth.claims.sub).maybeSingle();
  if (staff?.status !== "active" || !["owner", "admin"].includes(staff.role)) {
    throw new Error("Only Owners and Administrators can manage verification.");
  }
  if (action === "verify") {
    if (form.get("confirmed") !== "yes") throw new Error("Confirm manual verification first.");
    const notes = String(form.get("notes") ?? "").trim();
    if (notes.length < 10 || notes.length > 2000) throw new Error("Enter 10–2000 characters of review notes.");
    const { error } = await supabase.rpc("tma_verify_published_competition", {p_id: id, p_notes: notes});
    if (error) throw new Error(`Verification failed: ${error.message}`);
  } else {
    const { error } = await supabase.rpc("tma_revoke_competition_verification", {p_id: id});
    if (error) throw new Error(`Revocation failed: ${error.message}`);
  }
  revalidatePath(`/staff/competitions/${id}/verification`);
  revalidatePath(`/staff/competitions/${id}`);
  redirect(`/staff/competitions/${id}/verification?status=${action === "verify" ? "verified" : "revoked"}`);
}
export async function verifyCompetition(form: FormData) { await run(form, "verify"); }
export async function revokeVerification(form: FormData) { await run(form, "revoke"); }
