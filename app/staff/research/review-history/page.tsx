import Link from "next/link";
import { Suspense } from "react";
import {
  researchSession,
  personName,
  dateText,
  researchLinks,
  type ResearchEvent,
  type ResearchMember,
  type ResearchTask,
} from "@/lib/research-insights";

export const instant = false;

const PAGE_SIZE = 25;
const FILTERS = [
  ["all", "All events"],
  ["submitted", "Submitted"],
  ["approved", "Approved"],
  ["changes_requested", "Changes requested"],
  ["invalidated", "Invalidated"],
] as const;

type Props = {
  searchParams: Promise<{ kind?: string | string[]; page?: string | string[] }>;
};

function historyUrl(kind: string, page: number) {
  const query = new URLSearchParams();
  if (kind !== "all") query.set("kind", kind);
  if (page > 1) query.set("page", String(page));
  const suffix = query.toString();
  return `/staff/research/review-history${suffix ? `?${suffix}` : ""}`;
}

function pageNumber(value: string | string[] | undefined) {
  if (typeof value !== "string" || !/^[1-9]\d{0,5}$/.test(value)) return 1;
  const n = Number(value);
  return Number.isSafeInteger(n) ? n : 1;
}

async function ReviewHistoryContent({ searchParams }: Props) {
  const { db } = await researchSession();
  const params = await searchParams;
  const requestedKind = typeof params.kind === "string" ? params.kind : "all";
  const kind = FILTERS.some(([value]) => value === requestedKind) ? requestedKind : "all";
  const requestedPage = pageNumber(params.page);

  // Counting and filtering happen in Postgres, not after a truncated sample.
  let countQuery = db.from("research_approval_events")
    .select("id", { count: "exact", head: true });
  if (kind !== "all") countQuery = countQuery.eq("event", kind);
  const countResult = await countQuery;
  const total = countResult.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const start = (page - 1) * PAGE_SIZE;

  let eventsQuery = db.from("research_approval_events")
    .select("id,task_id,actor_id,event,note,occurred_at")
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .range(start, start + PAGE_SIZE - 1);
  if (kind !== "all") eventsQuery = eventsQuery.eq("event", kind);

  const [eventsResult, membersResult] = await Promise.all([
    eventsQuery,
    db.from("staff_members")
      .select("user_id,display_name,greeting_name,role,status")
      .limit(200),
  ]);
  const events = (eventsResult.data ?? []) as ResearchEvent[];
  const members = (membersResult.data ?? []) as ResearchMember[];
  const taskIds = [...new Set(events.map((event) => event.task_id))];
  const tasksResult = taskIds.length
    ? await db.from("research_assignments")
      .select("id,title,status,priority,assigned_to,created_by,competition_id,due_date,updated_at,completed_at")
      .in("id", taskIds)
    : null;
  const failed = Boolean(countResult.error || eventsResult.error || membersResult.error || tasksResult?.error);
  const tasks = (tasksResult?.data ?? []) as ResearchTask[];
  const titles = new Map(tasks.map((task) => [task.id, task.title]));

  return (
    <main className="min-h-screen bg-[#f6f7f8] text-[#002144]">
      <header className="bg-[#002144] px-6 py-12 text-white">
        <div className="mx-auto max-w-6xl">
          <Link href="/staff/dashboard" className="text-sm font-semibold text-[#e8afc2] hover:underline">
            ← Staff Dashboard
          </Link>
          <p className="mt-6 text-xs font-black uppercase tracking-widest text-[#e8afc2]">
            Research accountability
          </p>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">Approval Decision History</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200">
            Follow recorded submissions, approvals, changes requested, and invalidated reviews.
          </p>
        </div>
      </header>
      <div className="mx-auto max-w-6xl space-y-7 px-6 py-9">
        <nav className="flex flex-wrap gap-2" aria-label="Research pages">
          {researchLinks.map((link) => (
            <Link key={link.href} href={link.href}
              aria-current={link.href.endsWith("/review-history") ? "page" : undefined}
              className={`rounded-lg px-3 py-2 text-sm font-bold ${link.href.endsWith("/review-history") ? "bg-[#861F41] text-white" : "border border-slate-200 bg-white"}`}>
              {link.label}
            </Link>
          ))}
        </nav>
        {failed && (
          <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
            Review history could not be loaded. Confirm migration 036 and staff permissions.
          </p>
        )}
        <nav aria-label="Filter review events" className="flex flex-wrap gap-2">
          {FILTERS.map(([value, label]) => (
            <Link key={value} href={historyUrl(value, 1)}
              aria-current={kind === value ? "page" : undefined}
              className={`rounded-full px-4 py-2 text-sm font-bold ${kind === value ? "bg-[#002144] text-white" : "border border-slate-300 bg-white"}`}>
              {label}
            </Link>
          ))}
        </nav>
        {!failed && (
          <p className="text-sm text-slate-600" role="status">
            {total === 0
              ? "No recorded events match this filter."
              : `Showing ${start + 1}–${Math.min(start + PAGE_SIZE, total)} of ${total} matching events · Page ${page} of ${totalPages}`}
          </p>
        )}
        {!failed && events.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            No matching research review events yet.
          </p>
        )}
        {!failed && (
          <section className="space-y-3" aria-label="Research review events">
            {events.map((event) => (
              <article key={event.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-[#861F41]">
                      {event.event.replaceAll("_", " ")}
                    </p>
                    <h2 className="mt-2 text-lg font-bold">
                      {titles.get(event.task_id) || "Research assignment"}
                    </h2>
                  </div>
                  <span className="text-sm text-slate-600">{dateText(event.occurred_at)}</span>
                </div>
                <p className="mt-2 text-sm text-slate-600">By {personName(event.actor_id, members)}</p>
                {event.note && (
                  <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm leading-6">
                    {event.note}
                  </p>
                )}
                <Link href="/staff/research/approvals"
                  className="mt-3 inline-block text-sm font-bold text-[#861F41] hover:underline">
                  Open research approvals →
                </Link>
              </article>
            ))}
          </section>
        )}
        {!failed && totalPages > 1 && (
          <nav aria-label="Review history pages" className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-5">
            {page > 1 ? (
              <Link href={historyUrl(kind, page - 1)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold hover:bg-slate-50">
                ← Previous page
              </Link>
            ) : <span className="text-sm text-slate-400">First page</span>}
            <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
            {page < totalPages ? (
              <Link href={historyUrl(kind, page + 1)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold hover:bg-slate-50">
                Next page →
              </Link>
            ) : <span className="text-sm text-slate-400">Last page</span>}
          </nav>
        )}
      </div>
    </main>
  );
}

export default function ReviewHistoryPage(props: Props) {
  return (
    <Suspense fallback={<main className="p-8">Loading review history…</main>}>
      <ReviewHistoryContent {...props} />
    </Suspense>
  );
}
