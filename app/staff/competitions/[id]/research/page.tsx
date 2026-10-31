import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createCompetitionResearchTask } from "./actions";
import { updateResearchStatus } from "@/app/staff/research/actions";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
};
type Task = {
  id: string; title: string; description: string; assigned_to: string | null;
  created_by: string; priority: string; status: string; due_date: string | null;
  updated_at: string;
};
type Member = { user_id: string; display_name: string | null; greeting_name: string | null; role: string; status: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const statuses = ["todo", "in_progress", "blocked", "completed"] as const;
const label: Record<string, string> = { todo: "To do", in_progress: "In progress", blocked: "Blocked", completed: "Completed" };
const inputStyle = "mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-[#002144] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#861F41]";

function readableMember(id: string | null, staff: Member[]) {
  if (!id) return "Unassigned";
  const member = staff.find(m => m.user_id === id);
  return member?.display_name?.trim() || member?.greeting_name?.trim() || "Former or unavailable staff member";
}

async function Content({ params, searchParams }: PageProps) {
  await connection();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  if (authError || !auth?.claims?.sub) redirect("/staff/login");
  const userId = auth.claims.sub;
  const { data: member, error: memberError } = await supabase.from("staff_members")
    .select("role,status").eq("user_id", userId).maybeSingle();
  if (memberError || member?.status !== "active" || !["owner","admin","editor"].includes(member.role)) {
    redirect("/staff/login?error=unauthorized");
  }
  const { data: competition, error: competitionError } = await supabase.from("competitions")
    .select("id,name,organization_code,season_year")
    .eq("id", id).maybeSingle();
  if (competitionError) throw new Error("Unable to load competition.");
  if (!competition) notFound();

  const [taskResponse, memberResponse] = await Promise.all([
    supabase.from("research_assignments")
      .select("id,title,description,assigned_to,created_by,priority,status,due_date,updated_at")
      .eq("competition_id",id).order("updated_at",{ascending:false}).limit(200),
    supabase.from("staff_members")
      .select("user_id,display_name,greeting_name,role,status")
      .order("role",{ascending:true}),
  ]);
  const tasks = (taskResponse.data ?? []) as Task[];
  const staff = (memberResponse.data ?? []) as Member[];
  const manageAll = member.role === "owner" || member.role === "admin";
  const openCount = tasks.filter(t => t.status !== "completed").length;
  const overdueCount = tasks.filter(t => t.status !== "completed" && Boolean(t.due_date) && t.due_date! < new Date().toISOString().slice(0,10)).length;
  const query = await searchParams;
  return (
    <main className="min-h-screen bg-[#f6f7f8] text-[#002144]">
      <div className="border-b border-[#294664] bg-[#002144] px-6 py-12 text-white">
        <div className="mx-auto max-w-6xl">
          <Link href={`/staff/competitions/${id}`} className="text-sm font-semibold text-[#e8afc2] hover:underline">← Competition editor</Link>
          <p className="mt-6 text-xs font-black uppercase tracking-widest text-[#e8afc2]">The Marching Archives / Staff Research</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Research Tasks</h1>
          <p className="mt-2 text-slate-200">{competition.name} · {competition.organization_code} · {competition.season_year}</p>
        </div>
      </div>
      <div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
        {query.saved && <p role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">Research assignment created.</p>}
        {query.error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">{query.error === "forbidden" ? "You do not have permission to create this task." : query.error === "invalid" ? "Please check the form values." : "Unable to save. Check that migration 033 is installed."}</p>}
        <div className="grid gap-4 sm:grid-cols-3">
          {[{title:"Linked assignments", value: tasks.length},{title:"Open tasks",value:openCount},{title:"Overdue",value:overdueCount}].map(card =>
            <div key={card.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-600">{card.title}</p><p className="mt-2 text-3xl font-black tabular-nums">{taskResponse.error ? "—" : card.value}</p></div>)}
        </div>
        {(taskResponse.error || memberResponse.error) && <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">Unable to load {taskResponse.error ? "linked tasks" : "staff list"}. Make sure migrations 022, 024, and 033 are installed. No missing data is counted as zero.</p>}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black">Create a linked assignment</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">The assignment will remain linked to this competition even if its name changes.</p>
          <form action={createCompetitionResearchTask} className="mt-5 grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="competition_id" value={id}/>
            <label className="text-sm font-semibold sm:col-span-2">Title
              <input name="title" required maxLength={160} minLength={3} defaultValue={`Research ${competition.season_year} ${competition.organization_code}: ${competition.name}`.slice(0,160)} className={inputStyle}/>
            </label>
            <label className="text-sm font-semibold sm:col-span-2">Research notes
              <textarea name="description" rows={4} maxLength={5000} defaultValue={`Review the historical results and supporting sources for ${competition.name}. Record missing information and verification findings.`} className={inputStyle}/>
            </label>
            <label className="text-sm font-semibold">Assign to
              <select name="assigned_to" defaultValue="" className={inputStyle} disabled={Boolean(memberResponse.error)}>
                <option value="">Unassigned</option>
                {staff.filter(s=>s.status==="active").map(s=><option key={s.user_id} value={s.user_id}>{readableMember(s.user_id,staff)} · {s.role}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold">Priority
              <select name="priority" defaultValue="normal" className={inputStyle}>
                <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
              </select>
            </label>
            <label className="text-sm font-semibold">Due date (optional)
              <input type="date" name="due_date" className={inputStyle}/>
            </label>
            <div className="flex items-end"><button type="submit" disabled={Boolean(memberResponse.error)} className="rounded-xl bg-[#861F41] px-6 py-3 text-sm font-bold text-white hover:bg-[#6b1734] disabled:opacity-50">Create assignment</button></div>
          </form>
        </section>
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-black">Linked research queue</h2><Link href="/staff/research" className="text-sm font-bold text-[#861F41] hover:underline">All research assignments →</Link></div>
          {!taskResponse.error && tasks.length===0 && <p className="rounded-xl bg-white p-6 text-sm text-slate-600">No assignments are linked to this competition yet. Previous tasks containing the competition name in their description remain unlinked until migrated explicitly.</p>}
          {tasks.map(t=>{
            const canUpdate = manageAll || t.assigned_to===userId || t.created_by===userId;
            return <article key={t.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4"><div><h3 className="text-lg font-black">{t.title}</h3><p className="mt-2 text-sm text-slate-600">Assigned to {readableMember(t.assigned_to,staff)} · {t.priority} priority · {t.due_date ? `Due ${t.due_date}` : "No due date"}</p></div><span className="rounded-full bg-[#f6ebef] px-3 py-1 text-xs font-bold text-[#861F41]">{label[t.status] ?? t.status}</span></div>
              {t.description && <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">{t.description}</p>}
              {canUpdate && <form action={updateResearchStatus} className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
                <input type="hidden" name="id" value={t.id}/><label className="text-sm font-semibold">Update status <select name="status" defaultValue={t.status} className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2">{statuses.map(s=><option key={s} value={s}>{label[s]}</option>)}</select></label>
                <button type="submit" className="rounded-lg bg-[#002144] px-4 py-2 text-sm font-bold text-white hover:bg-[#163b60]">Save status</button>
              </form>}
            </article>;
          })}
          {tasks.length===200 && <p className="text-sm text-amber-800">Showing the latest 200 assignments for this competition. Open the full Research Assignments page to review older tasks.</p>}
        </section>
      </div>
    </main>
  );
}

export default function CompetitionResearchPage(props: PageProps) {
  return <Suspense fallback={<main className="p-10 text-[#002144]">Loading competition research…</main>}><Content {...props}/></Suspense>;
}
