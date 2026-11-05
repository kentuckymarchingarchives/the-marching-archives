import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import DiscoveryPageShell from "@/components/DiscoveryPageShell";
import { competitionPublicUrl } from "@/lib/public-competition-routes";

type Feature = { competition_id: string; editorial_note: string; sort_order: number };
type Competition = { id: string; slug: string | null; name: string; season_year: number; organization_code: string; competition_date: string | null };

async function Content() {
  await connection();
  const db = await createClient();
  const { data, error } = await db.from("featured_competitions")
    .select("competition_id,editorial_note,sort_order").order("sort_order").limit(24);
  const features = (data ?? []) as Feature[];
  const ids = features.map(f=>f.competition_id);
  const response = ids.length ? await db.from("competitions").select("id,slug,name,season_year,organization_code,competition_date")
    .in("id",ids).eq("publication_status","published").is("archived_at",null) : null;
  const lookup = new Map(((response?.data ?? []) as Competition[]).map(c=>[c.id,c]));
  const entries = features.flatMap(feature => { const c=lookup.get(feature.competition_id); return c && c.slug ? [{feature,competition:c}] : []; });
  return <DiscoveryPageShell active="/featured" title="Featured Competitions" description="A curated selection of documented contests from marching arts history. Selected by TMA staff, not determined by score or historical importance ranking.">
    {error || response?.error ? <p role="alert" className="rounded-xl bg-red-50 p-5 text-red-800">Featured competitions are unavailable. Confirm migration 042 is installed.</p>
    : entries.length ? <div className="grid gap-5 md:grid-cols-2">{entries.map(({competition:c,feature})=><article key={c.id} className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
      <p className="text-xs font-black uppercase tracking-widest text-[#861F41]">{c.organization_code} · {c.season_year}</p>
      <h2 className="mt-3 text-2xl font-black">{c.name}</h2>
      {c.competition_date && <p className="mt-2 text-sm text-slate-500">Competition date: {c.competition_date}</p>}
      {feature.editorial_note && <p className="mt-4 text-sm leading-7 text-slate-700">{feature.editorial_note}</p>}
      <Link className="mt-6 inline-block text-sm font-bold text-[#861F41] hover:underline" href={competitionPublicUrl(c.slug!)}>View published results ↗</Link>
    </article>)}</div> : <div className="rounded-2xl border border-slate-200 bg-white p-10"><h2 className="text-xl font-bold">No competitions featured yet</h2><p className="mt-3 text-slate-600">The Owners have not selected any published competitions to highlight. You can still browse the full archive.</p><Link href="/competitions" className="mt-4 inline-block font-bold text-[#861F41] hover:underline">Browse competitions ↗</Link></div>}
  </DiscoveryPageShell>;
}
export default function Page() { return <Suspense fallback={<p className="p-10">Loading featured competitions…</p>}><Content/></Suspense>; }
