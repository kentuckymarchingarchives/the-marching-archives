import Link from "next/link";
import { Suspense } from "react";
import { researchSession, personName, dateText, researchLinks,
  type ResearchEvent, type ResearchMember, type ResearchTask } from "@/lib/research-insights";

export const instant = false;
type Props = { searchParams: Promise<{ kind?: string }> };

async function ReviewHistoryContent({ searchParams }: Props) {
  const { db } = await researchSession();
  const params = await searchParams;
  const kind = ["submitted", "approved", "changes_requested", "invalidated"].includes(params.kind ?? "") ? params.kind! : "all";
  const [eventsQ, membersQ] = await Promise.all([
    db.from("research_approval_events").select("id,task_id,actor_id,event,note,occurred_at").order("occurred_at", { ascending: false }).limit(150),
    db.from("staff_members").select("user_id,display_name,greeting_name,role,status").limit(200),
  ]);
  const events = (eventsQ.data ?? []) as ResearchEvent[];
  const members = (membersQ.data ?? []) as ResearchMember[];
  const taskIds = [...new Set(events.map(e => e.task_id))].slice(0,150);
  const tasksQ = taskIds.length ? await db.from("research_assignments").select("id,title,status,priority,assigned_to,created_by,competition_id,due_date,updated_at,completed_at").in("id",taskIds) : null;
  const failed = Boolean(eventsQ.error || membersQ.error || tasksQ?.error);
  const tasks = (tasksQ?.data ?? []) as ResearchTask[];
  const title = new Map(tasks.map(t => [t.id,t.title]));
  const visible = kind === "all" ? events : events.filter(e => e.event === kind);
  return <main className="min-h-screen bg-[#f6f7f8] text-[#002144]">
    <header className="bg-[#002144] px-6 py-12 text-white"><div className="mx-auto max-w-6xl">
      <Link href="/staff/dashboard" className="text-sm font-semibold text-[#e8afc2] hover:underline">← Staff Dashboard</Link>
      <p className="mt-6 text-xs font-black uppercase tracking-widest text-[#e8afc2]">Research accountability</p>
      <h1 className="mt-3 text-3xl font-black sm:text-4xl">Approval Decision History</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200">Follow recorded submissions, approvals, changes requested, and invalidated reviews.</p>
    </div></header>
    <div className="mx-auto max-w-6xl space-y-7 px-6 py-9">
      <nav className="flex flex-wrap gap-2" aria-label="Research pages">{researchLinks.map(l => <Link key={l.href} href={l.href} className={`rounded-lg px-3 py-2 text-sm font-bold ${l.href.endsWith("/review-history") ? "bg-[#861F41] text-white" : "border border-slate-200 bg-white"}`}>{l.label}</Link>)}</nav>
      {failed && <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">Review history could not be loaded. Confirm migration 036 and staff permissions.</p>}
      <nav aria-label="Filter review events" className="flex flex-wrap gap-2">{[
        ["all","All events"], ["submitted","Submitted"], ["approved","Approved"], ["changes_requested","Changes requested"], ["invalidated","Invalidated"],
      ].map(([k,label]) => <Link key={k} href={`/staff/research/review-history?kind=${k}`} className={`rounded-full px-4 py-2 text-sm font-bold ${kind===k ? "bg-[#002144] text-white" : "border border-slate-300 bg-white"}`}>{label}</Link>)}</nav>
      <p className="text-xs text-slate-600">Shows the latest 150 events in the database, then applies the selected filter. Earlier events are not included in this view.</p>
      {!failed && !visible.length && <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">No matching events in the recent activity sample.</p>}
      {!failed && <section className="space-y-3" aria-label="Recent research review events">{visible.map(e => <article key={e.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-[#861F41]">{e.event.replaceAll("_", " ")}</p><h2 className="mt-2 text-lg font-bold">{title.get(e.task_id) || "Research assignment"}</h2></div><span className="text-sm text-slate-600">{dateText(e.occurred_at)}</span></div><p className="mt-2 text-sm text-slate-600">By {personName(e.actor_id, members)}</p>{e.note && <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm leading-6">{e.note}</p>}<Link href="/staff/research/approvals" className="mt-3 inline-block text-sm font-bold text-[#861F41] hover:underline">Open research approvals →</Link></article>)}</section>}
    </div>
  </main>;
}
export default function ReviewHistoryPage(props: Props) { return <Suspense fallback={<main className="p-8">Loading review history…</main>}><ReviewHistoryContent {...props}/></Suspense>; }
