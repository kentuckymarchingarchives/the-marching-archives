
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { readableLabel } from "@/lib/competition-config";

type Props = {
  searchParams: Promise<{
    year?: string;
    organization?: string;
  }>;
};

async function CompetitionList({
  searchParams,
}: Props) {
  const filters = await searchParams;
  const year = (filters.year ?? "").trim();
  const organization = (filters.organization ?? "").trim();

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
    !["owner", "admin", "editor"].includes(staff.role)
  ) {
    redirect("/staff/login?error=unauthorized");
  }

  let query = supabase
    .from("competitions")
    .select(
      "id, name, season_year, organization_code, competition_type, competition_date, city, state, publication_status"
    )
    .order("season_year", { ascending: false })
    .order("name", { ascending: true })
    .limit(100);

  if (/^\d{4}$/.test(year)) {
    query = query.eq("season_year", Number(year));
  }

  if (["KMEA", "MSBA", "BOA", "DCI"].includes(organization)) {
    query = query.eq("organization_code", organization);
  }

  const { data: competitions, error } = await query;

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
            Competitions
          </h1>
        </div>

        <Link
          href="/staff/competitions/new"
          className="rounded-lg bg-[#861F41] px-5 py-3 text-sm font-bold text-white hover:bg-[#701832]"
        >
          + Add Competition
        </Link>
      </div>

      <form
        method="get"
        className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-[1fr_1fr_auto]"
      >
        <label className="text-sm font-semibold text-[#002144]">
          Season
          <input
            name="year"
            type="number"
            min={1800}
            max={2200}
            defaultValue={year}
            placeholder="All years"
            className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3"
          />
        </label>

        <label className="text-sm font-semibold text-[#002144]">
          Organization
          <select
            name="organization"
            defaultValue={organization}
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3"
          >
            <option value="">All organizations</option>
            <option value="KMEA">KMEA</option>
            <option value="MSBA">MSBA</option>
            <option value="BOA">BOA</option>
            <option value="DCI">DCI</option>
          </select>
        </label>

        <button
          type="submit"
          className="self-end rounded-lg bg-[#002144] px-5 py-3 font-bold text-white"
        >
          Filter
        </button>
      </form>

      {error ? (
        <p role="alert" className="text-red-700">
          Unable to load competitions: {error.message}
        </p>
      ) : competitions?.length ? (
        <div className="space-y-3">
          {competitions.map((competition) => (
            <Link
              key={competition.id}
              href={`/staff/competitions/${competition.id}`}
              className="block rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-[#861F41] hover:shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#861F41]">
                    {competition.organization_code} ·{" "}
                    {competition.season_year}
                  </p>

                  <h2 className="mt-2 text-xl font-bold text-[#002144]">
                    {competition.name}
                  </h2>

                  <p className="mt-2 text-sm text-slate-600">
                    {readableLabel(competition.competition_type)}
                  </p>

                  <p className="mt-2 text-sm text-slate-500">
                    {[
                      competition.competition_date,
                      competition.city,
                      competition.state,
                    ].filter(Boolean).join(" · ") || "Date and location not set"}
                  </p>
                </div>

                <span
                  className={
                    competition.publication_status === "published"
                      ? "rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800"
                      : "rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800"
                  }
                >
                  {competition.publication_status === "published"
                    ? "Published"
                    : "Draft"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <h2 className="text-xl font-bold text-[#002144]">
            No competitions found
          </h2>
          <p className="mt-3 text-sm text-slate-600">
            Create your first event or change the filters.
          </p>
        </div>
      )}

      <p className="text-xs text-slate-500">
        Showing up to 100 matching competitions.
      </p>
    </div>
  );
}

export default function CompetitionsPage(props: Props) {
  return (
    <main className="min-h-screen bg-[#F4F6F9]">
      <Suspense
        fallback={
          <div className="p-10 text-sm text-slate-600">
            Loading competitions...
          </div>
        }
      >
        <CompetitionList {...props} />
      </Suspense>
    </main>
  );
}
