
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import BandStatusBadge from "@/components/BandStatusBadge";

export const instant = false;

type Props = {
  searchParams: Promise<{
    q?: string;
  }>;
};

async function BandList({ searchParams }: Props) {
  const params = await searchParams;
  const search = (params.q ?? "")
    .trim()
    .slice(0, 100);

  const supabase = await createClient();

  const { data: auth } =
    await supabase.auth.getClaims();

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
    !["owner", "admin", "editor"].includes(staff.role)
  ) {
    redirect("/staff/login?error=unauthorized");
  }

  let query = supabase
    .from("bands")
    .select(
      "id, slug, name, kind, city, state, country, competitive_status"
    )
    .is("archived_at", null)
    .order("name", { ascending: true })
    .limit(100);

  if (search) {
    query = query.ilike(
      "name",
      `%${search.replace(/[%_\\]/g, "\\$&")}%`
    );
  }

  const { data: bands, error } = await query;

  const canManageArchive =
    staff.role === "owner" || staff.role === "admin";

  return (
    <div className="mx-auto max-w-6xl space-y-7 px-6 py-10">
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
            Band Management
          </h1>

          <p className="mt-3 text-sm text-slate-600">
            Create, find, and edit bands and drum corps.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {canManageArchive && (
            <Link
              href="/staff/archive"
              className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-[#002144]"
            >
              Archive Center
            </Link>
          )}

          <Link
            href="/staff/bands/new"
            className="rounded-lg bg-[#861F41] px-5 py-3 text-sm font-bold text-white"
          >
            + Add New Band
          </Link>
        </div>
      </div>

      <form
        method="get"
        className="flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white p-5"
      >
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Search bands and drum corps..."
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-4 py-3 text-sm"
        />

        <button
          type="submit"
          className="rounded-lg bg-[#002144] px-6 py-3 text-sm font-bold text-white"
        >
          Search
        </button>

        {search && (
          <Link
            href="/staff/bands"
            className="self-center text-sm font-semibold text-[#861F41]"
          >
            Clear
          </Link>
        )}
      </form>

      {error ? (
        <p role="alert" className="text-sm text-red-700">
          Unable to load bands: {error.message}
        </p>
      ) : bands?.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {bands.map((band) => (
            <Link
              key={band.id}
              href={`/staff/bands/${band.id}`}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-[#861F41]"
            >
              <p className="text-xs font-bold uppercase tracking-wider text-[#861F41]">
                {band.kind === "drum_corps"
                  ? "Drum Corps"
                  : band.kind === "marching_band"
                    ? "Marching Band"
                    : "Other Ensemble"}
              </p>

              <h2 className="mt-2 text-xl font-bold text-[#002144]">
                {band.name}
              </h2>

              <p className="mt-2 text-sm text-slate-600">
                {[
                  band.city,
                  band.state,
                  band.country,
                ].filter(Boolean).join(", ")}
              </p>

              <div className="mt-5 flex items-center justify-between gap-3">
                <BandStatusBadge
                  status={band.competitive_status}
                />

                <span className="text-sm font-bold text-[#861F41]">
                  Edit →
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <h2 className="text-xl font-bold text-[#002144]">
            No bands found
          </h2>

          <p className="mt-3 text-sm text-slate-600">
            No active records match your search.
            Archived records can be found in
            the Archive Center.
          </p>
        </div>
      )}

      <p className="text-xs text-slate-500">
        Showing up to 100 non-archived records.
      </p>
    </div>
  );
}

export default function StaffBandsPage(props: Props) {
  return (
    <main className="min-h-screen bg-[#F4F6F9]">
      <Suspense
        fallback={
          <div
            role="status"
            className="p-10 text-sm text-slate-600"
          >
            Loading bands...
          </div>
        }
      >
        <BandList {...props} />
      </Suspense>
    </main>
  );
}
