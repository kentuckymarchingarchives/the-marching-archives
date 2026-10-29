import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { readableLabel } from "@/lib/competition-config";

const PAGE_SIZE = 24;

type Props = {
  searchParams: Promise<{ q?: string; page?: string; status?: string }>;
};

type Competition = {
  id: string;
  name: string;
  season_year: number;
  organization_code: string;
  competition_type: string;
  competition_date: string | null;
  city: string | null;
  state: string | null;
  publication_status: string;
  archived_at: string | null;
};

function listUrl(q: string, status: string, page: number) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status !== "all") params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/staff/competitions${query ? `?${query}` : ""}`;
}

function displayDate(date: string | null) {
  if (!date) return "Date not recorded";
  const parsed = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" });
}

async function CompetitionsIndex({ searchParams }: Props) {
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 100);
  const status = ["all", "draft", "published", "archived"].includes(params.status ?? "")
    ? (params.status as string)
    : "all";
  const requestedPage = Number(params.page);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0
    ? Math.min(requestedPage, 10000)
    : 1;

  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  if (authError || !auth?.claims?.sub) redirect("/staff/login");

  const { data: staff, error: staffError } = await supabase
    .from("staff_members")
    .select("role, status")
    .eq("user_id", auth.claims.sub)
    .maybeSingle();

  if (staffError || staff?.status !== "active" ||
      !["owner", "admin", "editor"].includes(staff.role)) {
    redirect("/staff/login?error=unauthorized");
  }

  let query = supabase
    .from("competitions")
    .select("id, name, season_year, organization_code, competition_type, competition_date, city, state, publication_status, archived_at", { count: "exact" });

  if (status === "archived") query = query.not("archived_at", "is", null);
  else query = query.is("archived_at", null);

  if (status === "draft" || status === "published") {
    query = query.eq("publication_status", status);
  }
  if (q) {
    query = query.ilike("name", `%${q.replace(/[\\%_]/g, "\\$&")}%`);
  }

  const { data, error, count } = await query
    .order("season_year", { ascending: false })
    .order("competition_date", { ascending: false, nullsFirst: false })
    .order("name", { ascending: true })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const competitions = (data ?? []) as Competition[];
  const total = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const canArchive = staff.role === "owner" || staff.role === "admin";

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-[#002144]">
      <section className="bg-[#002144] px-6 py-12 text-white">
        <div className="mx-auto max-w-6xl">
          <Link href="/staff/dashboard" className="text-sm font-semibold text-[#efc7d5] hover:text-white">← Staff Dashboard</Link>
          <p className="mt-7 text-xs font-bold uppercase tracking-[0.2em] text-[#efc7d5]">Archive Administration</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-5">
            <div>
              <h1 className="text-3xl font-extrabold sm:text-4xl">Manage Competitions</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200">
                Find existing competitions, continue entering results, and review publication status.
              </p>
            </div>
            <Link href="/staff/competitions/new" className="rounded-lg bg-[#861F41] px-5 py-3 text-sm font-bold text-white hover:bg-[#a12b53]">+ New Competition</Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-6 px-6 py-9">
        <form method="get" action="/staff/competitions" className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="min-w-50 flex-1">
            <label htmlFor="competition-search" className="mb-2 block text-sm font-semibold">Competition name</label>
            <input id="competition-search" type="search" name="q" defaultValue={q} placeholder="Search competitions..." className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus-visible:outline-2 focus-visible:outline-[#861F41]" />
          </div>
          <div className="min-w-40">
            <label htmlFor="competition-status" className="mb-2 block text-sm font-semibold">Show</label>
            <select id="competition-status" name="status" defaultValue={status} className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm">
              <option value="all">All active</option>
              <option value="draft">Drafts</option>
              <option value="published">Published</option>
              {canArchive && <option value="archived">Archived</option>}
            </select>
          </div>
          <button type="submit" className="rounded-lg bg-[#002144] px-6 py-3 text-sm font-bold text-white">Apply filters</button>
          <Link href="/staff/competitions" className="px-3 py-3 text-sm font-bold text-[#861F41] hover:underline">Clear</Link>
        </form>

        {error ? (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
            Unable to load competitions: {error.message}. Check database permissions if your staff role should have access.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-extrabold">Competition Records</h2>
              <p className="text-sm font-semibold text-slate-500">{total.toLocaleString()} matching {total === 1 ? "competition" : "competitions"}</p>
            </div>
            {competitions.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {competitions.map((competition) => {
                  const published = competition.publication_status === "published";
                  const archived = Boolean(competition.archived_at);
                  return (
                    <article key={competition.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider">
                        <span className="text-[#861F41]">{competition.organization_code} · {competition.season_year}</span>
                        <span className={`rounded-full px-3 py-1 ${archived ? "bg-slate-200 text-slate-700" : published ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                          {archived ? "Archived" : published ? "Published" : "Draft"}
                        </span>
                      </div>
                      <h3 className="mt-3 text-xl font-extrabold">{competition.name}</h3>
                      <p className="mt-3 text-sm text-slate-600">{readableLabel(competition.competition_type)} · {displayDate(competition.competition_date)}</p>
                      <p className="mt-1 text-sm text-slate-500">{[competition.city, competition.state].filter(Boolean).join(", ") || "Location not recorded"}</p>
                      <div className="mt-auto flex flex-wrap gap-2 pt-6">
                        <Link href={`/staff/competitions/${competition.id}`} className="rounded-lg bg-[#002144] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#143d65]">Manage competition →</Link>
                        {!archived && canArchive && (
                          <Link href={`/staff/competitions/${competition.id}/review`} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold text-[#002144] hover:bg-slate-50">Review results</Link>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
                <h3 className="text-lg font-bold">No matching competitions</h3>
                <p className="mt-2 text-sm text-slate-600">Try clearing your filters. New competitions and drafts appear here without being published.</p>
                <Link href="/staff/competitions/new" className="mt-5 inline-block font-bold text-[#861F41] hover:underline">Create a competition →</Link>
              </div>
            )}
            {pageCount > 1 && (
              <nav aria-label="Competition pages" className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
                {page > 1 ? <Link href={listUrl(q, status, page - 1)} className="font-bold text-[#861F41]">← Previous</Link> : <span className="text-slate-400">Previous</span>}
                <span className="text-sm text-slate-600">Page {page} of {pageCount}</span>
                {page < pageCount ? <Link href={listUrl(q, status, page + 1)} className="font-bold text-[#861F41]">Next →</Link> : <span className="text-slate-400">Next</span>}
              </nav>
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default function StaffCompetitionsPage(props: Props) {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#f6f7f9] p-10 text-slate-600">Loading competitions...</main>}>
      <CompetitionsIndex {...props} />
    </Suspense>
  );
}