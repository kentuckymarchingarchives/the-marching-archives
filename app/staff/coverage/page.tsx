import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Props = { searchParams: Promise<{ year?: string; org?: string }> };
type RecordRow = {
  id: string;
  name: string;
  season_year: number | null;
  organization_code: string | null;
  competition_date: string | null;
  city: string | null;
  state: string | null;
  source_url: string | null;
  publication_status: string | null;
};
type CoverageRow = {
  year: number;
  org: string;
  recorded: number;
  published: number;
  drafts: number;
  missingDate: number;
  missingLocation: number;
  missingSource: number;
};

const FETCH_SIZE = 500;
const MAX_RECORDS = 10000;

async function CoverageContent({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (authError || !userId) redirect("/staff/login");
  const { data: staff, error: staffError } = await supabase.from("staff_members")
    .select("role, status").eq("user_id", userId).maybeSingle();
  if (staffError || staff?.status !== "active" || !["owner", "admin", "editor"].includes(staff.role)) {
    redirect("/staff/login?error=unauthorized");
  }

  // Paginate explicitly to avoid Supabase's default 1,000-row cap.
  const records: RecordRow[] = [];
  let fetchError: string | null = null;
  for (let offset = 0; offset < MAX_RECORDS; offset += FETCH_SIZE) {
    const { data, error } = await supabase.from("competitions")
      .select("id, name, season_year, organization_code, competition_date, city, state, source_url, publication_status")
      .is("archived_at", null)
      .order("id", { ascending: true })
      .range(offset, offset + FETCH_SIZE - 1);
    if (error) { fetchError = error.message; break; }
    const batch = (data ?? []) as RecordRow[];
    records.push(...batch);
    if (batch.length < FETCH_SIZE) break;
  }
  const capped = records.length === MAX_RECORDS;
  const grouped = new Map<string, CoverageRow>();
  for (const record of records) {
    if (typeof record.season_year !== "number") continue;
    const org = record.organization_code?.trim().toUpperCase() || "UNSPECIFIED";
    const key = `${record.season_year}:${org}`;
    const entry = grouped.get(key) ?? {
      year: record.season_year, org, recorded: 0, published: 0, drafts: 0,
      missingDate: 0, missingLocation: 0, missingSource: 0,
    };
    entry.recorded += 1;
    if (record.publication_status === "published") entry.published += 1;
    else entry.drafts += 1;
    if (!record.competition_date) entry.missingDate += 1;
    if (!record.city?.trim() || !record.state?.trim()) entry.missingLocation += 1;
    if (!record.source_url?.trim()) entry.missingSource += 1;
    grouped.set(key, entry);
  }
  const allRows = [...grouped.values()].sort((a, b) => b.year - a.year || a.org.localeCompare(b.org));
  const years = [...new Set(allRows.map((row) => row.year))].sort((a, b) => b - a);
  const organizations = [...new Set(allRows.map((row) => row.org))].sort();
  const selectedYear = /^\d{4}$/.test(params.year ?? "") ? Number(params.year) : null;
  const selectedOrg = typeof params.org === "string" ? params.org.trim().toUpperCase().slice(0, 50) : "";
  const rows = allRows.filter((row) => (selectedYear === null || row.year === selectedYear) && (!selectedOrg || row.org === selectedOrg));
  const sum = (fn: (row: CoverageRow) => number) => rows.reduce((total, row) => total + fn(row), 0);
  const missing = sum((row) => row.missingDate + row.missingLocation + row.missingSource);

  return <main className="min-h-screen bg-[#f6f7f9] text-[#002144]">
    <header className="bg-[#002144] px-5 py-12 text-white sm:px-8">
      <div className="mx-auto max-w-6xl">
        <Link href="/staff/dashboard" className="text-sm font-semibold text-[#efbbce] hover:text-white">← Staff dashboard</Link>
        <p className="mt-7 text-xs font-bold uppercase tracking-[.2em] text-[#efbbce]">Archive administration · Phase 2</p>
        <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">Historical Data Coverage</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200">See which season and organization combinations are represented, and find records needing basic metadata or citations.</p>
      </div>
    </header>
    <div className="mx-auto max-w-6xl space-y-7 px-5 py-9 sm:px-8">
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
        <strong>Coverage is not completeness.</strong> A year absent from this report may have undocumented competitions. Counts reflect competition records accessible to your staff account, not the number of events that actually occurred. “Missing source” checks the original competition source URL; separately managed citations may exist.
      </div>
      {fetchError && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">Unable to load all records: {fetchError}. Counts below may be incomplete.</div>}
      {capped && <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">The 10,000-record report limit was reached. These counts are incomplete; narrow the underlying data or add database-side aggregation before relying on totals.</div>}
      <form action="/staff/coverage" method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="min-w-40 flex-1 text-sm font-semibold">Season
          <select name="year" defaultValue={selectedYear ?? ""} className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm">
            <option value="">All represented years</option>
            {years.map((year) => <option value={year} key={year}>{year}</option>)}
          </select>
        </label>
        <label className="min-w-40 flex-1 text-sm font-semibold">Organization
          <select name="org" defaultValue={selectedOrg} className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm">
            <option value="">All organizations</option>
            {organizations.map((org) => <option value={org} key={org}>{org}</option>)}
          </select>
        </label>
        <button type="submit" className="rounded-lg bg-[#861F41] px-5 py-3 text-sm font-bold text-white">Apply filters</button>
        <Link href="/staff/coverage" className="px-2 py-3 text-sm font-semibold text-[#861F41] hover:underline">Clear</Link>
      </form>
      <section aria-label="Coverage summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Recorded competitions", value: sum((r) => r.recorded) },
          { label: "Published", value: sum((r) => r.published) },
          { label: "Unpublished", value: sum((r) => r.drafts) },
          { label: "Missing field instances", value: missing },
        ].map((item) => <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{item.label}</p><p className="mt-2 text-3xl font-extrabold tabular-nums">{item.value.toLocaleString()}</p></div>)}
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-xl font-extrabold">Recorded season coverage</h2><p className="mt-1 text-sm text-slate-600">One row per represented year and organization. Missing field counts may overlap.</p></div>
          <Link href="/staff/competitions" className="text-sm font-semibold text-[#861F41] hover:underline">Manage competitions →</Link>
        </div>
        {rows.length === 0 ? <p className="mt-6 rounded-lg bg-slate-50 p-6 text-sm text-slate-600">No matching competition records. This does not mean there were no historical events.</p> :
        <div className="mt-6 overflow-x-auto"><table className="w-full min-w-195 border-collapse text-left text-sm">
          <thead><tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-600"><th className="px-3 py-3">Season</th><th className="px-3 py-3">Org.</th><th className="px-3 py-3 text-right">Recorded</th><th className="px-3 py-3 text-right">Published</th><th className="px-3 py-3 text-right">Unpublished</th><th className="px-3 py-3 text-right">No date</th><th className="px-3 py-3 text-right">Location missing</th><th className="px-3 py-3 text-right">No source URL</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={`${row.year}-${row.org}`} className="border-b border-slate-100 hover:bg-slate-50"><td className="px-3 py-3 font-bold"><Link href={`/seasons/${row.year}`} className="text-[#861F41] hover:underline">{row.year}</Link></td><td className="px-3 py-3 font-semibold">{row.org}</td><td className="px-3 py-3 text-right tabular-nums">{row.recorded}</td><td className="px-3 py-3 text-right tabular-nums">{row.published}</td><td className="px-3 py-3 text-right tabular-nums">{row.drafts}</td><td className="px-3 py-3 text-right tabular-nums">{row.missingDate}</td><td className="px-3 py-3 text-right tabular-nums">{row.missingLocation}</td><td className="px-3 py-3 text-right tabular-nums">{row.missingSource}</td></tr>)}</tbody>
        </table></div>}
      </section>
      <p className="text-xs leading-6 text-slate-500">Archived competitions are excluded. This is a read-only reporting view. Publication and evidence review remain separate staff workflows.</p>
    </div>
  </main>;
}

export default function CoveragePage(props: Props) {
  return <Suspense fallback={<main className="min-h-screen bg-[#f6f7f9] p-10 text-[#002144]">Loading coverage report…</main>}><CoverageContent searchParams={props.searchParams}/></Suspense>;
}
