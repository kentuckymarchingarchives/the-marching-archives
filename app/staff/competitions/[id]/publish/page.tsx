
import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN } from "@/lib/band-validation";
import StaffActionButton from "@/components/StaffActionButton";

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

const messages: Record<string, string> = {
  approved:
    "Historical review approved. You can now proceed to publishing.",
  published:
    "Success! This competition is published in The Marching Archives.",
  unpublished:
    "Competition returned to Draft. Its previous approval has been cleared.",
};

function ReviewFindingCard({
  finding,
  competitionId,
}: {
  finding: ReviewFinding;
  competitionId: string;
}) {
  const critical = finding.severity === "critical";
  const warning = finding.severity === "warning";

  const classes = critical
    ? "border-red-200 bg-red-50 text-red-900"
    : warning
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-emerald-200 bg-emerald-50 text-emerald-900";

  return (
    <div className={`rounded-xl border p-5 ${classes}`}>
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-current/20 bg-white font-bold"
        >
          {critical ? "!" : warning ? "?" : "✓"}
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="font-bold">
            {finding.title}
          </h3>

          <p className="mt-2 text-sm leading-6">
            {finding.detail}
          </p>

          {finding.roundId && (
            <Link
              href={`/staff/competitions/${competitionId}/rounds/${finding.roundId}`}
              className="mt-4 inline-flex cursor-pointer rounded-lg border border-current/20 bg-white px-4 py-2 text-sm font-bold hover:underline"
            >
              Open Round to Fix &rarr;
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function WorkflowStep({
  number,
  title,
  status,
  href,
  complete,
}: {
  number: number;
  title: string;
  status: string;
  href: string;
  complete: boolean;
}) {
  return (
    <a
      href={href}
      className="group flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-[#861F41]"
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
          complete
            ? "bg-emerald-100 text-emerald-800"
            : "bg-[#F4F6F9] text-[#002144]"
        }`}
      >
        {complete ? "✓" : number}
      </span>

      <span className="min-w-0">
        <span className="block font-bold text-[#002144] group-hover:text-[#861F41]">
          {title}
        </span>
        <span className="mt-1 block text-xs leading-5 text-slate-600">
          {status}
        </span>
      </span>
    </a>
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

  const [
    competitionResult,
    approvalResult,
    roundsResult,
  ] = await Promise.all([
    supabase
      .from("competitions")
      .select(
        "id, name, season_year, organization_code, competition_date, source_url, publication_status, archived_at"
      )
      .eq("id", id)
      .maybeSingle(),

    supabase
      .from("competition_approvals")
      .select("approved_by, approved_at, review_notes")
      .eq("competition_id", id)
      .maybeSingle(),

    supabase
      .from("competition_rounds")
      .select(
        "id, name, class_scope, archived_at",
        { count: "exact" }
      )
      .eq("competition_id", id)
      .order("sort_order", { ascending: true })
      .limit(100),
  ]);

  if (
    competitionResult.error ||
    approvalResult.error ||
    roundsResult.error
  ) {
    throw new Error(
      "Unable to load the competition publishing workflow."
    );
  }

  if (!competitionResult.data) {
    notFound();
  }

  const competition =
    competitionResult.data as ReviewCompetition;

  const approval = approvalResult.data;
  const rounds = (roundsResult.data ?? []) as ReviewRound[];
  const roundIds = rounds.map((round) => round.id);

  let entries: ReviewEntry[] = [];
  let captions: ReviewCaption[] = [];
  let captionScores: ReviewCaptionScore[] = [];
  let bands: ReviewBand[] = [];

  let truncated =
    (roundsResult.count ?? 0) > rounds.length;

  if (roundIds.length > 0) {
    const [entriesResult, captionsResult] =
      await Promise.all([
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
          .select(
            "id, round_id, name, max_score",
            { count: "exact" }
          )
          .in("round_id", roundIds)
          .limit(1000),
      ]);

    if (entriesResult.error || captionsResult.error) {
      throw new Error("Unable to review competition results.");
    }

    entries = (entriesResult.data ?? []) as ReviewEntry[];
    captions =
      (captionsResult.data ?? []) as ReviewCaption[];

    if (
      (entriesResult.count ?? 0) > entries.length ||
      (captionsResult.count ?? 0) > captions.length
    ) {
      truncated = true;
    }
  }

  const entryIds = entries.map((entry) => entry.id);
  const bandIds = [
    ...new Set(entries.map((entry) => entry.band_id)),
  ];

  if (bandIds.length > 0) {
    const { data, count, error } = await supabase
      .from("bands")
      .select("id, name, archived_at", { count: "exact" })
      .in("id", bandIds)
      .limit(1000);

    if (error) {
      throw new Error("Unable to review ensemble records.");
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
      throw new Error("Unable to review caption scores.");
    }

    captionScores =
      (data ?? []) as ReviewCaptionScore[];

    if ((count ?? 0) > captionScores.length) {
      truncated = true;
    }
  }

  // Reviewed citations support manual verification; their presence does not
  // certify each score or replace the existing publication approval workflow.
  const { data: citationRows, error: citationError } = await supabase
    .from("competition_sources")
    .select("id, title, source_type, url, citation, reviewed_at")
    .eq("competition_id", id)
    .order("created_at", { ascending: false })
    .limit(501);

  if (citationError) {
    throw new Error(
      "Unable to load competition citations. Ensure the source-management migration has been applied."
    );
  }

  const sourceRecords = citationRows ?? [];
  const sourcesTruncated = sourceRecords.length > 500;
  const reviewedRecords = sourceRecords.filter((source) => Boolean(source.reviewed_at));
  const pendingRecords = sourceRecords.filter((source) => !source.reviewed_at);

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

  const reviewReady =
    critical.length === 0 &&
    !truncated &&
    !archived;

  const hasApproval = Boolean(approval);

  const successMessage =
    message && Object.hasOwn(messages, message)
      ? messages[message]
      : null;

  const activeRoundCount = rounds.filter(
    (round) => !round.archived_at
  ).length;

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
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
      <Link
        href={`/staff/competitions/${id}`}
        className="text-sm font-semibold text-[#861F41] hover:underline"
      >
        &larr; Competition Management
      </Link>

      <header className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
          Staff Administration
        </p>

        <h1 className="font-serif text-4xl font-bold text-[#002144]">
          Review &amp; Publish
        </h1>

        <p className="text-xl font-bold text-[#002144]">
          {competition.name}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-slate-600">
            {competition.organization_code}
            {" · "}
            {competition.season_year}
          </span>

          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              published
                ? "bg-emerald-100 text-emerald-900"
                : "bg-amber-100 text-amber-900"
            }`}
          >
            {published ? "Published" : "Draft"}
          </span>
        </div>
      </header>

      {successMessage && (
        <div
          id="workflow-message"
          role="status"
          className="scroll-mt-24 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm font-bold text-emerald-900"
        >
          {successMessage}
        </div>
      )}

      {archived && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-900"
        >
          This competition is archived. Restore it
          before approving or publishing results.
        </p>
      )}

      <nav
        aria-label="Publishing workflow sections"
        className="grid gap-3 md:grid-cols-3"
      >
        <WorkflowStep
          number={1}
          title="Review Results"
          status={
            reviewReady
              ? "Automated checks ready"
              : `${critical.length} critical issues; review required`
          }
          complete={reviewReady}
          href="#review"
        />

        <WorkflowStep
          number={2}
          title="Approve Results"
          status={
            hasApproval
              ? "Approval recorded"
              : "Source verification required"
          }
          complete={hasApproval}
          href="#approval"
        />

        <WorkflowStep
          number={3}
          title="Publish"
          status={
            published
              ? "Visible in public archive"
              : "Awaiting publication"
          }
          complete={published}
          href="#publication"
        />
      </nav>

      <section className="grid gap-3 sm:grid-cols-4">
        {[
          {
            label: "Critical Issues",
            value: critical.length,
            color: "text-red-800",
          },
          {
            label: "Warnings",
            value: warnings.length,
            color: "text-amber-800",
          },
          {
            label: "Passed Checks",
            value: passed.length,
            color: "text-emerald-800",
          },
          {
            label: "Active Rounds",
            value: activeRoundCount,
            color: "text-[#002144]",
          },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              {item.label}
            </p>
            <p
              className={`mt-3 text-3xl font-bold tabular-nums ${item.color}`}
            >
              {item.value}
            </p>
          </div>
        ))}
      </section>

      <section
        id="review"
        className="scroll-mt-8 space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
              Step 1
            </p>

            <h2 className="mt-2 text-2xl font-bold text-[#002144]">
              Review Competition Results
            </h2>

            <p className="mt-3 text-sm leading-7 text-slate-600">
              Automated checks help identify incomplete
              records, inconsistent placements, and other
              potential problems.
            </p>
          </div>

          <Link
            href={`/staff/competitions/${id}/publish#review`}
            className="cursor-pointer rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-[#002144] hover:bg-slate-50"
          >
            Refresh Review
          </Link>
        </div>

        {critical.length === 0 ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
            No critical issues detected by the automated review.
          </p>
        ) : (
          <div className="space-y-3">
            <h3 className="font-bold text-red-900">
              Issues to Fix ({critical.length})
            </h3>

            {critical.map((finding, index) => (
              <ReviewFindingCard
                key={`critical-${index}`}
                finding={finding}
                competitionId={id}
              />
            ))}
          </div>
        )}

        {truncated && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
          >
            Some records exceed the review limits.
            The full competition must be checked before
            it can be safely approved.
          </p>
        )}

        {warnings.length > 0 && (
          <details className="rounded-xl border border-amber-200">
            <summary className="cursor-pointer bg-amber-50 p-5 font-bold text-amber-900">
              Warnings ({warnings.length})
            </summary>

            <div className="space-y-3 p-4">
              {warnings.map((finding, index) => (
                <ReviewFindingCard
                  key={`warning-${index}`}
                  finding={finding}
                  competitionId={id}
                />
              ))}
            </div>
          </details>
        )}

        {passed.length > 0 && (
          <details className="rounded-xl border border-emerald-200">
            <summary className="cursor-pointer bg-emerald-50 p-5 font-bold text-emerald-900">
              Passed Checks ({passed.length})
            </summary>

            <div className="space-y-3 p-4">
              {passed.map((finding, index) => (
                <ReviewFindingCard
                  key={`passed-${index}`}
                  finding={finding}
                  competitionId={id}
                />
              ))}
            </div>
          </details>
        )}

        <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-5">
          <Link
            href={`/staff/competitions/${id}`}
            className="cursor-pointer rounded-lg bg-[#002144] px-5 py-3 text-sm font-bold text-white hover:bg-[#123B63]"
          >
            Manage Competition &rarr;
          </Link>

          <Link
            href={`/staff/competitions/${id}/review`}
            className="cursor-pointer rounded-lg border border-slate-300 px-5 py-3 text-sm font-bold text-[#002144]"
          >
            Full Review Report
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8" aria-labelledby="citations-review-heading">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">Historical evidence</p>
            <h2 id="citations-review-heading" className="mt-2 text-2xl font-bold text-[#002144]">Citation Review</h2>
            <p className="mt-2 text-sm text-slate-600">Reviewed citations are evidence references, not an automatic certification of scores.</p>
          </div>
          <Link href={`/staff/competitions/${id}/sources`} className="rounded-lg bg-[#861F41] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#6d1733]">Manage Sources →</Link>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-4"><p className="text-sm text-slate-600">Recorded</p><p className="mt-1 text-2xl font-bold tabular-nums text-[#002144]">{sourceRecords.length}{sourcesTruncated ? "+" : ""}</p></div>
          <div className="rounded-xl bg-emerald-50 p-4"><p className="text-sm text-emerald-800">Reviewed</p><p className="mt-1 text-2xl font-bold tabular-nums text-emerald-900">{reviewedRecords.length}{sourcesTruncated ? "+" : ""}</p></div>
          <div className="rounded-xl bg-amber-50 p-4"><p className="text-sm text-amber-800">Pending</p><p className="mt-1 text-2xl font-bold tabular-nums text-amber-900">{pendingRecords.length}{sourcesTruncated ? "+" : ""}</p></div>
        </div>
        {sourcesTruncated && <p className="mt-4 text-sm font-semibold text-amber-800">More than 500 references exist; counts are partial. Open Manage Sources to review the full record.</p>}
        {reviewedRecords.length === 0 && <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">No reviewed citations recorded. Verify sources before approving publication.</p>}
        {reviewedRecords.length > 0 && <ul className="mt-5 space-y-2">{reviewedRecords.slice(0, 8).map((source) => <li key={source.id} className="rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-700"><span className="font-semibold text-[#002144]">{source.title}</span><span className="ml-2 text-xs text-emerald-800">Reviewed</span></li>)}</ul>}
      </section>

      <section
        id="approval"
        className="scroll-mt-8 space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8"
      >
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
            Step 2
          </p>

          <h2 className="mt-2 text-2xl font-bold text-[#002144]">
            Verify &amp; Approve
          </h2>

          <p className="mt-3 text-sm leading-7 text-slate-600">
            Compare recorded results against the original
            historical source material. Automated checks
            alone do not verify historical accuracy.
          </p>

          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block font-bold text-[#861F41] hover:underline"
            >
              Open Recorded Source ↗
            </a>
          )}
        </div>

        <div className="rounded-xl bg-[#F4F6F9] p-5">
          <p className="font-bold text-[#002144]">
            Manual Verification Checklist
          </p>

          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
            <li>Confirm the competition name, date, and location.</li>
            <li>Verify the competing ensembles and classifications.</li>
            <li>Compare totals, placements, and caption scores.</li>
            <li>Identify ties, penalties, and documented exceptions.</li>
            <li>Record which historical sources were reviewed.</li>
          </ul>
        </div>

        {approval && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
            <p className="font-bold text-blue-900">
              Approval on File
            </p>

            <p className="mt-2 text-sm text-blue-900">
              Approved{" "}
              {new Date(approval.approved_at).toLocaleString(
                "en-US",
                {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "America/New_York",
                }
              )}
            </p>

            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-blue-900">
              {approval.review_notes}
            </p>

            <p className="mt-3 text-xs text-blue-800">
              The publishing function will verify that
              the approved records have not changed.
            </p>
          </div>
        )}

        {!canManage ? (
          <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-600">
            Editors may review and correct results.
            Only Owners and Administrators can approve them.
          </p>
        ) : published ? (
          <p className="text-sm text-slate-600">
            This competition is published. Return it
            to Draft before making new corrections.
          </p>
        ) : !reviewReady ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            Approval is unavailable until critical
            issues are resolved and the entire record
            set has been reviewed.
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
                placeholder="Describe the source documents checked, accuracy verification, and any exceptions."
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
                I have manually verified the historical
                results against the available source material.
                This approval will be recorded under my
                staff account.
              </span>
            </label>

            <StaffActionButton
              label={
                approval
                  ? "Approve Again"
                  : "Approve Reviewed Results"
              }
              pendingLabel="Approving..."
              variant="navy"
            />
          </form>
        )}
      </section>

      <section
        id="publication"
        className="scroll-mt-8 space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8"
      >
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
            Step 3
          </p>

          <h2 className="mt-2 text-2xl font-bold text-[#002144]">
            Publish Results
          </h2>

          <p className="mt-3 text-sm leading-7 text-slate-600">
            Publishing makes the competition's
            non-archived rounds and verified results
            available in the public archive.
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
            Publishing is restricted to Owners and
            Administrators.
          </p>
        ) : !reviewReady ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            Resolve review problems before publishing.
          </p>
        ) : !approval ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            An approved historical review is required
            before publication.
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
                I understand that these results will
                become publicly accessible. Corrections
                will require unpublishing and a new approval.
              </span>
            </label>

            <StaffActionButton
              label="Publish Competition"
              pendingLabel="Publishing..."
              variant="green"
            />
          </form>
        )}
      </section>

      {published && canManage && (
        <section
          id="unpublish"
          className="scroll-mt-8 space-y-5 rounded-2xl border border-red-200 bg-white p-6 shadow-sm md:p-8"
        >
          <h2 className="text-2xl font-bold text-red-900">
            Return Competition to Draft
          </h2>

          <p className="text-sm leading-7 text-slate-600">
            Returning to Draft removes the competition
            from the public archive without deleting
            its historical records. The previous approval
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
                className="mt-2 block w-full max-w-sm rounded-lg border border-red-300 bg-white px-4 py-3 text-sm text-[#002144]"
              />
            </label>

            <StaffActionButton
              label="Return to Draft"
              pendingLabel="Unpublishing..."
              variant="danger"
            />
          </form>
        </section>
      )}

      <div className="flex flex-wrap gap-4">
        <Link
          href={`/staff/competitions/${id}`}
          className="font-bold text-[#861F41] hover:underline"
        >
          &larr; Competition Management
        </Link>

        <Link
          href="/staff/dashboard"
          className="font-bold text-[#002144] hover:underline"
        >
          Staff Dashboard
        </Link>
      </div>
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
            Loading review and publishing workflow...
          </div>
        }
      >
        <PublishingContent {...props} />
      </Suspense>
    </main>
  );
}
