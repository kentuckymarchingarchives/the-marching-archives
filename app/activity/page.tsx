import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Recent Archive Activity | The Marching Archives",
  description: "Explore recently published competitions, new ensemble profiles, and verified historical competition records.",
};

type ActivityType = "all" | "competition" | "band" | "verification";
type PageProps = { searchParams: Promise<{ type?: string }> };
type ActivityItem = {
  event_key: string;
  event_type: Exclude<ActivityType, "all">;
  title: string;
  description: string;
  event_at: string;
  destination: string;
  organization_code: string | null;
  season_year: number | null;
};

const filters: { value: ActivityType; label: string }[] = [
  { value: "all", label: "All activity" },
  { value: "competition", label: "Competitions" },
  { value: "band", label: "New ensembles" },
  { value: "verification", label: "Verified records" },
];
function validType(value: unknown): ActivityType {
  return filters.find((f) => f.value === value)?.value ?? "all";
}
function displayDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
  }).format(new Date(iso));
}

async function ActivityResults({ searchParams }: PageProps) {
  await connection();
  const search = await searchParams;
  const type = validType(search.type);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("tma_public_archive_activity", {
    p_limit: 50,
    p_type: type,
  });
  const items = (data ?? []) as ActivityItem[];

  return (
    <div className="mx-auto max-w-330 px-6 py-12 md:px-8 md:py-16">
      <nav aria-label="Activity filters" className="flex flex-wrap gap-2">
        {filters.map((filter) => (
          <Link
            key={filter.value}
            href={filter.value === "all" ? "/activity" : `/activity?type=${filter.value}`}
            aria-current={type === filter.value ? "page" : undefined}
            className={`rounded-full border px-4 py-2 text-sm font-bold transition ${type === filter.value ? "border-[#002144] bg-[#002144] text-white" : "border-slate-200 bg-white text-[#002144] hover:border-[#861F41]"}`}
          >{filter.label}</Link>
        ))}
      </nav>
      {error ? (
        <p role="alert" className="mt-10 rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">Unable to load archive activity right now. Please try again later.</p>
      ) : items.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <h2 className="text-xl font-extrabold">No activity recorded yet</h2>
          <p className="mt-3 text-sm text-slate-600">Activity will appear as records are added, published, and verified.</p>
        </div>
      ) : (
        <ol className="mt-10 space-y-4">
          {items.map((item) => (
            <li key={item.event_key} className="rounded-2xl border border-[#e0e5eb] bg-white p-6 shadow-sm sm:p-8">
              <article className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[.18em] text-[#861F41]">
                    {item.event_type === "competition" ? "Competition published" : item.event_type === "band" ? "Ensemble added" : "Competition verified"}
                  </p>
                  <h2 className="mt-3 text-xl font-extrabold leading-snug sm:text-2xl"><Link href={item.destination} className="hover:text-[#861F41] hover:underline">{item.title}</Link></h2>
                  <p className="mt-2 text-sm text-slate-600">{item.description}</p>
                  {item.season_year !== null && <p className="mt-2 text-xs font-semibold text-slate-500">{item.season_year} season</p>}
                </div>
                <time dateTime={item.event_at} className="shrink-0 text-xs font-semibold text-slate-500">{displayDate(item.event_at)}</time>
              </article>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-8 text-xs leading-6 text-slate-500">This feed displays the most recent 50 matching events. It reflects published and documented archive activity, not a complete edit history. Verification entries appear only while the underlying verification remains current.</p>
    </div>
  );
}

export default function ActivityPage({ searchParams }: PageProps) {
  return (
    <main className="min-h-[70vh] bg-[#f6f7f8] text-[#002144]">
      <header className="bg-[#002144] px-6 py-16 text-white md:px-8 md:py-20">
        <div className="mx-auto max-w-330">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#e8afc2]">The Marching Archives / Discover</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">Recent Archive Activity</h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-[#d2dce5]">Follow newly published results, added ensembles, and verified historical competitions as the archive grows.</p>
          <Link href="/updates" className="mt-5 inline-flex text-sm font-bold text-[#e8afc2] hover:underline">Looking for staff announcements? Visit News & Updates →</Link>
        </div>
      </header>
      <Suspense fallback={<p className="mx-auto max-w-330 px-6 py-12 text-slate-600">Loading archive activity…</p>}>
        <ActivityResults searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
