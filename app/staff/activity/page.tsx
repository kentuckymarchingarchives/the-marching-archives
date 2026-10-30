import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Params = { page?: string; table?: string; operation?: string };
type AuditEvent = {
  id: number;
  occurred_at: string;
  actor_user_id: string | null;
  table_name: string;
  operation: "INSERT" | "UPDATE" | "DELETE";
  record_id: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
};
const PAGE_SIZE = 25;
const TABLES = ["all", "staff_members", "bands", "band_names", "competitions", "competition_rounds", "competition_entries", "score_captions", "caption_scores", "power_ranking_editions", "power_ranking_sections", "power_ranking_entries", "competition_sources", "historical_documents"];
const OPS = ["all", "INSERT", "UPDATE", "DELETE"];

function summarize(event: AuditEvent) {
  const oldRow = event.old_values ?? {};
  const newRow = event.new_values ?? {};
  const names = Array.from(new Set([...Object.keys(oldRow), ...Object.keys(newRow)]));
  const changed = names.filter((name) => JSON.stringify(oldRow[name]) !== JSON.stringify(newRow[name]));
  return changed.length ? changed.join(", ") : "No tracked field changes";
}
function queryString(page: number, table: string, operation: string) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  if (table !== "all") params.set("table", table);
  if (operation !== "all") params.set("operation", operation);
  return `/staff/activity?${params.toString()}`;
}

async function ActivityContent({ searchParams }: { searchParams: Promise<Params> }) {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (authError || !userId) redirect("/staff/login");
  const { data: staff, error: staffError } = await supabase.from("staff_members")
    .select("role,status").eq("user_id", userId).maybeSingle();
  if (staffError || staff?.status !== "active" || !["owner", "admin"].includes(staff.role)) {
    return <main className="mx-auto max-w-5xl px-6 py-16"><h1 className="text-2xl font-bold">Access restricted</h1><p className="mt-3">Only active Owners and Administrators can view the audit log.</p></main>;
  }
  const params = await searchParams;
  const table = TABLES.includes(params.table ?? "") ? params.table! : "all";
  const operation = OPS.includes(params.operation ?? "") ? params.operation! : "all";
  const requestedPage = Number(params.page ?? "1");
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 10000) : 1;
  let query = supabase.from("archive_audit_events")
    .select("id,occurred_at,actor_user_id,table_name,operation,record_id,old_values,new_values", { count: "exact" });
  if (table !== "all") query = query.eq("table_name", table);
  if (operation !== "all") query = query.eq("operation", operation);
  const { data, error, count } = await query.order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const events = (data ?? []) as AuditEvent[];
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return <main className="min-h-screen bg-[#f6f7f9] text-[#002144]">
    <section className="bg-[#002144] px-6 py-12 text-white">
      <div className="mx-auto max-w-6xl"><Link href="/staff/dashboard" className="text-sm text-slate-300 hover:text-white">← Staff dashboard</Link>
        <p className="mt-6 text-xs font-bold uppercase tracking-[.2em] text-[#efbbce]">Staff / Accountability</p>
        <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">Archive Activity Log</h1>
        <p className="mt-3 max-w-2xl text-slate-300">Review recorded changes to historical results, competitions, ensembles, and staff access. Events are recorded after the audit migration is installed.</p>
      </div>
    </section>
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      <form method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-5">
        <label className="flex flex-col gap-1 text-sm font-semibold">Record type<select name="table" defaultValue={table} className="rounded-lg border border-slate-300 px-3 py-2 font-normal">{TABLES.map(v=><option value={v} key={v}>{v === "all" ? "All records" : v.replaceAll("_", " ")}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-sm font-semibold">Action<select name="operation" defaultValue={operation} className="rounded-lg border border-slate-300 px-3 py-2 font-normal">{OPS.map(v=><option value={v} key={v}>{v === "all" ? "All changes" : v}</option>)}</select></label>
        <button type="submit" className="rounded-lg bg-[#861F41] px-5 py-2.5 font-bold text-white hover:bg-[#6c1734]">Filter activity</button>
        <Link href="/staff/activity" className="px-2 py-2.5 text-sm font-semibold text-slate-600">Clear</Link>
      </form>
      {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-white p-6 text-rose-800">Unable to load activity. Confirm migration 021 has been installed and your account is an active Owner or Administrator.</div> : <>
        <p className="text-sm text-slate-600">{count ?? 0} recorded events · Page {page} of {pages}</p>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-212.5 w-full text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600"><tr><th className="p-4">When</th><th className="p-4">Action</th><th className="p-4">Record</th><th className="p-4">Changed fields</th><th className="p-4">Actor UID</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{events.map(event=><tr key={event.id} className="align-top">
              <td className="whitespace-nowrap p-4 text-slate-600">{new Date(event.occurred_at).toLocaleString("en-US", {timeZone:"America/New_York",dateStyle:"medium",timeStyle:"short"})} ET</td>
              <td className="p-4"><span className="rounded-md bg-slate-100 px-2 py-1 font-semibold">{event.operation}</span></td>
              <td className="p-4"><div className="font-semibold">{event.table_name.replaceAll("_", " ")}</div><div className="mt-1 break-all font-mono text-xs text-slate-500">{event.record_id}</div></td>
              <td className="p-4"><details><summary className="cursor-pointer text-[#861F41]">{summarize(event)}</summary><pre className="mt-2 max-w-lg overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">{JSON.stringify({before:event.old_values,after:event.new_values},null,2)}</pre></details></td>
              <td className="max-w-45 break-all p-4 font-mono text-xs text-slate-500">{event.actor_user_id ?? "System / SQL"}</td>
            </tr>)}{!events.length && <tr><td colSpan={5} className="p-10 text-center text-slate-500">No recorded changes match these filters.</td></tr>}</tbody>
          </table>
        </div>
        <div className="flex justify-between gap-4">{page>1?<Link className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold" href={queryString(page-1,table,operation)}>← Previous</Link>:<span/>}{page<pages?<Link className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold" href={queryString(page+1,table,operation)}>Next →</Link>:<span/>}</div>
      </>}
      <p className="text-xs leading-6 text-slate-500">The log records changes to selected fields, not passwords, tokens, free-text notes, or historical edits made before installation. Database-administrator operations may show no actor UID. This is an accountability record, not a full backup or automatic undo system.</p>
    </div>
  </main>;
}
export default function ActivityPage({searchParams}:{searchParams:Promise<Params>}) {
  return <Suspense fallback={<main className="mx-auto max-w-6xl p-10">Loading archive activity…</main>}><ActivityContent searchParams={searchParams}/></Suspense>;
}
