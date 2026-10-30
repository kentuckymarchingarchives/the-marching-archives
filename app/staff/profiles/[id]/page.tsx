import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Member = { user_id: string; display_name: string | null; greeting_name: string | null; role: string; status: string; staff_title: string | null; biography: string | null; research_specialties: string | null; profile_photo_url: string | null };
type Task = { id: string; title: string; status: string; priority: string; due_date: string | null; updated_at: string; completed_at: string | null };
const roleTitle = (role: string) => role === "owner" ? "Owner" : role === "admin" ? "Administrator" : "Editor";
const nameOf = (s: Member) => s.display_name?.trim() || s.greeting_name?.trim() || "Staff member";
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

type Props = { params: Promise<{ id: string }> };
async function ProfileContent({ params }: Props) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  const uid = auth?.claims?.sub;
  if (authError || !uid) redirect("/staff/login");
  const { data: own, error: ownError } = await supabase.from("staff_members").select("role,status").eq("user_id", uid).maybeSingle();
  if (ownError || own?.status !== "active" || !["owner", "admin", "editor"].includes(own.role)) redirect("/staff/dashboard");

  const { data: members, error: directoryError } = await supabase.rpc("tma_staff_profile_directory");
  if (directoryError) return <main className="mx-auto max-w-4xl px-5 py-12"><Link href="/staff/profiles" className="text-[#861F41] underline">← Staff directory</Link><p role="alert" className="mt-5 rounded-lg bg-red-50 p-5 text-red-800">Unable to load staff profiles. Please confirm migration 025.</p></main>;
  const member = ((members ?? []) as Member[]).find(m => m.user_id === id);
  if (!member) notFound();
  const { data: rows, error: tasksError } = await supabase.from("research_assignments")
    .select("id,title,status,priority,due_date,updated_at,completed_at")
    .eq("assigned_to", id).order("updated_at", { ascending: false }).limit(250);
  const tasks = (rows ?? []) as Task[];
  const completed = tasks.filter(t => t.status === "completed");
  const ongoing = tasks.filter(t => t.status !== "completed");
  const isLimited = tasks.length === 250;

  return <main className="min-h-screen bg-[#f6f7f9] text-[#002144]">
    <header className="bg-[#002144] text-white"><div className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
      <Link href="/staff/profiles" className="text-sm text-slate-200 hover:text-white">← Staff directory</Link>
      <p className="mt-7 text-xs font-bold uppercase tracking-widest text-[#efbbce]">Archive team profile</p>
      <h1 className="mt-2 text-3xl font-extrabold">{nameOf(member)}{id === uid ? " · Your profile" : ""}</h1>
      <p className="mt-2 text-base font-semibold text-[#efbbce]">{member.staff_title || roleTitle(member.role)}</p>
      <p className="mt-1 text-sm text-slate-200">{roleTitle(member.role)} · Active staff</p>
    </div></header>
    <div className="mx-auto max-w-5xl space-y-7 px-5 py-8 sm:px-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          {member.profile_photo_url ? <img src={member.profile_photo_url} alt={`${nameOf(member)} profile`} referrerPolicy="no-referrer" className="h-20 w-20 rounded-full border border-slate-200 object-cover"/> : <div aria-hidden="true" className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-[#002144] text-xl font-bold text-white">{nameOf(member).slice(0,2).toUpperCase()}</div>}
          <div><h2 className="text-lg font-extrabold">About {nameOf(member)}</h2><p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{member.biography || "No biography added yet."}</p></div>
        </div>
        {member.research_specialties && <div className="mt-5 border-t border-slate-100 pt-4"><h3 className="text-sm font-extrabold">Research specialties</h3><p className="mt-2 text-sm text-slate-700">{member.research_specialties}</p></div>}
      </section>
      <section aria-label="Research contributions" className="grid gap-4 sm:grid-cols-3">
        {[{label:"Completed assignments",value:completed.length},{label:"Active assignments",value:ongoing.length},{label:"Total assigned",value:tasks.length}].map(x => <div key={x.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-600">{x.label}</p><p className="mt-2 text-3xl font-extrabold tabular-nums">{tasksError ? "—" : x.value}</p></div>)}
      </section>
      {tasksError && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Unable to load research assignments. Confirm migration 022 and staff access.</p>}
      {isLimited && <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">Showing only the 250 most recently updated assignments. Counts shown here cover this sample, not every historical task.</p>}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-extrabold">Research contributions</h2><Link href="/staff/research" className="text-sm font-bold text-[#861F41] hover:underline">Research workspace →</Link></div>
        <p className="mt-2 text-sm text-slate-600">Completed assignments assigned to this staff member. These are recorded tasks, not a claim that every archive edit was performed by this person.</p>
        {completed.length ? <ul className="mt-5 divide-y divide-slate-100">{completed.slice(0,15).map(t => <li key={t.id} className="py-4"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">{t.title}</span><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">Completed</span></div><p className="mt-1 text-xs text-slate-500">{t.completed_at ? `Completed ${new Date(t.completed_at).toLocaleDateString("en-US")}` : "Completion date unavailable"}</p></li>)}</ul> : <p className="mt-5 text-sm text-slate-500">No completed research assignments recorded yet.</p>}
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-extrabold">Current assignments</h2>
        {ongoing.length ? <ul className="mt-4 divide-y divide-slate-100">{ongoing.slice(0,15).map(t => <li key={t.id} className="flex flex-wrap items-center justify-between gap-4 py-4"><div><p className="font-semibold">{t.title}</p><p className="mt-1 text-xs capitalize text-slate-600">{t.status.replaceAll("_", " ")} · {t.priority} priority</p></div><p className="text-xs text-slate-500">{t.due_date ? `Due ${t.due_date}` : "No deadline"}</p></li>)}</ul> : <p className="mt-4 text-sm text-slate-500">No current assignments.</p>}
      </section>
      <p className="text-xs leading-5 text-slate-500">Profiles are staff-only. Names and task activity come from existing staff and research data; authentication emails and private credentials are never shown.</p>
    </div>
  </main>;
}
export default function StaffProfilePage(props: Props) { return <Suspense fallback={<main className="p-10">Loading staff profile…</main>}><ProfileContent {...props}/></Suspense>; }
