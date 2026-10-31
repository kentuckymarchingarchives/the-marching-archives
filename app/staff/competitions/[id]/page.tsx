import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN } from "@/lib/band-validation";
import { readableLabel } from "@/lib/competition-config";
import { competitionPublicUrl } from "@/lib/public-competition-routes";
import ArchiveControls from "@/components/ArchiveControls";

export const instant = false;

type Props = {
  params: Promise<{ id: string }>;
};

type Competition = {
  id: string;
  name: string;
  slug: string | null;
  season_year: number;
  organization_code: string;
  competition_type: string;
  competition_date: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  source_url: string | null;
  publication_status: string;
  archived_at: string | null;
};

type CompetitionRound = {
  id: string;
  name: string;
  round_kind: string;
  class_scope: string | null;
  sort_order: number;
  archived_at: string | null;
};

async function CompetitionManagement({
  params,
}: Props) {
  const { id } = await params;

  if (!UUID_PATTERN.test(id)) {
    notFound();
  }

  const supabase = await createClient();

  // Require an authenticated staff account.
  const { data: auth, error: authError } =
    await supabase.auth.getClaims();

  if (authError || !auth?.claims?.sub) {
    redirect("/staff/login");
  }

  const { data: staff, error: staffError } =
    await supabase
      .from("staff_members")
      .select("role, status")
      .eq("user_id", auth.claims.sub)
      .maybeSingle();

  if (
    staffError ||
    staff?.status !== "active" ||
    !["owner", "admin", "editor"].includes(staff.role)
  ) {
    redirect("/staff/login?error=unauthorized");
  }

  // Load the selected competition, not the directory.
  const { data: competitionData, error: competitionError } =
    await supabase
      .from("competitions")
      .select(
        "id, name, slug, season_year, organization_code, competition_type, competition_date, city, state, country, source_url, publication_status, archived_at"
      )
      .eq("id", id)
      .maybeSingle();

  if (competitionError) {
    throw new Error(
      "Unable to load competition management details."
    );
  }

  if (!competitionData) {
    notFound();
  }

  const competition = competitionData as Competition;

  // Retrieve the rounds belonging to this competition.
  const { data: roundData, error: roundError } =
    await supabase
      .from("competition_rounds")
      .select(
        "id, name, round_kind, class_scope, sort_order, archived_at"
      )
      .eq("competition_id", id)
      .order("sort_order", { ascending: true })
      .limit(100);

  if (roundError) {
    throw new Error(
      "Unable to load competition rounds."
    );
  }

  const rounds = (roundData ?? []) as CompetitionRound[];

  const activeRounds = rounds.filter(
    (round) => !round.archived_at
  );

  const published =
    competition.publication_status === "published";

  const archived = Boolean(competition.archived_at);

  const canPublish =
    staff.role === "owner" ||
    staff.role === "admin";

  return (
    <main className="min-h-screen bg-[#F4F6F9]">
      <section className="bg-[#002144] px-6 py-8 text-white">
        <div className="mx-auto max-w-6xl">
          <Link
            href="/staff/competitions"
            className="text-sm font-semibold text-[#E0B4C2] hover:text-white hover:underline"
          >
            &larr; All Competitions
          </Link>

          <p className="mt-4 text-xs font-bold uppercase tracking-widest text-[#E0B4C2]">
            Competition Management
          </p>

          <h1 className="mt-2 text-2xl font-bold md:text-3xl">
            {competition.name}
          </h1>

          <p className="mt-4 text-sm text-slate-300">
            {competition.organization_code}
            {" · "}
            {competition.season_year}
            {" · "}
            {readableLabel(
              competition.competition_type
            )}
          </p>

          <div className="mt-3 flex flex-wrap gap-3">
            <span
              className={`rounded-full px-4 py-2 text-xs font-bold ${
                published
                  ? "bg-emerald-100 text-emerald-900"
                  : "bg-amber-100 text-amber-900"
              }`}
            >
              {published ? "Published" : "Draft"}
            </span>

            {archived && (
              <span className="rounded-full bg-red-100 px-4 py-2 text-xs font-bold text-red-900">
                Archived
              </span>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-6 px-6 py-7">
        {archived && (
          <div
            role="alert"
            className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-900"
          >
            This competition is archived.
            Restore it through the Archive Center
            before editing or publishing its results.
          </div>
        )}

        {published && !archived && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm leading-7 text-blue-900">
            This competition is currently published.
            You can review its results, but changes
            require returning it to Draft first.
          </div>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-[#002144]">Manage results</h2>
              <p className="mt-1 text-sm text-slate-600">Select a round below to open the score spreadsheet.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/staff/competitions/${id}/review`} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-[#002144] hover:bg-slate-50">Review results</Link>
              <Link href={`/staff/competitions/${id}/sources`} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-[#002144] hover:bg-slate-50">Manage sources</Link>
              <Link href={`/staff/competitions/${id}/verification`} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-[#002144] hover:bg-slate-50">Verification status</Link>
              <Link href={`/staff/competitions/${id}/research`} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-[#002144] hover:border-[#861F41] hover:text-[#861F41]">Research Tasks</Link>
              <Link href={`/staff/competitions/${id}/notes`} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-[#002144] hover:border-[#861F41] hover:text-[#861F41]">Research Notes</Link>
              {canPublish && <Link href={`/staff/competitions/${id}/history`} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-[#002144] hover:border-[#861F41] hover:text-[#861F41]">Revision History</Link>}
              {canPublish && <Link href={`/staff/competitions/${id}/publish`} className="rounded-lg bg-[#861F41] px-4 py-2 text-sm font-semibold text-white hover:bg-[#701832]">Publishing</Link>}
            </div>
          </div>
        </section>

        <section
          id="competition-rounds"
          className="scroll-mt-24 space-y-4"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
              Results Administration
            </p>

            <h2 className="mt-2 font-serif text-3xl font-bold text-[#002144]">
              Competition Rounds
            </h2>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
              Open a round to enter or review its scores and placements.
            </p>
          </div>

          {activeRounds.length ? (
            <div className="space-y-4">
              {activeRounds.map((round) => (
                <article
                  key={round.id}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-5">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-wider text-[#861F41]">
                        {readableLabel(
                          round.round_kind
                        )}
                      </p>

                      <h3 className="mt-2 text-xl font-bold text-[#002144]">
                        {round.name}
                      </h3>

                      <p className="mt-2 text-sm text-slate-600">
                        {round.class_scope
                          ? `Classification: ${round.class_scope}`
                          : "All eligible classifications"}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <Link
                        href={`/staff/competitions/${id}/rounds/${round.id}`}
                        className="inline-flex items-center justify-center rounded-lg bg-[#861F41] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#701832]"
                      >
                        {published
                          ? "View Results"
                          : "Manage Results"}
                        <span
                          aria-hidden="true"
                          className="ml-2"
                        >
                          &rarr;
                        </span>
                      </Link>

                      {!archived && (
                        <Link
                          href={`/staff/competitions/${id}/rounds/${round.id}/spreadsheet`}
                          className="inline-flex items-center justify-center rounded-lg border border-[#861F41]/30 bg-[#861F41]/5 px-5 py-3 text-sm font-bold text-[#861F41] transition hover:bg-[#861F41]/10"
                        >
                          Open Spreadsheet
                        </Link>
                      )}

                      {!archived && (
                        <Link
                          href={`/staff/competitions/${id}/rounds/${round.id}/tools`}
                          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-[#002144] transition hover:bg-slate-50"
                        >
                          Round Tools
                        </Link>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <h3 className="text-xl font-bold text-[#002144]">
                No Active Rounds
              </h3>

              <p className="mt-3 text-sm leading-7 text-slate-600">
                No active rounds are currently configured
                for this competition. The competition
                needs at least one round before bands
                and results can be entered.
              </p>
            </div>
          )}
        </section>

        {published && competition.slug && (
          <Link href={competitionPublicUrl(competition.slug)} className="inline-block text-sm font-bold text-[#861F41] hover:underline">
            View public competition →
          </Link>
        )}

        {canPublish && (
          <details className="rounded-xl border border-slate-200 bg-white p-5">
            <summary className="text-sm font-bold text-[#002144]">Archive settings</summary>
            <div className="mt-5">
              <ArchiveControls kind="competition" recordId={competition.id} name={competition.name} archived={archived} />
            </div>
            <Link href="/staff/archive" className="mt-4 inline-block text-sm font-semibold text-[#861F41]">Open archive center →</Link>
          </details>
        )}

        <div className="flex flex-wrap gap-5 border-t border-slate-200 pt-6">
          <Link
            href="/staff/competitions"
            className="text-sm font-bold text-[#861F41] hover:underline"
          >
            &larr; All Competitions
          </Link>

          <Link
            href="/staff/dashboard"
            className="text-sm font-bold text-[#002144] hover:underline"
          >
            Staff Dashboard
          </Link>

          {canPublish && (
            <Link
              href="/staff/archive"
              className="text-sm font-bold text-[#002144] hover:underline"
            >
              Archive Center
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}

export default function CompetitionManagementPage(
  props: Props
) {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#F4F6F9] px-6 py-12">
          <div
            role="status"
            className="mx-auto max-w-6xl text-sm text-slate-600"
          >
            Loading competition management...
          </div>
        </main>
      }
    >
      <CompetitionManagement params={props.params} />
    </Suspense>
  );
}
