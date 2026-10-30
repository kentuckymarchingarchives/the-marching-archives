
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { managedSections } from "@/lib/section-controls";

export async function saveSectionControl(formData: FormData) {
  const sectionKey = String(formData.get("section_key") ?? "");
  const offline = formData.get("is_offline") === "on";
  const notice = String(formData.get("notice") ?? "").trim();

  if (
    !(managedSections as readonly string[]).includes(sectionKey) ||
    notice.length < 10 ||
    notice.length > 500
  ) {
    redirect("/staff/sections?error=invalid");
  }

  const supabase = await createClient();

  const { data: auth, error: authError } =
    await supabase.auth.getClaims();

  if (authError || !auth?.claims?.sub) {
    redirect("/staff/login");
  }

  // Supabase enforces active Owner permissions at the database level.
  const { error } = await supabase.rpc(
    "tma_owner_set_section_control",
    {
      p_section_key: sectionKey,
      p_is_offline: offline,
      p_notice: notice,
    }
  );

  if (error) {
    redirect("/staff/sections?error=save");
  }

  revalidatePath("/staff/sections");
  revalidatePath("/maintenance");

  redirect("/staff/sections?saved=1");
}
