import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

type ActivityItem = {
  event_key: string;
  event_type: "competition" | "band" | "verification";
  title: string;
  description: string;
  event_at: string;
  destination: string;
  organization_code: string | null;
  season_year: number | null;
};

const category: Record<ActivityItem["event_type"], string> = {
  competition: "Published results",
  band: "New ensemble",
  verification: "Verified history",
};

function displayDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  }).format(new Date(iso));
}

async function RecentActivity() {
  // Next.js 16 Cache Components: read request-time data after connection().
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("tma_public_archive_activity", {
    p_limit: 6,
    p_type: "all",
  });
  const items = (data ?? []) as ActivityItem[];
  if (error) return null;

  return (
    <section aria-labelledby="recent-archive-activity" className="bg-[#f6f7f8] py-16 text-[#002144]">
      <div className="mx-auto max-w-330 px-6 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-[#861F41]">Automatically updated</p>
            <h2 id="recent-archive-activity" className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Recently added to the archive</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">Newly published competitions, added ensembles, and verified records.</p>
          </div>
          <Link href="/activity" className="text-sm font-extrabold text-[#861F41] hover:underline">View all activity →</Link>
        </div>
        {items.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-7">
            <p className="font-bold">More history is on the way.</p>
            <p className="mt-2 text-sm text-slate-600">Newly published records and additions will appear here. In the meantime, explore the existing archive.</p>
            <Link href="/competitions" className="mt-4 inline-flex text-sm font-bold text-[#861F41] hover:underline">Browse competitions →</Link>
          </div>
        ) : null}
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <article key={item.event_key} className={`rounded-2xl border bg-white p-6 shadow-sm ${item.event_type === "competition" ? "border-[#861F41]/30" : item.event_type === "verification" ? "border-emerald-300" : "border-[#e0e5eb]"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider ${item.event_type === "verification" ? "bg-emerald-50 text-emerald-800" : item.event_type === "competition" ? "bg-[#861F41]/10 text-[#861F41]" : "bg-slate-100 text-[#002144]"}`}>{category[item.event_type]}</span>
                <time dateTime={item.event_at} className="text-xs text-slate-500">{displayDate(item.event_at)}</time>
              </div>
              <h3 className="mt-4 text-lg font-extrabold leading-snug"><Link className="hover:text-[#861F41]" href={item.destination}>{item.title}</Link></h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function LatestArchiveActivity() {
  return <Suspense fallback={null}><RecentActivity /></Suspense>;
}
