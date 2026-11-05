import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { competitionPublicUrl } from "@/lib/public-competition-routes";
import DiscoveryPageShell from "@/components/DiscoveryPageShell";

type Hit = { id: string; slug: string; name: string; season_year: number; organization_code: string; competition_date: string; city: string | null; state: string | null };
async function Content() {
  await connection();
  // Use the archive's Eastern Time calendar instead of the Vercel server timezone.
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {month:"numeric",day:"numeric",timeZone:"America/New_York"}).formatToParts(now);
  const month = Number(parts.find(p => p.type === "month")?.value ?? "1");
  const day = Number(parts.find(p => p.type === "day")?.value ?? "1");
  const label = new Intl.DateTimeFormat("en-US", {month:"long",day:"numeric",timeZone:"America/New_York"}).format(now);
  const db = await createClient();
  const {data,error} = await db.rpc("tma_public_on_this_day",{p_month:month,p_day:day,p_limit:25});
  return <DiscoveryPageShell active="/on-this-day" title="On This Day" description={`Historical competitions held on ${label} in earlier years, drawn from the dates documented in our archive. Dates without supporting records aren't inferred.`}>
    {error ? <p role="alert" className="rounded-xl bg-red-50 p-5 text-red-800">Unable to load calendar history. Check migration 042.</p> : (data as Hit[] ?? []).length ? <ol className="space-y-4">{(data as Hit[]).map(item=><li key={item.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-black uppercase tracking-widest text-[#861F41]">{item.season_year} · {item.organization_code}</p>
      <h2 className="mt-2 text-xl font-black"><Link href={competitionPublicUrl(item.slug)} className="hover:text-[#861F41] hover:underline">{item.name} ↗</Link></h2>
      <p className="mt-2 text-sm text-slate-600">{item.competition_date}{[item.city,item.state].filter(Boolean).length ? ` · ${[item.city,item.state].filter(Boolean).join(", ")}` : ""}</p>
    </li>)}</ol> : <div className="rounded-2xl border border-slate-200 bg-white p-10"><h2 className="text-xl font-black">No documented competitions for {label}</h2><p className="mt-3 text-slate-600">This doesn't mean no competitions occurred. It means none with this date are currently published in TMA.</p><Link className="mt-5 inline-block font-bold text-[#861F41] hover:underline" href="/competitions">Explore all competitions ↗</Link></div>}
    <p className="mt-6 text-xs leading-6 text-slate-500">Calendar dates follow America/New_York time. The collection is limited to the first 25 published matches.</p>
  </DiscoveryPageShell>;
}
export default function Page(){return <Suspense fallback={<p className="p-10">Loading historical dates…</p>}><Content/></Suspense>}
