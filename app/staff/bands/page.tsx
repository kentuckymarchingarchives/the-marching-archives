
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const instant = false;


type Props = {
  searchParams: Promise<{ q?: string }>;
};

async function StaffBandsContent({
  searchParams,
}: Props) {
  const { q = "" } = await searchParams;
  const search = q.trim().slice(0, 100);

  const supabase = await createClient();

  // Verify authentication.
  const { data: auth, error: authError } =
    await supabase.auth.getClaims();

  if (authError || !auth?.claims?.sub) {
    redirect("/staff/login");
  }

  // Verify active staff membership.
  const { data: staff, error: staffError } =
    await supabase
      .from("staff_members")
      .select("role, status")
      .eq("user_id", auth.claims.sub)
      .maybeSingle();

  if (
    staffError ||
    !staff ||
    staff.status !== "active" ||
    !["owner", "admin", "editor"].includes(
      staff.role
    )
  ) {
    redirect("/staff/login?error=unauthorized");
  }

  // Load the band directory.
  let query = supabase
    .from("bands")
    .select(
      "id, slug, name, kind, city, state, country"
    )
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
    <div className="mx-auto max-w-6xl space-y-7 px-5 py-10">
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

          <p className="mt-3 text-sm text-slate-600">
            Manage ensemble profiles and historical
            band records.
          </p>
        </div>

        <Link
          href="/staff/bands/new"
          className="rounded-lg bg-[#861F41] px-5 py-3 text-sm font-bold text-white hover:bg-[#701832]"
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
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 text-[#002144]"
        />

        <button
          type="submit"
          className="rounded-lg bg-[#002144] px-5 py-3 font-semibold text-white"
        >
          Search
        </button>
      </form>

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-800"
        >
          Unable to load bands: {error.message}
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {bands?.length ? (
            bands.map((band) => (
              <Link
                key={band.id}
                href={`/staff/bands/${band.id}`}
                className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-5 transition hover:bg-slate-50"
              >
                <div>
                  <p className="font-bold text-[#002144]">
                    {band.name}
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    {[
                      band.city,
                      band.state,
                      band.country,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </p>

                  <p className="mt-2 text-xs text-slate-400">
                    /bands/{band.slug}
                  </p>
                </div>

                <span className="shrink-0 text-sm font-semibold text-[#861F41]">
                  Edit →
                </span>
              </Link>
            ))
          ) : (
            <div className="p-8">
              <p className="text-sm text-slate-600">
                {search
                  ? "No bands match your search."
                  : "No bands have been added yet."}
              </p>

              {!search && (
                <Link
                  href="/staff/bands/new"
                  className="mt-4 inline-block text-sm font-bold text-[#861F41]"
                >
                  Create your first band →
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-slate-500">
        Showing up to 100 records.
      </p>
    </div>
  );
}

export default function StaffBandsPage(
  props: Props
) {
  return (
    <main className="min-h-screen bg-[#F4F6F9]">
      <Suspense
        fallback={
          <div className="mx-auto max-w-6xl px-5 py-10">
            <div
              role="status"
              className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600"
            >
              Loading band management...
            </div>
          </div>
        }
      >
        <StaffBandsContent {...props} />
      </Suspense>
    </main>
  );
}
