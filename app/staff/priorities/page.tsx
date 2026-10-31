import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Research Priority Center | TMA Staff",
  robots: { index: false, follow: false },
};

type CompletenessRecord = {
  competition_id: string;
  competition_name: string;
  organization_code: string;
  season_year: number;
  publication_status: string;
  completeness_score: number;
  entry_count: number;
  placement_count: number;
  scored_count: number;
  reviewed_source_count: number;
  verification_current: boolean;
};
type Correction = {
  id: string;
  subject: string;
  kind: string;
  created_at: string;
};
type Source = {
  id: string;
  title: string;
  competition_id: string;
  created_at: string;
};
type Task = {
  id: string;
  title: string;
  priority: string;
  status: string;
  due_date: string | null;
  assigned_to: string | null;
};

type Filters = { org?: string; view?: string };
type PageProps = { searchParams: Promise<Filters> };

const orgOptions = ["all", "KMEA", "BOA", "MSBA", "DCI"] as const;
const viewOptions = ["all", "records", "corrections", "sources", "tasks"] as const;

function url(org: string, view: string) {
  const params = new URLSearchParams();
  if (org !== "all") params.set("org", org);
  if (view !== "all") params.set("view", view);
  const search = params.toString();
  return `/staff/priorities${search ? `?${search}` : ""}`;
}

function InfoCard({ label, value, detail, href }: {
  label: string; value: number | null; detail: string; href: string;
}) {
  return (
    <Link href={href} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#861F41] hover:shadow-md">
      <p className="text-sm font-bold text-slate-600">{label}</p>
      <p className="mt-3 text-4xl font-black tabular-nums text-[#002144]">{value === null ? "—" : value.toLocaleString()}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{value === null ? "Unavailable — check the data source" : detail}</p>
    </Link>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="mt-4 rounded-xl bg-slate-50 p-5 text-sm text-slate-600">{text}</p>;
}

async function Content({ searchParams }: PageProps) {
  await connection();
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  if (authError || !auth?.claims?.sub) redirect("/staff/login");
  const userId = auth.claims.sub;
  const { data: staff, error: staffError } = await supabase
    .from("staff_members")
    .select("role,status")
    .eq("user_id", userId)
    .maybeSingle();
  if (staffError || staff?.status !== "active" || !["owner", "admin", "editor"].includes(staff.role)) {
    redirect("/staff/login?error=unauthorized");
  }

  const params = await searchParams;
  const org = orgOptions.includes(params.org as (typeof orgOptions)[number]) ? params.org! : "all";
  const view = viewOptions.includes(params.view as (typeof viewOptions)[number]) ? params.view! : "all";

  // Existing staff-only RPC (migration 032) and existing staff RLS policies.
  // Results are deliberately bounded; counts below are exact only where noted.
  const [completeness, correctionCount, correctionList, sourceCount, sourceList, taskCount, taskList] = await Promise.all([
    supabase.rpc("tma_staff_competition_completeness", {
      p_organization: org === "all" ? null : org,
      p_publication: "all",
      p_limit: 20,
      p_offset: 0,
    }),
    supabase.from("archive_correction_submissions").select("id", { head: true, count: "exact" }).eq("status", "new"),
    supabase.from("archive_correction_submissions").select("id,subject,kind,created_at").eq("status", "new").order("created_at", { ascending: false }).limit(5),
    supabase.from("competition_sources").select("id", { head: true, count: "exact" }).is("reviewed_at", null),
    supabase.from("competition_sources").select("id,title,competition_id,created_at").is("reviewed_at", null).order("created_at", { ascending: false }).limit(5),
    supabase.from("research_assignments").select("id", { head: true, count: "exact" }).neq("status", "completed"),
    supabase.from("research_assignments").select("id,title,priority,status,due_date,assigned_to").neq("status", "completed").order("updated_at", { ascending: false }).limit(200),
  ]);

  const records = (completeness.error ? [] : completeness.data ?? []) as CompletenessRecord[];
  const corrections = (correctionList.error ? [] : correctionList.data ?? []) as Correction[];
  const sources = (sourceList.error ? [] : sourceList.data ?? []) as Source[];
  const tasks = (taskList.error ? [] : taskList.data ?? []) as Task[];
  const today = new Date().toISOString().slice(0, 10);
  const weightedTasks = [...tasks].sort((a, b) => {
    const weight = (item: Task) => {
      const overdue = item.due_date !== null && item.due_date < today;
      return (overdue ? 100 : 0) + (item.priority === "urgent" ? 40 : item.priority === "high" ? 25 : item.priority === "normal" ? 10 : 0) + (item.status === "blocked" ? 15 : 0);
    };
    return weight(b) - weight(a);
  }).slice(0, 8);
  const show = (key: string) => view === "all" || view === key;
  const errorMessages = [
    completeness.error && "completeness scores (migration 032)",
    (correctionCount.error || correctionList.error) && "corrections",
    (sourceCount.error || sourceList.error) && "sources",
    (taskCount.error || taskList.error) && "research assignments (migration 022)",
  ].filter(Boolean);

  return (
    <main className="min-h-screen bg-[#f6f7f8] text-[#002144]">
      <header className="bg-[#002144] px-6 py-14 text-white md:px-8">
        <div className="mx-auto max-w-330">
          <Link href="/staff/dashboard" className="text-sm font-bold text-[#e8afc2] hover:underline">← Staff Dashboard</Link>
          <p className="mt-8 text-xs font-black uppercase tracking-[.2em] text-[#e8afc2]">The Marching Archives / Staff research</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Research Priority Center</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[#d2dce5]">One place to find incomplete historical records, incoming corrections, unreviewed citations, and research assignments. All actions remain in your existing staff tools.</p>
        </div>
      </header>
      <div className="mx-auto max-w-330 space-y-8 px-6 py-10 md:px-8">
        {errorMessages.length > 0 && (
          <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950">
            Some data could not be loaded: {errorMessages.join(", ")}. Unavailable counts display as “—”, not zero. Check migrations and staff permissions.
          </div>
        )}
        <section aria-label="Workload overview" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <InfoCard label="Competition research candidates" value={completeness.error ? null : records.length} detail="Shown from the first 20 records, ordered by lowest score" href="/staff/completeness" />
          <InfoCard label="New corrections" value={correctionCount.error ? null : correctionCount.count ?? 0} detail="Awaiting initial review" href="/staff/corrections?status=new" />
          <InfoCard label="Unreviewed citations" value={sourceCount.error ? null : sourceCount.count ?? 0} detail="Sources awaiting a review" href="/staff/quality" />
          <InfoCard label="Open research tasks" value={taskCount.error ? null : taskCount.count ?? 0} detail="All active tasks" href="/staff/research" />
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-black">View research priorities</h2>
          <nav aria-label="Priority categories" className="mt-4 flex flex-wrap gap-2">
            {([{ id: "all", label: "Everything" }, { id: "records", label: "Incomplete records" }, { id: "corrections", label: "Corrections" }, { id: "sources", label: "Sources" }, { id: "tasks", label: "Assignments" }]).map(option => (
              <Link key={option.id} href={url(org, option.id)} aria-current={view === option.id ? "page" : undefined}
                className={`rounded-full border px-4 py-2 text-sm font-bold transition ${view === option.id ? "border-[#002144] bg-[#002144] text-white" : "border-slate-200 hover:border-[#861F41]"}`}>{option.label}</Link>
            ))}
          </nav>
          {(show("records")) && <nav aria-label="Filter competition organization" className="mt-4 flex flex-wrap gap-2">
            {orgOptions.map(option => <Link key={option} href={url(option, view)} aria-current={org === option ? "page" : undefined}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold ${org === option ? "border-[#861F41] bg-[#861F41] text-white" : "border-slate-200 hover:border-[#861F41]"}`}>{option === "all" ? "All organizations" : option}</Link>)}
          </nav>}
        </section>

        {show("records") && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-2xl font-black">Competition documentation</h2><p className="mt-2 text-sm text-slate-600">Up to 20 lowest-scoring records for this organization. Scores reflect documented fields, not accuracy or complete historical coverage.</p></div><Link href="/staff/completeness" className="text-sm font-black text-[#861F41] hover:underline">Full completeness report ↗</Link></div>
          {completeness.error ? <Empty text="Completeness records are unavailable." /> : records.length === 0 ? <Empty text="No competitions found for this filter." /> : (
            <div className="mt-5 divide-y divide-slate-100">{records.slice(0, 8).map(record => <article key={record.competition_id} className="flex flex-wrap items-center justify-between gap-4 py-4">
              <div className="min-w-0"><p className="text-xs font-black uppercase tracking-wide text-[#861F41]">{record.organization_code} · {record.season_year} · {record.publication_status}</p><h3 className="mt-1 font-bold">{record.competition_name}</h3><p className="mt-1 text-xs text-slate-500">{record.entry_count} entries · {record.reviewed_source_count} reviewed sources · {record.verification_current ? "Verified" : "Verification needed"}</p></div>
              <div className="flex items-center gap-3"><span className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-black tabular-nums">{record.completeness_score}/100</span><Link href={`/staff/competitions/${record.competition_id}`} className="text-sm font-bold text-[#861F41] hover:underline">Open →</Link></div>
            </article>)}</div>
          )}
        </section>}

        {show("corrections") && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-black">New correction reports</h2><p className="mt-2 text-sm text-slate-600">Visitor-submitted corrections awaiting an initial review.</p></div><Link href="/staff/corrections?status=new" className="text-sm font-black text-[#861F41] hover:underline">Open correction queue ↗</Link></div>
          {correctionList.error ? <Empty text="Correction reports are unavailable." /> : corrections.length === 0 ? <Empty text="No new correction reports." /> : <ul className="mt-4 divide-y divide-slate-100">{corrections.map(item => <li key={item.id} className="py-3"><p className="font-bold">{item.subject}</p><p className="mt-1 text-xs text-slate-500">{item.kind.replaceAll("_", " ")}</p></li>)}</ul>}
        </section>}

        {show("sources") && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-black">Sources awaiting review</h2><p className="mt-2 text-sm text-slate-600">Recorded competition citations not yet reviewed.</p></div><Link href="/staff/quality" className="text-sm font-black text-[#861F41] hover:underline">Archive quality ↗</Link></div>
          {sourceList.error ? <Empty text="Source reviews are unavailable." /> : sources.length === 0 ? <Empty text="No unreviewed citations." /> : <ul className="mt-4 divide-y divide-slate-100">{sources.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><p className="font-bold">{item.title}</p><Link href={`/staff/competitions/${item.competition_id}/sources`} className="text-sm font-bold text-[#861F41] hover:underline">Review →</Link></li>)}</ul>}
        </section>}

        {show("tasks") && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-black">Research assignments</h2><p className="mt-2 text-sm text-slate-600">Urgent and overdue work first, within the latest 200 open tasks. This list is a prioritization aid, not a complete task ranking.</p></div><Link href="/staff/research" className="text-sm font-black text-[#861F41] hover:underline">Manage tasks ↗</Link></div>
          {taskList.error ? <Empty text="Research tasks are unavailable." /> : weightedTasks.length === 0 ? <Empty text="No open research assignments." /> : <ul className="mt-4 divide-y divide-slate-100">{weightedTasks.map(task => {
            const overdue = task.due_date !== null && task.due_date < today;
            return <li key={task.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-bold">{task.title}</p><p className="mt-1 text-xs text-slate-500">{task.status.replaceAll("_", " ")} · {task.assigned_to === userId ? "Assigned to you" : task.assigned_to ? "Assigned to staff" : "Unassigned"}{task.due_date ? ` · Due ${task.due_date}` : ""}</p></div><div className="flex items-center gap-2"><span className={`rounded-full px-3 py-1 text-xs font-bold ${overdue ? "bg-rose-100 text-rose-800" : task.priority === "urgent" ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"}`}>{overdue ? "Overdue" : task.priority}</span></div></li>;
          })}</ul>}
        </section>}
        <aside className="rounded-2xl border border-slate-200 bg-white p-6 text-sm leading-7 text-slate-600">
          <h2 className="text-lg font-black text-[#002144]">How to use this center</h2>
          <p className="mt-2">This page combines existing research signals without changing their status or automatically creating tasks. A lower documentation score deserves review, but does not establish that a source is wrong. Correction and source queues are independent of the competition completeness score.</p>
          <p className="mt-2">Organization filters apply only to competition completeness. Correction, source, and task counts cover the records visible to your staff account under existing database policies.</p>
        </aside>
      </div>
    </main>
  );
}

export default function StaffResearchPrioritiesPage(props: PageProps) {
  return <Suspense fallback={<main className="min-h-screen bg-[#f6f7f8] p-10 text-[#002144]"><p role="status">Loading research priorities…</p></main>}><Content {...props} /></Suspense>;
}
