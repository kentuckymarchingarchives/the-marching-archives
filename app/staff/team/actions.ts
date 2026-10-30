"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function saveStaffMember(formData: FormData) {
  const userId = String(formData.get("user_id") ?? "").trim();
  const role = String(formData.get("role") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId) ||
      !["owner", "admin", "editor"].includes(role) ||
      !["active", "inactive"].includes(status)) {
    redirect("/staff/team?error=invalid");
  }

  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  if (authError || !auth?.claims?.sub) redirect("/staff/login");

  // Authorization is enforced independently in the SECURITY DEFINER RPC.
  const { error } = await supabase.rpc("tma_manage_staff_member", {
    p_user_id: userId,
    p_role: role,
    p_status: status,
  });
  if (error) {
    const reason = error.message.includes("last active Owner") ? "last-owner" :
      error.code === "42501" ? "forbidden" :
      error.code === "23503" ? "no-user" : "save";
    redirect(`/staff/team?error=${reason}`);
  }
  revalidatePath("/staff/team");
  redirect("/staff/team?saved=1");
}
