import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";

type Props = { searchParams: Promise<{ year?: string }> };
const nowYear = new Date().getUTCFullYear();

async function SeasonDirectory({ searchParams }: Props) {
  const { year: yearInput } = await searchParams;
  const selected = typeof yearInput === "string" && /^\d{4}$/.test(yearInput)
    ? Number(yearInput) : null;
  const validYear = selected !== null && selected >= 1800 && selected <= nowYear + 1;

  const supabase = await createClient();
  // This is a recent-season discovery sample, not an exhaustive year index.
  const { data, error } = await supabase.from("competitions")
    .select("season_year")
    .eq("publication_status", "published")
    .is("archived_at", null)
    .order("season_year", { ascending: false })
    .limit(500);

  const years = [...new Set((data ?? []).map((entry) => entry.season_year))]
    .filter((year): year is number => typeof year === "number")
    .sort((a, b) => b - a);

  return (
    <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-xl font-bold text-[#002144]">Find a season</h2>
        <p className="mt-2 text-sm text-slate-600">Enter any year to explore its published competition records, even if it does not appear in the recent-season list.</p>
        <form method="get" action="/seasons" className="mt-5 flex flex-wrap items-end gap-3">
          <label className="flex-1 text-sm font-semibold text-[#002144]">Season year
            <input type="number" name="year" min="1800" max={nowYear + 1} defaultValue={validYear ? selected : ""} placeholder="e.g. 1986" required className="mt-2 block w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-[#861F41] focus:ring-2 focus:ring-[#861F41]/20" />
          </label>
          <button type="submit" className="rounded-lg bg-[#861F41] px-6 py-3 font-bold text-white hover:bg-[#6d1733]">Find year</button>
        </form>
        {selected !== null && !validYear && <p role="alert" className="mt-3 text-sm text-red-700">Enter a year between 1800 and {nowYear + 1}.</p>}
        {validYear && <Link href={`/seasons/${selected}`} className="mt-4 inline-flex font-semibold text-[#861F41] underline underline-offset-4">Explore {selected} results →</Link>}
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-extrabold text-[#002144]">Recently represented seasons</h2>
        <p className="mt-2 text-sm text-slate-600">Years appearing in the 500 most recent published competition records. Older years remain accessible through the year search above.</p>
        {error ? <p role="alert" className="mt-5 rounded-xl bg-red-50 p-5 text-red-800">The recent season list is unavailable. You can still search by year.</p> : years.length === 0 ? <p className="mt-6 rounded-xl border bg-white p-6 text-slate-600">No published competition seasons are available yet.</p> :
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            {years.map((year) => <Link key={year} href={`/seasons/${year}`} className="rounded-xl border border-slate-200 bg-white p-5 text-center text-xl font-extrabold text-[#002144] shadow-sm transition hover:border-[#861F41] hover:text-[#861F41]">{year} <span className="mt-2 block text-xs font-medium text-slate-500">Explore results →</span></Link>)}
          </div>}
      </section>
    </div>
  );
}

export default function SeasonsPage(props: Props) {
  return <main className="min-h-screen bg-[#f6f7f9]">
    <header className="bg-[#002144] px-5 py-14 text-white sm:px-8">
      <div className="mx-auto max-w-6xl"><nav className="mb-6 text-sm text-slate-300"><Link href="/" className="hover:text-white">Home</Link> / Seasons</nav><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#efb8ca]">Historical archive</p><h1 className="mt-3 text-4xl font-extrabold sm:text-5xl">Explore by Season</h1><p className="mt-4 max-w-2xl text-slate-200">Choose a year to discover the published competitions and results recorded for that season.</p></div>
    </header>
    <Suspense fallback={<p className="mx-auto max-w-6xl px-5 py-12">Loading seasons…</p>}><SeasonDirectory searchParams={props.searchParams} /></Suspense>
  </main>;
}
