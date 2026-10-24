
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

  const { data: staff } = await supabase
    .from("staff_members")
    .select("role, status")
    .eq("user_id", userId)
    .maybeSingle();

  if (
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

  const sections = [
    {
      title: "Band Management",
      description:
        "Create and edit marching bands, drum corps, historical names, and competitive status.",
      href: "/staff/bands",
      createHref: "/staff/bands/new",
      createLabel: "Add Band",
    },
    {
      title: "Competition Management",
      description:
        "Create events, configure championship stages, and manage competition rounds.",
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
              className="rounded-lg border border-white/30 px-5 py-3 text-sm font-semibold hover:bg-white/10"
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

        <section>
          <h2 className="mb-5 text-2xl font-bold text-[#002144]">
            Archive Management
          </h2>

          <div className="grid gap-5 md:grid-cols-3">
            {sections.map((section) => (
              <div
                key={section.href}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
                  Available
                </p>

                <h3 className="mt-3 text-xl font-bold text-[#002144]">
                  {section.title}
                </h3>

                <p className="mt-3 min-h-24 text-sm leading-6 text-slate-600">
                  {section.description}
                </p>

                <div className="mt-6 flex flex-col gap-3">
                  <Link
                    href={section.href}
                    className="rounded-lg bg-[#002144] px-5 py-3 text-center text-sm font-bold text-white hover:bg-[#123B63]"
                  >
                    Manage →
                  </Link>

                  <Link
                    href={section.createHref}
                    className="rounded-lg bg-[#861F41] px-5 py-3 text-center text-sm font-bold text-white hover:bg-[#A02B52]"
                  >
                    + {section.createLabel}
                  </Link>
                </div>
              </div>
            ))}

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Coming in Phase 6
              </p>

              <h3 className="mt-3 text-xl font-bold text-[#002144]">
                Results & Publishing
              </h3>

              <p className="mt-3 text-sm leading-6 text-slate-600">
                Enter competing bands, classifications,
                placements, caption scores, and review
                completed historical results.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold text-[#002144]">
            Public Archive
          </h2>

          <p className="mt-2 text-sm text-slate-600">
            See the published band and corps directory
            as visitors see it.
          </p>

          <Link
            href="/bands"
            className="mt-4 inline-block text-sm font-bold text-[#861F41]"
          >
            View Band Directory →
          </Link>
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
