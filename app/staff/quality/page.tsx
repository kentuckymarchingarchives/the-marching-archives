import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Read-only staff quality overview. No route-level `dynamic` export:
// this project uses Next.js Cache Components.
const PAGE_SIZE = 24;

type Props = { searchParams: Promise<{ page?: string; q?: string }> };
type Competition = {
  id: string;
  name: string;
  season_year: number;
  organization_code: string;
  publication_status: string;
};
type Source = { competition_id: string; reviewed_at: string | null };
type Verification = { competition_id: string };

type QualityRow = Competition & {
  totalSources: number;
  reviewedSources: number;
  verification: "verified" | "outdated" | "unverified" | "draft";
};

function pageUrl(page: number, q: string) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/staff/quality${query ? `?${query}` : ""}`;
}

async function QualityContent({ searchParams }: Props) {
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 100);
  const pageInput = Number(params.page ?? "1");
  const page = Number.isSafeInteger(pageInput) && pageInput > 0
    ? Math.min(pageInput, 10000) : 1;

  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  if (authError || !auth?.claims?.sub) redirect("/staff/login");

  const { data: staff, error: staffError } = await supabase
    .from("staff_members")
    .select("role, status")
    .eq("user_id", auth.claims.sub)
    .maybeSingle();
  if (staffError || staff?.status !== "active" ||
      !["owner", "admin", "editor"].includes(staff.role)) {
    redirect("/staff/login?error=unauthorized");
  }

  let query = supabase.from("competitions")
    .select("id, name, season_year, organization_code, publication_status", { count: "exact" })
    .is("archived_at", null);
  if (q) query = query.ilike("name", `%${q.replace(/[\%_]/g, "\$&")}%`);
  const { data, count, error: competitionError } = await query
    .order("season_year", { ascending: false })
    .order("name", { ascending: true })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (competitionError) throw new Error("Unable to load competition records.");

  const competitions = (data ?? []) as Competition[];
  const ids = competitions.map((item) => item.id);
  let sources: Source[] = [];
  let verifications: Verification[] = [];
  if (ids.length) {
    const [sourceResult, verificationResult] = await Promise.all([
      supabase.from("competition_sources")
        .select("competition_id, reviewed_at")
        .in("competition_id", ids)
        .limit(10000),
      supabase.from("competition_verifications")
        .select("competition_id")
        .in("competition_id", ids),
    ]);
    if (sourceResult.error || verificationResult.error) {
      throw new Error("Unable to load source or verification records. Confirm migrations 012 and 014 are installed and staff can read them.");
    }
    sources = (sourceResult.data ?? []) as Source[];
    verifications = (verificationResult.data ?? []) as Verification[];
  }
  const sourceMap = new Map<string, { total: number; reviewed: number }>();
  for (const source of sources) {
    const item = sourceMap.get(source.competition_id) ?? { total: 0, reviewed: 0 };
    item.total += 1;
    if (source.reviewed_at) item.reviewed += 1;
    sourceMap.set(source.competition_id, item);
  }
  const verifiedIds = new Set(verifications.map((row) => row.competition_id));
  const verificationChecks = await Promise.all(
    competitions.filter((c) => c.publication_status === "published" && verifiedIds.has(c.id))
      .map(async (competition) => {
        const { data: current, error } = await supabase.rpc("tma_verification_is_current", { p_id: competition.id });
        if (error) throw new Error("Unable to check verification currency. Confirm migration 014 is installed.");
        return { id: competition.id, current: current === true };
      })
  );
  const currentIds = new Set(verificationChecks.filter((c) => c.current).map((c) => c.id));
  const rows: QualityRow[] = competitions.map((competition) => {
    const sourceCounts = sourceMap.get(competition.id) ?? { total: 0, reviewed: 0 };
    const verification: QualityRow["verification"] = competition.publication_status !== "published"
      ? "draft"
      : currentIds.has(competition.id) ? "verified"
      : verifiedIds.has(competition.id) ? "outdated" : "unverified";
    return { ...competition, totalSources: sourceCounts.total,
      reviewedSources: sourceCounts.reviewed, verification };
  });
  const total = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const noSources = rows.filter((r) => r.totalSources === 0).length;
  const pending = rows.filter((r) => r.totalSources > r.reviewedSources).length;
  const outdated = rows.filter((r) => r.verification === "outdated").length;
  const verified = rows.filter((r) => r.verification === "verified").length;

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-[#002144]">
      <header className="bg-[#002144] px-5 py-11 text-white sm:px-8">
        <div className="mx-auto max-w-6xl">
          <Link href="/staff/dashboard" className="text-sm font-semibold text-[#f1c4d4] hover:underline">← Staff dashboard</Link>
          <p className="mt-7 text-xs font-bold uppercase tracking-widest text-[#f1c4d4]">Archive administration</p>
          <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">Archive quality</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200">Find competitions that need source citations, review, or renewed verification. This page never changes records.</p>
        </div>
      </header>
      <div className="mx-auto max-w-6xl space-y-7 px-5 py-9 sm:px-8">
        <form action="/staff/quality" method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-5">
          <div className="min-w-52 flex-1">
            <label htmlFor="quality-search" className="mb-2 block text-sm font-bold">Find a competition</label>
            <input id="quality-search" name="q" type="search" defaultValue={q} placeholder="Competition name" className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm" />
          </div>
          <button className="rounded-lg bg-[#861F41] px-5 py-2.5 text-sm font-bold text-white" type="submit">Search</button>
          <Link href="/staff/quality" className="px-3 py-2.5 text-sm font-bold text-[#861F41]">Clear</Link>
        </form>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Quality counts for current page">
          {[
            { label: "Without citations", value: noSources },
            { label: "With sources awaiting review", value: pending },
            { label: "Verification outdated", value: outdated },
            { label: "Currently verified", value: verified },
          ].map((metric) => (
            <div key={metric.label} className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold text-slate-500">{metric.label}</p>
              <p className="mt-3 text-3xl font-extrabold tabular-nums">{metric.value}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500">Counts apply only to the {rows.length} competitions displayed on this page, not the entire archive. The existing single competition source_url is not counted as a managed citation.</p>
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5">
            <h2 className="text-xl font-extrabold">Competition quality checklist</h2>
            <span className="text-sm text-slate-500">{total.toLocaleString()} active competitions</span>
          </div>
          {rows.length === 0 ? (
            <p className="p-8 text-sm text-slate-600">No competitions match this search.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {rows.map((row) => (
                <article key={row.id} className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_190px_170px] lg:items-center">
                  <div className="min-w-0">
                    <Link href={`/staff/competitions/${row.id}`} className="font-bold hover:text-[#861F41] hover:underline">{row.name}</Link>
                    <p className="mt-1 text-xs text-slate-500">{row.organization_code} · {row.season_year} · {row.publication_status === "published" ? "Published" : "Not published"}</p>
                    <p className="mt-2 text-sm text-slate-700">
                      {row.totalSources === 0 ? "No managed citations" : `${row.reviewedSources} of ${row.totalSources} sources reviewed`}
                    </p>
                  </div>
                  <div>
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${row.verification === "verified" ? "bg-emerald-100 text-emerald-900" : row.verification === "outdated" ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"}`}>
                      {row.verification === "verified" ? "Verified" : row.verification === "outdated" ? "Verification outdated" : row.verification === "draft" ? "Not published" : "Not verified"}
                    </span>
                  </div>
                  <nav aria-label={`Quality actions for ${row.name}`} className="flex flex-wrap gap-3 text-sm font-bold text-[#861F41] lg:flex-col lg:gap-2">
                    <Link href={`/staff/competitions/${row.id}/sources`} className="hover:underline">Manage sources →</Link>
                    <Link href={`/staff/competitions/${row.id}/review`} className="hover:underline">Review results →</Link>
                    <Link href={`/staff/competitions/${row.id}/verification`} className="hover:underline">Verification →</Link>
                  </nav>
                </article>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between border-t border-slate-200 p-5 text-sm">
            {page > 1 ? <Link className="font-bold text-[#861F41]" href={pageUrl(page - 1, q)}>← Previous</Link> : <span />}
            <span className="text-slate-500">Page {page} of {pageCount}</span>
            {page < pageCount ? <Link className="font-bold text-[#861F41]" href={pageUrl(page + 1, q)}>Next →</Link> : <span />}
          </div>
        </section>
        <p className="text-sm text-slate-500">These indicators are administrative reminders. A valid URL or a saved approval does not independently establish historical accuracy.</p>
      </div>
    </main>
  );
}

export default function QualityPage(props: Props) {
  return <Suspense fallback={<main className="mx-auto max-w-6xl p-8">Loading archive quality…</main>}><QualityContent {...props} /></Suspense>;
}
