import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

type Correction = { id: string; subject: string; kind: string; created_at: string };
type Source = { id: string; title: string; competition_id: string; created_at: string };
type Competition = { id: string; name: string; season_year: number; organization_code: string };

function CountCard({ label, count, href, description }: { label: string; count: number | null; href: string; description: string }) {
  return <Link href={href} className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#861F41]/50 hover:shadow-md">
    <p className="text-sm font-bold text-slate-600">{label}</p>
    <p className="mt-3 text-4xl font-extrabold tabular-nums text-[#002144]">{count === null ? "—" : count.toLocaleString()}</p>
    <p className="mt-2 text-xs text-slate-500">{count === null ? "Unable to load count" : description}</p>
  </Link>;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

async function NotificationsContent() {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  if (authError || !auth?.claims?.sub) redirect("/staff/login");

  const { data: staff, error: staffError } = await supabase.from("staff_members")
    .select("role,status").eq("user_id", auth.claims.sub).maybeSingle();
  if (staffError || staff?.status !== "active" || !["owner", "admin", "editor"].includes(staff.role)) {
    redirect("/staff/login?error=unauthorized");
  }

  const [correctionCount, correctionList, sourceCount, sourceList, draftCount, draftList] = await Promise.all([
    supabase.from("archive_correction_submissions").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabase.from("archive_correction_submissions").select("id,subject,kind,created_at").eq("status", "new").order("created_at", { ascending: false }).limit(6),
    supabase.from("competition_sources").select("id", { count: "exact", head: true }).is("reviewed_at", null),
    supabase.from("competition_sources").select("id,title,competition_id,created_at").is("reviewed_at", null).order("created_at", { ascending: false }).limit(6),
    supabase.from("competitions").select("id", { count: "exact", head: true }).is("archived_at", null).neq("publication_status", "published"),
    supabase.from("competitions").select("id,name,season_year,organization_code").is("archived_at", null).neq("publication_status", "published").order("season_year", { ascending: false }).limit(6),
  ]);

  const errors = [correctionCount.error, correctionList.error, sourceCount.error, sourceList.error, draftCount.error, draftList.error].filter(Boolean);
  const corrections = (correctionList.data ?? []) as Correction[];
  const sources = (sourceList.data ?? []) as Source[];
  const drafts = (draftList.data ?? []) as Competition[];
  const canPublish = staff.role === "owner" || staff.role === "admin";

  return <main className="min-h-screen bg-[#f6f7f9] text-[#002144]">
    <header className="bg-[#002144] px-5 py-12 text-white">
      <div className="mx-auto max-w-6xl">
        <Link href="/staff/dashboard" className="text-sm font-semibold text-[#f2becf] hover:underline">← Staff Dashboard</Link>
        <p className="mt-7 text-xs font-extrabold uppercase tracking-[0.2em] text-[#f2becf]">Staff workspace</p>
        <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">Notifications & attention center</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200">A live snapshot of archive work that may need attention. These are outstanding records, not push notifications.</p>
      </div>
    </header>

    <div className="mx-auto max-w-6xl space-y-8 px-5 py-9">
      {errors.length > 0 && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        Some information could not be loaded. Confirm that the Corrections and Sources SQL migrations are installed and your staff account can read them. Counts marked “—” are unavailable, not zero.
      </div>}
      <section aria-label="Outstanding items" className="grid gap-4 sm:grid-cols-3">
        <CountCard label="New corrections" count={correctionCount.error ? null : correctionCount.count ?? 0} href="/staff/corrections?status=new" description="Visitor reports waiting for initial review" />
        <CountCard label="Unreviewed sources" count={sourceCount.error ? null : sourceCount.count ?? 0} href="/staff/quality" description="Recorded citations awaiting review" />
        <CountCard label="Unpublished competitions" count={draftCount.error ? null : draftCount.count ?? 0} href="/staff/competitions" description="Active competition records not yet published" />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-extrabold">New corrections</h2><p className="mt-1 text-sm text-slate-500">Most recent visitor submissions</p></div><Link href="/staff/corrections?status=new" className="text-sm font-bold text-[#861F41] hover:underline">Open queue →</Link></div>
          {correctionList.error ? <p className="mt-5 text-sm text-red-700">Corrections could not be loaded.</p> : corrections.length ? <ul className="mt-5 divide-y divide-slate-100">{corrections.map((item) => <li key={item.id} className="py-3"><p className="font-semibold">{item.subject}</p><p className="mt-1 text-xs text-slate-500">{item.kind.replaceAll("_", " ")} · {formatDate(item.created_at)}</p></li>)}</ul> : <p className="mt-5 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">No new correction submissions.</p>}
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-extrabold">Sources to review</h2><p className="mt-1 text-sm text-slate-500">Most recently added unreviewed citations</p></div><Link href="/staff/quality" className="text-sm font-bold text-[#861F41] hover:underline">Quality dashboard →</Link></div>
          {sourceList.error ? <p className="mt-5 text-sm text-red-700">Sources could not be loaded.</p> : sources.length ? <ul className="mt-5 divide-y divide-slate-100">{sources.map((item) => <li key={item.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate font-semibold">{item.title}</p><p className="mt-1 text-xs text-slate-500">Added {formatDate(item.created_at)}</p></div><Link href={`/staff/competitions/${item.competition_id}/sources`} className="shrink-0 text-sm font-bold text-[#861F41] hover:underline">Review →</Link></li>)}</ul> : <p className="mt-5 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">No unreviewed sources.</p>}
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-extrabold">Unpublished competitions</h2><p className="mt-1 text-sm text-slate-500">Recent seasons needing results or publication review</p></div><Link href="/staff/competitions" className="text-sm font-bold text-[#861F41] hover:underline">All competitions →</Link></div>
        {draftList.error ? <p className="mt-5 text-sm text-red-700">Competitions could not be loaded.</p> : drafts.length ? <ul className="mt-5 divide-y divide-slate-100">{drafts.map((c) => <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-semibold">{c.name}</p><p className="mt-1 text-xs text-slate-500">{c.organization_code} · {c.season_year}</p></div><Link href={canPublish ? `/staff/competitions/${c.id}/review` : `/staff/competitions/${c.id}`} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold hover:bg-slate-50">{canPublish ? "Review results" : "Manage record"}</Link></li>)}</ul> : <p className="mt-5 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">No unpublished active competitions.</p>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="text-xl font-extrabold">Verification follow-up</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Check for missing citations, verification that has become outdated, and incomplete competition records in the Archive Quality Dashboard. These are not included in the counts above.</p>
        <Link href="/staff/quality" className="mt-4 inline-flex rounded-lg bg-[#002144] px-5 py-3 text-sm font-bold text-white hover:bg-[#123b63]">Open Archive Quality →</Link>
      </section>
    </div>
  </main>;
}

export default function StaffNotificationsPage() {
  return <Suspense fallback={<main className="mx-auto max-w-6xl p-8 text-slate-600">Loading staff notifications…</main>}><NotificationsContent /></Suspense>;
}
