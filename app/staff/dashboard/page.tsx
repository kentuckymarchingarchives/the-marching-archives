
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { signOutStaff } from "@/app/staff/actions";

export const instant = false;

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
            Account
          </p>

          <h2 className="mt-3 text-2xl font-bold text-[#002144]">
            Welcome to TMA Administration
          </h2>

          <div className="mt-5 flex flex-wrap gap-3">
            <span className="rounded-full bg-[#002144] px-4 py-2 text-sm font-semibold text-white">
              {roleLabel}
            </span>

            <span className="rounded-full bg-green-100 px-4 py-2 text-sm font-semibold text-green-900">
              Active Staff
            </span>
          </div>
        </section>

        <section>
          <h2 className="mb-5 text-2xl font-bold text-[#002144]">
            Archive Management
          </h2>

          <div className="grid gap-5 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
                Available
              </p>

              <h3 className="mt-3 text-xl font-bold text-[#002144]">
                Band Management
              </h3>

              <p className="mt-3 text-sm leading-6 text-slate-600">
                Create and edit marching bands,
                drum corps, historical names,
                and archive profiles.
              </p>

              <div className="mt-6 flex flex-col gap-3">
                <Link
                  href="/staff/bands"
                  className="rounded-lg bg-[#002144] px-5 py-3 text-center text-sm font-bold text-white hover:bg-[#123B63]"
                >
                  Manage Bands →
                </Link>

                <Link
                  href="/staff/bands/new"
                  className="rounded-lg bg-[#861F41] px-5 py-3 text-center text-sm font-bold text-white hover:bg-[#A02B52]"
                >
                  + Add New Band
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Coming Soon
              </p>

              <h3 className="mt-3 text-xl font-bold text-[#002144]">
                Competition Management
              </h3>

              <p className="mt-3 text-sm leading-6 text-slate-600">
                Create competitions for KMEA,
                MSBA, BOA, and DCI, configure
                rounds, and enter results.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Coming Soon
              </p>

              <h3 className="mt-3 text-xl font-bold text-[#002144]">
                Publishing
              </h3>

              <p className="mt-3 text-sm leading-6 text-slate-600">
                Review and publish historical
                competition records to the
                public archive.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold text-[#002144]">
            Public Website
          </h2>

          <p className="mt-2 text-sm text-slate-600">
            View how your band records appear
            to visitors.
          </p>

          <Link
            href="/bands"
            className="mt-4 inline-block text-sm font-bold text-[#861F41]"
          >
            View Public Band Directory →
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
