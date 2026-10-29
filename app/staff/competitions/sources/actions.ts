"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { UUID_PATTERN } from "@/lib/band-validation";
import { createClient } from "@/lib/supabase/server";

function value(form: FormData, field: string) {
  const raw = form.get(field);
  return typeof raw === "string" ? raw.trim() : "";
}

async function authorized(id: string) {
  if (!UUID_PATTERN.test(id)) throw new Error("Invalid competition ID.");
  const db = await createClient();
  const { data: auth } = await db.auth.getClaims();
  if (!auth?.claims?.sub) redirect("/staff/login");
  const { data: staff } = await db.from("staff_members")
    .select("role,status").eq("user_id", auth.claims.sub).maybeSingle();
  if (staff?.status !== "active" || !["owner", "admin", "editor"].includes(staff.role)) {
    throw new Error("Staff access required.");
  }
  const { data: competition, error } = await db.from("competitions")
    .select("id,archived_at").eq("id", id).maybeSingle();
  if (error || !competition) throw new Error("Competition not found.");
  if (competition.archived_at) throw new Error("Restore this competition before modifying sources.");
  return { db, userId: auth.claims.sub, role: staff.role };
}

export async function addCompetitionSource(form: FormData) {
  const competitionId = value(form, "competition_id");
  const { db, userId } = await authorized(competitionId);
  const title = value(form, "title");
  const sourceType = value(form, "source_type");
  const url = value(form, "url");
  const citation = value(form, "citation");
  const notes = value(form, "notes");
  if (title.length < 3 || title.length > 200 || citation.length > 2000 || notes.length > 3000 || url.length > 2000) {
    throw new Error("Check source field lengths.");
  }
  if (!["official_results", "recap_sheet", "program", "news", "website", "other"].includes(sourceType)) {
    throw new Error("Invalid source type.");
  }
  if (url) {
    let parsed: URL;
    try { parsed = new URL(url); } catch { throw new Error("Enter a valid URL."); }
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Use an HTTP or HTTPS link.");
  }
  if (!url && !citation) throw new Error("Add a link or a written citation.");
  const { error } = await db.from("competition_sources").insert({
    competition_id: competitionId, title, source_type: sourceType,
    url: url || null, citation: citation || null, notes: notes || null, created_by: userId,
  });
  if (error) throw new Error(`Could not add source: ${error.message}`);
  revalidatePath(`/staff/competitions/${competitionId}/sources`);
}

export async function setCompetitionSourceReviewed(form: FormData) {
  const competitionId = value(form, "competition_id");
  const sourceId = value(form, "source_id");
  if (!UUID_PATTERN.test(sourceId)) throw new Error("Invalid source ID.");
  const { db, userId, role } = await authorized(competitionId);
  if (!(["owner", "admin"].includes(role))) throw new Error("Only Owners and Administrators can review sources.");
  const reviewed = value(form, "reviewed") === "true";
  const { data, error } = await db.from("competition_sources").update({
    reviewed_at: reviewed ? new Date().toISOString() : null,
    reviewed_by: reviewed ? userId : null,
  }).eq("id", sourceId).eq("competition_id", competitionId).select("id").maybeSingle();
  if (error || !data) throw new Error("Could not update source review status.");
  revalidatePath(`/staff/competitions/${competitionId}/sources`);
}

export async function deleteCompetitionSource(form: FormData) {
  const competitionId = value(form, "competition_id");
  const sourceId = value(form, "source_id");
  if (!UUID_PATTERN.test(sourceId)) throw new Error("Invalid source ID.");
  const { db, role } = await authorized(competitionId);
  const { data: existing } = await db.from("competition_sources")
    .select("reviewed_at").eq("id", sourceId).eq("competition_id", competitionId).maybeSingle();
  if (existing?.reviewed_at && !["owner", "admin"].includes(role)) {
    throw new Error("Only Owners or Administrators may delete reviewed sources.");
  }
  const { error } = await db.from("competition_sources")
    .delete().eq("id", sourceId).eq("competition_id", competitionId);
  if (error) throw new Error("Unable to delete source.");
  revalidatePath(`/staff/competitions/${competitionId}/sources`);
}
