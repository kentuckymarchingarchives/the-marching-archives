
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { signOutStaff } from "@/app/staff/actions";

async function DashboardContent() {
  const supabase = await createClient();

  const { data: claims, error: authError } =
    await supabase.auth.getClaims();

  const userId = claims?.claims?.sub;

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
    !staff ||
    staff.status !== "active" ||
    !["owner", "admin", "editor"].includes(
      staff.role
    )
  ) {
    redirect("/staff/login?error=unauthorized");
  }

  const roleLabel =
    staff.role === "owner"
      ? "Owner"
      : staff.role === "admin"
        ? "Administrator"
        : "Editor";

  return (
    <main className="min-h-screen bg-[#F4F6F9]">
      <header className="bg-[#002144] px-6 py-8 text-white md:px-12">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#E1BBC7]">
              The Marching Archives
            </p>

            <h1 className="mt-2 font-serif text-3xl font-bold">
              Staff Dashboard
            </h1>
          </div>

          <form action={signOutStaff}>
            <button
              type="submit"
              className="rounded-lg border border-white/30 px-5 py-2 text-sm font-semibold hover:bg-white/10"
            >
              Sign Out
            </button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-8 px-6 py-10 md:px-12">
        <section className="rounded-2xl border border-slate-200 bg-white p-7">
          <p className="text-xs font-bold uppercase tracking-wider text-[#861F41]">
            Account Status
          </p>

          <h2 className="mt-3 text-2xl font-bold text-[#002144]">
            Welcome to TMA Administration
          </h2>

          <div className="mt-5 flex flex-wrap gap-3">
            <span className="rounded-full bg-[#002144] px-4 py-2 text-sm font-semibold text-white">
              {roleLabel}
            </span>

            <span className="rounded-full bg-green-100 px-4 py-2 text-sm font-semibold text-green-900">
              Active Staff Member
            </span>
          </div>
        </section>

        <section>
          <h2 className="mb-5 text-xl font-bold text-[#002144]">
            Administration
          </h2>

          <div className="grid gap-5 md:grid-cols-3">
            {[
              {
                title: "Band Management",
                description:
                  "Create band and corps profiles, historical names, and locations.",
              },
              {
                title: "Competitions",
                description:
                  "Create events, manage rounds, and enter historical results.",
              },
              {
                title: "Publishing",
                description:
                  "Review completed competition records before making them public.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-slate-200 bg-white p-6"
              >
                <h3 className="text-lg font-bold text-[#002144]">
                  {item.title}
                </h3>

                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {item.description}
                </p>

                <p className="mt-6 text-xs font-bold uppercase tracking-wider text-[#861F41]">
                  Coming in upcoming phases
                </p>
              </div>
            ))}
          </div>
        </section>

        <Link
          href="/"
          className="inline-block text-sm font-semibold text-[#861F41]"
        >
          ← Visit Public Website
        </Link>
      </div>
    </main>
  );
}

export default function StaffDashboardPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#F4F6F9] p-10">
          Loading dashboard...
        </main>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
