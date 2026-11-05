"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function updateFeaturedCompetition(formData: FormData) {
  const db = await createClient();
  const { data: auth, error } = await db.auth.getClaims();
  if (error || !auth?.claims?.sub) redirect("/staff/login");
  const {data: owner} = await db.from("staff_members").select("role,status")
    .eq("user_id",auth.claims.sub).maybeSingle();
  if (owner?.status !== "active" || owner.role !== "owner") redirect("/staff/dashboard");

  const id = String(formData.get("competition_id") ?? "").trim();
  const note = String(formData.get("editorial_note") ?? "").trim();
  const order = Number(formData.get("sort_order") ?? "100");
  const operation = String(formData.get("operation") ?? "add");
  if (!UUID.test(id) || note.length > 400 || !Number.isInteger(order) || order < 0 || order > 10000 || !["add","remove"].includes(operation)) {
    redirect("/staff/featured?error=invalid");
  }
  if (operation === "add") {
    const {data: c} = await db.from("competitions").select("id")
      .eq("id",id).eq("publication_status","published").is("archived_at",null).maybeSingle();
    if (!c) redirect("/staff/featured?error=unpublished");
    const {error: saveError} = await db.from("featured_competitions")
      .upsert({competition_id:id,editorial_note:note,sort_order:order},{onConflict:"competition_id"});
    if (saveError) redirect("/staff/featured?error=save");
  } else {
    const {error: removeError} = await db.from("featured_competitions")
      .delete().eq("competition_id",id);
    if (removeError) redirect("/staff/featured?error=save");
  }
  revalidatePath("/featured");
  revalidatePath("/staff/featured");
  redirect("/staff/featured?saved=1");
}
