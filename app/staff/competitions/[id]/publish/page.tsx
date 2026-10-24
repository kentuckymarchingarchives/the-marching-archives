
import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN } from "@/lib/band-validation";

import {
  analyzeCompetition,
  type ReviewCompetition,
  type ReviewRound,
  type ReviewEntry,
  type ReviewBand,
  type ReviewCaption,
  type ReviewCaptionScore,
  type ReviewFinding,
} from "@/lib/competition-review";

import {
  approveCompetition,
  publishCompetition,
  unpublishCompetition,
} from "@/app/staff/competitions/publishing-actions";

export const instant = false;

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string }>;
};

const notices: Record<string, string> = {
  approved: "Review approval recorded successfully.",
  published: "Competition published successfully.",
  unpublished:
    "Competition returned to Draft. A new approval will be required.",
};

function FindingCard({
  finding,
  competitionId,
}: {
  finding: ReviewFinding;
  competitionId: string;
}) {
  const style =
    finding.severity === "critical"
      ? {
          border: "border-red-200",
          background: "bg-red-50",
          text: "text-red-900",
          label: "Critical Issue",
        }
      : finding.severity === "warning"
        ? {
            border: "border-amber-200",
            background: "bg-amber-50",
            text: "text-amber-900",
            label: "Review Warning",
          }
        : {
            border: "border-emerald-200",
            background: "bg-emerald-50",
            text: "text-emerald-900",
            label: "Passed",
          };

  return (
    <article
      className={`rounded-xl border p-5 ${style.border} ${style.background}`}
    >
      <p
        className={`text-xs font-bold uppercase tracking-wider ${style.text}`}
      >
        {style.label}
      </p>

      <h3 className={`mt-2 font-bold ${style.text}`}>
        {finding.title}
      </h3>

      <p className={`mt-2 text-sm leading-6 ${style.text}`}>
        {finding.detail}
      </p>

      {finding.roundId && (
        <Link
          href={`/staff/competitions/${competitionId}/rounds/${finding.roundId}`}
          className={`mt-4 inline-flex cursor-pointer rounded-lg border ${style.border} bg-white px-4 py-2 text-sm font-bold ${style.text} hover:underline`}
        >
          Open Round to Fix &rarr;
        </Link>
      )}
    </article>
  );
}

async function PublishingContent({
  params,
  searchParams,
}: Props) {
  const { id } = await params;
  const { message } = await searchParams;

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
        "id, name, season_year, organization_code, competition_date, source_url, publication_status, archived_at"
      )
      .eq("id", id)
      .maybeSingle();

  if (competitionError) {
    throw new Error("Unable to load competition.");
  }

  if (!competitionData) {
    notFound();
  }

  const competition = competitionData as ReviewCompetition;

  const { data: approval, error: approvalError } =
    await supabase
      .from("competition_approvals")
      .select("approved_by, approved_at, review_notes")
      .eq("competition_id", id)
      .maybeSingle();

  if (approvalError) {
    throw new Error("Unable to load review approval.");
  }

  // Load the same information used by the existing
  // Phase 7.1 review page.
  const {
    data: roundData,
    count: roundCount,
    error: roundError,
  } = await supabase
    .from("competition_rounds")
    .select(
      "id, name, class_scope, archived_at",
      { count: "exact" }
    )
    .eq("competition_id", id)
    .order("sort_order", { ascending: true })
    .limit(100);

  if (roundError) {
    throw new Error("Unable to load competition rounds.");
  }

  const rounds = (roundData ?? []) as ReviewRound[];
  const roundIds = rounds.map((round) => round.id);

  let entries: ReviewEntry[] = [];
  let captions: ReviewCaption[] = [];
  let captionScores: ReviewCaptionScore[] = [];
  let bands: ReviewBand[] = [];
  let truncated = (roundCount ?? 0) > rounds.length;

  if (roundIds.length > 0) {
    const [entryResult, captionResult] = await Promise.all([
      supabase
        .from("competition_entries")
        .select(
          "id, band_id, round_id, classification, total_score, class_placement, overall_placement",
          { count: "exact" }
        )
        .in("round_id", roundIds)
        .limit(1000),

      supabase
        .from("score_captions")
        .select("id, round_id, name, max_score", {
          count: "exact",
        })
        .in("round_id", roundIds)
        .limit(1000),
    ]);

    if (entryResult.error || captionResult.error) {
      throw new Error(
        "Unable to load competition results."
      );
    }

    entries = (entryResult.data ?? []) as ReviewEntry[];
    captions = (captionResult.data ?? []) as ReviewCaption[];

    if (
      (entryResult.count ?? 0) > entries.length ||
      (captionResult.count ?? 0) > captions.length
    ) {
      truncated = true;
    }
  }

  const bandIds = [
    ...new Set(entries.map((entry) => entry.band_id)),
  ];

  const entryIds = entries.map((entry) => entry.id);

  if (bandIds.length > 0) {
    const { data, count, error } = await supabase
      .from("bands")
      .select("id, name, archived_at", {
        count: "exact",
      })
      .in("id", bandIds)
      .limit(1000);

    if (error) {
      throw new Error("Unable to load ensemble records.");
    }

    bands = (data ?? []) as ReviewBand[];

    if ((count ?? 0) > bands.length) {
      truncated = true;
    }
  }

  if (entryIds.length > 0) {
    const { data, count, error } = await supabase
      .from("caption_scores")
      .select("entry_id, caption_id, score", {
        count: "exact",
      })
      .in("entry_id", entryIds)
      .limit(1000);

    if (error) {
      throw new Error("Unable to load caption scores.");
    }

    captionScores = (data ?? []) as ReviewCaptionScore[];

    if ((count ?? 0) > captionScores.length) {
      truncated = true;
    }
  }

  const findings = analyzeCompetition({
    competition,
    rounds,
    entries,
    bands,
    captions,
    captionScores,
    truncated,
  });

  const critical = findings.filter(
    (finding) => finding.severity === "critical"
  );

  const warnings = findings.filter(
    (finding) => finding.severity === "warning"
  );

  const passed = findings.filter(
    (finding) => finding.severity === "passed"
  );

  const canManage =
    staff.role === "owner" ||
    staff.role === "admin";

  const published =
    competition.publication_status === "published";

  const archived = Boolean(competition.archived_at);

  const canProceed =
    critical.length === 0 &&
    !truncated &&
    !archived;

  const successMessage =
    message && notices[message]
      ? notices[message]
      : null;

  const activeRounds = rounds.filter(
    (round) => !round.archived_at
  ).length;

  const sourceUrl =
    competition.source_url &&
    /^https?:\/\//i.test(competition.source_url)
      ? competition.source_url
      : null;

  return (
    <div className="mx-auto max-w-6xl space-y-9 px-6 py-10">
      <Link
        href={`/staff/competitions/${id}`}
        className="text-sm font-semibold text-[#861F41] hover:underline"
      >
        &larr; Competition Management
      </Link>

      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
          Administration · Quality Control
        </p>

        <h1 className="mt-3 font-serif text-4xl font-bold text-[#002144]">
          Review &amp; Publish
        </h1>

        <p className="mt-3 text-xl font-semibold text-[#002144]">
          {competition.name}
        </p>

        <p className="mt-2 text-slate-600">
          {competition.organization_code}
          {" · "}
          {competition.season_year}
        </p>
      </header>

      {successMessage && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm font-bold text-emerald-900"
        >
          {successMessage}
        </div>
      )}

      {archived && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-900"
        >
          This competition is archived. Restore it
          before approving or publishing its results.
        </div>
      )}

      {/* Summary */}
      <section className="grid gap-4 sm:grid-cols-4">
        {[
          {
            label: "Critical Issues",
            value: critical.length,
            style: "text-red-800 bg-red-50",
          },
          {
            label: "Warnings",
            value: warnings.length,
            style: "text-amber-800 bg-amber-50",
          },
          {
            label: "Passed Checks",
            value: passed.length,
            style: "text-emerald-800 bg-emerald-50",
          },
          {
            label: "Active Rounds",
            value: activeRounds,
            style: "text-[#002144] bg-white",
          },
        ].map((item) => (
          <div
            key={item.label}
            className={`rounded-2xl border border-slate-200 p-5 ${item.style}`}
          >
            <p className="text-xs font-bold uppercase tracking-wide">
              {item.label}
            </p>

            <p className="mt-3 text-3xl font-bold tabular-nums">
              {item.value}
            </p>
          </div>
        ))}
      </section>

      {/* Progress indicator */}
      <section className="rounded-2xl border border-slate-200 bg-white p-7">
        <h2 className="text-2xl font-bold text-[#002144]">
          Publishing Progress
        </h2>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 p-5">
            <p className="text-sm font-bold text-[#002144]">
              1. Results Review
            </p>
            <p
              className={`mt-2 text-sm font-semibold ${
                canProceed
                  ? "text-emerald-700"
                  : "text-amber-800"
              }`}
            >
              {canProceed
                ? "Automated checks complete"
                : "Needs attention"}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 p-5">
            <p className="text-sm font-bold text-[#002144]">
              2. Historical Approval
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-600">
              {approval
                ? "Approval recorded"
                : "Awaiting Owner/Admin approval"}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 p-5">
            <p className="text-sm font-bold text-[#002144]">
              3. Publication
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-600">
              {published
                ? "Published to the public archive"
                : "Not yet published"}
            </p>
          </div>
        </div>
      </section>

      {/* Automated review */}
      <section
        id="review"
        className="scroll-mt-8 space-y-6 rounded-2xl border border-slate-200 bg-white p-7"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
              Step 1
            </p>

            <h2 className="mt-2 text-2xl font-bold text-[#002144]">
              Review Competition Results
            </h2>

            <p className="mt-3 text-sm leading-7 text-slate-600">
              TMA checks your entered rounds, ensembles,
              placements, and scores for potential
              problems before publication.
            </p>
          </div>

          <Link
            href={`/staff/competitions/${id}/publish`}
            className="cursor-pointer rounded-lg border border-slate-300 px-5 py-3 text-sm font-bold text-[#002144] hover:bg-slate-50"
          >
            Run Review Again
          </Link>
        </div>

        {critical.length === 0 ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
            No critical issues detected by the automated review.
          </p>
        ) : (
          <div className="space-y-3">
            <h3 className="font-bold text-red-900">
              Issues to Resolve ({critical.length})
            </h3>

            {critical.map((finding, index) => (
              <FindingCard
                key={`critical-${index}`}
                finding={finding}
                competitionId={id}
              />
            ))}
          </div>
        )}

        {warnings.length > 0 && (
          <details className="rounded-xl border border-amber-200 bg-amber-50">
            <summary className="cursor-pointer p-5 font-bold text-amber-900">
              Review Warnings ({warnings.length})
            </summary>

            <div className="space-y-3 border-t border-amber-200 p-4">
              {warnings.map((finding, index) => (
                <FindingCard
                  key={`warning-${index}`}
                  finding={finding}
                  competitionId={id}
                />
              ))}
            </div>
          </details>
        )}

        {passed.length > 0 && (
          <details className="rounded-xl border border-emerald-200 bg-emerald-50">
            <summary className="cursor-pointer p-5 font-bold text-emerald-900">
              Passed Checks ({passed.length})
            </summary>

            <div className="space-y-3 border-t border-emerald-200 p-4">
              {passed.map((finding, index) => (
                <FindingCard
                  key={`passed-${index}`}
                  finding={finding}
                  competitionId={id}
                />
              ))}
            </div>
          </details>
        )}

        {truncated && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
          >
            This competition has more records than the
            review can load. Publishing should not
            proceed until the full record set can
            be verified.
          </p>
        )}

        <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-5">
          <Link
            href={`/staff/competitions/${id}`}
            className="cursor-pointer rounded-lg bg-[#002144] px-5 py-3 text-sm font-bold text-white hover:bg-[#123B63]"
          >
            Edit Competition &rarr;
          </Link>

          <Link
            href={`/staff/competitions/${id}/review`}
            className="cursor-pointer rounded-lg border border-slate-300 px-5 py-3 text-sm font-bold text-[#002144] hover:bg-slate-50"
          >
            View Detailed Review
          </Link>
        </div>
      </section>

      {/* Manual verification and approval */}
      <section
        id="approval"
        className="scroll-mt-8 space-y-5 rounded-2xl border border-slate-200 bg-white p-7"
      >
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
            Step 2
          </p>

          <h2 className="mt-2 text-2xl font-bold text-[#002144]">
            Verify &amp; Approve Results
          </h2>

          <p className="mt-3 text-sm leading-7 text-slate-600">
            Automated checks don't establish historical
            accuracy. Compare the results against official
            recaps, programs, score sheets, or other
            documented sources before approving.
          </p>

          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block font-bold text-[#861F41] hover:underline"
            >
              Open Recorded Source &nearr;
            </a>
          )}
        </div>

        <div className="rounded-xl bg-[#F4F6F9] p-5">
          <p className="text-sm font-bold text-[#002144]">
            Historical Verification Checklist
          </p>

          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
            <li>Confirm competition date, name, and location.</li>
            <li>Verify ensembles included in each round.</li>
            <li>Compare official totals and caption scores.</li>
            <li>Confirm class and overall placements, including ties.</li>
            <li>Document exceptions or incomplete source material.</li>
          </ul>
        </div>

        {approval && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
            <p className="text-sm font-bold text-blue-900">
              Approval Recorded
            </p>

            <p className="mt-2 text-sm text-blue-900">
              Approved on{" "}
              {new Date(approval.approved_at).toLocaleString(
                "en-US",
                {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "America/New_York",
                }
              )}
            </p>

            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-blue-900">
              {approval.review_notes}
            </p>

            <p className="mt-3 text-xs leading-6 text-blue-800">
              Publishing will independently verify
              that the approved data has not changed.
            </p>
          </div>
        )}

        {!canManage ? (
          <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
            Editors may review and correct results, but
            an Owner or Administrator must approve them.
          </p>
        ) : published ? (
          <p className="text-sm text-slate-600">
            This competition is already published.
            Return it to Draft before recording a new approval.
          </p>
        ) : !canProceed ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Resolve critical review problems and restore
            any archived records before approval.
          </p>
        ) : (
          <form
            action={approveCompetition}
            className="space-y-5 border-t border-slate-100 pt-5"
          >
            <input
              type="hidden"
              name="competition_id"
              value={id}
            />

            <label className="block text-sm font-semibold text-[#002144]">
              Historical Review Notes *

              <textarea
                name="review_notes"
                required
                minLength={10}
                maxLength={2000}
                rows={4}
                placeholder="Describe the historical sources verified, accuracy checks, and any exceptions."
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-[#002144]"
              />
            </label>

            <label className="flex items-start gap-3 text-sm leading-6 text-slate-700">
              <input
                type="checkbox"
                name="verified"
                value="yes"
                required
                className="mt-1 cursor-pointer"
              />

              <span>
                I have manually reviewed the historical
                sources and verified the competition
                information. My approval will be recorded
                under my staff account.
              </span>
            </label>

            <button
              type="submit"
              className="cursor-pointer rounded-lg bg-[#002144] px-6 py-3 text-sm font-bold text-white hover:bg-[#123B63]"
            >
              {approval
                ? "Approve Reviewed Results Again"
                : "Approve Reviewed Results"}
            </button>
          </form>
        )}
      </section>

      {/* Publication */}
      <section
        id="publication"
        className="scroll-mt-8 space-y-5 rounded-2xl border border-slate-200 bg-white p-7"
      >
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
            Step 3
          </p>

          <h2 className="mt-2 text-2xl font-bold text-[#002144]">
            Publish to The Marching Archives
          </h2>

          <p className="mt-3 text-sm leading-7 text-slate-600">
            Publishing makes the non-archived rounds
            and historical results available through
            the public competition archive.
          </p>
        </div>

        {published ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm font-bold text-emerald-900">
            This competition is currently published.
          </p>
        ) : archived ? (
          <p className="text-sm text-red-800">
            Restore the competition before publishing.
          </p>
        ) : !canManage ? (
          <p className="text-sm text-slate-600">
            Publishing requires an Owner or Administrator.
          </p>
        ) : !canProceed ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            Resolve the review issues above before
            proceeding with publication.
          </p>
        ) : !approval ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            Record a verified historical approval
            in Step 2 before publishing.
          </p>
        ) : (
          <form
            action={publishCompetition}
            className="space-y-4"
          >
            <input
              type="hidden"
              name="competition_id"
              value={id}
            />

            <label className="flex items-start gap-3 text-sm leading-6 text-slate-700">
              <input
                type="checkbox"
                name="confirm_publish"
                value="yes"
                required
                className="mt-1 cursor-pointer"
              />

              <span>
                I understand that publishing makes
                these verified results publicly
                accessible and that changes require
                unpublishing and a new approval.
              </span>
            </label>

            <button
              type="submit"
              className="cursor-pointer rounded-lg bg-emerald-700 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-800"
            >
              Publish Competition
            </button>
          </form>
        )}
      </section>

      {/* Unpublish */}
      {published && canManage && (
        <section className="space-y-5 rounded-2xl border border-red-200 bg-white p-7">
          <h2 className="text-2xl font-bold text-red-900">
            Return to Draft
          </h2>

          <p className="text-sm leading-7 text-slate-600">
            Unpublishing removes this competition
            from the public archive while preserving
            its internal records. The current approval
            will be cleared.
          </p>

          <form
            action={unpublishCompetition}
            className="space-y-4"
          >
            <input
              type="hidden"
              name="competition_id"
              value={id}
            />

            <label className="block text-sm font-bold text-red-900">
              Type UNPUBLISH to confirm

              <input
                name="confirmation"
                required
                pattern="UNPUBLISH"
                autoComplete="off"
                placeholder="UNPUBLISH"
                className="mt-2 block w-full max-w-sm rounded-lg border border-red-300 bg-white px-4 py-3 text-sm"
              />
            </label>

            <button
              type="submit"
              className="cursor-pointer rounded-lg border border-red-300 bg-red-50 px-6 py-3 text-sm font-bold text-red-800 hover:bg-red-100"
            >
              Return Competition to Draft
            </button>
          </form>
        </section>
      )}

      <Link
        href={`/staff/competitions/${id}`}
        className="inline-block text-sm font-bold text-[#861F41] hover:underline"
      >
        &larr; Return to Competition Management
      </Link>
    </div>
  );
}

export default function PublishingPage(props: Props) {
  return (
    <main className="min-h-screen bg-[#F4F6F9]">
      <Suspense
        fallback={
          <div
            role="status"
            className="mx-auto max-w-6xl px-6 py-10 text-sm text-slate-600"
          >
            Loading competition review and publishing...
          </div>
        }
      >
        <PublishingContent {...props} />
      </Suspense>
    </main>
  );
}
