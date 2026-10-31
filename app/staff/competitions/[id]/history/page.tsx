import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; type?: string }>;
};
type Revision = {
  id: number;
  occurred_at: string;
  actor_user_id: string | null;
  table_name: string;
  operation: "INSERT" | "UPDATE" | "DELETE";
  record_id: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  total_count: number;
};
type StaffName = { user_id: string; display_name: string | null; greeting_name: string | null };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TYPE_OPTIONS = [
  ["all", "All changes"],
  ["competitions", "Competition details"],
  ["competition_rounds", "Rounds"],
  ["competition_entries", "Results & placements"],
  ["score_captions", "Caption definitions"],
  ["caption_scores", "Caption scores"],
  ["competition_sources", "Sources"],
] as const;
const DISPLAY: Record<string, string> = {
  competitions: "Competition details",
  competition_rounds: "Competition round",
  competition_entries: "Result entry",
  score_captions: "Caption definition",
  caption_scores: "Caption score",
  competition_sources: "Competition source",
};
const FIELD_NAMES: Record<string, string> = {
  competition_date: "Date", name: "Name", season_year: "Season",
  total_score: "Total score", overall_placement: "Overall placement",
  class_placement: "Class placement", classification: "Classification",
  band_id: "Band ID", round_id: "Round ID", score: "Caption score",
  published_at: "Published at", publication_status: "Publication status",
  penalty: "Penalty", archived_at: "Archived at",
};

function renderValue(value: unknown): string {
  if (value === undefined || value === null) return "—";
  if (typeof value === "string") return value || "(empty)";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}
function changes(event: Revision) {
  const a = event.old_values ?? {};
  const b = event.new_values ?? {};
  return [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .filter((key) => key !== "id" && JSON.stringify(a[key]) !== JSON.stringify(b[key]))
    .map((key) => ({ key, before: a[key], after: b[key] }));
}
function pageHref(id: string, page: number, type: string) {
  const query = new URLSearchParams({ page: String(page) });
  if (type !== "all") query.set("type", type);
  return `/staff/competitions/${id}/history?${query}`;
}

async function HistoryContent({ params, searchParams }: PageProps) {
  await connection();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  if (authError || !auth?.claims?.sub) redirect("/staff/login");
  const { data: staff, error: staffError } = await supabase.from("staff_members")
    .select("role,status").eq("user_id", auth.claims.sub).maybeSingle();
  if (staffError || staff?.status !== "active" || !["owner", "admin"].includes(staff.role)) {
    return <main className="mx-auto max-w-4xl px-6 py-16 text-[#002144]"><h1 className="text-2xl font-black">Access restricted</h1><p className="mt-3">Only active Owners and Administrators can review competition revision history.</p></main>;
  }
  const { data: competition, error: competitionError } = await supabase.from("competitions")
    .select("id,name,season_year,organization_code").eq("id", id).maybeSingle();
  if (competitionError) throw new Error("Unable to load competition.");
  if (!competition) notFound();

  const incoming = await searchParams;
  const rawPage = Number(incoming.page ?? 1);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, 10000) : 1;
  const selectedType = TYPE_OPTIONS.some(([key]) => key === incoming.type) ? incoming.type! : "all";
  const [revisionsResponse, staffResponse] = await Promise.all([
    supabase.rpc("tma_competition_revision_history", {
      p_competition_id: id, p_page: page, p_page_size: 30,
    }),
    supabase.from("staff_members").select("user_id,display_name,greeting_name"),
  ]);
  const allRevisions = (revisionsResponse.data ?? []) as Revision[];
  // The database limits each request to 30 records; category filters apply to the
  // current page only. This is explicitly noted in the UI to avoid false completeness claims.
  const shown = selectedType === "all" ? allRevisions : allRevisions.filter((r) => r.table_name === selectedType);
  const authorNames = new Map(((staffResponse.data ?? []) as StaffName[]).map((s) => [s.user_id, s.display_name?.trim() || s.greeting_name?.trim() || "Staff member"]));
  const total = allRevisions[0]?.total_count;
  const hasNext = typeof total === "number" ? page * 30 < total : allRevisions.length === 30;

  return <main className="min-h-screen bg-[#f6f7f8] text-[#002144]">
    <header className="bg-[#002144] px-6 py-12 text-white">
      <div className="mx-auto max-w-6xl">
        <Link href={`/staff/competitions/${id}`} className="text-sm font-semibold text-[#e8afc2] hover:underline">← Competition editor</Link>
        <p className="mt-6 text-xs font-black uppercase tracking-widest text-[#e8afc2]">The Marching Archives / Staff Accountability</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Competition Revision History</h1>
        <p className="mt-3 text-slate-200">{competition.name} · {competition.organization_code} · {competition.season_year}</p>
      </div>
    </header>
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm leading-6 text-slate-600">Read-only changes recorded since the audit log was installed. Earlier edits cannot be reconstructed.</p>
        <Link href="/staff/activity" className="text-sm font-bold text-[#861F41] hover:underline">View full staff audit log ↗</Link>
      </div>
      <form method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="flex flex-col gap-1 text-sm font-semibold">Change type
          <select name="type" defaultValue={selectedType} className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal">
            {TYPE_OPTIONS.map(([key,label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <button className="rounded-lg bg-[#861F41] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#6e1935]">Filter current page</button>
        <Link href={`/staff/competitions/${id}/history`} className="px-3 py-2 text-sm font-bold text-slate-600">Clear</Link>
      </form>
      {revisionsResponse.error ? (
        <p role="alert" className="rounded-xl border border-rose-200 bg-white p-6 text-rose-800">Unable to load revision history. Confirm migrations 021 and 035 are installed and your account is an active Owner or Administrator.</p>
      ) : <>
        <p className="text-sm text-slate-600">Page {page} · {typeof total === "number" ? `${total} total logged changes` : "Recent logged changes"}{selectedType !== "all" ? " · Type filter applies to the current page" : ""}</p>
        {!shown.length && <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">No tracked changes match on this page. Older pages may contain more activity.</p>}
        <div className="space-y-4">{shown.map(event => {
          const fields = changes(event);
          return <article key={event.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-6 py-5">
              <div><p className="text-xs font-black uppercase tracking-wider text-[#861F41]">{event.operation === "INSERT" ? "Created" : event.operation === "DELETE" ? "Deleted" : "Updated"} · {DISPLAY[event.table_name] ?? event.table_name}</p>
                <p className="mt-2 text-xs text-slate-500">{new Date(event.occurred_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" })} ET</p>
              </div>
              <p className="text-sm font-semibold">{event.actor_user_id ? authorNames.get(event.actor_user_id) ?? "Former staff / unknown" : "System / SQL"}</p>
            </div>
            <div className="px-6 py-5">
              <p className="mb-3 break-all text-xs text-slate-500">Record ID: {event.record_id}</p>
              {fields.length ? <dl className="space-y-3">{fields.map(f => <div key={f.key} className="grid gap-2 rounded-lg bg-[#f8fafc] p-3 sm:grid-cols-[180px_1fr_1fr]">
                <dt className="text-sm font-bold">{FIELD_NAMES[f.key] ?? f.key.replaceAll("_", " ")}</dt>
                <dd className="min-w-0 wrap-break-word text-sm text-slate-500"><span className="block text-xs font-bold uppercase tracking-wider">Before</span>{renderValue(f.before)}</dd>
                <dd className="min-w-0 wrap-break-word text-sm text-[#002144]"><span className="block text-xs font-bold uppercase tracking-wider">After</span>{renderValue(f.after)}</dd>
              </div>)}</dl> : <p className="text-sm text-slate-600">No comparable tracked fields in this event.</p>}
            </div>
          </article>;
        })}</div>
        <nav aria-label="Revision history pages" className="flex items-center justify-between gap-4">
          {page > 1 ? <Link href={pageHref(id,page-1,selectedType)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-bold">← Newer</Link> : <span />}
          {hasNext ? <Link href={pageHref(id,page+1,selectedType)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-bold">Older →</Link> : <span />}
        </nav>
      </>}
      {staffResponse.error && <p className="text-xs text-amber-800">Staff names are unavailable; the revision log is unaffected.</p>}
      <p className="text-xs leading-6 text-slate-500">This is a field-level audit trail—not a database backup or an automatic undo tool. Only fields included in the original audit allowlist are shown. Changes made before migration 021, or on tables without its trigger, are not available.</p>
    </div>
  </main>;
}

export default function CompetitionHistoryPage(props: PageProps) {
  return <Suspense fallback={<main className="p-10 text-[#002144]">Loading competition revision history…</main>}><HistoryContent {...props} /></Suspense>;
}
