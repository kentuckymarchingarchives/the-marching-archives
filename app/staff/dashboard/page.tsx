import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOutStaff } from "@/app/staff/actions";

export const instant = false;

type Shortcut = { title: string; detail: string; href: string; symbol: string };

const recordTools: Shortcut[] = [
  { title: "Bands & Corps", detail: "Profiles, logos, and historical names", href: "/staff/bands", symbol: "BC" },
  { title: "Competitions", detail: "Events, rounds, scores, and publishing", href: "/staff/competitions", symbol: "CP" },
  { title: "Power Rankings", detail: "Enter KMEA and BOA rankings by edition", href: "/staff/power-rankings", symbol: "PR" },
  { title: "Document Library", detail: "Catalog historical documents and citations", href: "/staff/documents", symbol: "DL" },
];
const reviewTools: Shortcut[] = [
  { title: "Archive Quality", detail: "Identify missing or unreviewed sources", href: "/staff/quality", symbol: "AQ" },
  { title: "Data Coverage", detail: "Track documented seasons and organizations", href: "/staff/coverage", symbol: "DC" },
  { title: "Corrections", detail: "Review community-submitted corrections", href: "/staff/corrections", symbol: "CR" },
  { title: "Notifications", detail: "Corrections, sources, and unpublished records", href: "/staff/notifications", symbol: "NT" },
  { title: "Research Assignments", detail: "Team tasks, priority, and progress", href: "/staff/research", symbol: "RA" },
  { title: "Duplicate Detection", detail: "Review potential duplicate historical records", href: "/staff/duplicates", symbol: "DD" },
];

const administrationTools: Shortcut[] = [
  { title: "Staff Management", detail: "Roles, account access, and staff status", href: "/staff/team", symbol: "TM" },
  { title: "Activity & Audit Log", detail: "Review documented changes to archive records", href: "/staff/activity", symbol: "AL" },
];

function ToolCard({ item }: { item: Shortcut }) {
  return (
    <Link href={item.href} className="group flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-[#861F41]/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#861F41]">
      <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#002144]/[0.07] text-xs font-black text-[#002144]">{item.symbol}</span>
      <span className="min-w-0 flex-1"><span className="block font-bold text-[#002144]">{item.title}</span><span className="mt-1 block text-xs leading-5 text-slate-600">{item.detail}</span></span>
      <span aria-hidden="true" className="text-lg text-[#861F41] transition group-hover:translate-x-1">→</span>
    </Link>
  );
}

function Metric({ label, value, description, href }: { label: string; value: number | null; description: string; href: string }) {
  return (
    <Link href={href} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#861F41]/40 hover:shadow-md">
      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</span>
      <span className="mt-2 block text-3xl font-extrabold tabular-nums text-[#002144]">{value === null ? "—" : value.toLocaleString()}</span>
      <span className="mt-1 block text-xs text-slate-500">{value === null ? "Count currently unavailable" : description}</span>
    </Link>
  );
}

async function DashboardContent() {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (authError || !userId) redirect("/staff/login");

  const { data: staff, error: staffError } = await supabase
    .from("staff_members").select("role, status").eq("user_id", userId).maybeSingle();
  if (staffError || staff?.status !== "active" || !["owner", "admin", "editor"].includes(staff.role)) {
    redirect("/staff/login?error=unauthorized");
  }

  const canPublish = staff.role === "owner" || staff.role === "admin";
  const roleLabel = staff.role === "owner" ? "Owner" : staff.role === "admin" ? "Administrator" : "Editor";

  const [bandCount, competitionCount, publishedCount, draftCount, latestResponse, tasksOpen, tasksMine, corrections, sources, teamCount, auditEvents, recentTasks] = await Promise.all([
    supabase.from("bands").select("id", { count: "exact", head: true }),
    supabase.from("competitions").select("id", { count: "exact", head: true }).is("archived_at", null),
    supabase.from("competitions").select("id", { count: "exact", head: true }).is("archived_at", null).eq("publication_status", "published"),
    supabase.from("competitions").select("id", { count: "exact", head: true }).is("archived_at", null).neq("publication_status", "published"),
    supabase.from("competitions")
      .select("id, name, organization_code, season_year, publication_status")
      .is("archived_at", null).order("season_year", { ascending: false })
      .order("name", { ascending: true }).limit(6),
    supabase.from("research_assignments").select("id", { count: "exact", head: true }).neq("status", "completed"),
    supabase.from("research_assignments").select("id", { count: "exact", head: true }).eq("assigned_to", userId).neq("status", "completed"),
    supabase.from("archive_correction_submissions").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabase.from("competition_sources").select("id", { count: "exact", head: true }).is("reviewed_at", null),
    canPublish ? supabase.from("staff_members").select("user_id", { count: "exact", head: true }).eq("status", "active") : Promise.resolve({count:null,error:null}),
    canPublish ? supabase.from("archive_audit_events").select("id,table_name,operation,occurred_at").order("occurred_at", { ascending: false }).limit(5) : Promise.resolve({data:[],error:null}),
    supabase.from("research_assignments").select("id,title,status,priority,due_date,assigned_to").neq("status", "completed").order("updated_at", { ascending: false }).limit(5),
  ]);

  const latest = latestResponse.data ?? [];
  const activeDrafts = draftCount.error ? null : (draftCount.count ?? null);

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-[#002144]">
      <section className="bg-[#002144] text-white">
        <div className="mx-auto max-w-7xl px-5 py-9 sm:px-8 sm:py-12">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#efbbce]">The Marching Archives / Staff workspace</p>
              <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Archive control center</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-200">Manage records, continue historical research, and review work that needs attention—all in one place.</p>
              <p className="mt-4 text-xs text-slate-300"><span className="rounded-full border border-white/25 px-3 py-1 font-bold text-white">{roleLabel}</span><span className="ml-2">Active staff account</span></p>
            </div>
            <form action={signOutStaff}><button className="rounded-lg border border-white/30 px-4 py-2 text-sm font-semibold hover:bg-white/10" type="submit">Sign out</button></form>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-8 px-5 py-8 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-extrabold">Archive overview</h2>
          <div className="flex flex-wrap gap-2">
            <Link className="rounded-lg bg-[#002144] px-4 py-2 text-sm font-bold text-white hover:bg-[#123b63]" href="/staff/competitions/new">+ New competition</Link>
            <Link className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold hover:bg-slate-50" href="/staff/bands/new">+ New ensemble</Link>
          </div>
        </div>
        <section aria-label="Archive totals" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Bands & Corps" value={bandCount.error ? null : bandCount.count} description="Ensembles in the database" href="/staff/bands" />
          <Metric label="Active competitions" value={competitionCount.error ? null : competitionCount.count} description="Non-archived competitions" href="/staff/competitions" />
          <Metric label="Published competitions" value={publishedCount.error ? null : publishedCount.count} description="Visible in the public archive" href="/staff/competitions" />
          <Metric label="Not yet published" value={activeDrafts} description="Records to finish or review" href="/staff/competitions" />
        </section>

        <section aria-label="Work requiring attention" className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">Live work queues</p><h2 className="mt-1 text-xl font-extrabold">What needs attention</h2></div>
            <Link href="/staff/notifications" className="text-sm font-bold text-[#861F41] hover:underline">Full attention center →</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="My open tasks" value={tasksMine.error ? null : tasksMine.count} description="Assignments waiting on you" href="/staff/research?mine=1" />
            <Metric label="Team open tasks" value={tasksOpen.error ? null : tasksOpen.count} description="Tasks not yet completed" href="/staff/research" />
            <Metric label="New corrections" value={corrections.error ? null : corrections.count} description="Community submissions to review" href="/staff/corrections?status=new" />
            <Metric label="Unreviewed sources" value={sources.error ? null : sources.count} description="Source citations awaiting review" href="/staff/quality" />
          </div>
        </section>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">Continue working</p><h2 className="mt-1 text-xl font-extrabold">Competitions to open</h2></div><Link href="/staff/competitions" className="text-sm font-bold text-[#861F41] hover:underline">View all →</Link></div>
            <p className="mt-2 text-xs text-slate-500">Showing up to six competitions by season, not most recently edited.</p>
            {latestResponse.error ? <p role="alert" className="mt-5 text-sm text-red-700">Could not load competitions. Please check the database connection and staff permissions.</p> : latest.length === 0 ? (
              <p className="mt-5 rounded-xl bg-slate-50 p-5 text-sm text-slate-600">No accessible competitions were found. <Link href="/staff/competitions/new" className="font-bold text-[#861F41] underline">Create one</Link> to begin.</p>
            ) : (
              <div className="mt-4 divide-y divide-slate-100">
                {latest.map((item) => (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div className="min-w-0"><p className="font-bold">{item.name}</p><p className="mt-1 text-xs text-slate-500">{item.organization_code} · {item.season_year}</p><span className={`mt-2 inline-block rounded-full px-2.5 py-1 text-[11px] font-bold ${item.publication_status === "published" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>{item.publication_status === "published" ? "Published" : "Not published"}</span></div>
                    <div className="flex flex-wrap gap-2"><Link href={`/staff/competitions/${item.id}`} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold hover:bg-slate-50">Open</Link><Link href={`/staff/competitions/${item.id}/review`} className="rounded-lg bg-[#002144] px-3 py-2 text-xs font-bold text-white">Review</Link></div>
                  </div>
                ))}
              </div>
            )}
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">Needs attention</p>
            <h2 className="mt-1 text-xl font-extrabold">Research & review</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Move quickly to the review tools. These are shortcuts, not outstanding-task counts.</p>
            <div className="mt-5 space-y-3">
              <Link href="/staff/quality" className="flex items-center justify-between rounded-xl bg-slate-50 p-4 text-sm font-bold hover:bg-slate-100">Source & verification quality <span>→</span></Link>
              <Link href="/staff/corrections" className="flex items-center justify-between rounded-xl bg-slate-50 p-4 text-sm font-bold hover:bg-slate-100">Community correction submissions <span>→</span></Link>
              <Link href="/staff/coverage" className="flex items-center justify-between rounded-xl bg-slate-50 p-4 text-sm font-bold hover:bg-slate-100">Historical coverage gaps <span>→</span></Link>
              {canPublish && <Link href="/staff/archive" className="flex items-center justify-between rounded-xl bg-slate-50 p-4 text-sm font-bold hover:bg-slate-100">Archived records <span>→</span></Link>}
            </div>
          </section>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">Research workspace</p><h2 className="mt-1 text-xl font-extrabold">Active assignments</h2></div><Link href="/staff/research" className="text-sm font-bold text-[#861F41] hover:underline">All tasks →</Link></div>
            {recentTasks.error ? <p className="mt-4 text-sm text-amber-800">Research assignments are unavailable. Confirm migration 022 and staff permissions.</p> : !recentTasks.data?.length ? <p className="mt-4 text-sm text-slate-500">No active research assignments.</p> : <ul className="mt-3 divide-y divide-slate-100">{recentTasks.data.map(task => <li key={task.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{task.title}</p><p className="mt-1 text-xs text-slate-500">{task.status.replaceAll("_", " ")} · {task.priority}{task.assigned_to === userId ? " · Assigned to you" : ""}</p></div><span className="shrink-0 text-xs text-slate-500">{task.due_date ?? "No due date"}</span></li>)}</ul>}
          </section>
          {canPublish ? <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">Owner / Administrator</p><h2 className="mt-1 text-xl font-extrabold">Recent archive changes</h2></div><Link href="/staff/activity" className="text-sm font-bold text-[#861F41] hover:underline">Audit log →</Link></div>
            {auditEvents.error ? <p className="mt-4 text-sm text-amber-800">Audit events are unavailable. Confirm migration 021.</p> : !auditEvents.data?.length ? <p className="mt-4 text-sm text-slate-500">No recorded changes yet.</p> : <ul className="mt-3 divide-y divide-slate-100">{auditEvents.data.map(event => <li key={event.id} className="flex items-center justify-between gap-3 py-3"><div><p className="text-sm font-semibold">{event.table_name.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-slate-500">{event.operation}</p></div><time className="text-xs text-slate-500" dateTime={event.occurred_at}>{new Date(event.occurred_at).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</time></li>)}</ul>}
          </section> : <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"><h2 className="text-xl font-extrabold">Your research workflow</h2><p className="mt-2 text-sm leading-6 text-slate-600">Open Research Assignments to continue assigned tasks and update progress.</p><Link href="/staff/research?mine=1" className="mt-4 inline-flex rounded-lg bg-[#002144] px-4 py-2 text-sm font-bold text-white">View my tasks →</Link></section>}
        </div>
        {canPublish && <section className="space-y-3"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">Restricted administration</p><h2 className="mt-1 text-xl font-extrabold">Team & accountability</h2></div><p className="text-xs text-slate-500">Active staff: {teamCount.error || teamCount.count === null ? "Unavailable" : teamCount.count.toLocaleString()}</p></div><div className="grid gap-3 md:grid-cols-2">{administrationTools.filter(tool => staff.role === "owner" || tool.href !== "/staff/team").map(tool => <ToolCard key={tool.href} item={tool} />)}</div></section>}
        <section>
          <div className="mb-4"><p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">Record management</p><h2 className="mt-1 text-2xl font-extrabold">Your archive tools</h2><p className="mt-2 text-sm text-slate-600">Open a dedicated workspace without scrolling through repeated controls.</p></div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{recordTools.map((tool) => <ToolCard item={tool} key={tool.href} />)}</div>
        </section>
        <section>
          <h2 className="mb-4 text-xl font-extrabold">Review & research tools</h2>
          <div className="grid gap-3 md:grid-cols-3">{reviewTools.map((tool) => <ToolCard item={tool} key={tool.href} />)}</div>
        </section>
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#002144] p-6 text-white sm:p-7">
          <div><h2 className="text-xl font-extrabold">Preview the public archive</h2><p className="mt-1 text-sm text-slate-300">Check what visitors can see after updating records.</p></div>
          <div className="flex flex-wrap gap-2"><Link href="/bands" className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-[#002144]">Bands & Corps</Link><Link href="/competitions" className="rounded-lg border border-white/40 px-4 py-2 text-sm font-bold">Competitions</Link><Link href="/power-rankings" className="rounded-lg border border-white/40 px-4 py-2 text-sm font-bold">Power Rankings</Link></div>
        </section>
        {staff.role === "owner" && <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"><p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">Infrastructure</p><h2 className="mt-1 text-xl font-extrabold">Backup & recovery</h2><p className="mt-2 text-sm text-slate-600">Run and check encrypted backups under your GitHub repository’s Actions tab. Backups are not activated merely by installing this dashboard; configure Phase 6 secrets and verify a successful test first.</p><p className="mt-3 text-xs text-slate-500">Guide in the repository: <code>docs/BACKUP-AND-RESTORE.md</code></p></section>}
        <p className="text-xs leading-5 text-slate-500">Some tools (Power Rankings, Corrections, Documents, Quality, Coverage) require their separate feature installations and database migrations. A link may lead to a 404 until that feature has been deployed. All permissions continue to be enforced by the linked pages and server actions.</p>
      </div>
    </main>
  );
}

export default function StaffDashboardPage() {
  return <Suspense fallback={<main className="min-h-screen bg-[#f6f7f9] p-10"><p role="status">Loading staff dashboard...</p></main>}><DashboardContent /></Suspense>;
}
