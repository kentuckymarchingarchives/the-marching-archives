import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { saveStaffMember } from "./actions";

type Staff = { user_id: string; role: string; status: string; created_at: string; display_name: string | null; greeting_name: string | null };
type Props = { searchParams: Promise<{ error?: string; saved?: string }> };

const messages: Record<string,string> = {
  invalid: "Enter a valid UID, role, status, and names within the allowed lengths.",
  "last-owner": "The last active Owner cannot be demoted or deactivated.",
  forbidden: "Only active Owners may modify staff accounts.",
  "no-user": "That UID does not exist in Supabase Authentication.",
  save: "The change could not be saved. Check the UID and database migration.",
};

async function TeamContent({ searchParams }: Props) {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (authError || !userId) redirect("/staff/login");
  const { data: current, error: staffError } = await supabase
    .from("staff_members").select("role,status").eq("user_id", userId).maybeSingle();
  if (staffError || current?.role !== "owner" || current.status !== "active") {
    redirect("/staff/dashboard");
  }
  const { data, error: listError } = await supabase.from("staff_members")
    .select("user_id,role,status,created_at,display_name,greeting_name").order("created_at", { ascending: true });
  const rows = (data ?? []) as Staff[];
  const params = await searchParams;
  const ownerCount = rows.filter(row => row.role === "owner" && row.status === "active").length;

  return <main className="min-h-screen bg-[#f6f7f9] text-[#002144]">
    <div className="bg-[#002144] text-white"><div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
      <Link href="/staff/dashboard" className="text-sm text-slate-200 hover:text-white">← Staff dashboard</Link>
      <p className="mt-7 text-xs font-bold uppercase tracking-widest text-[#f0bfce]">Owner tools</p>
      <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">Staff management</h1>
      <p className="mt-3 max-w-2xl text-sm text-slate-200">Manage names, greetings, roles, and account access. Changes take effect in your existing permission checks.</p>
    </div></div>
    <div className="mx-auto max-w-6xl space-y-8 px-5 py-8 sm:px-8">
      {params.saved === "1" && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">Staff access updated.</p>}
      {params.error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">{messages[params.error] ?? messages.save}</p>}
      <section className="grid gap-4 sm:grid-cols-3">
        {[{label:"Staff accounts",value:rows.length},{label:"Active Owners",value:ownerCount},{label:"Active staff",value:rows.filter(x=>x.status==="active").length}].map(item =>
          <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-600">{item.label}</p><p className="mt-2 text-3xl font-extrabold tabular-nums">{listError ? "—" : item.value}</p></div>
        )}
      </section>
      {listError && <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-900">Unable to load staff members. Check your database permissions.</p>}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold">Add or promote staff</h2>
        <p className="mt-2 text-sm text-slate-600">The person must already have a Supabase Authentication account. Enter their UID, names, role, and status. The greeting name appears in “Hello, …!” on their dashboard.</p>
        <form action={saveStaffMember} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:items-end">
          <label className="block text-sm font-semibold">Authentication UID<input required name="user_id" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
          <label className="block text-sm font-semibold">Display name<input name="display_name" maxLength={100} placeholder="Noah Moore" className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
          <label className="block text-sm font-semibold">Greeting name<input name="greeting_name" maxLength={40} placeholder="Noah or JT" className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
          <label className="block text-sm font-semibold">Role<select name="role" defaultValue="editor" className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"><option value="editor">Editor</option><option value="admin">Administrator</option><option value="owner">Owner</option></select></label>
          <label className="block text-sm font-semibold">Status<select name="status" defaultValue="active" className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
          <button className="rounded-lg bg-[#861F41] px-5 py-2.5 font-bold text-white hover:bg-[#6d1936]" type="submit">Save staff</button>
        </form>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold">Current staff</h2>
        <p className="mt-2 text-sm text-slate-600">Update roles and deactivate access without deleting authentication accounts. At least one active Owner must remain.</p>
        <div className="mt-5 space-y-3">
          {rows.map(member => <form action={saveStaffMember} key={member.user_id} className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-3 lg:items-end">
            <div className="min-w-0 sm:col-span-2 lg:col-span-3"><p className="font-bold text-[#002144]">{member.display_name || member.greeting_name || "Unnamed staff member"}</p><p className="mt-1 text-xs text-slate-500">Supabase UID {member.user_id===userId ? "· You" : ""}</p><p className="break-all font-mono text-xs sm:text-sm">{member.user_id}</p><input type="hidden" name="user_id" value={member.user_id}/></div>
            <label className="text-sm font-semibold">Display name<input name="display_name" maxLength={100} defaultValue={member.display_name ?? ""} placeholder="Full or display name" className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
            <label className="text-sm font-semibold">Greeting name<input name="greeting_name" maxLength={40} defaultValue={member.greeting_name ?? ""} placeholder="Name used in greeting" className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
            <label className="text-sm font-semibold">Role<select name="role" defaultValue={member.role} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2"><option value="owner">Owner</option><option value="admin">Administrator</option><option value="editor">Editor</option></select></label>
            <label className="text-sm font-semibold">Status<select name="status" defaultValue={member.status} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2"><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
            <button type="submit" className="rounded-lg border border-[#002144] px-4 py-2 text-sm font-bold hover:bg-slate-100">Update</button>
          </form>)}
          {!listError && rows.length===0 && <p className="text-sm text-slate-600">No staff accounts were found.</p>}
        </div>
      </section>
      <p className="text-sm text-slate-600">Names are visible to Owners on this page and to each signed-in staff member on their dashboard. Authentication emails are not exposed. Only grant Owner access to trusted administrators.</p>
    </div>
  </main>;
}

export default function StaffTeamPage(props: Props) {
  return <Suspense fallback={<main className="mx-auto max-w-6xl p-8">Loading staff management…</main>}><TeamContent {...props}/></Suspense>;
}
