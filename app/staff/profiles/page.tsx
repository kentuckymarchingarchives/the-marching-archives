import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Member = { user_id: string; display_name: string | null; greeting_name: string | null; role: string; status: string };
type Assignment = { assigned_to: string | null; status: string };
const roleTitle = (role: string) => role === "owner" ? "Owner" : role === "admin" ? "Administrator" : "Editor";
const nameOf = (s: Member) => s.display_name?.trim() || s.greeting_name?.trim() || "Staff member";

async function DirectoryContent() {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  const uid = auth?.claims?.sub;
  if (authError || !uid) redirect("/staff/login");
  const { data: own, error: ownError } = await supabase.from("staff_members").select("role,status").eq("user_id", uid).maybeSingle();
  if (ownError || own?.status !== "active" || !["owner", "admin", "editor"].includes(own.role)) redirect("/staff/dashboard");

  const [staffResult, assignmentsResult] = await Promise.all([
    supabase.rpc("tma_staff_profile_directory"),
    supabase.from("research_assignments").select("assigned_to,status"),
  ]);
  const members = (staffResult.data ?? []) as Member[];
  const tasks = (assignmentsResult.data ?? []) as Assignment[];
  return <main className="min-h-screen bg-[#f6f7f9] text-[#002144]">
    <header className="bg-[#002144] text-white"><div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
      <Link href="/staff/dashboard" className="text-sm text-slate-200 hover:text-white">← Staff dashboard</Link>
      <p className="mt-7 text-xs font-bold uppercase tracking-widest text-[#efbbce]">Team collaboration</p>
      <h1 className="mt-2 text-3xl font-extrabold">Staff directory</h1>
      <p className="mt-3 max-w-2xl text-sm text-slate-200">Meet the active archive team and see research progress. Profiles are visible only to authenticated active staff.</p>
    </div></header>
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
      {staffResult.error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Could not load staff directory. Verify migration 025 is installed.</p> :
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{members.map(s => {
          const mine = tasks.filter(t => t.assigned_to === s.user_id);
          const completed = mine.filter(t => t.status === "completed").length;
          return <Link key={s.user_id} href={`/staff/profiles/${s.user_id}`} className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-[#861F41]/50 hover:shadow-md">
            <div className="flex items-center gap-3"><span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#002144] text-sm font-extrabold text-white">{(s.greeting_name || nameOf(s)).trim().slice(0,2).toUpperCase()}</span><div className="min-w-0"><h2 className="truncate text-lg font-extrabold group-hover:text-[#861F41]">{nameOf(s)}{s.user_id === uid ? " (You)" : ""}</h2><p className="text-xs font-semibold text-[#861F41]">{roleTitle(s.role)}</p></div></div>
            <div className="mt-5 flex gap-5 border-t border-slate-100 pt-4 text-sm"><div><p className="text-2xl font-extrabold">{assignmentsResult.error ? "—" : completed}</p><p className="text-xs text-slate-600">Completed tasks</p></div><div><p className="text-2xl font-extrabold">{assignmentsResult.error ? "—" : mine.filter(t => t.status !== "completed").length}</p><p className="text-xs text-slate-600">Active tasks</p></div></div>
          </Link>;
        })}</div>}
      {!staffResult.error && members.length === 0 && <p className="rounded-xl bg-white p-5 text-sm text-slate-600">No active staff members were returned.</p>}
      {assignmentsResult.error && <p className="mt-4 text-sm text-amber-900">Research totals are unavailable. Verify migration 022.</p>}
    </div>
  </main>;
}
export default function StaffProfilesPage() { return <Suspense fallback={<main className="p-10">Loading staff directory…</main>}><DirectoryContent/></Suspense>; }
