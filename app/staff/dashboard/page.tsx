
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { signOutStaff } from "@/app/staff/actions";

export const instant = false;

async function DashboardContent() {
  const supabase = await createClient();

  const { data: auth, error: authError } =
    await supabase.auth.getClaims();

  const userId = auth?.claims?.sub;

  if (authError || !userId) {
    redirect("/staff/login");
  }

  const { data: staff, error: staffError } =
    await supabase
      .from("staff_members")
      .select("role, status")
      .eq("user_id", userId)
      .maybeSingle();

  if (
    staffError ||
    staff?.status !== "active" ||
    !["owner", "admin", "editor"].includes(staff.role)
  ) {
    redirect("/staff/login?error=unauthorized");
  }

  const roleLabel =
    staff.role === "owner"
      ? "Owner"
      : staff.role === "admin"
        ? "Administrator"
        : "Editor";

  const canPublish =
    staff.role === "owner" ||
    staff.role === "admin";

  const { data: recentCompetitions, error: recentError } =
    await supabase
      .from("competitions")
      .select(
        "id, name, organization_code, season_year, publication_status"
      )
      .is("archived_at", null)
      .order("season_year", { ascending: false })
      .order("name", { ascending: true })
      .limit(8);

  const sections = [
    {
      title: "Band Management",
      description:
        "Create ensemble profiles, upload logos, manage historical names, and update competitive status.",
      href: "/staff/bands",
      createHref: "/staff/bands/new",
      createLabel: "Add Band",
    },
    {
      title: "Competition Management",
      description:
        "Create events, configure rounds, enter scores, and manage competition records.",
      href: "/staff/competitions",
      createHref: "/staff/competitions/new",
      createLabel: "Add Competition",
    },
  ];

  return (
    <main className="min-h-screen bg-[#F4F6F9]">
      <section className="bg-[#002144] px-6 py-12 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#E0B4C2]">
              Administration
            </p>

            <h1 className="mt-3 font-serif text-4xl font-bold">
              Staff Dashboard
            </h1>

            <p className="mt-3 text-slate-300">
              The Marching Archives Management System
            </p>
          </div>

          <form action={signOutStaff}>
            <button
              type="submit"
              className="cursor-pointer rounded-lg border border-white/30 px-5 py-3 text-sm font-semibold hover:bg-white/10"
            >
              Sign Out
            </button>
          </form>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-10 px-6 py-10">
        <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
            Account Status
          </p>

          <h2 className="mt-3 text-2xl font-bold text-[#002144]">
            Welcome to TMA Administration
          </h2>

          <div className="mt-5 flex flex-wrap gap-3">
            <span className="rounded-full bg-[#002144] px-4 py-2 text-sm font-semibold text-white">
              {roleLabel}
            </span>

            <span className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-900">
              Active Staff Member
            </span>
          </div>
        </section>

        <section className="space-y-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
              Staff Tools
            </p>

            <h2 className="mt-2 text-2xl font-bold text-[#002144]">
              Archive Management
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {sections.map((section) => (
              <div
                key={section.href}
                className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
                  Available
                </p>

                <h3 className="mt-3 text-xl font-bold text-[#002144]">
                  {section.title}
                </h3>

                <p className="mt-3 flex-1 text-sm leading-7 text-slate-600">
                  {section.description}
                </p>

                <div className="mt-6 flex flex-col gap-3">
                  <Link
                    href={section.href}
                    className="cursor-pointer rounded-lg bg-[#002144] px-5 py-3 text-center text-sm font-bold text-white hover:bg-[#123B63]"
                  >
                    Manage &rarr;
                  </Link>

                  <Link
                    href={section.createHref}
                    className="cursor-pointer rounded-lg bg-[#861F41] px-5 py-3 text-center text-sm font-bold text-white hover:bg-[#A02B52]"
                  >
                    + {section.createLabel}
                  </Link>
                </div>
              </div>
            ))}

            <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">
                Available Now
              </p>

              <h3 className="mt-3 text-xl font-bold text-[#002144]">
                Results &amp; Publishing
              </h3>

              <p className="mt-3 flex-1 text-sm leading-7 text-slate-600">
                Review historical scores, resolve issues,
                approve verified records, and publish
                competitions to the public archive.
              </p>

              <div className="mt-6 flex flex-col gap-3">
                <a
                  href="#recent-competitions"
                  className="cursor-pointer rounded-lg bg-[#002144] px-5 py-3 text-center text-sm font-bold text-white hover:bg-[#123B63]"
                >
                  Review Competitions &rarr;
                </a>

                <Link
                  href="/staff/competitions"
                  className="cursor-pointer rounded-lg bg-[#861F41] px-5 py-3 text-center text-sm font-bold text-white hover:bg-[#A02B52]"
                >
                  All Competitions
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section
          id="recent-competitions"
          className="scroll-mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-7"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
                Results Workflow
              </p>

              <h2 className="mt-2 text-2xl font-bold text-[#002144]">
                Recent Competitions
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Open an event to review its results and
                continue the publishing process.
              </p>
            </div>

            <Link
              href="/staff/competitions"
              className="text-sm font-bold text-[#861F41] hover:underline"
            >
              View All &rarr;
            </Link>
          </div>

          {recentError ? (
            <p
              role="alert"
              className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
            >
              Unable to load recent competitions.
            </p>
          ) : recentCompetitions?.length ? (
            <div className="mt-6 divide-y divide-slate-100">
              {recentCompetitions.map((competition) => {
                const published =
                  competition.publication_status === "published";

                return (
                  <div
                    key={competition.id}
                    className="flex flex-wrap items-center justify-between gap-4 py-5 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-[#002144]">
                        {competition.name}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {competition.organization_code}
                        {" · "}
                        {competition.season_year}
                      </p>

                      <span
                        className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-bold ${
                          published
                            ? "bg-emerald-100 text-emerald-900"
                            : "bg-amber-100 text-amber-900"
                        }`}
                      >
                        {published ? "Published" : "Draft"}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/staff/competitions/${competition.id}`}
                        className="cursor-pointer rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-[#002144] hover:bg-slate-50"
                      >
                        Manage Results
                      </Link>

                      <Link
                        href={`/staff/competitions/${competition.id}/publish`}
                        className="cursor-pointer rounded-lg bg-[#861F41] px-4 py-2 text-sm font-bold text-white hover:bg-[#A02B52]"
                      >
                        {published
                          ? "View Publication"
                          : "Review & Publish"}
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-6 rounded-xl bg-[#F8FAFC] p-7 text-center">
              <p className="font-semibold text-[#002144]">
                No competitions yet
              </p>

              <p className="mt-2 text-sm text-slate-600">
                Create a competition to begin recording
                and reviewing historical results.
              </p>

              <Link
                href="/staff/competitions/new"
                className="mt-4 inline-block font-bold text-[#861F41] hover:underline"
              >
                Create Competition &rarr;
              </Link>
            </div>
          )}

          {!canPublish && (
            <p className="mt-6 border-t border-slate-100 pt-4 text-xs leading-6 text-slate-500">
              Editors can enter and review competition
              results. Only Owners and Administrators
              can approve or publish them.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold text-[#002144]">
            Public Archive
          </h2>

          <p className="mt-2 text-sm text-slate-600">
            Explore the published archive as visitors see it.
          </p>

          <div className="mt-4 flex flex-wrap gap-5">
            <Link
              href="/bands"
              className="font-bold text-[#861F41] hover:underline"
            >
              Band Directory &rarr;
            </Link>

            <Link
              href="/competitions"
              className="font-bold text-[#861F41] hover:underline"
            >
              Competition Archive &rarr;
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function StaffDashboardPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#F4F6F9] p-10">
          <p role="status" className="text-slate-600">
            Loading staff dashboard...
          </p>
        </main>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
