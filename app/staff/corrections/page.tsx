import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateCorrection } from "./actions";

export const instant = false;
const PAGE_SIZE = 20;
type Search = { status?: string; page?: string };
type Submission = {
  id: string; created_at: string; kind: string; subject: string; record_url: string | null;
  season_year: number | null; details: string; evidence_url: string | null;
  contact_email: string; status: string; staff_notes: string | null;
};
function safeLink(url: string | null) {
  if (!url) return null;
  try { const parsed = new URL(url); return ["https:", "http:"].includes(parsed.protocol) ? parsed.href : null; }
  catch { return null; }
}
async function Queue({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const status = ["all", "new", "reviewing", "resolved", "dismissed"].includes(params.status ?? "") ? params.status! : "all";
  const requestedPage = Number(params.page);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 10000) : 1;
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  if (authError || !auth?.claims?.sub) redirect("/staff/login");
  const { data: staff, error: staffError } = await supabase.from("staff_members").select("role,status").eq("user_id", auth.claims.sub).maybeSingle();
  if (staffError || staff?.status !== "active" || !["owner", "admin", "editor"].includes(staff.role)) redirect("/staff/login?error=unauthorized");
  let query = supabase.from("archive_correction_submissions").select("id,created_at,kind,subject,record_url,season_year,details,evidence_url,contact_email,status,staff_notes", { count: "exact" });
  if (status !== "all") query = query.eq("status", status);
  const { data, error, count } = await query.order("created_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const submissions = (data ?? []) as Submission[];
  const pageCount = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const statusHref = (s: string, p = 1) => `/staff/corrections?status=${s}&page=${p}`;
  return (
    <main className="min-h-screen bg-[#f6f7f9] text-[#002144]">
      <header className="bg-[#002144] px-5 py-12 text-white"><div className="mx-auto max-w-6xl"><Link href="/staff/dashboard" className="text-sm text-rose-200 hover:underline">← Staff dashboard</Link><h1 className="mt-5 text-3xl font-extrabold sm:text-4xl">Community corrections</h1><p className="mt-3 text-slate-200">Review visitor-submitted corrections and missing results. Published archive records never change automatically.</p></div></header>
      <div className="mx-auto max-w-6xl space-y-6 px-5 py-8">
        <nav aria-label="Submission status" className="flex flex-wrap gap-2">{["all", "new", "reviewing", "resolved", "dismissed"].map((s) => <Link key={s} href={statusHref(s)} aria-current={status === s ? "page" : undefined} className={`rounded-full border px-4 py-2 text-sm font-semibold capitalize ${status === s ? "border-[#861F41] bg-[#861F41] text-white" : "border-slate-200 bg-white"}`}>{s}</Link>)}</nav>
        {error ? <p role="alert" className="rounded-xl bg-red-50 p-5 text-red-800">Unable to load reports. Confirm the Phase 4 SQL migration has been applied.</p> : submissions.length === 0 ? <div className="rounded-xl border bg-white p-8">No submissions match this filter.</div> : (
          <section className="space-y-4" aria-label="Submitted reports">
            {submissions.map((item) => <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">{item.subject}</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize">{item.status}</span></div>
              <p className="mt-2 text-xs text-slate-500">{item.kind.replaceAll("_", " ")} · {new Date(item.created_at).toLocaleDateString("en-US", { dateStyle: "medium" })}{item.season_year ? ` · ${item.season_year}` : ""}</p>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">{item.details}</p>
              <div className="mt-3 flex flex-wrap gap-4 text-sm">{safeLink(item.record_url) && <a href={safeLink(item.record_url)!} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#861F41] underline">Archive record</a>}{safeLink(item.evidence_url) && <a href={safeLink(item.evidence_url)!} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#861F41] underline">Supporting source</a>}</div>
              <p className="mt-3 text-xs text-slate-500">Contact (staff only): {item.contact_email}</p>
              <form action={updateCorrection} className="mt-5 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-[160px_1fr_auto] sm:items-end">
                <input type="hidden" name="id" value={item.id} />
                <label className="text-sm font-semibold">Review status<select name="status" defaultValue={item.status} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal">{["new", "reviewing", "resolved", "dismissed"].map((s) => <option value={s} key={s}>{s}</option>)}</select></label>
                <label className="text-sm font-semibold">Internal notes<textarea name="staff_notes" defaultValue={item.staff_notes ?? ""} maxLength={4000} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal" /></label>
                <button type="submit" className="rounded-lg bg-[#861F41] px-5 py-2.5 font-semibold text-white">Save review</button>
              </form>
            </article>)}
          </section>
        )}
        <div className="flex items-center gap-4 text-sm"><span>Page {page} of {pageCount} · {count ?? 0} reports</span>{page > 1 && <Link className="font-bold text-[#861F41]" href={statusHref(status, page - 1)}>← Previous</Link>}{page < pageCount && <Link className="font-bold text-[#861F41]" href={statusHref(status, page + 1)}>Next →</Link>}</div>
      </div>
    </main>
  );
}
export default function StaffCorrectionsPage({ searchParams }: { searchParams: Promise<Search> }) {
  return <Suspense fallback={<div className="mx-auto max-w-6xl p-8">Loading submitted reports…</div>}><Queue searchParams={searchParams} /></Suspense>;
}
