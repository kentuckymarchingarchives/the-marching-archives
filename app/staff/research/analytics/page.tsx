import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { researchSession, personName, researchLinks, type ResearchTask,
  type ResearchApproval, type ResearchMember } from "@/lib/research-insights";

export const instant = false;

async function ResearchAnalyticsContent() {
  await connection();
  const { db } = await researchSession();
  const [tasksQ, approvalsQ, membersQ] = await Promise.all([
    db.from("research_assignments").select("id,title,status,priority,assigned_to,created_by,competition_id,due_date,updated_at,completed_at").order("updated_at", { ascending: false }).limit(1000),
    db.from("research_approvals").select("task_id,state,submitted_by,submitted_at,reviewed_by,reviewed_at,review_note").order("submitted_at", { ascending: false }).limit(1000),
    db.from("staff_members").select("user_id,display_name,greeting_name,role,status").eq("status", "active").limit(200),
  ]);
  const failed = Boolean(tasksQ.error || approvalsQ.error || membersQ.error);
  const tasks = (tasksQ.data ?? []) as ResearchTask[];
  const approvals = (approvalsQ.data ?? []) as ResearchApproval[];
  const members = (membersQ.data ?? []) as ResearchMember[];
  const now = new Date().toISOString().slice(0, 10);
  const completed = tasks.filter((t) => t.status === "completed").length;
  const overdue = tasks.filter((t) => t.status !== "completed" && t.due_date && t.due_date < now).length;
  const pending = approvals.filter((a) => a.state === "pending").length;
  const approved = approvals.filter((a) => a.state === "approved").length;
  const decided = approvals.filter((a) => a.state === "approved" || a.state === "changes_requested").length;
  const stats = [
    { label: "Assignments in sample", value: tasks.length },
    { label: "Completed in sample", value: completed },
    { label: "Overdue & open", value: overdue },
    { label: "Awaiting review", value: pending },
    { label: "Approved research", value: approved },
    { label: "Approval share of decisions", value: decided ? `${Math.round(approved / decided * 100)}%` : "—" },
  ];
  const contributions = members.map((m) => ({
    id: m.user_id, name: personName(m.user_id, members), role: m.role,
    completed: tasks.filter((t) => t.assigned_to === m.user_id && t.status === "completed").length,
    open: tasks.filter((t) => t.assigned_to === m.user_id && t.status !== "completed").length,
    approved: approvals.filter((a) => a.submitted_by === m.user_id && a.state === "approved").length,
  })).sort((a,b) => b.completed - a.completed || b.approved - a.approved);
  const capped = tasks.length === 1000 || approvals.length === 1000 || members.length === 200;
  return <main className="min-h-screen bg-[#f6f7f8] text-[#002144]">
    <header className="bg-[#002144] px-6 py-12 text-white"><div className="mx-auto max-w-6xl">
      <Link href="/staff/dashboard" className="text-sm font-semibold text-[#e8afc2] hover:underline">← Staff Dashboard</Link>
      <p className="mt-6 text-xs font-black uppercase tracking-widest text-[#e8afc2]">Research operations</p>
      <h1 className="mt-3 text-3xl font-black sm:text-4xl">Staff Research Analytics</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200">A snapshot of documented assignment progress and review decisions.</p>
    </div></header>
    <div className="mx-auto max-w-6xl space-y-7 px-6 py-9">
      <nav className="flex flex-wrap gap-2" aria-label="Research pages">{researchLinks.map(l => <Link key={l.href} href={l.href} className={`rounded-lg px-3 py-2 text-sm font-bold ${l.href.endsWith("/analytics") ? "bg-[#861F41] text-white" : "border border-slate-200 bg-white"}`}>{l.label}</Link>)}</nav>
      {failed && <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">Could not load all analytics. Confirm migrations 022, 024 and 036 are installed. Values are withheld to avoid misleading counts.</p>}
      {capped && !failed && <p className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm">This is a bounded sample (up to 1,000 assignments and approvals and 200 active staff). Totals may be incomplete. Do not treat this view as a complete lifetime report.</p>}
      <section aria-label="Summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{stats.map(s => <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-sm text-slate-600">{s.label}</p><p className="mt-2 text-3xl font-black">{failed ? "—" : s.value}</p></div>)}</section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-black">Research contributions</h2><p className="mt-1 text-sm text-slate-600">Completed assignments by current assignee; approved submissions by submitter. This is not a measure of total historical research effort.</p>
        {!failed && <div className="mt-5 overflow-x-auto"><table className="w-full min-w-145 text-left text-sm"><thead><tr className="border-b text-slate-600"><th className="px-3 py-3">Staff member</th><th className="px-3 py-3">Role</th><th className="px-3 py-3">Completed</th><th className="px-3 py-3">Open</th><th className="px-3 py-3">Approved submissions</th></tr></thead><tbody>{contributions.map(c => <tr key={c.id} className="border-b border-slate-100"><td className="px-3 py-3 font-semibold">{c.name}</td><td className="px-3 py-3 capitalize">{c.role}</td><td className="px-3 py-3">{c.completed}</td><td className="px-3 py-3">{c.open}</td><td className="px-3 py-3">{c.approved}</td></tr>)}</tbody></table></div>}
      </section>
    </div>
  </main>;
}
export default function ResearchAnalyticsPage() { return <Suspense fallback={<main className="p-8">Loading analytics…</main>}><ResearchAnalyticsContent /></Suspense>; }
