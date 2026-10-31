import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { researchSession, researchLinks } from "@/lib/research-insights";

export const instant = false;

type Contribution = {
  id: string;
  name: string;
  role: string;
  completed: number;
  open: number;
  approved: number;
};

type Analytics = {
  assignments: number;
  completed: number;
  overdue: number;
  pending: number;
  approved: number;
  decided: number;
  contributions: Contribution[];
};

function isAnalytics(value: unknown): value is Analytics {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return ["assignments", "completed", "overdue", "pending", "approved", "decided"]
    .every((key) => typeof item[key] === "number") && Array.isArray(item.contributions);
}

async function ResearchAnalyticsContent() {
  await connection();
  const { db } = await researchSession();
  const { data, error } = await db.rpc("tma_research_analytics");
  const analytics = !error && isAnalytics(data) ? data : null;
  const stats = [
    { label: "Total assignments", value: analytics?.assignments ?? 0 },
    { label: "Completed assignments", value: analytics?.completed ?? 0 },
    { label: "Overdue & open", value: analytics?.overdue ?? 0 },
    { label: "Awaiting review", value: analytics?.pending ?? 0 },
    { label: "Approved research", value: analytics?.approved ?? 0 },
    {
      label: "Approval share of decisions",
      value: analytics?.decided
        ? `${Math.round((analytics.approved / analytics.decided) * 100)}%`
        : "—",
    },
  ];

  return (
    <main className="min-h-screen bg-[#f6f7f8] text-[#002144]">
      <header className="bg-[#002144] px-6 py-12 text-white">
        <div className="mx-auto max-w-6xl">
          <Link href="/staff/dashboard" className="text-sm font-semibold text-[#e8afc2] hover:underline">
            ← Staff Dashboard
          </Link>
          <p className="mt-6 text-xs font-black uppercase tracking-widest text-[#e8afc2]">Research operations</p>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">Staff Research Analytics</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200">
            Database-wide assignment progress and current review decisions, without sampled totals.
          </p>
        </div>
      </header>
      <div className="mx-auto max-w-6xl space-y-7 px-6 py-9">
        <nav className="flex flex-wrap gap-2" aria-label="Research pages">
          {researchLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg px-3 py-2 text-sm font-bold ${
                link.href.endsWith("/analytics")
                  ? "bg-[#861F41] text-white"
                  : "border border-slate-200 bg-white"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {!analytics && (
          <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
            Unable to load accurate research analytics. Install migration 037 and confirm that your
            research tables and active staff permissions are configured. Statistics are hidden until
            the query succeeds.
          </p>
        )}

        <section aria-label="Summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-600">{stat.label}</p>
              <p className="mt-2 text-3xl font-black">{analytics ? stat.value : "—"}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black">Research contributions</h2>
          <p className="mt-1 text-sm text-slate-600">
            Completed assignments by current assignee; approved submissions by submitter.
            Counts cover current records, not historical effort or past approval events.
          </p>
          {analytics && (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-145 text-left text-sm">
                <thead>
                  <tr className="border-b text-slate-600">
                    <th scope="col" className="px-3 py-3">Staff member</th>
                    <th scope="col" className="px-3 py-3">Role</th>
                    <th scope="col" className="px-3 py-3">Completed</th>
                    <th scope="col" className="px-3 py-3">Open</th>
                    <th scope="col" className="px-3 py-3">Approved submissions</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.contributions.map((member) => (
                    <tr key={member.id} className="border-b border-slate-100">
                      <td className="px-3 py-3 font-semibold">{member.name}</td>
                      <td className="px-3 py-3 capitalize">{member.role}</td>
                      <td className="px-3 py-3">{member.completed}</td>
                      <td className="px-3 py-3">{member.open}</td>
                      <td className="px-3 py-3">{member.approved}</td>
                    </tr>
                  ))}
                  {analytics.contributions.length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-600">No active staff found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default function ResearchAnalyticsPage() {
  return (
    <Suspense fallback={<main className="p-8">Loading analytics…</main>}>
      <ResearchAnalyticsContent />
    </Suspense>
  );
}
