import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { addRanking, addSection, removeRanking, changeStatus, updateRanking, updateSection } from "../actions";

type Props = { params: Promise<{ id: string }> };
type Section = { id: string; edition_id: string; name: string; kind: string; classification: string | null; parent_section_id: string | null; numbered: boolean; max_entries: number | null; sort_order: number };
type Entry = { id: string; section_id: string; rank: number | null; band_id: string; rating: number | null; note: string | null; bands: { name: string } | null };

async function Editor({ params }: Props) {
 const { id } = await params;
 if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
 const db = await createClient();
 const { data: auth } = await db.auth.getClaims();
 if (!auth?.claims?.sub) redirect("/staff/login");
 const { data: staff } = await db.from("staff_members").select("role,status").eq("user_id",auth.claims.sub).maybeSingle();
 if (staff?.status !== "active" || !["owner","admin","editor"].includes(staff.role)) redirect("/staff/login?error=unauthorized");
 const { data: edition } = await db.from("power_ranking_editions").select("*").eq("id",id).maybeSingle();
 if (!edition) notFound();
 const [sectionResult,entryResult,bandsResult] = await Promise.all([
  db.from("power_ranking_sections").select("*").eq("edition_id",id).order("sort_order").order("created_at"),
  db.from("power_ranking_entries").select("id,section_id,rank,band_id,rating,note,bands(name)").eq("edition_id",id).order("rank"),
  db.from("bands").select("id,name").order("name").limit(1000),
 ]);
 const sections=(sectionResult.data??[]) as Section[];
 const entries=(entryResult.data??[]) as unknown as Entry[];
 const bands=bandsResult.data??[];
 const draft=edition.status==="draft";
 const admin=staff.role==="owner"||staff.role==="admin";
 const overall=sections.find(s=>s.kind==="overall");
 return <main className="min-h-screen bg-[#f6f7f9] text-[#002144]">
  <section className="bg-[#002144] px-6 py-10 text-white"><div className="mx-auto max-w-5xl"><Link href="/staff/power-rankings" className="text-sm text-pink-200">← All editions</Link><h1 className="mt-4 text-3xl font-extrabold">{edition.season_year} {edition.organization_code} — {edition.title}</h1><p className="mt-2 text-slate-200">{draft?"Private draft":"Published edition"} · {sections.length} sections</p></div></section>
  <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
   {admin&&<form action={changeStatus} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-5"><input type="hidden" name="edition" value={id}/><input type="hidden" name="status" value={draft?"published":"draft"}/><p className="text-sm text-slate-600">{draft?"Check all sections against the original publication before publishing.":"Unpublish before editing an edition."}</p><button className="rounded-lg bg-[#861F41] px-5 py-2.5 font-semibold text-white">{draft?"Publish edition":"Unpublish edition"}</button></form>}
   {draft&&<div className="grid gap-5 lg:grid-cols-2">
    <section className="rounded-xl border bg-white p-5"><h2 className="text-xl font-bold">Add ranking section</h2><p className="mt-2 text-sm text-slate-600">Additional groups belong to Overall; KMEA also supports class rankings.</p><form action={addSection} className="mt-4 grid gap-3"><input type="hidden" name="edition" value={id}/><label className="grid gap-1 text-sm font-semibold">Type<select name="kind" className="rounded-lg border p-2"><option value="additional">Additional overall group</option>{edition.organization_code==="KMEA"&&<option value="class">Class rankings</option>}</select></label><label className="grid gap-1 text-sm font-semibold">Section name<input required name="name" maxLength={80} placeholder="Next 5 / Honorable Mentions / Class 1A" className="rounded-lg border p-2"/></label>{edition.organization_code==="KMEA"&&<label className="grid gap-1 text-sm font-semibold">Class (for class sections)<select name="classification" className="rounded-lg border p-2">{["1A","2A","3A","4A","5A"].map(c=><option key={c}>{c}</option>)}</select></label>}<label className="grid gap-1 text-sm font-semibold">Parent overall section<select name="parent" className="rounded-lg border p-2">{overall&&<option value={overall.id}>{overall.name}</option>}</select></label><label className="grid gap-1 text-sm font-semibold">Number of entries (optional)<input name="limit" type="number" min="1" max="1000" placeholder="5" className="rounded-lg border p-2"/></label><label className="grid gap-1 text-sm font-semibold">Additional group positions<select name="numbered" className="rounded-lg border p-2"><option value="no">Unnumbered list</option><option value="yes">Numbered list</option></select></label><button className="rounded-lg bg-[#002144] p-3 font-semibold text-white">Add section</button></form></section>
    <section className="rounded-xl border bg-white p-5"><h2 className="text-xl font-bold">Add one band</h2><form action={addRanking} className="mt-4 grid gap-3"><input type="hidden" name="edition" value={id}/><label className="grid gap-1 text-sm font-semibold">Section<select required name="section" className="rounded-lg border p-2">{sections.map(s=><option key={s.id} value={s.id}>{s.name} ({s.numbered?"numbered":"unranked"})</option>)}</select></label><p className="text-xs text-slate-500">Enter a rank for numbered sections; leave it blank for unnumbered groups.</p><label className="grid gap-1 text-sm font-semibold">Position (when numbered)<input name="rank" type="number" min="1" max="10000" className="rounded-lg border p-2"/></label><label className="grid gap-1 text-sm font-semibold">Band or corps<select required name="band" className="rounded-lg border p-2"><option value="">Select existing ensemble</option>{bands.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label><label className="grid gap-1 text-sm font-semibold">Rating (optional)<input name="rating" type="number" step="any" className="rounded-lg border p-2"/></label><label className="grid gap-1 text-sm font-semibold">Note (optional)<input name="note" maxLength={500} className="rounded-lg border p-2"/></label><button className="rounded-lg bg-[#861F41] p-3 font-semibold text-white">Save band</button></form>{bands.length===1000&&<p className="mt-2 text-xs text-amber-700">Only the first 1,000 bands are available in this selector.</p>}</section>
   </div>}
   {[sectionResult.error,entryResult.error,bandsResult.error].filter(Boolean).map((e,i)=><p key={i} role="alert" className="rounded bg-red-50 p-3 text-red-800">{e!.message}</p>)}
   {sections.map(s=><section key={s.id} className="rounded-xl border bg-white p-5">
     <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-bold">{s.name}</h2><span className="text-xs text-slate-500">{s.kind==="additional"?"Overall · additional":s.kind==="class"?"Class rankings":"Overall rankings"} · {s.numbered?"Numbered":"Unnumbered"}{s.max_entries?` · Max ${s.max_entries}`:""}</span></div>
     {draft&&<details className="mt-3 rounded-lg bg-slate-50 p-3 text-sm"><summary className="cursor-pointer font-semibold">Edit section name, limit, or order</summary>
      <form action={updateSection} className="mt-3 grid gap-3 sm:grid-cols-3">
       <input type="hidden" name="edition" value={id}/><input type="hidden" name="section" value={s.id}/>
       <label className="grid gap-1 font-medium">Section name<input name="name" required maxLength={80} defaultValue={s.name} className="rounded border bg-white p-2"/></label>
       <label className="grid gap-1 font-medium">Max entries (optional)<input name="limit" type="number" min="1" max="1000" defaultValue={s.max_entries??""} className="rounded border bg-white p-2"/></label>
       <label className="grid gap-1 font-medium">Display order<input name="order" type="number" min="0" max="10000" defaultValue={s.sort_order} className="rounded border bg-white p-2"/></label>
       <button className="rounded bg-[#002144] px-4 py-2 font-semibold text-white sm:col-span-3">Save section</button>
      </form><p className="mt-2 text-xs text-slate-600">Lower display-order numbers come first. Additional overall groups appear beneath Overall.</p>
     </details>}
     <div className="mt-3 divide-y">{entries.filter(e=>e.section_id===s.id).sort((a,b)=>(a.rank??999999)-(b.rank??999999)).map(e=><div key={e.id} className="py-3">
      <div className="flex items-center gap-3"><strong className="w-12">{e.rank===null?"—":`#${e.rank}`}</strong><div className="flex-1"><p className="font-semibold">{e.bands?.name??"Unknown ensemble"}</p>{e.rating!==null&&<p className="text-xs text-slate-500">Rating: {e.rating}</p>}{e.note&&<p className="text-xs text-slate-500">{e.note}</p>}</div></div>
      {draft&&<details className="mt-2 ml-12 rounded-lg border p-3 text-sm"><summary className="cursor-pointer font-semibold text-[#861F41]">Edit or remove this entry</summary>
       <form action={updateRanking} className="mt-3 grid gap-3 sm:grid-cols-2"><input type="hidden" name="edition" value={id}/><input type="hidden" name="id" value={e.id}/><input type="hidden" name="section" value={s.id}/>
       <label className="grid gap-1">Band<select name="band" required defaultValue={e.band_id} className="rounded border p-2">{bands.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
       <label className="grid gap-1">Position {s.numbered?"(required)":"(unranked)"}<input name="rank" type="number" min="1" max="10000" disabled={!s.numbered} required={s.numbered} defaultValue={e.rank??""} className="rounded border p-2"/></label>
       <label className="grid gap-1">Rating (optional)<input name="rating" type="number" step="any" defaultValue={e.rating??""} className="rounded border p-2"/></label>
       <label className="grid gap-1">Note<input name="note" maxLength={500} defaultValue={e.note??""} className="rounded border p-2"/></label>
       <button className="rounded bg-[#002144] px-4 py-2 font-semibold text-white sm:col-span-2">Save changes</button>
       </form><form action={removeRanking} className="mt-3"><input type="hidden" name="edition" value={id}/><input type="hidden" name="id" value={e.id}/><button className="rounded border border-red-300 px-3 py-2 text-red-700">Remove entry</button></form>
      </details>}
     </div>)}{!entries.some(e=>e.section_id===s.id)&&<p className="py-4 text-slate-500">No bands entered yet.</p>}</div>
    </section>)}
  </div>
 </main>;
}
export default function Page(props:Props){return <Suspense fallback={<main className="p-10">Loading edition…</main>}><Editor {...props}/></Suspense>}
