import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { signOutStaff } from "@/app/staff/actions";

export const instant = false;

const management = [
  {
    number: "01",
    title: "Bands & Corps",
    description: "Manage ensembles, logos, historical names, and competitive status.",
    href: "/staff/bands",
    addHref: "/staff/bands/new",
    addLabel: "Add an ensemble",
  },
  {
    number: "02",
    title: "Competitions",
    description: "Create events, configure rounds, and maintain historical competition results.",
    href: "/staff/competitions",
    addHref: "/staff/competitions/new",
    addLabel: "Add a competition",
  },
];

async function DashboardContent() {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;

  if (authError || !userId) redirect("/staff/login");

  const { data: staff, error: staffError } = await supabase
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
    staff.role === "owner" ? "Owner" : staff.role === "admin" ? "Administrator" : "Editor";
  const canPublish = staff.role === "owner" || staff.role === "admin";

  const { data: recentCompetitions, error: recentError } = await supabase
    .from("competitions")
    .select("id, name, organization_code, season_year, publication_status")
    .is("archived_at", null)
    .order("season_year", { ascending: false })
    .order("name", { ascending: true })
    .limit(8);

  const recent = recentCompetitions ?? [];
  const published = recent.filter((item) => item.publication_status === "published").length;
  const unpublished = recent.length - published;

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-[#002144]">
      <section className="bg-[#002144] text-white">
        <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#efbbce]">The Marching Archives / Staff</p>
              <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-5xl">Archive administration</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200 sm:text-base">
                Your workspace for managing competitive marching history, maintaining records, and reviewing results.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/30 bg-white/10 px-4 py-1.5 text-xs font-bold">{roleLabel}</span>
                <span className="rounded-full border border-emerald-300/30 bg-emerald-900/40 px-4 py-1.5 text-xs font-bold text-emerald-100">Active staff</span>
              </div>
            </div>
            <form action={signOutStaff}>
              <button type="submit" className="rounded-lg border border-white/30 px-5 py-2.5 text-sm font-semibold transition hover:bg-white/10">Sign out</button>
            </form>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-9 px-5 py-9 sm:px-8 sm:py-12">
        <nav aria-label="Dashboard quick links" className="flex flex-wrap gap-2">
          <a href="#manage" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:border-[#861F41]">Manage records</a>
          <a href="#recent" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:border-[#861F41]">Recent competitions</a>
          <a href="#public" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:border-[#861F41]">Public archive</a>
        </nav>

        <section aria-label="Dashboard snapshot" className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Recent competitions</p>
            <p className="mt-3 text-4xl font-extrabold tabular-nums">{recentError ? "—" : recent.length}</p>
            <p className="mt-2 text-xs text-slate-500">Latest 8 accessible records, not an archive-wide total</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Published in recent list</p>
            <p className="mt-3 text-4xl font-extrabold tabular-nums">{recentError ? "—" : published}</p>
            <p className="mt-2 text-xs text-slate-500">Already visible in the public archive</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Not published in recent list</p>
            <p className="mt-3 text-4xl font-extrabold tabular-nums">{recentError ? "—" : unpublished}</p>
            <p className="mt-2 text-xs text-slate-500">Records that may require additional review</p>
          </div>
        </section>

        <section id="manage" className="scroll-mt-28">
          <div className="mb-5">
            <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#861F41]">Workspace</p>
            <h2 className="mt-2 text-2xl font-extrabold sm:text-3xl">Manage the archive</h2>
            <p className="mt-2 text-sm text-slate-600">Choose the record type you want to work on.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {management.map((item) => (
              <article key={item.href} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <span className="text-sm font-black text-[#861F41]">{item.number} / MANAGEMENT</span>
                <h3 className="mt-5 text-2xl font-extrabold">{item.title}</h3>
                <p className="mt-3 flex-1 text-sm leading-7 text-slate-600">{item.description}</p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href={item.href} className="rounded-lg bg-[#002144] px-5 py-3 text-sm font-bold text-white hover:bg-[#123b63]">Manage records →</Link>
                  <Link href={item.addHref} className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-bold hover:bg-slate-50">+ {item.addLabel}</Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="recent" className="scroll-mt-28 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#861F41]">Results workflow</p>
              <h2 className="mt-2 text-2xl font-extrabold">Recent competitions</h2>
              <p className="mt-2 text-sm text-slate-600">Pick up where you left off with an event or its results.</p>
            </div>
            <Link href="/staff/competitions" className="text-sm font-bold text-[#861F41] hover:underline">View all competitions →</Link>
          </div>
          {recentError ? (
            <p role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">Unable to load recent competitions.</p>
          ) : recent.length ? (
            <div className="mt-6 divide-y divide-slate-100">
              {recent.map((competition) => {
                const isPublished = competition.publication_status === "published";
                return (
                  <div key={competition.id} className="flex flex-wrap items-center justify-between gap-4 py-5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="font-bold">{competition.name}</p>
                      <p className="mt-1 text-sm text-slate-500">{competition.organization_code} · {competition.season_year}</p>
                      <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${isPublished ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>
                        {isPublished ? "Published" : "Not published"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/staff/competitions/${competition.id}`} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold hover:bg-slate-50">Manage results</Link>
                      {canPublish && (
                        <Link href={`/staff/competitions/${competition.id}/publish`} className="rounded-lg bg-[#861F41] px-4 py-2 text-sm font-bold text-white hover:bg-[#6d1733]">
                          {isPublished ? "Publication details" : "Review & publish"}
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-6 rounded-xl bg-slate-50 p-7 text-center">
              <p className="font-bold">No competitions yet</p>
              <p className="mt-2 text-sm text-slate-600">Create a competition to start documenting historical results.</p>
              <Link href="/staff/competitions/new" className="mt-4 inline-block text-sm font-bold text-[#861F41] hover:underline">Create a competition →</Link>
            </div>
          )}
          {!canPublish && (
            <p className="mt-6 border-t border-slate-100 pt-4 text-sm text-slate-500">
              Editors can manage and review results. Publishing remains restricted to Owners and Administrators.
            </p>
          )}
        </section>

        <section id="public" className="scroll-mt-28 rounded-2xl bg-[#002144] p-6 text-white sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#efbbce]">Public view</p>
              <h2 className="mt-2 text-2xl font-extrabold">See the archive as visitors do</h2>
              <p className="mt-2 text-sm text-slate-300">Check published content after updating records.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/bands" className="rounded-lg bg-white px-4 py-3 text-sm font-bold text-[#002144] hover:bg-slate-100">Bands & Corps</Link>
              <Link href="/competitions" className="rounded-lg border border-white/40 px-4 py-3 text-sm font-bold text-white hover:bg-white/10">Competitions</Link>
            </div>
          </div>
        </section>
        {canPublish && (
          <div className="text-right">
            <Link href="/staff/archive" className="text-sm font-semibold text-slate-600 hover:text-[#861F41]">Manage archived records →</Link>
          </div>
        )}
      </div>
    </main>
  );
}

export default function StaffDashboardPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#f6f7f9] p-10"><p role="status" className="text-slate-600">Loading staff dashboard...</p></main>}>
      <DashboardContent />
    </Suspense>
  );
}
