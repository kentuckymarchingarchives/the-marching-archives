import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createEdition } from "./actions";

async function Content() {
 const db=await createClient();
 const {data:auth}=await db.auth.getClaims();
 if(!auth?.claims?.sub) redirect("/staff/login");
 const {data:staff}=await db.from("staff_members").select("role,status").eq("user_id",auth.claims.sub).maybeSingle();
 if(staff?.status!=="active" || !["owner","admin","editor"].includes(staff.role)) redirect("/staff/login?error=unauthorized");
 const {data:editions,error}=await db.from("power_ranking_editions").select("id,organization_code,season_year,title,classification,status,published_on").order("season_year",{ascending:false}).order("created_at",{ascending:false}).limit(100);
 return <main className="min-h-screen bg-[#f6f7f9] text-[#002144]">
  <section className="bg-[#002144] px-6 py-12 text-white"><div className="mx-auto max-w-5xl"><Link href="/staff/dashboard" className="text-sm text-pink-200">← Staff dashboard</Link><h1 className="mt-4 text-4xl font-extrabold">Manage Power Rankings</h1><p className="mt-3 text-slate-200">Enter KMEA and BOA rankings individually. Editions stay private until published.</p></div></section>
  <div className="mx-auto grid max-w-5xl gap-8 px-6 py-10 lg:grid-cols-[1fr_1.2fr]">
   <section className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">New ranking edition</h2>
    <form action={createEdition} className="mt-5 grid gap-4">
     <label className="grid gap-1 text-sm font-semibold">Organization<select required name="organization" className="rounded-lg border p-3"><option value="KMEA">KMEA</option><option value="BOA">BOA</option></select></label>
     <label className="grid gap-1 text-sm font-semibold">Season<input required type="number" name="year" min="1900" max="2100" defaultValue={new Date().getFullYear()} className="rounded-lg border p-3"/></label>
     <label className="grid gap-1 text-sm font-semibold">Edition name<input required maxLength={120} name="title" placeholder="Week 1 / Final Rankings" className="rounded-lg border p-3"/></label>
     <label className="grid gap-1 text-sm font-semibold">Publication date (optional)<input type="date" name="date" className="rounded-lg border p-3"/></label>
     <label className="grid gap-1 text-sm font-semibold">Original source URL (optional)<input type="url" name="source" className="rounded-lg border p-3" placeholder="https://..."/></label>
     <button className="rounded-lg bg-[#861F41] px-5 py-3 font-bold text-white">Create draft edition</button>
    </form></section>
   <section><h2 className="text-xl font-bold">Existing editions</h2>{error && <p className="mt-4 text-red-700">Could not load editions: {error.message}</p>}
    <div className="mt-5 space-y-3">{(editions??[]).map(e=><Link key={e.id} href={`/staff/power-rankings/${e.id}`} className="block rounded-xl border bg-white p-5 shadow-sm hover:border-[#861F41]"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{e.season_year} {e.organization_code} — {e.title}</strong><span className="text-xs font-semibold uppercase text-slate-500">{e.status}</span></div><p className="mt-1 text-sm text-slate-500">{e.classification}{e.published_on?` · ${e.published_on}`:""}</p></Link>)}{!error && !editions?.length && <p className="rounded-xl border bg-white p-5 text-slate-600">No ranking editions yet.</p>}</div>
   </section>
  </div></main>;
}
export default function Page(){return <Suspense fallback={<main className="p-10">Loading rankings…</main>}><Content/></Suspense>}
