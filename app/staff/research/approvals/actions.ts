"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const uuidPattern = /^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;

function fail(reason: string): never {
  redirect(`/staff/research/approvals?error=${reason}`);
}

async function client() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect("/staff/login");
  return supabase;
}

export async function submitResearchForReview(formData: FormData) {
  const id = String(formData.get("task_id") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!uuidPattern.test(id) || note.length > 2000) fail("invalid");
  const supabase = await client();
  const { error } = await supabase.rpc("tma_submit_research_for_review", { p_task_id: id, p_note: note });
  if (error) fail(error.code === "42501" ? "forbidden" : error.code === "22023" ? "state" : "save");
  revalidatePath("/staff/research/approvals");
  redirect("/staff/research/approvals?saved=submitted");
}

export async function reviewResearch(formData: FormData) {
  const id = String(formData.get("task_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!uuidPattern.test(id) || !["approved", "changes_requested"].includes(decision) || note.length > 2000 || (decision === "changes_requested" && note.length < 5)) fail("invalid");
  const supabase = await client();
  const { error } = await supabase.rpc("tma_review_research", { p_task_id: id, p_decision: decision, p_note: note });
  if (error) fail(error.code === "42501" ? "forbidden" : error.code === "22023" ? "state" : "save");
  revalidatePath("/staff/research/approvals");
  redirect("/staff/research/approvals?saved=reviewed");
}
