"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const uuid = /^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;
const statuses = ["todo", "in_progress", "blocked", "completed"];
const priorities = ["low", "normal", "high", "urgent"];

function dateOrNull(value: FormDataEntryValue | null) {
  const s = String(value ?? "").trim();
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(`${s}T12:00:00Z`))) redirect("/staff/research?error=invalid");
  return s;
}
function assigneeOrNull(value: FormDataEntryValue | null) {
  const s = String(value ?? "").trim();
  if (s && !uuid.test(s)) redirect("/staff/research?error=invalid");
  return s || null;
}
async function authenticatedClient() {
  const client = await createClient();
  const { data, error } = await client.auth.getClaims();
  if (error || !data?.claims?.sub) redirect("/staff/login");
  return client;
}
function parseTask(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const priority = String(formData.get("priority") ?? "normal");
  const status = String(formData.get("status") ?? "todo");
  if (title.length < 3 || title.length > 160 || description.length > 5000 || !priorities.includes(priority) || !statuses.includes(status)) redirect("/staff/research?error=invalid");
  return { title, description, priority, status, assigned_to: assigneeOrNull(formData.get("assigned_to")), due_date: dateOrNull(formData.get("due_date")) };
}
function actionError(error: { code?: string; message: string } | null): never {
  const reason = error?.code === "42501" ? "forbidden" : error?.code === "22023" ? "invalid" : "save";
  redirect(`/staff/research?error=${reason}`);
}
export async function createResearchTask(formData: FormData) {
  const input = parseTask(formData);
  const supabase = await authenticatedClient();
  const { error } = await supabase.rpc("tma_create_research_assignment", {
    p_title: input.title, p_description: input.description, p_priority: input.priority,
    p_assigned_to: input.assigned_to, p_due_date: input.due_date,
  });
  if (error) actionError(error);
  revalidatePath("/staff/research");
  redirect("/staff/research?saved=created");
}
export async function editResearchTask(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!uuid.test(id)) redirect("/staff/research?error=invalid");
  const input = parseTask(formData);
  const supabase = await authenticatedClient();
  const { error } = await supabase.rpc("tma_edit_research_assignment", {
    p_id: id, p_title: input.title, p_description: input.description,
    p_assigned_to: input.assigned_to, p_priority: input.priority,
    p_status: input.status, p_due_date: input.due_date,
  });
  if (error) actionError(error);
  revalidatePath("/staff/research");
  redirect("/staff/research?saved=updated");
}
export async function updateResearchStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!uuid.test(id) || !statuses.includes(status)) redirect("/staff/research?error=invalid");
  const supabase = await authenticatedClient();
  const { error } = await supabase.rpc("tma_set_research_assignment_status", { p_id: id, p_status: status });
  if (error) actionError(error);
  revalidatePath("/staff/research");
  redirect("/staff/research?saved=status");
}
