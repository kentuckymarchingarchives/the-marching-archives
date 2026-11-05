import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateFeaturedCompetition } from "./actions";

type Competition = {id:string;name:string;season_year:number;organization_code:string;publication_status:string};
type Feature = {competition_id:string;editorial_note:string;sort_order:number};
const INPUT="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-[#002144]";

async function Content({searchParams}:{searchParams:Promise<{saved?:string;error?:string}>}){
  await connection();
  const db=await createClient();
  const {data:auth,error:authError}=await db.auth.getClaims();
  if(authError||!auth?.claims?.sub) redirect("/staff/login");
  const {data:staff}=await db.from("staff_members").select("role,status").eq("user_id",auth.claims.sub).maybeSingle();
  if(staff?.role!=="owner"||staff?.status!=="active") redirect("/staff/dashboard");
  const [featuredResponse,cResponse,query]=await Promise.all([
    db.from("featured_competitions").select("competition_id,editorial_note,sort_order").order("sort_order").limit(100),
    db.from("competitions").select("id,name,season_year,organization_code,publication_status")
      .eq("publication_status","published").is("archived_at",null).order("season_year",{ascending:false}).limit(200),
    searchParams
  ]);
  const features=(featuredResponse.data??[]) as Feature[];
  const choices=(cResponse.data??[]) as Competition[];
  const byId=new Map(choices.map(c=>[c.id,c]));
  return <main className="min-h-screen bg-[#f6f7f9] text-[#002144]">
    <header className="bg-[#002144] px-6 py-12 text-white"><div className="mx-auto max-w-6xl">
      <Link href="/staff/dashboard" className="text-sm font-bold text-[#e8afc2] hover:underline">← Staff dashboard</Link>
      <p className="mt-7 text-xs font-black uppercase tracking-widest text-[#e8afc2]">Owner-only editorial tools</p>
      <h1 className="mt-3 text-3xl font-black sm:text-4xl">Featured Competitions</h1>
      <p className="mt-3 max-w-xl text-sm text-slate-200">Choose published competitions to highlight on the public Featured page. Unpublished or archived competitions never appear publicly.</p>
    </div></header>
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
      {query.saved && <p role="status" className="rounded-xl bg-green-50 p-4 text-green-900">Featured competitions updated.</p>}
      {query.error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">Unable to save: {query.error === "unpublished" ? "Choose a published, unarchived competition." : query.error === "invalid" ? "Please check the selected record and form fields." : "Check migration 042 and your database permissions."}</p>}
      {(featuredResponse.error||cResponse.error)&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">Unable to load records. Verify migration 042 is installed.</p>}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-black">Feature a competition</h2>
        <p className="mt-2 text-sm text-slate-600">The list shows the latest 200 published competitions. Choose an existing record to add or update its description.</p>
        <form action={updateFeaturedCompetition} className="mt-6 grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="operation" value="add"/>
          <label className="text-sm font-bold sm:col-span-2">Competition
            <select name="competition_id" required defaultValue="" className={INPUT}><option value="" disabled>Select competition</option>{choices.map(c=><option key={c.id} value={c.id}>{c.season_year} · {c.organization_code} · {c.name}</option>)}</select>
          </label>
          <label className="text-sm font-bold sm:col-span-2">Why feature it? (optional)
            <textarea name="editorial_note" rows={3} maxLength={400} className={INPUT} placeholder="Describe what visitors can discover in these documented results."/>
          </label>
          <label className="text-sm font-bold">Display order (lower first)<input name="sort_order" type="number" min="0" max="10000" defaultValue={100} required className={INPUT}/></label>
          <button type="submit" className="self-end rounded-xl bg-[#861F41] px-6 py-3 text-sm font-black text-white hover:bg-[#6f1937]">Save featured competition</button>
        </form>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-black">Current selections</h2><Link href="/featured" className="text-sm font-bold text-[#861F41] hover:underline">View public page ↗</Link></div>
        <div className="mt-5 space-y-4">{features.length ? features.map(f=><div key={f.competition_id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 p-4">
          <div><p className="font-bold">{byId.get(f.competition_id)?.name ?? `Competition ${f.competition_id}`}</p><p className="mt-1 text-sm text-slate-600">Order {f.sort_order} · {f.editorial_note || "No editorial description"}</p></div>
          <form action={updateFeaturedCompetition}><input type="hidden" name="competition_id" value={f.competition_id}/><input type="hidden" name="operation" value="remove"/><button type="submit" className="rounded-lg border border-red-200 px-4 py-2 text-sm font-bold text-red-800 hover:bg-red-50">Remove</button></form>
        </div>) : <p className="text-slate-600">No selections yet.</p>}</div>
      </section>
    </div>
  </main>;
}
export default function Page({searchParams}:{searchParams:Promise<{saved?:string;error?:string}>}){return <Suspense fallback={<p className="p-10">Loading featured selections…</p>}><Content searchParams={searchParams}/></Suspense>}
