"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const notePath = (competitionId: string) => `/staff/competitions/${competitionId}/notes`;

export async function addCompetitionResearchNote(formData: FormData) {
  const competitionId = String(formData.get("competition_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!UUID.test(competitionId)) redirect("/staff/dashboard");
  if (body.length < 3 || body.length > 4000) redirect(`${notePath(competitionId)}?error=invalid`);

  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  if (authError || !auth?.claims?.sub) redirect("/staff/login");
  const { error } = await supabase.rpc("tma_add_competition_research_note", {
    p_competition_id: competitionId,
    p_body: body,
  });
  if (error) redirect(`${notePath(competitionId)}?error=save`);
  revalidatePath(notePath(competitionId));
  redirect(`${notePath(competitionId)}?saved=1`);
}

export async function setCompetitionResearchNoteStatus(formData: FormData) {
  const competitionId = String(formData.get("competition_id") ?? "");
  const noteId = String(formData.get("note_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!UUID.test(competitionId) || !UUID.test(noteId)) redirect("/staff/dashboard");
  if (status !== "open" && status !== "resolved") redirect(`${notePath(competitionId)}?error=invalid`);

  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  if (authError || !auth?.claims?.sub) redirect("/staff/login");
  // Match the note to the competition so another competition's note cannot be changed
  // by a forged form. RPC separately checks Owner / Administrator access.
  const { data: note, error: noteError } = await supabase.from("competition_research_notes")
    .select("id").eq("id", noteId).eq("competition_id", competitionId).maybeSingle();
  if (noteError || !note) redirect(`${notePath(competitionId)}?error=save`);
  const { error } = await supabase.rpc("tma_set_competition_research_note_status", {
    p_note_id: noteId, p_status: status,
  });
  if (error) redirect(`${notePath(competitionId)}?error=save`);
  revalidatePath(notePath(competitionId));
  redirect(`${notePath(competitionId)}?saved=1`);
}
