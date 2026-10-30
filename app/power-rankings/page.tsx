import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";

type Props = { searchParams: Promise<{ organization?: string; year?: string; edition?: string }> };
type Section = { id: string; name: string; kind: string; parent_section_id: string | null; classification: string | null; numbered: boolean; sort_order: number };
type Entry = { id: string; section_id: string; rank: number | null; rating: number | null; note: string | null; band_id: string; bands: { name: string; slug: string } | null };

function RankingRows({ section, entries, organization, year }: { section: Section; entries: Entry[]; organization: string; year: number }) {
 const rows = entries.filter(e => e.section_id === section.id).sort((a,b) => (a.rank??100000)-(b.rank??100000));
 return <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b bg-[#edf2f7] text-[#002144]"><th className="w-20 py-3">{section.numbered?"Rank":"Group"}</th><th>Ensemble</th><th className="text-right">Rating</th></tr></thead><tbody>{rows.map(e=><tr key={e.id} className="border-b border-slate-100 transition-colors hover:bg-[#f8edf1] last:border-0"><td className="py-3 font-bold">{e.rank===null?"—":`#${e.rank}`}</td><td><Link href={`/bands/${e.bands?.slug??e.band_id}`} className="font-semibold text-[#002144] hover:underline">{e.bands?.name??"Unknown ensemble"}</Link>{e.bands?.slug&&<Link href={`/power-rankings/history?organization=${organization}&year=${year}&band=${encodeURIComponent(e.bands.slug)}&view=${section.kind==="class"?"class":"overall"}&classification=${encodeURIComponent(section.classification??"")}`} className="ml-3 text-xs font-semibold text-[#861F41] hover:underline">History →</Link>}{e.note&&<p className="text-xs text-slate-500">{e.note}</p>}</td><td className="text-right">{e.rating??"—"}</td></tr>)}</tbody></table>{!rows.length&&<p className="py-5 text-sm text-slate-500">No entries recorded for this section.</p>}</div>;
}
async function Content({searchParams}: Props) {
 const params=await searchParams;
 const organization=params.organization==="BOA"?"BOA":"KMEA";
 const year=/^\d{4}$/.test(params.year??"")?Number(params.year):null;
 const db=await createClient();
 let query=db.from("power_ranking_editions").select("id,organization_code,season_year,title,published_on,source_url").eq("status","published").eq("organization_code",organization).order("season_year",{ascending:false}).order("published_on",{ascending:false}).limit(100);
 if(year)query=query.eq("season_year",year);
 const {data:editions,error}=await query;
 const current=(editions??[]).find(e=>e.id===params.edition)??editions?.[0];
 let sections:Section[]=[];let entries:Entry[]=[];let problem:string|null=null;
 if(current){
  const [s,e]=await Promise.all([
   db.from("power_ranking_sections").select("id,name,kind,parent_section_id,classification,numbered,sort_order").eq("edition_id",current.id).order("sort_order").limit(100),
   db.from("power_ranking_entries").select("id,section_id,rank,rating,note,band_id,bands(name,slug)").eq("edition_id",current.id).order("rank").limit(1000)
  ]);
  sections=(s.data??[]) as Section[];entries=(e.data??[]) as unknown as Entry[];
  problem=s.error?.message??e.error?.message??null;
  if(sections.length===100||entries.length===1000)problem="Ranking display limit reached. Contact archive staff to confirm this list is complete.";
 }
 const overall=sections.filter(s=>s.kind==="overall");
 const classes=sections.filter(s=>s.kind==="class");
 return <main className="min-h-screen bg-[#f6f7f9] text-[#002144]">
  <section className="relative overflow-hidden bg-[#002144] px-6 py-20 text-white"><div className="mx-auto max-w-5xl"><Link href="/leaderboards" className="text-sm font-semibold text-[#e8afc2] hover:underline">← Leaderboards</Link><p className="mt-7 text-xs font-extrabold uppercase tracking-[.23em] text-[#e8afc2]">Curated historical editions</p><h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-6xl">Historical <span className="text-[#e8afc2]">Power Rankings.</span></h1><p className="mt-3 max-w-2xl text-slate-200">Archived KMEA and BOA rankings, entered from historical editions—not automatically calculated from competition results.</p></div></section>
  <div className="mx-auto max-w-5xl space-y-6 px-6 py-10">
   <form action="/power-rankings" className="flex flex-wrap items-end gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><label className="grid gap-1 text-sm font-semibold">Organization<select name="organization" defaultValue={organization} className="rounded-lg border p-3"><option>KMEA</option><option>BOA</option></select></label><label className="grid gap-1 text-sm font-semibold">Season<input type="number" name="year" min="1900" max="2100" defaultValue={year??""} placeholder="All years" className="w-36 rounded-lg border p-3"/></label><button className="rounded-lg bg-[#861F41] px-5 py-3 font-bold text-white">Browse rankings</button></form>
   {error&&<p role="alert" className="rounded-lg bg-red-50 p-4 text-red-700">{error.message}</p>}
   {!!editions?.length&&<div className="flex flex-wrap gap-2">{editions.map(e=><Link key={e.id} href={`/power-rankings?organization=${organization}${year?`&year=${year}`:""}&edition=${e.id}`} className={`rounded-full border px-4 py-2 text-sm font-semibold ${current?.id===e.id?"bg-[#002144] text-white":"bg-white"}`}>{e.season_year} · {e.title}</Link>)}</div>}
   {current?<div className="space-y-5"><div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm"><h2 className="text-2xl font-extrabold">{current.season_year} {current.organization_code} — {current.title}</h2><p className="mt-2 text-sm text-slate-500">{current.published_on?`Edition date: ${current.published_on}`:"Historical ranking edition"}</p>{current.source_url&&/^https?:\/\//i.test(current.source_url)&&<a href={current.source_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-semibold text-[#861F41] underline">Original ranking source</a>}</div>
   {problem?<p role="alert" className="rounded-lg bg-amber-50 p-4 text-amber-800">{problem}</p>:<>
    {overall.map(section=><section key={section.id} className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm"><h3 className="border-l-4 border-[#861F41] pl-4 text-xl font-extrabold">{section.name}</h3><RankingRows section={section} entries={entries} organization={organization} year={current.season_year}/>{sections.filter(s=>s.kind==="additional"&&s.parent_section_id===section.id).map(group=><div key={group.id} className="mt-6 border-t pt-5"><h4 className="text-lg font-bold text-[#861F41]">{group.name}</h4><RankingRows section={group} entries={entries} organization={organization} year={current.season_year}/></div>)}</section>)}
    {classes.length>0&&<div className="space-y-4"><h3 className="text-2xl font-extrabold tracking-tight">Class Rankings</h3>{classes.map(section=><section key={section.id} className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm"><h4 className="text-lg font-bold">{section.name}</h4><RankingRows section={section} entries={entries} organization={organization} year={current.season_year}/></section>)}</div>}
   </>}</div>:!error&&<p className="rounded-xl border bg-white p-8 text-center text-slate-600">No published ranking editions match your filters.</p>}
  </div>
 </main>;
}
export default function Page(props:Props){return <Suspense fallback={<main className="p-10">Loading Power Rankings…</main>}><Content {...props}/></Suspense>}
