"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const validCategories = ["archive", "research", "correction", "website"];

export async function saveArchiveUpdate(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const title = String(formData.get("title") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const category = String(formData.get("category") ?? "");
  const status = String(formData.get("status") ?? "");
  const validId = id === "" || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  if (!validId || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100 ||
      title.length < 5 || title.length > 160 || summary.length < 10 || summary.length > 320 ||
      content.length < 20 || content.length > 10000 || !validCategories.includes(category) ||
      !["draft", "published"].includes(status)) {
    redirect("/staff/updates?error=invalid");
  }

  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  if (authError || !auth?.claims?.sub) redirect("/staff/login");

  const { error } = await supabase.rpc("tma_owner_save_archive_update", {
    p_id: id || null,
    p_slug: slug,
    p_title: title,
    p_summary: summary,
    p_content: content,
    p_category: category,
    p_status: status,
  });
  if (error) {
    const reason = error.code === "23505" ? "duplicate" : error.code === "42501" ? "access" : "save";
    redirect(`/staff/updates?error=${reason}`);
  }
  revalidatePath("/updates");
  revalidatePath(`/updates/${slug}`);
  revalidatePath("/");
  redirect("/staff/updates?saved=1");
}
