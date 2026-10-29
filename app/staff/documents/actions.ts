"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const TYPES = ["program", "recap", "newspaper", "results", "photograph", "other"];
const ORGS = ["", "KMEA", "MSBA", "BOA", "DCI"];

function field(data: FormData, key: string, max = 2000) {
  const value = data.get(key);
  return typeof value === "string" ? value.trim().slice(0, max + 1) : "";
}

async function authorizedClient() {
  const supabase = await createClient();
  const { data: auth, error } = await supabase.auth.getClaims();
  if (error || !auth?.claims?.sub) redirect("/staff/login");
  const { data: member } = await supabase.from("staff_members")
    .select("role,status").eq("user_id", auth.claims.sub).maybeSingle();
  if (member?.status !== "active" || !["owner", "admin", "editor"].includes(member.role)) {
    redirect("/staff/login?error=unauthorized");
  }
  return { supabase, userId: auth.claims.sub, role: member.role };
}

export async function addDocument(data: FormData) {
  const { supabase, userId, role } = await authorizedClient();
  const title = field(data, "title", 200);
  const document_type = field(data, "document_type", 30);
  const organization_code = field(data, "organization_code", 20);
  const yearText = field(data, "season_year", 4);
  const season_year = yearText ? Number(yearText) : null;
  const description = field(data, "description", 2000);
  const citation = field(data, "citation", 2000);
  const document_url = field(data, "document_url", 2000);
  const rights_note = field(data, "rights_note", 500);
  const published = field(data, "publish", 10) === "yes";

  if (title.length < 3 || title.length > 200 || citation.length < 3 || citation.length > 2000 || rights_note.length < 3 || rights_note.length > 500 || description.length > 2000 ||
      !TYPES.includes(document_type) || !ORGS.includes(organization_code) ||
      (season_year !== null && (!Number.isInteger(season_year) || season_year < 1800 || season_year > 2200))) {
    redirect("/staff/documents?error=invalid");
  }
  try {
    const url = new URL(document_url);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password || document_url.length > 2000) throw new Error("invalid");
  } catch { redirect("/staff/documents?error=url"); }

  const { error } = await supabase.from("archive_documents").insert({
    title, document_type, organization_code: organization_code || null,
    season_year, description: description || null, citation, document_url,
    rights_note, publication_status: published && ["owner", "admin"].includes(role) ? "published" : "draft", created_by: userId,
  });
  if (error) redirect("/staff/documents?error=save");
  revalidatePath("/documents");
  revalidatePath("/staff/documents");
  redirect("/staff/documents?success=created");
}

export async function updateDocumentStatus(data: FormData) {
  const { supabase, role } = await authorizedClient();
  const id = field(data, "id", 50);
  const next = field(data, "status", 20);
  if (!/^[0-9a-f-]{36}$/i.test(id) || !["draft", "published"].includes(next)) redirect("/staff/documents?error=invalid");
  // Publishing is restricted to Owner/Admin, aligned with existing TMA workflow.
  if (!["owner", "admin"].includes(role)) redirect("/staff/documents?error=permission");
  const { error } = await supabase.from("archive_documents").update({ publication_status: next, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) redirect("/staff/documents?error=save");
  revalidatePath("/documents");
  revalidatePath("/staff/documents");
  redirect("/staff/documents?success=updated");
}
