import ResearchNavigation from "@/components/staff/ResearchNavigation";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { researchSession, dateText, type ResearchTask, type ResearchApproval } from "@/lib/research-insights";

export const instant = false;

async function MyResearchContent() {
  await connection();
  const { db, id, greeting } = await researchSession();
  const [tasksQ, approvalsQ] = await Promise.all([
    db.from("research_assignments").select("id,title,status,priority,assigned_to,created_by,competition_id,due_date,updated_at,completed_at").eq("assigned_to", id).order("updated_at", { ascending: false }).limit(500),
    db.from("research_approvals").select("task_id,state,submitted_by,submitted_at,reviewed_by,reviewed_at,review_note").eq("submitted_by", id).order("submitted_at", { ascending: false }).limit(500),
  ]);
  const failed = Boolean(tasksQ.error || approvalsQ.error);
  const tasks = (tasksQ.data ?? []) as ResearchTask[];
  const approvals = (approvalsQ.data ?? []) as ResearchApproval[];
  const approvalByTask = new Map(approvals.map(a => [a.task_id, a]));
  const today = new Date().toISOString().slice(0, 10);
  const active = tasks.filter(t => t.status !== "completed");
  const due = active.filter(t => t.due_date && t.due_date < today);
  const ready = tasks.filter(t => t.status === "completed" && (!approvalByTask.has(t.id) || approvalByTask.get(t.id)?.state === "changes_requested"));
  const waiting = approvals.filter(a => a.state === "pending");
  const visible = [...active].sort((a,b) => (a.due_date || "9999").localeCompare(b.due_date || "9999")).slice(0,40);
  return <main className="min-h-screen bg-[#f6f7f8] text-[#002144]">
    <header className="bg-[#002144] px-6 py-12 text-white"><div className="mx-auto max-w-6xl">
      <Link href="/staff/dashboard" className="text-sm font-semibold text-[#e8afc2] hover:underline">← Staff Dashboard</Link>
      <p className="mt-6 text-xs font-black uppercase tracking-widest text-[#e8afc2]">Personal research workspace</p>
      <h1 className="mt-3 text-3xl font-black sm:text-4xl">My Research</h1>
      <p className="mt-3 text-sm text-slate-200">Hello, {greeting}! Here's the work currently assigned to you.</p>
    </div></header>
    <div className="mx-auto max-w-6xl space-y-7 px-6 py-9">
      <ResearchNavigation currentPath="/staff/research/mine" />
      {failed && <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">My Research data is unavailable. Confirm migrations 022 and 036 are installed.</p>}
      {!failed && (tasks.length === 500 || approvals.length === 500) && <p className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm">Showing a bounded sample of your latest 500 assignments and submissions. Some older entries may be missing.</p>}
      <section aria-label="My task overview" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[
        ["Open assignments", active.length], ["Overdue", due.length], ["Ready to submit", ready.length], ["Awaiting review", waiting.length],
      ].map(([label,count]) => <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-600">{label}</p><p className="mt-2 text-3xl font-black">{failed ? "—" : count}</p></div>)}</section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-black">My open assignments</h2><Link href="/staff/research?mine=1" className="text-sm font-bold text-[#861F41] hover:underline">Manage assignments →</Link></div>
        {!failed && visible.length === 0 && <p className="mt-5 text-sm text-slate-600">No open tasks are currently assigned to you.</p>}
        {!failed && <div className="mt-4 divide-y divide-slate-100">{visible.map(t => <article key={t.id} className="py-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold">{t.title}</h3><p className="mt-1 text-sm text-slate-600">{t.status.replaceAll("_"," ")} · {t.priority} priority · Due {dateText(t.due_date)}</p></div>{t.due_date && t.due_date < today && <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-800">Overdue</span>}</div>{t.competition_id && <Link className="mt-2 inline-block text-sm font-bold text-[#861F41] hover:underline" href={`/staff/competitions/${t.competition_id}/research`}>Competition research →</Link>}</article>)}</div>}
      </section>
      <section className="grid gap-4 md:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="text-lg font-black">Ready for review</h2><p className="mt-2 text-sm text-slate-600">{failed ? "Unavailable" : `${ready.length} completed assignment(s) eligible for submission.`}</p><Link className="mt-4 inline-block text-sm font-bold text-[#861F41] hover:underline" href="/staff/research/approvals?view=ready">Submit completed research →</Link></div><div className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="text-lg font-black">Waiting on reviewers</h2><p className="mt-2 text-sm text-slate-600">{failed ? "Unavailable" : `${waiting.length} submission(s) awaiting a decision.`}</p><Link className="mt-4 inline-block text-sm font-bold text-[#861F41] hover:underline" href="/staff/research/approvals?view=pending">See pending reviews →</Link></div></section>
    </div>
  </main>;
}
export default function MyResearchPage() { return <Suspense fallback={<main className="p-8">Loading your research…</main>}><MyResearchContent /></Suspense>; }
