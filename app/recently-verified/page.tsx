import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import DiscoveryPageShell from "@/components/DiscoveryPageShell";

type Item = { event_key:string; event_type:string; title:string; event_at:string; destination:string; organization_code:string|null; season_year:number|null };
async function Content(){
  await connection();
  const db=await createClient();
  const {data,error}=await db.rpc("tma_public_archive_activity",{p_limit:50,p_type:"verification"});
  const items=(data??[]) as Item[];
  return <DiscoveryPageShell active="/recently-verified" title="Recently Verified Records" description="Competition results whose documented verification remains current. This feed is derived from live verification checks and is not simply a list of staff submissions.">
    {error ? <p role="alert" className="rounded-xl bg-red-50 p-5 text-red-800">Unable to load verification activity. Confirm migration 031 is installed.</p>
    : items.length ? <div className="space-y-4">{items.filter(i=>i.event_type==="verification" && i.destination?.startsWith("/competitions/")).map(i=><article key={i.event_key} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-black uppercase tracking-widest text-[#861F41]">Verified · {i.organization_code} · {i.season_year}</p>
      <h2 className="mt-2 text-xl font-black"><Link className="hover:text-[#861F41] hover:underline" href={i.destination}>{i.title} ↗</Link></h2>
      <p className="mt-2 text-xs text-slate-500">Verified {new Intl.DateTimeFormat("en-US",{dateStyle:"medium",timeZone:"UTC"}).format(new Date(i.event_at))}</p>
    </article>)}</div> : <div className="rounded-2xl border border-slate-200 bg-white p-10"><h2 className="text-xl font-black">No current verified results yet</h2><p className="mt-3 text-sm text-slate-600">Verified competitions will appear here after staff complete the formal evidence review.</p><Link className="mt-4 inline-block font-bold text-[#861F41] hover:underline" href="/competitions">Browse published results ↗</Link></div>}
    <p className="mt-6 text-xs text-slate-500">Shows up to 50 recent verification events. Verification may cease to be current if a competition's results or reviewed sources change.</p>
  </DiscoveryPageShell>;
}
export default function Page(){return <Suspense fallback={<p className="p-10">Loading verified competitions…</p>}><Content/></Suspense>}
