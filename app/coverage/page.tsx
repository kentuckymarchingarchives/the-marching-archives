import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import DiscoveryPageShell from "@/components/DiscoveryPageShell";

type Row = { organization_code:string; season_year:number; competitions:number; rounds:number; result_entries:number };
const ORGS = ["KMEA","BOA","MSBA","DCI"];
async function Content({searchParams}:{searchParams:Promise<{organization?:string}>}) {
  await connection();
  const p = await searchParams;
  const org = ORGS.includes(p.organization ?? "") ? p.organization! : null;
  const db = await createClient();
  const { data,error } = await db.rpc("tma_public_coverage",{p_organization:org});
  const rows = (data ?? []) as Row[];
  const totals = rows.reduce((a,r)=>({competitions:a.competitions+Number(r.competitions),rounds:a.rounds+Number(r.rounds),entries:a.entries+Number(r.result_entries)}),{competitions:0,rounds:0,entries:0});
  return <DiscoveryPageShell active="/coverage" title="Archive Coverage" description="See where published competition results are currently documented. These totals show TMA's records, not the full number of competitions that historically took place.">
    <nav aria-label="Organization filter" className="mb-6 flex flex-wrap gap-2">{[null,...ORGS].map(o=><Link key={o??"all"} href={o?`/coverage?organization=${o}`:"/coverage"} aria-current={org===o?"page":undefined} className={`rounded-full px-4 py-2 text-sm font-bold ${org===o?"bg-[#002144] text-white":"border border-slate-200 bg-white hover:border-[#861F41]"}`}>{o??"All organizations"}</Link>)}</nav>
    {error ? <p role="alert" className="rounded-xl bg-red-50 p-5 text-red-800">Unable to load coverage. Confirm migration 042 is installed.</p> : <>
      <div className="grid gap-4 sm:grid-cols-3">{[["Published competitions",totals.competitions],["Documented rounds",totals.rounds],["Recorded entries",totals.entries]].map(([title,value])=><div key={title} className="rounded-2xl border border-slate-200 bg-white p-6"><p className="text-sm text-slate-600">{title}</p><p className="mt-2 text-3xl font-black tabular-nums">{Number(value).toLocaleString("en-US")}</p></div>)}</div>
      <div className="mt-8 overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="min-w-150 w-full text-left text-sm"><thead className="bg-[#002144] text-white"><tr>{["Season","Organization","Competitions","Rounds","Entries"].map(x=><th key={x} scope="col" className="px-5 py-4">{x}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={`${r.organization_code}-${r.season_year}`} className="border-t border-slate-200"><th scope="row" className="px-5 py-4"><Link href={`/competitions?organization=${r.organization_code}&year=${r.season_year}`} className="font-bold text-[#861F41] hover:underline">{r.season_year} ↗</Link></th><td className="px-5 py-4">{r.organization_code}</td><td className="px-5 py-4 tabular-nums">{r.competitions}</td><td className="px-5 py-4 tabular-nums">{r.rounds}</td><td className="px-5 py-4 tabular-nums">{r.result_entries}</td></tr>)}</tbody></table>{!rows.length && <p className="p-8 text-slate-600">No published records for this filter.</p>}</div>
      <p className="mt-6 text-xs leading-6 text-slate-500">A missing season or organization means no currently published competitions were found for that combination. It does not mean that no such events occurred. Entries count per-round appearances, not unique ensembles.</p>
    </>}
  </DiscoveryPageShell>;
}
export default function Page({searchParams}:{searchParams:Promise<{organization?:string}>}) {return <Suspense fallback={<p className="p-10">Loading archive coverage…</p>}><Content searchParams={searchParams}/></Suspense>}
