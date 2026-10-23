
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type Props = {
  searchParams: Promise<{ q?: string }>;
};

export default async function BandsPage({
  searchParams,
}: Props) {
  const { q = "" } = await searchParams;
  const search = q.trim().slice(0, 100);

  const supabase = await createClient();

  let query = supabase
    .from("bands")
    .select("id, name, kind, city, state, country")
    .order("name")
    .limit(100);

  if (search) {
    query = query.ilike(
      "name",
      `%${search.replace(/[%_\\]/g, "\\$&")}%`
    );
  }

  const { data: bands, error } = await query;

  return (
    <main className="min-h-screen bg-[#F4F6F9]">
      <header className="bg-[#002144] px-6 py-16 text-white">
        <div className="mx-auto max-w-6xl">
          <Link
            href="/"
            className="text-sm font-semibold text-[#E1BAC7]"
          >
            ← The Marching Archives
          </Link>

          <h1 className="mt-7 font-serif text-5xl font-bold">
            Band & Corps Directory
          </h1>

          <p className="mt-4 text-slate-300">
            Explore ensembles recorded in
            The Marching Archives.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-7 px-6 py-10">
        <form method="get" className="flex gap-3">
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Search band or corps names..."
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3"
          />

          <button
            type="submit"
            className="rounded-lg bg-[#861F41] px-6 py-3 font-bold text-white"
          >
            Search
          </button>
        </form>

        {error ? (
          <p role="alert" className="text-red-700">
            Unable to load archive records.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {bands?.map((band) => (
              <Link
                key={band.id}
                href={`/bands/${band.id}`}
                className="rounded-xl border border-slate-200 bg-white p-6 transition hover:border-[#861F41] hover:shadow-sm"
              >
                <p className="text-xs font-bold uppercase tracking-wider text-[#861F41]">
                  {band.kind === "drum_corps"
                    ? "Drum Corps"
                    : band.kind === "marching_band"
                      ? "Marching Band"
                      : "Ensemble"}
                </p>

                <h2 className="mt-2 text-xl font-bold text-[#002144]">
                  {band.name}
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  {[band.city, band.state, band.country]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </Link>
            ))}

            {!bands?.length && (
              <p className="text-slate-600">
                No matching bands found.
              </p>
            )}
          </div>
        )}

        <p className="text-xs text-slate-500">
          Showing up to 100 records.
        </p>
      </div>
    </main>
  );
}
