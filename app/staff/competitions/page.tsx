
import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN } from "@/lib/band-validation";
import { readableLabel } from "@/lib/competition-config";
import { competitionPublicUrl } from "@/lib/public-competition-routes";

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

function formatDate(value: string | null): string {
  if (!value) return "Date not recorded";

  const date = new Date(`${value}T12:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    return "Date not recorded";
  }

  return date.toLocaleDateString("en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  });
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
        {label}
      </p>

      <p className="mt-3 text-lg font-bold text-[#002144]">
        {value}
      </p>
    </div>
  );
}

async function CompetitionManagement({ params }: Props) {
  const { id } = await params;

  if (!UUID_PATTERN.test(id)) {
    notFound();
  }

  const supabase = await createClient();

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
    throw new Error("Unable to load competition rounds.");
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

  const location = [
    competition.city,
    competition.state,
    competition.country,
  ]
    .filter(Boolean)
    .join(", ");

  let sourceUrl: string | null = null;

  if (competition.source_url) {
    try {
      const parsed = new URL(competition.source_url);

      if (
        parsed.protocol === "https:" ||
        parsed.protocol === "http:"
      ) {
        sourceUrl = parsed.toString();
      }
    } catch {
      sourceUrl = null;
    }
  }

  return (
    <main className="min-h-screen bg-[#F4F6F9]">
      <section className="bg-[#002144] px-6 py-12 text-white">
        <div className="mx-auto max-w-6xl">
          <Link
            href="/staff/competitions"
            className="text-sm font-semibold text-[#E0B4C2] hover:text-white hover:underline"
          >
            &larr; All Competitions
          </Link>

          <p className="mt-8 text-xs font-bold uppercase tracking-widest text-[#E0B4C2]">
            Competition Management
          </p>

          <h1 className="mt-3 font-serif text-3xl font-bold md:text-4xl">
            {competition.name}
          </h1>

          <p className="mt-4 text-sm text-slate-300">
            {competition.organization_code}
            {" · "}
            {competition.season_year}
            {" · "}
            {readableLabel(competition.competition_type)}
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
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

      <div className="mx-auto max-w-6xl space-y-10 px-6 py-10">
        {archived && (
          <div
            role="alert"
            className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"
          >
            This competition is archived.
            Restore it before editing or publishing.
          </div>
        )}

        {published && !archived && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900">
            This competition is published.
            Results are read-only until the competition
            is returned to Draft.
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <InfoCard
            label="Organization"
            value={competition.organization_code}
          />

          <InfoCard
            label="Season"
            value={competition.season_year}
          />

          <InfoCard
            label="Active Rounds"
            value={activeRounds.length}
          />

          <InfoCard
            label="Publication"
            value={published ? "Published" : "Draft"}
          />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
            Event Details
          </p>

          <h2 className="mt-2 font-serif text-2xl font-bold text-[#002144]">
            Competition Information
          </h2>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Date
              </p>

              <p className="mt-2 font-semibold text-[#002144]">
                {formatDate(
                  competition.competition_date
                )}
              </p>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Location
              </p>

              <p className="mt-2 font-semibold text-[#002144]">
                {location || "Location not recorded"}
              </p>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Competition Type
              </p>

              <p className="mt-2 font-semibold text-[#002144]">
                {readableLabel(
                  competition.competition_type
                )}
              </p>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Historical Source
              </p>

              {sourceUrl ? (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block font-semibold text-[#861F41] hover:underline"
                >
                  Open Recorded Source &rarr;
                </a>
              ) : (
                <p className="mt-2 font-semibold text-slate-500">
                  No source link recorded
                </p>
              )}
            </div>
          </div>
        </section>

        <section
          id="competition-rounds"
          className="scroll-mt-8 space-y-5"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
              Results Administration
            </p>

            <h2 className="mt-2 font-serif text-3xl font-bold text-[#002144]">
              Competition Rounds
            </h2>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
              Use the live spreadsheet to enter results
              for multiple bands at once, or open the
              individual editor to manage custom captions,
              lineups, and detailed results.
            </p>
          </div>

          {activeRounds.length ? (
            <div className="space-y-4">
              {activeRounds.map((round) => {
                const base =
                  `/staff/competitions/${id}/rounds/${round.id}`;

                return (
                  <article
                    key={round.id}
                    className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-5">
                      <div>
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
                          href={`${base}/spreadsheet`}
                          className="rounded-lg bg-[#861F41] px-5 py-3 text-sm font-bold text-white hover:bg-[#701832]"
                        >
                          Open Spreadsheet &rarr;
                        </Link>

                        <Link
                          href={base}
                          className="rounded-lg bg-[#002144] px-5 py-3 text-sm font-bold text-white hover:bg-[#123B63]"
                        >
                          Individual Editor
                        </Link>

                        {!archived && (
                          <Link
                            href={`${base}/tools`}
                            className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-[#002144] hover:bg-slate-50"
                          >
                            Round Tools
                          </Link>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
              <h3 className="text-xl font-bold text-[#002144]">
                No Active Rounds
              </h3>

              <p className="mt-3 text-sm text-slate-600">
                Create or restore an active competition
                round before entering results.
              </p>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
            Historical Verification
          </p>

          <h2 className="mt-2 font-serif text-2xl font-bold text-[#002144]">
            Review &amp; Publishing
          </h2>

          <p className="mt-3 text-sm leading-7 text-slate-600">
            Verify official placements, review historical
            scoring, and approve results before publication.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/staff/competitions/${id}/review`}
              className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-bold text-[#002144]"
            >
              Full Review Report
            </Link>

            <Link
              href={`/staff/competitions/${id}/publish`}
              className="rounded-lg bg-[#002144] px-5 py-3 text-sm font-bold text-white hover:bg-[#123B63]"
            >
              Review &amp; Publish &rarr;
            </Link>

            {published && competition.slug && (
              <Link
                href={competitionPublicUrl(
                  competition.slug
                )}
                className="rounded-lg bg-emerald-700 px-5 py-3 text-sm font-bold text-white"
              >
                View Public Results
              </Link>
            )}
          </div>

          {!canPublish && (
            <p className="mt-5 text-xs text-slate-500">
              Editors can enter and review draft results.
              Only Owners and Administrators can approve
              and publish competitions.
            </p>
          )}
        </section>

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
          <p
            role="status"
            className="mx-auto max-w-6xl text-sm text-slate-600"
          >
            Loading competition management...
          </p>
        </main>
      }
    >
      <CompetitionManagement params={props.params} />
    </Suspense>
  );
}
