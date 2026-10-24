
import { Suspense } from "react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import BandStatusBadge from "@/components/BandStatusBadge";

type Props = {
  searchParams: Promise<{
    q?: string;
    type?: string;
  }>;
};

async function BandDirectory({
  searchParams,
}: Props) {
  const params = await searchParams;

  const search = (params.q ?? "")
    .trim()
    .slice(0, 100);

  const type =
    params.type === "marching_band" ||
    params.type === "drum_corps"
      ? params.type
      : "all";

  const supabase = await createClient();

  let query = supabase
    .from("bands")
    .select(
      "id, slug, name, kind, city, state, country, competitive_status"
    )
    .order("name", { ascending: true })
    .limit(100);

  if (search) {
    query = query.ilike(
      "name",
      `%${search.replace(/[%_\\]/g, "\\$&")}%`
    );
  }

  if (type !== "all") {
    query = query.eq("kind", type);
  }

  const { data: bands, error } = await query;

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <form
        method="get"
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="grid gap-4 md:grid-cols-[1fr_220px_auto] md:items-end">
          <label className="block">
            <span className="text-sm font-bold text-[#002144]">
              Search Ensembles
            </span>

            <input
              name="q"
              type="search"
              defaultValue={search}
              placeholder="Search by band or corps name..."
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-[#002144] focus:border-[#861F41] focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="text-sm font-bold text-[#002144]">
              Ensemble Type
            </span>

            <select
              name="type"
              defaultValue={type}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-[#002144]"
            >
              <option value="all">All Ensembles</option>
              <option value="marching_band">
                Marching Bands
              </option>
              <option value="drum_corps">
                Drum Corps
              </option>
            </select>
          </label>

          <button
            type="submit"
            className="rounded-lg bg-[#861F41] px-7 py-3 text-sm font-bold text-white hover:bg-[#A02B52]"
          >
            Search
          </button>
        </div>
      </form>

      <div className="mb-5 mt-10 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-[#002144]">
          {search ? "Search Results" : "Archive Directory"}
        </h2>

        {!error && (
          <span className="text-sm text-slate-500">
            {bands?.length ?? 0} records displayed
          </span>
        )}
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800"
        >
          Unable to load the band directory.
          Please try again.
        </div>
      ) : bands?.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {bands.map((band) => (
            <Link
              key={band.id}
              href={`/bands/${band.slug}`}
              className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-[#861F41] hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
                    {band.kind === "drum_corps"
                      ? "Drum Corps"
                      : band.kind === "marching_band"
                        ? "Marching Band"
                        : "Other Ensemble"}
                  </span>

                  <h3 className="mt-2 text-xl font-bold text-[#002144] group-hover:text-[#861F41]">
                    {band.name}
                  </h3>

                  <p className="mt-3 text-sm text-slate-500">
                    {[
                      band.city,
                      band.state,
                      band.country,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </div>

                <span
                  aria-hidden="true"
                  className="text-lg text-[#861F41]"
                >
                  →
                </span>
              </div>

              <div className="mt-5">
                <BandStatusBadge
                  status={band.competitive_status}
                />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <h3 className="text-xl font-bold text-[#002144]">
            No ensembles found
          </h3>

          <p className="mt-3 text-sm text-slate-600">
            {search || type !== "all"
              ? "Try adjusting your search or filters."
              : "The archive does not have any band records yet."}
          </p>

          {(search || type !== "all") && (
            <Link
              href="/bands"
              className="mt-5 inline-block text-sm font-bold text-[#861F41]"
            >
              Clear Filters
            </Link>
          )}
        </div>
      )}

      <p className="mt-6 text-xs text-slate-500">
        Showing up to 100 matching records.
      </p>
    </div>
  );
}

export default function BandsPage(props: Props) {
  return (
    <main className="min-h-screen bg-[#F4F6F9]">
      <section className="bg-[#002144] px-6 py-16 text-white">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#E0B4C2]">
            Explore the Archive
          </p>

          <h1 className="mt-4 font-serif text-4xl font-bold md:text-5xl">
            Bands & Drum Corps
          </h1>

          <p className="mt-5 max-w-2xl leading-7 text-slate-300">
            Discover marching bands and drum corps
            documented in The Marching Archives.
            Search for an ensemble to explore
            its profile and historical records.
          </p>
        </div>
      </section>

      <Suspense
        fallback={
          <div className="mx-auto max-w-7xl px-6 py-12">
            <div
              role="status"
              className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600"
            >
              Loading band directory...
            </div>
          </div>
        }
      >
        <BandDirectory
          searchParams={props.searchParams}
        />
      </Suspense>
    </main>
  );
}
