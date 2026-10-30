import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Candidate = {
  record_type: "bands" | "competitions" | "entries";
  title: string;
  context: string;
  record_ids: string[];
  review_id: string | null;
  match_count: number;
};

type PageProps = { searchParams: Promise<{ type?: string }> };

const filters = [
  { key: "all", text: "All candidates" },
  { key: "bands", text: "Bands & corps" },
  { key: "competitions", text: "Competitions" },
  { key: "entries", text: "Round entries" },
] as const;

function recordUrl(candidate: Candidate, id: string) {
  if (candidate.record_type === "bands") return `/staff/bands/${id}`;
  if (candidate.record_type === "competitions") return `/staff/competitions/${id}`;
  return candidate.review_id ? `/staff/competitions/${candidate.review_id}` : "/staff/competitions";
}

const label: Record<Candidate["record_type"], string> = {
  bands: "Ensemble profiles",
  competitions: "Competition records",
  entries: "Round entries",
};

async function DuplicateReview({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  const uid = auth?.claims?.sub;
  if (authError || !uid) redirect("/staff/login");

  const { data: staff, error: staffError } = await supabase
    .from("staff_members")
    .select("role,status")
    .eq("user_id", uid)
    .maybeSingle();

  if (staffError || staff?.status !== "active" ||
      !["owner", "admin", "editor"].includes(staff.role)) {
    redirect("/staff/login?error=unauthorized");
  }

  const { data, error } = await supabase.rpc("tma_duplicate_candidates");
  const candidates = !error ? (data ?? []) as Candidate[] : [];
  const { type = "all" } = await searchParams;
  const selected = filters.some((filter) => filter.key === type) ? type : "all";
  const visible = selected === "all"
    ? candidates
    : candidates.filter((item) => item.record_type === selected);
  const counts = {
    bands: candidates.filter((item) => item.record_type === "bands").length,
    competitions: candidates.filter((item) => item.record_type === "competitions").length,
    entries: candidates.filter((item) => item.record_type === "entries").length,
  };

  return (
    <main className="min-h-screen bg-[#f5f7fa] text-[#002144]">
      <header className="bg-[#002144] px-5 py-12 text-white">
        <div className="mx-auto max-w-6xl">
          <Link href="/staff/dashboard" className="text-sm font-semibold text-[#f0bdce] hover:underline">
            ← Staff Dashboard
          </Link>
          <p className="mt-7 text-xs font-bold uppercase tracking-[.2em] text-[#f0bdce]">
            Archive quality / Phase 5
          </p>
          <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">Duplicate Detection</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200">
            Review possible duplicate ensemble profiles, competition records, and repeated entries.
            This tool never merges, deletes, or changes records automatically.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-7 px-5 py-9">
        {error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
            Could not load duplicate candidates. Run migration 023 and confirm your account has active staff access.
            No results are shown until this query succeeds.
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          {([
            ["bands", "Band profile groups"],
            ["competitions", "Competition groups"],
            ["entries", "Round entry groups"],
          ] as const).map(([key, title]) => (
            <div key={key} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-600">{title}</p>
              <p className="mt-2 text-3xl font-extrabold">{error ? "—" : counts[key]}</p>
            </div>
          ))}
        </div>

        <section className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-950">
          <strong>Review before correcting.</strong> A match is not proof of a duplicate. Identical names can refer
          to legitimate historical records, and bands may appear across different rounds or competitions.
          The database currently limits the report to 100 groups per category and displays up to 20 IDs per group.
        </section>

        <nav aria-label="Candidate type" className="flex flex-wrap gap-2">
          {filters.map((filter) => (
            <Link
              key={filter.key}
              href={`/staff/duplicates?type=${filter.key}`}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${selected === filter.key
                ? "bg-[#002144] text-white" : "border border-slate-300 bg-white hover:bg-slate-100"}`}
            >
              {filter.text}
            </Link>
          ))}
        </nav>

        <section className="space-y-4" aria-label="Potential duplicates">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-extrabold">Potential duplicate groups</h2>
              <p className="mt-1 text-sm text-slate-600">{error ? "Unavailable" : `${visible.length} candidate groups found`}</p>
            </div>
            <Link href="/staff/research" className="text-sm font-bold text-[#861F41] hover:underline">
              Research Assignments →
            </Link>
          </div>

          {!error && visible.length === 0 && (
            <p className="rounded-xl border border-slate-200 bg-white p-7 text-sm text-slate-600">
              No potential duplicates found for this filter. This is not a guarantee that the archive contains no duplicates.
            </p>
          )}

          {visible.map((candidate, index) => (
            <article key={`${candidate.record_type}-${candidate.record_ids.join("-")}-${index}`}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wider text-[#861F41]">
                    {label[candidate.record_type]}
                  </p>
                  <h3 className="mt-2 text-lg font-extrabold">{candidate.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{candidate.context || "No location or date provided"}</p>
                </div>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
                  {candidate.match_count} matching records
                </span>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {candidate.record_ids.map((id, i) => (
                  <Link key={id} href={recordUrl(candidate, id)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-[#002144] hover:border-[#861F41] hover:bg-slate-50">
                    {candidate.record_type === "entries" ? "Review competition" : `Open record ${i + 1}`} →
                  </Link>
                ))}
              </div>
              {candidate.record_type === "entries" && (
                <p className="mt-3 text-xs text-slate-500">
                  Entry IDs: {candidate.record_ids.join(", ")}. Review the competition and its rounds before editing.
                </p>
              )}
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

export default function DuplicateDetectionPage(props: PageProps) {
  return (
    <Suspense fallback={<main className="mx-auto max-w-6xl p-8">Loading duplicate review…</main>}>
      <DuplicateReview {...props} />
    </Suspense>
  );
}
