import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Recently Added | TMA Staff",
  robots: { index: false, follow: false },
};

type Category = "all" | "competition" | "band" | "verification";
type PageProps = { searchParams: Promise<{ type?: string }> };
type ActivityEvent = {
  event_key: string;
  event_type: "competition" | "band" | "verification";
  title: string;
  description: string;
  event_at: string;
  destination: string;
  organization_code: string | null;
  season_year: number | null;
};
const categories: { key: Category; label: string }[] = [
  { key: "all", label: "All activity" },
  { key: "competition", label: "Published competitions" },
  { key: "band", label: "New ensembles" },
  { key: "verification", label: "Verified records" },
];
const titleFor = (type: ActivityEvent["event_type"]) => ({
  competition: "Competition published",
  band: "Ensemble added",
  verification: "Results verified",
})[type];
function formattedDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  }).format(new Date(value));
}
function card(label: string, number: number | null, sub: string) {
  return <div className="rounded-2xl border border-slate-200 border-t-4 border-t-[#861F41] bg-white p-5 shadow-sm">
    <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">{label}</p>
    <p className="mt-2 text-3xl font-black tabular-nums text-[#002144]">{number === null ? "—" : number.toLocaleString()}</p>
    <p className="mt-1 text-xs text-slate-500">{sub}</p>
  </div>;
}

async function RecentArchiveContent({ searchParams }: PageProps) {
  await connection();
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  if (authError || !auth?.claims?.sub) redirect("/staff/login");
  const { data: member, error: memberError } = await supabase.from("staff_members")
    .select("role,status").eq("user_id", auth.claims.sub).maybeSingle();
  if (memberError || !member || member.status !== "active" ||
      !["owner", "admin", "editor"].includes(member.role)) {
    redirect("/staff/login?error=unauthorized");
  }

  const query = await searchParams;
  const category: Category = categories.some(c => c.key === query.type)
    ? query.type as Category : "all";

  // Only publicly publishable events appear in the public activity RPC.
  // It checks publication status and current verification fingerprints.
  const [activity, unpublished] = await Promise.all([
    supabase.rpc("tma_public_archive_activity", { p_type: category, p_limit: 50 }),
    supabase.from("competitions").select("id", { count: "exact", head: true })
      .is("archived_at", null).neq("publication_status", "published"),
  ]);
  const events: ActivityEvent[] = activity.error ? [] : (activity.data ?? []) as ActivityEvent[];
  const counts = {
    competition: events.filter(e => e.event_type === "competition").length,
    band: events.filter(e => e.event_type === "band").length,
    verification: events.filter(e => e.event_type === "verification").length,
  };
  const isAll = category === "all";

  return <main className="min-h-screen bg-[#f6f7f8] text-[#002144]">
    <header className="bg-[#002144] px-6 py-12 text-white md:px-8 md:py-16">
      <div className="mx-auto max-w-330">
        <p className="text-xs font-black uppercase tracking-[.2em] text-[#e8afc2]">The Marching Archives / Staff</p>
        <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">Recently Added Archive</h1>
        <p className="mt-4 max-w-2xl leading-7 text-[#d2dce5]">Review newly published competition records, recently added ensembles, and currently valid verification activity.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/staff/dashboard" className="rounded-lg border border-white/40 px-4 py-2 text-sm font-bold hover:bg-white/10">← Staff Dashboard</Link>
          <Link href="/activity" className="rounded-lg bg-[#861F41] px-4 py-2 text-sm font-bold text-white hover:bg-[#9b2850]">View Public Feed ↗</Link>
        </div>
      </div>
    </header>
    <div className="mx-auto max-w-330 space-y-8 px-6 py-10 md:px-8">
      <section aria-labelledby="summary-heading">
        <h2 id="summary-heading" className="text-2xl font-black">Archive activity overview</h2>
        <p className="mt-1 text-sm text-slate-600">{isAll ? "Counts below reflect the 50 most recent public events, not lifetime totals." : "Choose All activity to see a cross-category snapshot of the most recent 50 events."}</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {card("Published", isAll && !activity.error ? counts.competition : null, "Within recent feed sample")}
          {card("New ensembles", isAll && !activity.error ? counts.band : null, "Within recent feed sample")}
          {card("Verifications", isAll && !activity.error ? counts.verification : null, "Within recent feed sample")}
          {card("Not published", unpublished.error ? null : unpublished.count, "Active competition drafts")}
        </div>
      </section>
      <section aria-labelledby="activity-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h2 id="activity-heading" className="text-2xl font-black">Latest activity</h2><p className="mt-1 text-sm text-slate-600">Select a category to examine its latest 50 entries.</p></div>
          <Link href="/staff/competitions" className="text-sm font-bold text-[#861F41] hover:underline">Manage competitions →</Link>
        </div>
        <nav aria-label="Archive activity categories" className="mt-5 flex flex-wrap gap-2">
          {categories.map(c => <Link key={c.key}
            href={c.key === "all" ? "/staff/recent" : `/staff/recent?type=${c.key}`}
            aria-current={category === c.key ? "page" : undefined}
            className={`rounded-full border px-4 py-2 text-sm font-bold transition ${category === c.key ? "border-[#002144] bg-[#002144] text-white" : "border-slate-200 bg-white hover:border-[#861F41]"}`}>
            {c.label}</Link>)}
        </nav>
        {activity.error ? <div role="alert" className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          Unable to load activity. Confirm Supabase migration 031 is installed and the public activity function can be called by authenticated users.
        </div> : events.length === 0 ? <div className="mt-6 rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-600">No documented activity in this category yet.</div> :
          <ol className="mt-6 space-y-3">{events.map(event => <li key={event.event_key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black uppercase tracking-wider text-[#861F41]">{titleFor(event.event_type)}</p>
                <h3 className="mt-2 text-lg font-extrabold"><Link href={event.destination} className="hover:text-[#861F41] hover:underline">{event.title}</Link></h3>
                <p className="mt-1 text-sm text-slate-600">{event.description}</p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold text-slate-500">
                  {event.organization_code && <span>{event.organization_code}</span>}
                  {event.season_year !== null && <span>Season {event.season_year}</span>}
                </div>
              </div>
              <time className="shrink-0 text-xs font-semibold text-slate-500" dateTime={event.event_at}>{formattedDate(event.event_at)}</time>
            </div>
          </li>)}</ol>}
      </section>
      <p className="text-xs leading-6 text-slate-500">This page displays published archive events, not the complete staff audit trail. Unpublished competitions are counted but never listed as public activity. The event feed is limited to 50 per filter. Verification entries appear only while their supporting results and sources remain unchanged.</p>
    </div>
  </main>;
}

export default function StaffRecentArchivePage(props: PageProps) {
  return <Suspense fallback={<main className="min-h-screen bg-[#f6f7f8] p-10"><p role="status">Loading recent archive activity…</p></main>}><RecentArchiveContent {...props} /></Suspense>;
}
