import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Data Completeness | TMA Staff",
  robots: { index: false, follow: false },
};

type Params = {
  org?: string;
  status?: string;
  page?: string;
};
type Props = { searchParams: Promise<Params> };
type Row = {
  competition_id: string;
  competition_slug: string | null;
  competition_name: string;
  season_year: number;
  organization_code: string;
  publication_status: string;
  round_count: number;
  entry_count: number;
  placement_count: number;
  scored_count: number;
  reviewed_source_count: number;
  verification_current: boolean;
  completeness_score: number;
  total_matching: number;
};

const organizations = ["all", "KMEA", "BOA", "MSBA", "DCI"] as const;
const statuses = ["all", "draft", "published"] as const;
const pageSize = 50;

function makeUrl(org: string, status: string, page: number) {
  const params = new URLSearchParams();
  if (org !== "all") params.set("org", org);
  if (status !== "all") params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/staff/completeness${query ? `?${query}` : ""}`;
}

function Pill({ score }: { score: number }) {
  const style = score >= 85
    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
    : score >= 60
      ? "bg-amber-50 text-amber-900 border-amber-200"
      : "bg-rose-50 text-rose-800 border-rose-200";
  return <span className={`inline-flex rounded-full border px-3 py-1 text-sm font-black tabular-nums ${style}`}>{score}/100</span>;
}

function Progress({ value, max }: { value: number; max: number }) {
  const percent = max ? Math.round(100 * value / max) : 0;
  return <span className="inline-flex items-center gap-2">
    <span className="h-2 w-16 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
      <span className="block h-full rounded-full bg-[#861F41]" style={{ width: `${percent}%` }} />
    </span>
    <span className="tabular-nums">{value}/{max}</span>
  </span>;
}

async function Content({ searchParams }: Props) {
  await connection();
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  if (authError || !auth?.claims?.sub) redirect("/staff/login");
  const { data: staff, error: staffError } = await supabase
    .from("staff_members")
    .select("role,status")
    .eq("user_id", auth.claims.sub)
    .maybeSingle();
  if (staffError || !staff || staff.status !== "active" ||
      !["owner", "admin", "editor"].includes(staff.role)) {
    redirect("/staff/login?error=unauthorized");
  }

  const query = await searchParams;
  const org = organizations.includes(query.org as typeof organizations[number])
    ? query.org! : "all";
  const status = statuses.includes(query.status as typeof statuses[number])
    ? query.status! : "all";
  const parsedPage = Number(query.page ?? "1");
  const page = Number.isSafeInteger(parsedPage) ? Math.min(Math.max(1, parsedPage), 100) : 1;

  const result = await supabase.rpc("tma_staff_competition_completeness", {
    p_organization: org === "all" ? null : org,
    p_publication: status,
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
  });
  const records: Row[] = result.error ? [] : (result.data ?? []) as Row[];
  const total = records.length ? Number(records[0].total_matching) : null;
  const hasNext = total !== null && page * pageSize < total && page < 100;

  return <main className="min-h-screen bg-[#f6f7f8] text-[#002144]">
    <header className="bg-[#002144] px-6 py-14 text-white md:px-8">
      <div className="mx-auto max-w-330">
        <p className="text-xs font-black uppercase tracking-[.2em] text-[#e8afc2]">The Marching Archives / Staff research</p>
        <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">Archive Data Completeness</h1>
        <p className="mt-4 max-w-3xl leading-7 text-[#d2dce5]">Find competitions that need more recorded results, placements, scores, reviewed citations, or current verification. The score measures documented fields—not historical truth or whether all participants have been found.</p>
        <Link href="/staff/dashboard" className="mt-6 inline-flex rounded-lg border border-white/40 px-4 py-2 text-sm font-bold hover:bg-white/10">← Staff Dashboard</Link>
      </div>
    </header>
    <div className="mx-auto max-w-330 space-y-8 px-6 py-10 md:px-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-lg font-black">Filter the research queue</h2>
        <nav className="mt-4 flex flex-wrap gap-2" aria-label="Filter by organization">
          {organizations.map(value => <Link key={value} href={makeUrl(value, status, 1)} aria-current={org === value ? "page" : undefined}
            className={`rounded-full border px-4 py-2 text-sm font-bold ${org === value ? "border-[#002144] bg-[#002144] text-white" : "border-slate-200 hover:border-[#861F41]"}`}>{value === "all" ? "All organizations" : value}</Link>)}
        </nav>
        <nav className="mt-3 flex flex-wrap gap-2" aria-label="Filter by publication status">
          {statuses.map(value => <Link key={value} href={makeUrl(org, value, 1)} aria-current={status === value ? "page" : undefined}
            className={`rounded-full border px-4 py-2 text-sm font-bold ${status === value ? "border-[#861F41] bg-[#861F41] text-white" : "border-slate-200 hover:border-[#861F41]"}`}>{value === "all" ? "All statuses" : value === "draft" ? "Drafts" : "Published"}</Link>)}
        </nav>
      </section>

      <section aria-labelledby="queue-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h2 id="queue-heading" className="text-2xl font-black">Records needing attention</h2><p className="mt-1 text-sm text-slate-600">Lowest completeness first; newest season breaks ties.</p></div>
          <p className="text-sm font-bold text-slate-600">{total === null ? "" : `${total.toLocaleString()} matching competitions`}</p>
        </div>
        {result.error ? <div role="alert" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">Unable to load completeness data. Ensure migration 032 is installed and your account is active staff. Database error: {result.error.message}</div> :
        records.length === 0 ? <p className="mt-5 rounded-xl border border-slate-200 bg-white p-7 text-sm text-slate-600">No competitions match these filters.</p> :
        <div className="mt-5 space-y-4">{records.map(item => <article key={item.competition_id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0"><p className="text-xs font-black uppercase tracking-wide text-[#861F41]">{item.organization_code} · {item.season_year} · {item.publication_status}</p><h3 className="mt-2 text-xl font-black">{item.competition_name}</h3></div>
            <Pill score={item.completeness_score} />
          </div>
          <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-3"><p className="font-bold">Rounds · 15 pts</p><p className="mt-1 text-slate-600">{item.round_count} documented</p></div>
            <div className="rounded-lg bg-slate-50 p-3"><p className="font-bold">Result entries · 20 pts</p><p className="mt-1 text-slate-600">{item.entry_count} documented</p></div>
            <div className="rounded-lg bg-slate-50 p-3"><p className="font-bold">Placements · 20 pts</p><p className="mt-1 text-slate-600"><Progress value={item.placement_count} max={item.entry_count} /></p></div>
            <div className="rounded-lg bg-slate-50 p-3"><p className="font-bold">Total scores · 20 pts</p><p className="mt-1 text-slate-600"><Progress value={item.scored_count} max={item.entry_count} /></p></div>
            <div className="rounded-lg bg-slate-50 p-3"><p className="font-bold">Reviewed sources · 15 pts</p><p className="mt-1 text-slate-600">{item.reviewed_source_count} reviewed</p></div>
            <div className="rounded-lg bg-slate-50 p-3"><p className="font-bold">Current verification · 10 pts</p><p className="mt-1 text-slate-600">{item.verification_current ? "Current" : "Not current or not yet verified"}</p></div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href={`/staff/competitions/${item.competition_id}`} className="rounded-lg bg-[#002144] px-4 py-2 text-sm font-bold text-white hover:bg-[#173c61]">Edit competition →</Link>
            {item.competition_slug && item.publication_status === "published" && <Link href={`/competitions/${item.competition_slug}`} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold hover:bg-slate-50">Public record ↗</Link>}
          </div>
        </article>)}</div>}
        <nav aria-label="Completeness pages" className="mt-6 flex items-center justify-between gap-3 text-sm font-bold">
          {page > 1 ? <Link href={makeUrl(org, status, page - 1)} className="rounded-lg border border-slate-200 bg-white px-4 py-2">← Previous</Link> : <span />}
          <span>Page {page}</span>
          {hasNext ? <Link href={makeUrl(org, status, page + 1)} className="rounded-lg border border-slate-200 bg-white px-4 py-2">Next →</Link> : <span />}
        </nav>
      </section>
      <aside className="rounded-2xl border border-slate-200 bg-white p-6 text-sm leading-7 text-slate-600">
        <h2 className="mb-2 text-lg font-black text-[#002144]">How the score works</h2>
        <p><strong>Rounds (15):</strong> At least one round. <strong>Entries (20):</strong> At least one ensemble entry. <strong>Placements (20):</strong> Proportion of entries with an overall or class placement. <strong>Scores (20):</strong> Proportion of entries with a recorded total score. <strong>Sources (15):</strong> At least one reviewed citation. <strong>Verification (10):</strong> A current formal verification for a published competition.</p>
        <p className="mt-3">This is a documentation checklist, not a historical accuracy rating. It cannot infer missing participants, missing rounds, or whether a historical source is truthful. A draft may top out at 90 because formal verification applies to published competitions. Scores are computed from current records and update when reloaded.</p>
      </aside>
    </div>
  </main>;
}

export default function StaffCompletenessPage(props: Props) {
  return <Suspense fallback={<main className="min-h-screen bg-[#f6f7f8] p-10"><p role="status">Loading archive completeness…</p></main>}><Content {...props} /></Suspense>;
}
