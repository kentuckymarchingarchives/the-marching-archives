import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import DiscoveryPageShell from "@/components/DiscoveryPageShell";

type Band = {id:string;name:string};
async function Content() {
  await connection();
  const db=await createClient();
  const {data,error,count}=await db.from("bands").select("id,name",{count:"exact"}).is("archived_at",null).order("name").limit(500);
  const bands=(data??[]) as Band[];
  return <DiscoveryPageShell active="/rivalries" title="Historical Rivalries" description="Compare two ensembles head-to-head in the published competition rounds they both entered. TMA does not designate official rivalries or infer undocumented meetings.">
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-2xl font-black">Choose two ensembles</h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">This opens the existing, source-linked band comparison engine. It compares shared rounds and recorded placements—not a subjective rivalry ranking.</p>
      {error ? <p role="alert" className="mt-4 text-red-700">Unable to load ensembles.</p> : <form method="get" action="/compare" className="mt-6 grid gap-4 sm:grid-cols-2">
        {["left","right"].map((name,i)=><label key={name} className="text-sm font-bold">{i===0?"First ensemble":"Second ensemble"}
          <select name={name} required defaultValue="" className="mt-2 block w-full rounded-xl border border-slate-300 bg-white p-3 text-[#002144]"><option value="" disabled>Select ensemble</option>{bands.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select>
        </label>)}
        <label className="text-sm font-bold sm:col-span-2">Organization
          <select name="organization" defaultValue="KMEA" className="mt-2 block w-full rounded-xl border border-slate-300 bg-white p-3"><option>KMEA</option><option>BOA</option><option>MSBA</option><option>DCI</option></select>
        </label>
        <button className="rounded-xl bg-[#861F41] px-6 py-3 text-sm font-black text-white hover:bg-[#6f1937] sm:col-span-2" type="submit">Compare documented meetings ↗</button>
      </form>}
      {(count??0)>bands.length && <p className="mt-4 text-xs text-amber-800">The list shows the first 500 active ensembles alphabetically. For other bands, use the full band comparison page or search the directory.</p>}
    </section>
    <p className="mt-6 text-sm text-slate-600">Only shared published rounds can establish head-to-head meetings. An absent matchup is not evidence that two bands never competed together. <Link href="/compare" className="font-bold text-[#861F41] hover:underline">Open detailed comparisons ↗</Link></p>
  </DiscoveryPageShell>;
}
export default function Page(){return <Suspense fallback={<p className="p-10">Loading rivalries…</p>}><Content/></Suspense>}
