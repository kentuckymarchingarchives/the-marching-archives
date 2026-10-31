import ResearchNavigation from "@/components/staff/ResearchNavigation";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createResearchTask, editResearchTask, updateResearchStatus } from "./actions";

type Task = {
  id: string; title: string; description: string; created_by: string; assigned_to: string | null;
  priority: string; status: string; due_date: string | null; created_at: string; updated_at: string;
};
type Member = { user_id: string; role: string; status: string };
type Props = { searchParams: Promise<{ status?: string; mine?: string; saved?: string; error?: string }> };
const statusList = ["todo", "in_progress", "blocked", "completed"];
const priorityList = ["low", "normal", "high", "urgent"];
const statusLabel: Record<string,string> = { todo:"To do", in_progress:"In progress", blocked:"Blocked", completed:"Completed" };
const priorityLabel: Record<string,string> = { low:"Low", normal:"Normal", high:"High", urgent:"Urgent" };
const messages: Record<string,string> = {
  forbidden: "You don't have permission to make that change.", invalid:"Check the task fields and select an active staff member.",
  save:"The change failed. Confirm the SQL migration is installed and check the database permissions.",
};
function memberLabel(id: string | null, members: Member[], self: string) {
  if (!id) return "Unassigned";
  const member = members.find((m) => m.user_id === id);
  return `${id === self ? "You · " : ""}${member?.role ?? "Staff"} · ${id.slice(0,8)}…`;
}
function selectClasses() { return "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-[#002144]"; }
function assigneeOptions(members: Member[], selected: string | null, self: string) {
  return <><option value="">Unassigned</option>{members.filter(m=>m.status === "active" || m.user_id === selected).map(m=><option key={m.user_id} value={m.user_id}>{memberLabel(m.user_id,members,self)}{m.status!=="active" ? " (inactive)" : ""}</option>)}</>;
}
function dateLabel(value: string | null) {
  return value ? new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US", { timeZone:"UTC",year:"numeric",month:"short",day:"numeric"}) : "No due date";
}
function EditFields({ task, members, self }: { task: Task; members: Member[]; self: string }) {
  return <div className="mt-4 grid gap-3 sm:grid-cols-2">
    <label className="text-sm font-semibold sm:col-span-2">Title<input name="title" required minLength={3} maxLength={160} defaultValue={task.title} className={selectClasses()} /></label>
    <label className="text-sm font-semibold sm:col-span-2">Research notes<textarea name="description" maxLength={5000} rows={3} defaultValue={task.description} className={selectClasses()} /></label>
    <label className="text-sm font-semibold">Assigned to<select name="assigned_to" defaultValue={task.assigned_to ?? ""} className={selectClasses()}>{assigneeOptions(members,task.assigned_to,self)}</select></label>
    <label className="text-sm font-semibold">Due date<input type="date" name="due_date" defaultValue={task.due_date ?? ""} className={selectClasses()} /></label>
    <label className="text-sm font-semibold">Priority<select name="priority" defaultValue={task.priority} className={selectClasses()}>{priorityList.map(p=><option key={p} value={p}>{priorityLabel[p]}</option>)}</select></label>
    <label className="text-sm font-semibold">Status<select name="status" defaultValue={task.status} className={selectClasses()}>{statusList.map(s=><option key={s} value={s}>{statusLabel[s]}</option>)}</select></label>
  </div>;
}
async function ResearchContent({ searchParams }: Props) {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (authError || !userId) redirect("/staff/login");
  const { data: staff, error: staffError } = await supabase.from("staff_members").select("role,status").eq("user_id",userId).maybeSingle();
  if (staffError || staff?.status !== "active" || !["owner","admin","editor"].includes(staff.role)) redirect("/staff/login?error=unauthorized");
  const [tasksResponse, membersResponse] = await Promise.all([
    supabase.from("research_assignments").select("id,title,description,created_by,assigned_to,priority,status,due_date,created_at,updated_at").order("updated_at",{ ascending:false }).limit(250),
    supabase.from("staff_members").select("user_id,role,status").order("role",{ascending:true}),
  ]);
  const params = await searchParams;
  const tasks = (tasksResponse.data ?? []) as Task[];
  const members = (membersResponse.data ?? []) as Member[];
  const filtered = tasks.filter(t => (!statusList.includes(params.status ?? "") || t.status === params.status) && (params.mine !== "1" || t.assigned_to === userId));
  const canManageAll = staff.role === "owner" || staff.role === "admin";
  const summary = [
    { label:"Open tasks", count:tasks.filter(t=>t.status!=="completed").length },
    { label:"In progress", count:tasks.filter(t=>t.status==="in_progress").length },
    { label:"Blocked", count:tasks.filter(t=>t.status==="blocked").length },
    { label:"My assigned tasks", count:tasks.filter(t=>t.assigned_to===userId && t.status!=="completed").length },
  ];
  return <main className="min-h-screen bg-[#f6f7f9] text-[#002144]">
    <header className="bg-[#002144] px-5 py-12 text-white"><div className="mx-auto max-w-6xl">
      <Link href="/staff/dashboard" className="text-sm font-semibold text-[#f2becf] hover:underline">← Staff Dashboard</Link>
      <p className="mt-7 text-xs font-extrabold uppercase tracking-[.2em] text-[#f2becf]">Staff collaboration</p>
      <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">Research assignments</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200">Coordinate historical research, record deadlines, and track the next steps for archive coverage.</p>
    </div></header>
    <div className="mx-auto max-w-6xl space-y-7 px-5 py-9">
      <ResearchNavigation currentPath="/staff/research" />
      {params.saved && <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">Research task saved successfully.</p>}
      {params.error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">{messages[params.error] ?? messages.save}</p>}
      {(tasksResponse.error || membersResponse.error) && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">Unable to load {tasksResponse.error ? "research assignments" : "staff members"}. Confirm migration 022 is installed and your account can access the data. Counts are unavailable until the query succeeds.</p>}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Research overview">
        {summary.map(s=><div key={s.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-600">{s.label}</p><p className="mt-2 text-3xl font-extrabold">{tasksResponse.error ? "—" : s.count}</p></div>)}
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-extrabold">Create a research task</h2>
        <p className="mt-1 text-sm text-slate-600">All active staff can create tasks. Assign work to an active staff member or leave it unassigned.</p>
        <form action={createResearchTask} className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold sm:col-span-2">Task title<input required minLength={3} maxLength={160} name="title" placeholder="Verify 1994 KMEA Class 3A Finals results" className={selectClasses()} /></label>
          <label className="text-sm font-semibold sm:col-span-2">Research description<textarea name="description" maxLength={5000} rows={3} placeholder="What needs to be checked? Include potential sources and expected deliverables." className={selectClasses()} /></label>
          <label className="text-sm font-semibold">Assign to<select name="assigned_to" defaultValue="" className={selectClasses()}>{assigneeOptions(members,null,userId)}</select></label>
          <label className="text-sm font-semibold">Due date (optional)<input name="due_date" type="date" className={selectClasses()} /></label>
          <label className="text-sm font-semibold">Priority<select name="priority" defaultValue="normal" className={selectClasses()}>{priorityList.map(p=><option value={p} key={p}>{priorityLabel[p]}</option>)}</select></label>
          <div className="flex items-end"><button type="submit" disabled={Boolean(membersResponse.error)} className="w-full rounded-lg bg-[#861F41] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#6d1936] disabled:opacity-50">Create task</button></div>
        </form>
      </section>
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-extrabold">Research queue</h2><p className="mt-1 text-sm text-slate-600">Latest 250 tasks, ordered by last update.</p></div><Link href="/staff/notifications" className="text-sm font-semibold text-[#861F41] hover:underline">Attention Center →</Link></div>
        <nav aria-label="Filter tasks" className="flex flex-wrap gap-2">{[{key:"",label:"All"}, ...statusList.map(s=>({key:s,label:statusLabel[s]}))].map(option=><Link key={option.key} href={`/staff/research?status=${option.key}${params.mine==="1"?"&mine=1":""}`} className={`rounded-full px-4 py-2 text-sm font-semibold ${ (params.status??"")===option.key ? "bg-[#002144] text-white" : "border border-slate-300 bg-white hover:bg-slate-100"}`}>{option.label}</Link>)}<Link href={params.mine==="1" ? `/staff/research?status=${params.status??""}` : `/staff/research?status=${params.status??""}&mine=1`} className="rounded-full border border-[#861F41] bg-white px-4 py-2 text-sm font-semibold text-[#861F41]">{params.mine==="1" ? "Show team tasks" : "Only my tasks"}</Link></nav>
        {!tasksResponse.error && filtered.length===0 && <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">No tasks match this filter.</p>}
        {filtered.map(task=>{
          const canEdit = canManageAll || task.created_by===userId;
          const canStatus = canEdit || task.assigned_to===userId;
          const overdue = task.due_date && task.status!=="completed" && task.due_date < new Date().toISOString().slice(0,10);
          return <article key={task.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="text-lg font-bold">{task.title}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{task.description || "No details added."}</p></div><div className="flex gap-2"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{statusLabel[task.status]??task.status}</span><span className={`rounded-full px-3 py-1 text-xs font-bold ${task.priority==="urgent"?"bg-red-100 text-red-800":task.priority==="high"?"bg-amber-100 text-amber-900":"bg-slate-100 text-slate-700"}`}>{priorityLabel[task.priority]??task.priority}</span></div></div>
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500"><span>Assigned: {memberLabel(task.assigned_to,members,userId)}</span><span className={overdue ? "font-bold text-red-700" : ""}>{overdue?"Overdue · ":""}{dateLabel(task.due_date)}</span><span>Created by {memberLabel(task.created_by,members,userId)}</span></div>
            {canStatus && <form action={updateResearchStatus} className="mt-4 flex flex-wrap items-end gap-2"><input type="hidden" name="id" value={task.id}/><label className="text-xs font-semibold">Change status<select name="status" defaultValue={task.status} className={selectClasses()}>{statusList.map(s=><option key={s} value={s}>{statusLabel[s]}</option>)}</select></label><button type="submit" className="rounded-lg border border-[#002144] px-4 py-2 text-sm font-bold hover:bg-slate-100">Save status</button></form>}
            {canEdit && <details className="mt-4 border-t border-slate-100 pt-4"><summary className="cursor-pointer text-sm font-bold text-[#861F41]">Edit assignment details</summary><form action={editResearchTask}><input type="hidden" name="id" value={task.id}/><EditFields task={task} members={members} self={userId}/><button type="submit" className="mt-4 rounded-lg bg-[#002144] px-5 py-2.5 text-sm font-bold text-white">Save changes</button></form></details>}
          </article>;
        })}
      </section>
    </div>
  </main>;
}
export default function ResearchPage(props: Props) {
  return <Suspense fallback={<main className="mx-auto max-w-6xl p-8">Loading research tasks…</main>}><ResearchContent {...props}/></Suspense>;
}
