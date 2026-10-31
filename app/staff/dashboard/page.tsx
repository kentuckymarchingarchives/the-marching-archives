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
  { title: "Staff Profiles", detail: "Team directory and documented research contributions", href: "/staff/profiles", symbol: "SP" },
  { title: "Duplicate Detection", detail: "Review potential duplicate historical records", href: "/staff/duplicates", symbol: "DD" },
  {title: "Recently Added", detail: "Recent published records and verification activity", href: "/staff/recent", symbol: "RC",},
  {title: "Data Completeness", detail: "Find competition records missing documented results or sources", href: "/staff/completeness", symbol: "DC",},
];

const administrationTools: Shortcut[] = [
  { title: "Staff Management", detail: "Roles, account access, and staff status", href: "/staff/team", symbol: "TM" },
  { title: "Section Controls", detail: "Set public sections online or temporarily offline", href: "/staff/sections", symbol: "SC" },
  { title: "Activity & Audit Log", detail: "Review documented changes to archive records", href: "/staff/activity", symbol: "AL" },
];

function SectionHeading({ kicker, title, id, description }: { kicker: string; title: string; id: string; description?: string }) {
  return <div><p className="text-xs font-black uppercase tracking-[0.17em] text-[#861F41]">{kicker}</p><h2 id={id} className="mt-1 text-2xl font-black tracking-tight text-[#002144]">{title}</h2>{description && <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>}</div>;
}

function ToolCard({ item }: { item: Shortcut }) {
  return (
    <Link href={item.href} className="group flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#861F41]/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#861F41]">
      <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#002144]/[0.07] text-xs font-black text-[#002144]">{item.symbol}</span>
      <span className="min-w-0 flex-1"><span className="block font-bold text-[#002144]">{item.title}</span><span className="mt-1 block text-xs leading-5 text-slate-600">{item.detail}</span></span>
      <span aria-hidden="true" className="text-lg text-[#861F41] transition group-hover:translate-x-1">→</span>
    </Link>
  );
}

function Metric({ label, value, description, href, accent = false }: { label: string; value: number | null; description: string; href: string; accent?: boolean }) {
  return (
    <Link href={href} className={`rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${accent ? "border-[#861F41]/40 border-t-4 border-t-[#861F41]" : "border-slate-200 border-t-4 border-t-[#002144]"}`}>
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
    .from("staff_members").select("role, status, display_name, greeting_name").eq("user_id", userId).maybeSingle();
  if (staffError || staff?.status !== "active" || !["owner", "admin", "editor"].includes(staff.role)) {
    redirect("/staff/login?error=unauthorized");
  }

  const canPublish = staff.role === "owner" || staff.role === "admin";
  const preferredName = (staff.greeting_name?.trim() || staff.display_name?.trim().split(/\s+/)[0] || "there");
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
    <main className="min-h-screen bg-[#f6f8fb] text-[#002144]">
      {/* Personal workspace: designed to work with existing TMA shared header/footer. */}
      <section className="relative overflow-hidden bg-[#002144] text-white">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full border-52 border-white/[0.035]" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-52 right-1/4 h-80 w-80 rounded-full bg-[#861F41]/30 blur-3xl" />
        <div className="relative mx-auto max-w-330 px-5 py-10 sm:px-8 sm:py-14">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-2xl">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#e8afc2]">The Marching Archives / Staff workspace</p>
              <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">Hello, {preferredName}!</h1>
              <p className="mt-3 text-base leading-7 text-slate-200">Welcome back to your archive control center. Pick up your research, review incoming records, or manage the team.</p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-[#e8afc2]/40 bg-white/10 px-3 py-1.5 text-xs font-bold text-white">{roleLabel}</span>
                <Link href="/staff/profiles" className="text-sm font-bold text-[#e8afc2] underline-offset-4 hover:underline">View staff profiles →</Link>
              </div>
            </div>
            <form action={signOutStaff}>
              <button type="submit" className="rounded-xl border border-white/30 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Sign out</button>
            </form>
          </div>
          <div className="mt-8 flex flex-wrap gap-2">
            <Link href="/staff/competitions/new" className="rounded-xl bg-[#861F41] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#a22b52]">+ New competition</Link>
            <Link href="/staff/bands/new" className="rounded-xl border border-white/30 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10">+ New ensemble</Link>
            <Link href="/staff/research" className="rounded-xl border border-white/30 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10">Research assignments →</Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-330 space-y-10 px-5 py-9 sm:px-8 sm:py-12">
        <section aria-labelledby="archive-overview-heading">
          <SectionHeading kicker="At a glance" title="Archive overview" id="archive-overview-heading" description="Live totals from your existing archive." />
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Bands & Corps" value={bandCount.error ? null : bandCount.count} description="Documented ensembles" href="/staff/bands" />
            <Metric label="Competitions" value={competitionCount.error ? null : competitionCount.count} description="Active competition records" href="/staff/competitions" />
            <Metric label="Published" value={publishedCount.error ? null : publishedCount.count} description="Public competition records" href="/staff/competitions" />
            <Metric label="Not published" value={activeDrafts} description="Records being prepared" href="/staff/competitions" />
          </div>
        </section>

        <section aria-labelledby="attention-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SectionHeading kicker="Your priorities" title="Needs attention" id="attention-heading" description="Live queues—open the matching workspace to follow up." />
            <Link href="/staff/notifications" className="text-sm font-bold text-[#861F41] hover:underline">All notifications →</Link>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="My open tasks" value={tasksMine.error ? null : tasksMine.count} description="Assigned to you" href="/staff/research?mine=1" accent />
            <Metric label="Team open tasks" value={tasksOpen.error ? null : tasksOpen.count} description="Awaiting completion" href="/staff/research" />
            <Metric label="New corrections" value={corrections.error ? null : corrections.count} description="Visitor reports to review" href="/staff/corrections?status=new" />
            <Metric label="Unreviewed sources" value={sources.error ? null : sources.count} description="Citations awaiting review" href="/staff/quality" />
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <section aria-labelledby="recent-competitions-heading" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SectionHeading kicker="Competition records" title="Continue where you left off" id="recent-competitions-heading" description="Latest seasons in the archive (not last edit time)." />
              <Link href="/staff/competitions" className="text-sm font-bold text-[#861F41] hover:underline">All competitions →</Link>
            </div>
            {latestResponse.error ? <p role="alert" className="mt-5 text-sm text-red-700">Could not load competitions. Check your permissions and connection.</p> : latest.length === 0 ? <p className="mt-5 rounded-xl bg-slate-50 p-5 text-sm text-slate-600">No accessible competitions found. <Link className="font-bold text-[#861F41] underline" href="/staff/competitions/new">Create a competition</Link>.</p> : (
              <ul className="mt-5 divide-y divide-slate-100">
                {latest.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div className="min-w-0"><p className="font-bold leading-6 text-[#002144]">{item.name}</p><p className="mt-1 text-xs font-medium text-slate-500">{item.organization_code} · {item.season_year}</p><span className={`mt-2 inline-block rounded-full px-2.5 py-1 text-[11px] font-bold ${item.publication_status === "published" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>{item.publication_status === "published" ? "Published" : "Not published"}</span></div>
                  <div className="flex gap-2"><Link className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold transition hover:bg-slate-50" href={`/staff/competitions/${item.id}`}>Open</Link><Link className="rounded-lg bg-[#002144] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#12385b]" href={`/staff/competitions/${item.id}/review`}>Review</Link></div>
                </li>)}
              </ul>
            )}
          </section>
          <section aria-labelledby="research-heading" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3"><SectionHeading kicker="Team research" title="Active assignments" id="research-heading" /><Link href="/staff/research" className="text-sm font-bold text-[#861F41] hover:underline">All tasks →</Link></div>
            {recentTasks.error ? <p role="alert" className="mt-5 text-sm text-amber-800">Assignments unavailable. Check migration 022 and staff permissions.</p> : !recentTasks.data?.length ? <p className="mt-5 text-sm text-slate-500">There are no active assignments right now.</p> : <ul className="mt-4 divide-y divide-slate-100">{recentTasks.data.map(task => <li key={task.id} className="py-3"><div className="flex items-start justify-between gap-3"><p className="text-sm font-bold text-[#002144]">{task.title}</p><span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-bold capitalize text-slate-600">{task.priority}</span></div><p className="mt-1 text-xs text-slate-500">{task.status.replaceAll("_", " ")}{task.assigned_to === userId ? " · Assigned to you" : ""} · {task.due_date ?? "No due date"}</p></li>)}</ul>}
            <div className="mt-5 rounded-xl bg-[#f8f3f5] p-4 text-sm text-[#002144]"><span className="font-bold">Research tip:</span> Keep assignments updated so the whole team can see current progress.</div>
          </section>
        </div>

        <section aria-labelledby="record-tools-heading">
          <SectionHeading kicker="Manage the collection" title="Archive management" id="record-tools-heading" description="Your primary editing and publishing workspaces." />
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{recordTools.map(item => <ToolCard key={item.href} item={item} />)}</div>
        </section>

        <section aria-labelledby="review-tools-heading">
          <SectionHeading kicker="Research & integrity" title="Review tools" id="review-tools-heading" description="Verify sources, handle community feedback, and inspect coverage gaps." />
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{reviewTools.map(item => <ToolCard key={item.href} item={item} />)}</div>
        </section>

        {canPublish && <section aria-labelledby="team-heading">
          <div className="flex flex-wrap items-end justify-between gap-3"><SectionHeading kicker="Restricted workspace" title="Team & accountability" id="team-heading" description="Only authorized staff can access administrative records." /><span className="text-xs text-slate-500">Active staff: {teamCount.error || teamCount.count === null ? "Unavailable" : teamCount.count.toLocaleString()}</span></div>
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div className="grid gap-4 sm:grid-cols-2">{administrationTools.filter(item => staff.role === "owner" || !["/staff/team", "/staff/sections"].includes(item.href)).map(item => <ToolCard key={item.href} item={item} />)}</div>
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-base font-extrabold">Recent archive activity</h3><Link className="text-xs font-bold text-[#861F41] hover:underline" href="/staff/activity">View audit log →</Link></div>
              {auditEvents.error ? <p role="alert" className="mt-4 text-sm text-amber-800">Activity log unavailable. Check migration 021.</p> : !auditEvents.data?.length ? <p className="mt-4 text-sm text-slate-500">No recorded changes yet.</p> : <ul className="mt-3 divide-y divide-slate-100">{auditEvents.data.map(event => <li className="flex items-center justify-between gap-3 py-3" key={event.id}><div><p className="text-sm font-semibold capitalize">{event.table_name.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-slate-500">{event.operation}</p></div><span className="text-xs text-slate-500">{event.occurred_at.slice(0,10)}</span></li>)}</ul>}
            </section>
          </div>
        </section>}

        <section className="flex flex-wrap items-center justify-between gap-5 rounded-3xl bg-[#002144] p-6 text-white sm:p-8">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#e8afc2]">Public archive</p><h2 className="mt-2 text-xl font-black sm:text-2xl">See the archive as visitors do.</h2><p className="mt-2 text-sm text-slate-300">Review your published competition results and ensemble profiles.</p></div>
          <div className="flex flex-wrap gap-2"><Link href="/bands" className="rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-[#002144]">Bands & Corps</Link><Link href="/competitions" className="rounded-lg border border-white/40 px-4 py-2.5 text-sm font-bold">Competitions</Link><Link href="/power-rankings" className="rounded-lg border border-white/40 px-4 py-2.5 text-sm font-bold">Power Rankings</Link></div>
        </section>
        <p className="text-xs leading-5 text-slate-500">Dashboard counts are read from your Supabase database. Some shortcuts require their corresponding feature pages and migrations to be installed. Visible links do not replace the permissions enforced by those pages and server actions.</p>
      </div>
    </main>
  );
}

export default function StaffDashboardPage() {
  return <Suspense fallback={<main className="min-h-screen bg-[#f6f7f9] p-10"><p role="status">Loading staff dashboard...</p></main>}><DashboardContent /></Suspense>;
}
