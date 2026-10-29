import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { roundPublicUrl } from "@/lib/public-competition-routes";

export const instant = false;

const PAGE_SIZE = 25;
const ROUND_OPTIONS = [
  ["single_show", "Single show"],
  ["regionals_quarterfinals", "Regionals / Quarterfinals"],
  ["prelims", "Preliminaries"],
  ["semifinals", "Semifinals"],
  ["finals", "Finals"],
  ["custom", "Other"],
] as const;
const ORGANIZATIONS = ["KMEA", "MSBA", "BOA", "DCI"];

type SearchParams = Record<string, string | string[] | undefined>;
type Props = { searchParams: Promise<SearchParams> };
type Band = { name: string; slug: string };
type Competition = {
  name: string; slug: string; season_year: number;
  organization_code: string; publication_status: string; archived_at: string | null;
};
type Round = {
  name: string; slug: string; round_kind: string; archived_at: string | null;
  competitions: Competition;
};
type ResultRow = {
  id: string; classification: string | null;
  overall_placement: number | null; class_placement: number | null;
  total_score: number | string | null;
  bands: Band; competition_rounds: Round;
};

function single(v: string | string[] | undefined): string {
  return typeof v === "string" ? v : Array.isArray(v) ? (v[0] ?? "") : "";
}
function year(v: string): number | null {
  const n = Number(v);
  return /^\d{4}$/.test(v) && n >= 1800 && n <= 2200 ? n : null;
}
function safeNumber(v: string, max: number): number | null {
  if (!v.trim()) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
}
function score(v: string | number | null): string {
  if (v === null) return "—";
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(3) : "—";
}
function resultUrl(filters: Record<string, string>, page: number) {
  const p = new URLSearchParams();
  for (const [key, val] of Object.entries(filters)) if (val) p.set(key, val);
  if (page > 1) p.set("page", String(page));
  return `/search/results?${p.toString()}`;
}
const inputClass = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-[#002144] focus:outline-2 focus:outline-[#861F41]";

async function ResultsContent({ searchParams }: Props) {
  const params = await searchParams;
  const filters = {
    from: single(params.from), to: single(params.to),
    organization: single(params.organization), classification: single(params.classification).trim().slice(0, 30),
    round: single(params.round), placementType: single(params.placementType),
    place: single(params.place), minScore: single(params.minScore), maxScore: single(params.maxScore),
  };
  const from = year(filters.from);
  const to = year(filters.to);
  const place = safeNumber(filters.place, 10000);
  const minScore = safeNumber(filters.minScore, 100000);
  const maxScore = safeNumber(filters.maxScore, 100000);
  const pageRaw = Number(single(params.page));
  const page = Number.isSafeInteger(pageRaw) && pageRaw >= 1 && pageRaw <= 1000 ? pageRaw : 1;
  const invalid = (Boolean(filters.from) && from === null) ||
    (Boolean(filters.to) && to === null) ||
    (from !== null && to !== null && from > to) ||
    (Boolean(filters.place) && (place === null || place < 1)) ||
    (Boolean(filters.minScore) && minScore === null) ||
    (Boolean(filters.maxScore) && maxScore === null) ||
    (minScore !== null && maxScore !== null && minScore > maxScore);

  let rows: ResultRow[] = [];
  let total = 0;
  let loadError = "";
  if (!invalid) {
    const supabase = await createClient();
    // Both inner joins are required so filters select only published competitions.
    let query = supabase.from("competition_entries").select(
      "id, classification, overall_placement, class_placement, total_score, bands!inner(name,slug), competition_rounds!inner(name,slug,round_kind,archived_at,competitions!inner(name,slug,season_year,organization_code,publication_status,archived_at))",
      { count: "exact" }
    )
      .eq("competition_rounds.competitions.publication_status", "published")
      .is("competition_rounds.competitions.archived_at", null)
      .is("competition_rounds.archived_at", null);
    if (from !== null) query = query.gte("competition_rounds.competitions.season_year", from);
    if (to !== null) query = query.lte("competition_rounds.competitions.season_year", to);
    if (ORGANIZATIONS.includes(filters.organization)) query = query.eq("competition_rounds.competitions.organization_code", filters.organization);
    if (ROUND_OPTIONS.some(([v]) => v === filters.round)) query = query.eq("competition_rounds.round_kind", filters.round);
    if (filters.classification) query = query.ilike("classification", filters.classification.replace(/[%_\\]/g, "\\$&"));
    const placementColumn = filters.placementType === "class" ? "class_placement" : "overall_placement";
    if (place !== null) query = query.eq(placementColumn, place);
    if (minScore !== null) query = query.gte("total_score", minScore);
    if (maxScore !== null) query = query.lte("total_score", maxScore);
    const { data, count, error } = await query
      .order("id", { ascending: true })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    if (error) loadError = "Results could not be loaded. Please try a narrower search.";
    else {
      rows = (data ?? []) as unknown as ResultRow[];
      total = count ?? 0;
    }
  }
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <main className="min-h-screen bg-[#f6f7f9] pb-20 text-[#002144]">
      <section className="bg-[#002144] px-5 py-12 text-white sm:px-8">
        <div className="mx-auto max-w-7xl">
          <Link href="/search" className="text-sm font-semibold text-rose-200 hover:underline">← Back to archive search</Link>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-rose-200">Explore the archive</p>
          <h1 className="mt-2 text-3xl font-extrabold sm:text-5xl">Historical Results Search</h1>
          <p className="mt-4 max-w-3xl text-slate-200">Find individual published performances by season, organization, class, round, placement, and total score.</p>
        </div>
      </section>
      <div className="mx-auto max-w-7xl space-y-7 px-5 py-8 sm:px-8">
        <form method="get" action="/search/results" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm font-semibold">From year<input type="number" min="1800" max="2200" name="from" defaultValue={filters.from} placeholder="e.g. 2014" className={inputClass}/></label>
            <label className="text-sm font-semibold">Through year<input type="number" min="1800" max="2200" name="to" defaultValue={filters.to} placeholder="e.g. 2026" className={inputClass}/></label>
            <label className="text-sm font-semibold">Organization<select name="organization" defaultValue={filters.organization} className={inputClass}><option value="">All organizations</option>{ORGANIZATIONS.map(o=><option key={o} value={o}>{o}</option>)}</select></label>
            <label className="text-sm font-semibold">Classification<input name="classification" maxLength={30} placeholder="e.g. 4A" defaultValue={filters.classification} className={inputClass}/></label>
            <label className="text-sm font-semibold">Round<select name="round" defaultValue={filters.round} className={inputClass}><option value="">All rounds</option>{ROUND_OPTIONS.map(([v,label])=><option value={v} key={v}>{label}</option>)}</select></label>
            <label className="text-sm font-semibold">Placement type<select name="placementType" defaultValue={filters.placementType} className={inputClass}><option value="overall">Overall</option><option value="class">Class</option></select></label>
            <label className="text-sm font-semibold">Exact placement<input type="number" min="1" max="10000" name="place" placeholder="e.g. 1" defaultValue={filters.place} className={inputClass}/></label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm font-semibold">Min score<input type="number" min="0" step="any" name="minScore" defaultValue={filters.minScore} className={inputClass}/></label>
              <label className="text-sm font-semibold">Max score<input type="number" min="0" step="any" name="maxScore" defaultValue={filters.maxScore} className={inputClass}/></label>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button className="rounded-lg bg-[#861F41] px-6 py-3 text-sm font-bold text-white hover:bg-[#6d1733]">Find results</button>
            <Link href="/search/results" className="rounded-lg border border-slate-300 px-6 py-3 text-sm font-semibold hover:bg-slate-50">Clear filters</Link>
          </div>
        </form>
        {invalid ? <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">Check the year range, score range, or placement filters.</p> : loadError ? <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-5 text-sm text-red-900">{loadError}</p> : (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4 text-sm font-semibold">{total.toLocaleString()} matching recorded performances</div>
            <div className="overflow-x-auto">
              <table className="min-w-212.5 w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-700"><tr><th className="px-5 py-3">Season / Competition</th><th className="px-5 py-3">Ensemble</th><th className="px-5 py-3">Round / Class</th><th className="px-5 py-3 text-right">Overall</th><th className="px-5 py-3 text-right">Class</th><th className="px-5 py-3 text-right">Total</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map(row => {
                    const r = row.competition_rounds;
                    const c = r.competitions;
                    return <tr key={row.id} className="hover:bg-slate-50"><td className="px-5 py-4"><div className="font-bold">{c.season_year} · {c.organization_code}</div><Link href={roundPublicUrl(c.slug,r.slug)} className="text-[#861F41] hover:underline">{c.name}</Link></td><td className="px-5 py-4"><Link href={`/bands/${row.bands.slug}`} className="font-semibold hover:underline">{row.bands.name}</Link></td><td className="px-5 py-4">{r.name}<div className="text-slate-500">{row.classification || "Unclassified"}</div></td><td className="px-5 py-4 text-right tabular-nums">{row.overall_placement ?? "—"}</td><td className="px-5 py-4 text-right tabular-nums">{row.class_placement ?? "—"}</td><td className="px-5 py-4 text-right font-bold tabular-nums">{score(row.total_score)}</td></tr>;
                  })}
                  {rows.length === 0 && <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-500">No published results match these filters.</td></tr>}
                </tbody>
              </table>
            </div>
            {lastPage > 1 && <nav className="flex items-center justify-center gap-4 border-t border-slate-200 p-5 text-sm font-semibold" aria-label="Results pagination">{page > 1 && <Link href={resultUrl(filters,page-1)} className="rounded-lg border px-4 py-2">← Previous</Link>}<span>Page {page} of {lastPage}</span>{page < lastPage && <Link href={resultUrl(filters,page+1)} className="rounded-lg border px-4 py-2">Next →</Link>}</nav>}
          </section>
        )}
        <p className="text-sm leading-6 text-slate-500">Records reflect what is currently documented and published. A missing result does not prove an ensemble did not compete. Scores from different organizations or historical judging systems are not always directly comparable.</p>
      </div>
    </main>
  );
}
export default function HistoricalResultsSearchPage(props: Props) {
  return <Suspense fallback={<div className="mx-auto max-w-7xl p-10 text-slate-600">Loading historical results search…</div>}><ResultsContent {...props}/></Suspense>;
}
