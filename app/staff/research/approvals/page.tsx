import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { submitResearchForReview, reviewResearch } from "./actions";

export const instant = false;

type Task = { id: string; title: string; description: string; status: string; assigned_to: string | null; created_by: string; priority: string; competition_id: string | null };
type Approval = { task_id: string; state: string; submitted_by: string; submitted_at: string; submission_note: string; reviewed_by: string | null; reviewed_at: string | null; review_note: string };
type Member = { user_id: string; display_name: string | null; greeting_name: string | null; role: string };
type Event = { id: number; task_id: string; actor_id: string; event: string; note: string; occurred_at: string };
type Props = { searchParams: Promise<{ saved?: string; error?: string; view?: string }> };

const labels: Record<string,string> = { pending:"Awaiting review", approved:"Approved", changes_requested:"Changes requested" };
const errors: Record<string,string> = { invalid:"Check the fields and try again.", forbidden:"You do not have permission to perform that action (or you submitted this research yourself).", state:"The task is not eligible for that action. Completed tasks can be submitted; only pending submissions can be reviewed.", save:"The change failed. Confirm migration 036 is installed." };

async function ApprovalContent({ searchParams }: Props) {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (authError || !userId) redirect("/staff/login");
  const { data: staff, error: staffError } = await supabase.from("staff_members").select("role,status").eq("user_id",userId).maybeSingle();
  if (staffError || staff?.status !== "active" || !["owner","admin","editor"].includes(staff.role)) redirect("/staff/login?error=unauthorized");
  const canReview = staff.role === "owner" || staff.role === "admin";
  const [taskResponse, approvalResponse, memberResponse, eventResponse] = await Promise.all([
    supabase.from("research_assignments").select("id,title,description,status,assigned_to,created_by,priority,competition_id").order("updated_at",{ascending:false}).limit(250),
    supabase.from("research_approvals").select("task_id,state,submitted_by,submitted_at,submission_note,reviewed_by,reviewed_at,review_note").order("submitted_at",{ascending:false}).limit(250),
    supabase.from("staff_members").select("user_id,display_name,greeting_name,role").eq("status","active").limit(250),
    supabase.from("research_approval_events").select("id,task_id,actor_id,event,note,occurred_at").order("occurred_at",{ascending:false}).limit(30),
  ]);
  const params = await searchParams;
  const errorLoading = taskResponse.error || approvalResponse.error || memberResponse.error || eventResponse.error;
  const tasks = (taskResponse.data ?? []) as Task[];
  const approvals = (approvalResponse.data ?? []) as Approval[];
  const members = (memberResponse.data ?? []) as Member[];
  const events = (eventResponse.data ?? []) as Event[];
  const byTask = new Map(approvals.map(a=>[a.task_id,a]));
  const name = (id: string | null) => id ? (members.find(m=>m.user_id===id)?.display_name || members.find(m=>m.user_id===id)?.greeting_name || `Staff ${id.slice(0,8)}`) : "Unassigned";
  const view = ["all","pending","approved","changes_requested","ready"].includes(params.view ?? "") ? params.view : "all";
  const visible = tasks.filter(t=>{
    const a = byTask.get(t.id);
    if (view === "ready") return t.status==="completed" && (!a || a.state==="changes_requested");
    return view === "all" ? t.status==="completed" || !!a : a?.state === view;
  });
  const counts = { pending: approvals.filter(a=>a.state==="pending").length, approved: approvals.filter(a=>a.state==="approved").length, changes:approvals.filter(a=>a.state==="changes_requested").length, ready:tasks.filter(t=>t.status==="completed" && (!byTask.has(t.id) || byTask.get(t.id)?.state==="changes_requested")).length };
  return <main className="min-h-screen bg-[#f6f7f8] text-[#002144]">
    <header className="bg-[#002144] px-6 py-12 text-white"><div className="mx-auto max-w-6xl">
      <Link href="/staff/dashboard" className="text-sm font-semibold text-[#E8AFC2] hover:underline">← Staff Dashboard</Link>
      <p className="mt-6 text-xs font-black uppercase tracking-widest text-[#E8AFC2]">The Marching Archives / Staff Research</p>
      <h1 className="mt-3 text-3xl font-black sm:text-4xl">Research Approvals</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200">Submit completed assignments for independent review. Approval confirms the research task was reviewed; it does not publish or verify competition results.</p>
    </div></header>
    <div className="mx-auto max-w-6xl space-y-7 px-6 py-9">
      <div className="flex flex-wrap gap-4"><Link href="/staff/research" className="text-sm font-bold text-[#861F41] hover:underline">← Research Assignments</Link><Link href="/staff/priorities" className="text-sm font-bold text-[#861F41] hover:underline">Research Priority Center →</Link></div>
      {params.saved && <p role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">Research {params.saved === "submitted" ? "submitted for review" : "review decision saved"}.</p>}
      {params.error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">{errors[params.error] ?? errors.save}</p>}
      {errorLoading && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Could not load all review data. Check migration 036 and staff permissions. Counts are unavailable.</p>}
      <section aria-label="Review overview" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[
        ["Pending review",counts.pending],["Approved",counts.approved],["Changes requested",counts.changes],["Ready to submit",counts.ready]
      ].map(([label,value])=><div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-600">{label}</p><p className="mt-2 text-3xl font-black">{errorLoading ? "—" : value}</p></div>)}</section>
      <nav className="flex flex-wrap gap-2" aria-label="Filter reviews">{[
        ["all","All"],["pending","Pending"],["approved","Approved"],["changes_requested","Changes requested"],["ready","Ready to submit"]
      ].map(([key,label])=><Link key={key} href={`/staff/research/approvals?view=${key}`} className={`rounded-full px-4 py-2 text-sm font-semibold ${view===key?"bg-[#002144] text-white":"border border-slate-300 bg-white hover:bg-slate-100"}`}>{label}</Link>)}</nav>
      {!errorLoading && visible.length===0 && <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">No research assignments in this view.</p>}
      {!errorLoading && <section className="space-y-4" aria-label="Research review tasks">{visible.map(task=>{
        const approval = byTask.get(task.id);
        const eligible = task.status==="completed" && (!approval || approval.state==="changes_requested");
        const canSubmit = eligible && (canReview || task.assigned_to===userId || task.created_by===userId);
        const canDecide = canReview && approval?.state==="pending" && approval.submitted_by!==userId;
        return <article key={task.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-black">{task.title}</h2><p className="mt-2 text-sm text-slate-600">Assigned to {name(task.assigned_to)} · {task.priority} priority · Task: {task.status}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{approval ? labels[approval.state] : "Not submitted"}</span></div>
          {task.description && <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">{task.description}</p>}
          {task.competition_id && <Link href={`/staff/competitions/${task.competition_id}`} className="mt-3 inline-block text-sm font-semibold text-[#861F41] hover:underline">Open related competition →</Link>}
          {approval && <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm"><p><strong>Submitted by:</strong> {name(approval.submitted_by)}</p>{approval.submission_note && <p className="mt-2 whitespace-pre-wrap"><strong>Submission note:</strong> {approval.submission_note}</p>}{approval.review_note && <p className="mt-2 whitespace-pre-wrap"><strong>Review feedback:</strong> {approval.review_note}</p>}{approval.reviewed_by && <p className="mt-2"><strong>Reviewed by:</strong> {name(approval.reviewed_by)}</p>}</div>}
          {canSubmit && <form action={submitResearchForReview} className="mt-5 space-y-3 border-t border-slate-200 pt-4"><input type="hidden" name="task_id" value={task.id}/><label className="block text-sm font-bold">Research summary for reviewers<textarea name="note" maxLength={2000} rows={2} className="mt-2 w-full rounded-lg border border-slate-300 p-3 text-sm" placeholder="Describe the research completed, sources checked, and outstanding questions."/></label><button className="rounded-lg bg-[#861F41] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#701832]" type="submit">Submit for review</button></form>}
          {canDecide && <form action={reviewResearch} className="mt-5 space-y-3 border-t border-slate-200 pt-4"><input type="hidden" name="task_id" value={task.id}/><label className="block text-sm font-bold">Review feedback<textarea name="note" maxLength={2000} rows={3} className="mt-2 w-full rounded-lg border border-slate-300 p-3 text-sm" placeholder="Explain the decision. Feedback is required if requesting changes."/></label><div className="flex flex-wrap gap-2"><button type="submit" name="decision" value="approved" className="rounded-lg bg-[#002144] px-5 py-2.5 text-sm font-bold text-white">Approve research</button><button type="submit" name="decision" value="changes_requested" className="rounded-lg border border-[#861F41] px-5 py-2.5 text-sm font-bold text-[#861F41]">Request changes</button></div></form>}
          {canReview && approval?.state==="pending" && approval.submitted_by===userId && <p className="mt-4 text-xs text-slate-600">Another Owner or Administrator must review your submission.</p>}
        </article>;
      })}</section>}
      {!errorLoading && events.length>0 && <section className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="text-xl font-black">Recent decisions</h2><p className="mt-1 text-xs text-slate-500">Latest 30 review events. Older events remain in the database.</p><div className="mt-4 divide-y divide-slate-100">{events.map(event=><p className="py-3 text-sm" key={event.id}><strong>{name(event.actor_id)}</strong> · {event.event.replaceAll("_"," ")} · {tasks.find(t=>t.id===event.task_id)?.title ?? "Research assignment"}{event.note ? ` — ${event.note}` : ""}</p>)}</div></section>}
    </div>
  </main>;
}
export default function ResearchApprovalsPage(props: Props) { return <Suspense fallback={<main className="p-8">Loading research approvals…</main>}><ApprovalContent {...props}/></Suspense>; }
