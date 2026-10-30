import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import PowerRankingTrendChart from "@/components/PowerRankingTrendChart";

type Params = { organization?: string; year?: string; band?: string; view?: string; classification?: string };
type Props = { searchParams: Promise<Params> };
type Edition = { id: string; title: string; season_year: number; published_on: string | null; created_at: string };
type Section = { id: string; edition_id: string; kind: string; classification: string | null; name: string; parent_section_id: string | null; numbered: boolean };
type RankingEntry = { edition_id: string; section_id: string; band_id: string; rank: number | null };
type Band = { id: string; name: string; slug: string };

function EditionDate({ value }: { value: string | null }) {
  return <span>{value ?? "Date not recorded"}</span>;
}

async function HistoryContent({ searchParams }: Props) {
  const params = await searchParams;
  const organization = params.organization === "BOA" ? "BOA" : "KMEA";
  const year = /^\d{4}$/.test(params.year ?? "") ? Number(params.year) : new Date().getFullYear();
  const view = organization === "KMEA" && params.view === "class" ? "class" : "overall";
  const classification = view === "class" && /^(1A|2A|3A|4A|5A)$/.test(params.classification ?? "") ? params.classification! : "1A";
  const bandSlug = /^[a-zA-Z0-9_-]{1,150}$/.test(params.band ?? "") ? params.band! : "";
  const db = await createClient();
  const { data: bandData, error: bandError } = bandSlug
    ? await db.from("bands").select("id,name,slug").eq("slug", bandSlug).maybeSingle()
    : { data: null, error: null };
  const band = bandData as Band | null;

  const { data: editionData, error: editionError } = await db.from("power_ranking_editions")
    .select("id,title,season_year,published_on,created_at")
    .eq("status", "published").eq("organization_code", organization).eq("season_year", year)
    .order("published_on", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true }).limit(201);
  const editions = (editionData ?? []) as Edition[];
  const truncated = editions.length > 200;
  const errors: string[] = [];
  if (editionError) errors.push("Unable to load ranking editions.");
  if (bandError) errors.push("Unable to find this ensemble.");

  const rows: Array<{edition: Edition; description: string; rank: number | null; movement: string; valid: boolean}> = [];
  if (band && editions.length && !truncated && !editionError) {
    const ids = editions.map(e => e.id);
    const [sectionsResult, entriesResult] = await Promise.all([
      db.from("power_ranking_sections").select("id,edition_id,kind,classification,name,parent_section_id,numbered").in("edition_id", ids).limit(2001),
      db.from("power_ranking_entries").select("edition_id,section_id,band_id,rank").in("edition_id", ids).eq("band_id", band.id).limit(2001),
    ]);
    if (sectionsResult.error || entriesResult.error) errors.push("Unable to load complete ranking history.");
    const sections = (sectionsResult.data ?? []) as Section[];
    const entries = (entriesResult.data ?? []) as RankingEntry[];
    if (sections.length > 2000 || entries.length > 2000) errors.push("History exceeds the display limit. Results withheld to avoid missing entries.");
    if (!errors.length) {
      const bySection = new Map(sections.map(s => [s.id, s]));
      let previousRank: number | null = null;
      let previousHadRank = false;
      for (const edition of editions) {
        const relevant = sections.filter(s => s.edition_id === edition.id && (view === "overall" ? s.kind === "overall" : s.kind === "class" && s.classification === classification));
        const main = relevant[0];
        const matching = entries.filter(e => e.edition_id === edition.id).map(e => ({ entry: e, section: bySection.get(e.section_id) })).filter(({section}) => section && (section.id === main?.id || (view === "overall" && section.kind === "additional" && section.parent_section_id === main?.id)));
        const mainEntry = matching.find(({section}) => section?.id === main?.id);
        const otherEntry = matching.find(({section}) => section?.kind === "additional");
        const matched = mainEntry ?? otherEntry;
        const rank = matched?.section?.numbered ? matched.entry.rank : null;
        let movement = "—";
        if (rank !== null && rank !== undefined && previousHadRank && previousRank !== null) {
          const diff = previousRank - rank;
          movement = diff > 0 ? `↑ ${diff}` : diff < 0 ? `↓ ${Math.abs(diff)}` : "No change";
        }
        rows.push({edition, description: matched ? (matched.section?.kind === "additional" ? matched.section.name : rank !== null ? `#${rank}` : "Listed") : "Not listed", rank: rank ?? null, movement, valid: Boolean(matched)});
        previousHadRank = rank !== null && rank !== undefined;
        previousRank = rank ?? null;
      }
    }
  }
  return <main className="min-h-screen bg-[#f6f7f9] text-[#002144]">
    <section className="relative overflow-hidden bg-[#002144] px-6 py-20 text-white"><div className="mx-auto max-w-5xl">
      <Link href="/power-rankings" className="text-sm font-semibold text-pink-200 hover:underline">← Power Rankings</Link>
      <p className="mt-7 text-xs font-extrabold uppercase tracking-[.23em] text-[#e8afc2]">Edition-by-edition movement</p><h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-6xl">Power Rankings <span className="text-[#e8afc2]">History.</span></h1>
      <p className="mt-3 max-w-3xl text-slate-200">Follow an ensemble through published ranking editions. Movement is calculated only between comparable, documented numbered positions.</p>
    </div></section>
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-10">
      <form action="/power-rankings/history" className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-1 text-sm font-semibold">Organization<select name="organization" defaultValue={organization} className="rounded-lg border p-3"><option value="KMEA">KMEA</option><option value="BOA">BOA</option></select></label>
        <label className="grid gap-1 text-sm font-semibold">Season<input name="year" type="number" min="1900" max="2100" defaultValue={year} className="rounded-lg border p-3" required/></label>
        <label className="grid gap-1 text-sm font-semibold">Ensemble slug<input name="band" defaultValue={bandSlug} placeholder="From band profile URL" className="rounded-lg border p-3" required/></label>
        <label className="grid gap-1 text-sm font-semibold">Ranking type<select name="view" defaultValue={view} className="rounded-lg border p-3"><option value="overall">Overall</option>{organization==="KMEA"&&<option value="class">Class</option>}</select></label>
        {organization==="KMEA"&&<label className="grid gap-1 text-sm font-semibold">Class<select name="classification" defaultValue={classification} className="rounded-lg border p-3">{["1A","2A","3A","4A","5A"].map(c=><option key={c}>{c}</option>)}</select></label>}
        <div className="flex items-end"><button className="w-full rounded-lg bg-[#861F41] px-5 py-3 font-bold text-white">View history</button></div>
      </form>
      {errors.map(e=><p key={e} role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{e}</p>)}
      {truncated&&<p role="alert" className="rounded-xl bg-amber-50 p-4 text-amber-900">More than 200 editions were found. History is withheld to avoid an incomplete comparison.</p>}
      {bandSlug&&!band&&!bandError&&<p className="rounded-xl border bg-white p-5">No band found with that URL slug. Open a band profile and use its final URL segment.</p>}
      {band&&!errors.length&&!truncated&&<section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">{organization} · {year} · {view==="class"?`Class ${classification}`:"Overall"}</p><h2 className="mt-2 text-2xl font-extrabold">{band.name}</h2><p className="mt-1 text-sm text-slate-500">{editions.length} published edition{editions.length===1?"":"s"} documented</p></div><Link href={`/bands/${band.slug}`} className="text-sm font-semibold text-[#861F41] hover:underline">Band profile →</Link></div>
        <PowerRankingTrendChart editions={rows.map(r => ({ id: r.edition.id, label: r.edition.title, rank: r.rank, description: r.description }))} />
        <div className="mt-6 overflow-x-auto"><table className="w-full min-w-140 text-left text-sm"><thead><tr className="border-b bg-[#edf2f7] text-[#002144]"><th className="py-3 pr-3">Edition</th><th className="pr-3">Publication date</th><th className="pr-3">Recorded position / group</th><th>Change</th></tr></thead><tbody>{rows.map(r=><tr key={r.edition.id} className="border-b border-slate-100 transition-colors hover:bg-[#f8edf1] last:border-0"><td className="py-4 pr-3 font-semibold"><Link className="hover:underline" href={`/power-rankings?organization=${organization}&year=${year}&edition=${r.edition.id}`}>{r.edition.title}</Link></td><td className="pr-3 text-slate-500"><EditionDate value={r.edition.published_on}/></td><td className="pr-3">{r.description}</td><td className={r.movement.startsWith("↑")?"font-semibold text-emerald-700":r.movement.startsWith("↓")?"font-semibold text-red-700":"text-slate-500"}>{r.movement}</td></tr>)}</tbody></table></div>
        {!rows.length&&<p className="mt-5 text-slate-500">No published ranking editions were found for these filters.</p>}
        <p className="mt-5 text-xs leading-6 text-slate-500">Movement compares each edition only with the immediately preceding published edition of the same season and ranking type, when both contain numbered positions. Unlisted bands and unnumbered additional groups are never assigned an inferred rank. Editions without publication dates follow record creation order as a fallback.</p>
      </section>}
      {!bandSlug&&<p className="rounded-xl border bg-white p-6 text-slate-600">Select an ensemble from a published Power Rankings page using its History link, or enter its band-profile slug above.</p>}
    </div>
  </main>;
}

export default function Page(props: Props) {
  return <Suspense fallback={<main className="p-10">Loading ranking history…</main>}><HistoryContent {...props}/></Suspense>;
}
