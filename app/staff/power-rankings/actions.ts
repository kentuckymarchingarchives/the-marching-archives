"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function authorized() {
  const db = await createClient();
  const { data: auth } = await db.auth.getClaims();
  const id = auth?.claims?.sub;
  if (!id) throw new Error("Sign in to manage rankings.");
  const { data: staff } = await db.from("staff_members").select("role,status").eq("user_id",id).maybeSingle();
  if (staff?.status !== "active" || !["owner","admin","editor"].includes(staff.role)) throw new Error("Not authorized.");
  return { db, admin: staff.role === "owner" || staff.role === "admin" };
}
const value = (f:FormData, key:string) => String(f.get(key) ?? "").trim();
function failure(error: { message: string } | null) { if(error) throw new Error(error.message); }

export async function createEdition(form: FormData) {
  const { db } = await authorized();
  const organization_code = value(form,"organization");
  const season_year = Number(value(form,"year"));
  const title = value(form,"title").slice(0,120);
  const classification = "Overall";
  const published_on = value(form,"date") || null;
  const source_url = value(form,"source") || null;
  if (!["KMEA","BOA"].includes(organization_code) || !Number.isInteger(season_year) || season_year < 1900 || season_year > 2100 || !title) throw new Error("Check ranking details.");
  if (source_url && (!/^https?:\/\//i.test(source_url) || source_url.length > 1000)) throw new Error("Provide an HTTP(S) source URL.");
  const { data, error } = await db.from("power_ranking_editions").insert({organization_code,season_year,title,classification,published_on,source_url,status:"draft"}).select("id").single();
  failure(error);
  const { error: sectionError } = await db.from("power_ranking_sections").insert({edition_id:data!.id,name:"Overall Rankings",kind:"overall",numbered:true,sort_order:0});
  failure(sectionError);
  revalidatePath("/staff/power-rankings");
  redirect(`/staff/power-rankings/${data!.id}`);
}

export async function addRanking(form: FormData) {
  const { db } = await authorized();
  const edition_id = value(form,"edition");
  const band_id = value(form,"band");
  const section_id = value(form,"section");
  const rank = Number(value(form,"rank"));
  const rawRating = value(form,"rating");
  const rating = rawRating === "" ? null : Number(rawRating);
  if (!uuid.test(edition_id) || !uuid.test(section_id) || !uuid.test(band_id) || (value(form,"rank") && (!Number.isInteger(rank) || rank < 1 || rank > 10000)) || (rating !== null && (!Number.isFinite(rating) || Math.abs(rating)>99999999))) throw new Error("Check ranking entry.");
  const {data:section,error:sectionError}=await db.from("power_ranking_sections").select("numbered,edition_id").eq("id",section_id).single();
  failure(sectionError);
  if(section?.edition_id!==edition_id || (section.numbered && !value(form,"rank")) || (!section.numbered && value(form,"rank"))) throw new Error("Invalid section or rank.");
  const { error } = await db.from("power_ranking_entries").insert({edition_id,section_id,band_id,rank:section!.numbered?rank:null,rating,note:value(form,"note").slice(0,500) || null});
  failure(error);
  revalidatePath(`/staff/power-rankings/${edition_id}`);
  revalidatePath("/power-rankings");
}

export async function removeRanking(form: FormData) {
  const { db } = await authorized();
  const id=value(form,"id"), edition=value(form,"edition");
  if (!uuid.test(id)||!uuid.test(edition)) throw new Error("Invalid record.");
  const { error }=await db.from("power_ranking_entries").delete().eq("id",id).eq("edition_id",edition);
  failure(error); revalidatePath(`/staff/power-rankings/${edition}`);
}

export async function changeStatus(form: FormData) {
  const { db,admin }=await authorized();
  if(!admin) throw new Error("Only Owners and Administrators can publish rankings.");
  const id=value(form,"edition"), status=value(form,"status");
  if(!uuid.test(id)||!["draft","published"].includes(status)) throw new Error("Invalid status change.");
  if(status==="published") {
    const {count,error}=await db.from("power_ranking_entries").select("id",{count:"exact",head:true}).eq("edition_id",id);
    failure(error); if(!count) throw new Error("Add at least one band before publishing.");
  }
  const {error}=await db.from("power_ranking_editions").update({status,updated_at:new Date().toISOString()}).eq("id",id);
  failure(error); revalidatePath(`/staff/power-rankings/${id}`); revalidatePath("/power-rankings");
}

export async function addSection(form: FormData) {
 const {db}=await authorized();
 const edition_id=value(form,"edition"),kind=value(form,"kind");
 const name=value(form,"name").slice(0,80);
 const classification=kind==="class"?value(form,"classification"):null;
 const parent_section_id=kind==="additional"?value(form,"parent"):null;
 const maxRaw=value(form,"limit");
 const max_entries=maxRaw?Number(maxRaw):null;
 const numbered=kind==="additional"?value(form,"numbered")==="yes":true;
 if(!uuid.test(edition_id)||!name||!["overall","class","additional"].includes(kind)||
  (kind==="class"&&!/^[1-5]A$/.test(classification??""))||
  (kind==="additional"&&!uuid.test(parent_section_id??""))||
  (max_entries!==null&&(!Number.isInteger(max_entries)||max_entries<1||max_entries>1000))) throw new Error("Invalid section details.");
 const {error}=await db.from("power_ranking_sections").insert({edition_id,kind,name,classification,parent_section_id,max_entries,numbered,sort_order:kind==="class"?20:kind==="additional"?10:0});
 failure(error);revalidatePath(`/staff/power-rankings/${edition_id}`);
}


// Edits always target an existing draft. Publishing and unpublishing remain admin-only.
export async function updateRanking(form: FormData) {
  const {db}=await authorized();
  const id=value(form,"id"), edition=value(form,"edition"), section=value(form,"section");
  const band=value(form,"band");
  const rawRank=value(form,"rank"), rawRating=value(form,"rating");
  const rating=rawRating===""?null:Number(rawRating);
  const rank=rawRank===""?null:Number(rawRank);
  if(![id,edition,section,band].every(v=>uuid.test(v)) ||
     (rank!==null&&(!Number.isInteger(rank)||rank<1||rank>10000)) ||
     (rating!==null&&(!Number.isFinite(rating)||Math.abs(rating)>99999999))) throw new Error("Invalid ranking values.");
  const {data:entry,error:readError}=await db.from("power_ranking_entries").select("id,section_id").eq("id",id).eq("edition_id",edition).single();
  failure(readError);
  if(entry?.section_id!==section) throw new Error("Entries cannot move between sections while editing.");
  const {data:sec,error:sectionError}=await db.from("power_ranking_sections").select("numbered").eq("id",section).eq("edition_id",edition).single();
  failure(sectionError);
  if(!sec || (sec.numbered && rank===null) || (!sec.numbered && rank!==null)) throw new Error("Position doesn't match this section.");
  const {error}=await db.from("power_ranking_entries").update({band_id:band,rank,rating,note:value(form,"note").slice(0,500)||null}).eq("id",id).eq("edition_id",edition);
  failure(error);
  revalidatePath(`/staff/power-rankings/${edition}`);
  revalidatePath("/power-rankings");
}

export async function updateSection(form: FormData) {
  const {db}=await authorized();
  const edition=value(form,"edition"),id=value(form,"section");
  const name=value(form,"name").slice(0,80);
  const maxText=value(form,"limit");
  const max_entries=maxText===""?null:Number(maxText);
  const sort_order=Number(value(form,"order"));
  if(!uuid.test(edition)||!uuid.test(id)||!name||
    (max_entries!==null&&(!Number.isInteger(max_entries)||max_entries<1||max_entries>1000))||
    !Number.isInteger(sort_order)||sort_order<0||sort_order>10000) throw new Error("Invalid section details.");
  const {error}=await db.from("power_ranking_sections")
    .update({name,max_entries,sort_order}).eq("id",id).eq("edition_id",edition);
  failure(error);
  revalidatePath(`/staff/power-rankings/${edition}`);
  revalidatePath("/power-rankings");
}
