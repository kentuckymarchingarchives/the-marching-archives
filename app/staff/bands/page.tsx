
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Props = {
  searchParams: Promise<{ q?: string }>;
};

export default async function StaffBandsPage({
  searchParams,
}: Props) {
  const { q = "" } = await searchParams;
  const search = q.trim().slice(0, 100);

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();

  if (!auth?.claims?.sub) {
    redirect("/staff/login");
  }

  const { data: staff } = await supabase
    .from("staff_members")
    .select("role, status")
    .eq("user_id", auth.claims.sub)
    .maybeSingle();

  if (
    staff?.status !== "active" ||
    !["owner", "admin", "editor"].includes(
      staff.role
    )
  ) {
    redirect("/staff/login");
  }

  let query = supabase
    .from("bands")
    .select("id, name, kind, city, state, country")
    .order("name", { ascending: true })
    .limit(100);

  if (search) {
    query = query.ilike(
      "name",
      `%${search.replace(/[%_\\]/g, "\\$&")}%`
    );
  }

  const { data: bands, error } = await query;

  return (
    <main className="mx-auto max-w-6xl space-y-7 px-5 py-10">
      <Link
        href="/staff/dashboard"
        className="text-sm font-semibold text-[#861F41]"
      >
        ← Staff Dashboard
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
            Archive Management
          </p>
          <h1 className="mt-2 font-serif text-4xl font-bold text-[#002144]">
            Bands & Drum Corps
          </h1>
        </div>

        <Link
          href="/staff/bands/new"
          className="rounded-lg bg-[#861F41] px-5 py-3 text-sm font-bold text-white"
        >
          + Add Band / Corps
        </Link>
      </div>

      <form method="get" className="flex gap-3">
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Search by ensemble name..."
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3"
        />
        <button
          type="submit"
          className="rounded-lg bg-[#002144] px-5 py-3 font-semibold text-white"
        >
          Search
        </button>
      </form>

      {error ? (
        <p role="alert" className="text-red-700">
          Unable to load bands: {error.message}
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {bands?.length ? (
            bands.map((band) => (
              <Link
                key={band.id}
                href={`/staff/bands/${band.id}`}
                className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-5 hover:bg-slate-50"
              >
                <div>
                  <p className="font-bold text-[#002144]">
                    {band.name}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {[band.city, band.state, band.country]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </div>

                <span className="text-sm font-semibold text-[#861F41]">
                  Edit →
                </span>
              </Link>
            ))
          ) : (
            <p className="p-8 text-sm text-slate-600">
              No bands found. Create your first record.
            </p>
          )}
        </div>
      )}

      <p className="text-xs text-slate-500">
        Showing up to 100 records. Pagination will
        be added as the archive grows.
      </p>
    </main>
  );
}
