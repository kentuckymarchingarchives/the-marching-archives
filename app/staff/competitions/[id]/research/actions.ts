"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRIORITIES = ["low", "normal", "high", "urgent"];

export async function createCompetitionResearchTask(formData: FormData) {
  const id = String(formData.get("competition_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const priority = String(formData.get("priority") ?? "normal");
  const assignedTo = String(formData.get("assigned_to") ?? "").trim();
  const dueDate = String(formData.get("due_date") ?? "").trim();
  const back = UUID.test(id) ? `/staff/competitions/${id}/research` : "/staff/competitions";

  if (!UUID.test(id) || title.length < 3 || title.length > 160 || description.length > 5000 ||
      !PRIORITIES.includes(priority) || (assignedTo && !UUID.test(assignedTo)) ||
      (dueDate && (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || Number.isNaN(Date.parse(`${dueDate}T12:00:00Z`))))) {
    redirect(`${back}?error=invalid`);
  }

  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  if (authError || !auth?.claims?.sub) redirect("/staff/login");

  const { error } = await supabase.rpc("tma_create_competition_research_task", {
    p_competition_id: id,
    p_title: title,
    p_description: description,
    p_assigned_to: assignedTo || null,
    p_priority: priority,
    p_due_date: dueDate || null,
  });
  if (error) {
    redirect(`${back}?error=${error.code === "42501" ? "forbidden" : "save"}`);
  }
  revalidatePath(back);
  revalidatePath("/staff/research");
  redirect(`${back}?saved=1`);
}
