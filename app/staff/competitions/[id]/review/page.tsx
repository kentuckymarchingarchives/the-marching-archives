
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

export const instant = false;

type Props = {
  params: Promise<{ id: string }>;
};

const styles = {
  critical: {
    border: "border-red-200",
    bg: "bg-red-50",
    title: "text-red-900",
    detail: "text-red-800",
    label: "Critical Issue",
    symbol: "✕",
  },
  warning: {
    border: "border-amber-200",
    bg: "bg-amber-50",
    title: "text-amber-900",
    detail: "text-amber-800",
    label: "Warning",
    symbol: "!",
  },
  passed: {
    border: "border-emerald-200",
    bg: "bg-emerald-50",
    title: "text-emerald-900",
    detail: "text-emerald-800",
    label: "Passed",
    symbol: "✓",
  },
};

function FindingCard({
  finding,
  competitionId,
}: {
  finding: ReviewFinding;
  competitionId: string;
}) {
  const style = styles[finding.severity];

  return (
    <div
      className={`rounded-xl border p-5 ${style.border} ${style.bg}`}
    >
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${style.border} bg-white font-bold ${style.title}`}
        >
          {style.symbol}
        </span>

        <div className="min-w-0 flex-1">
          <p
            className={`text-xs font-bold uppercase tracking-wider ${style.title}`}
          >
            {style.label}
          </p>

          <h3 className={`mt-1 font-bold ${style.title}`}>
            {finding.title}
          </h3>

          <p
            className={`mt-2 text-sm leading-6 ${style.detail}`}
          >
            {finding.detail}
          </p>

          {finding.roundId && (
            <Link
              href={`/staff/competitions/${competitionId}/rounds/${finding.roundId}`}
              className={`mt-3 inline-block text-sm font-bold underline ${style.title}`}
            >
              Open Round Results →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

async function ReviewContent({ params }: Props) {
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

  const competition =
    competitionData as ReviewCompetition;

  // Request counts alongside data so a large review
  // never silently skips entries.

  const { data: roundData, count: roundCount, error: roundError } =
    await supabase
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
      throw new Error(
        "Unable to load competition results and captions."
      );
    }

    entries = (entriesResult.data ?? []) as ReviewEntry[];
    captions = (captionsResult.data ?? []) as ReviewCaption[];

    if (
      (entriesResult.count ?? 0) > entries.length ||
      (captionsResult.count ?? 0) > captions.length
    ) {
      truncated = true;
    }
  }

  const entryIds = entries.map((entry) => entry.id);
  const bandIds = [...new Set(
    entries.map((entry) => entry.band_id)
  )];

  if (bandIds.length > 0) {
    const { data, count, error } = await supabase
      .from("bands")
      .select("id, name, archived_at", {
        count: "exact",
      })
      .in("id", bandIds)
      .limit(1000);

    if (error) {
      throw new Error("Unable to load band information.");
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

  const recordedSource = competition.source_url?.trim() ?? "";
  let sourceLink: string | null = null;
  if (recordedSource) {
    try {
      const candidate = new URL(recordedSource);
      if (candidate.protocol === "http:" || candidate.protocol === "https:") {
        sourceLink = candidate.href;
      }
    } catch {
      // Invalid source URLs are surfaced as review warnings.
    }
  }

  const activeRoundCount = rounds.filter(
    (round) => !round.archived_at
  ).length;

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-6 py-10">
      <Link
        href={`/staff/competitions/${id}`}
        className="text-sm font-semibold text-[#861F41]"
      >
        ← Back to Competition
      </Link>

      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
          Phase 7 · Quality Control
        </p>

        <h1 className="mt-3 font-serif text-4xl font-bold text-[#002144]">
          Results Review
        </h1>

        <p className="mt-3 text-xl font-semibold text-[#002144]">
          {competition.name}
        </p>

        <p className="mt-2 text-slate-600">
          {competition.organization_code} ·{" "}
          {competition.season_year}
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "Critical Issues",
            value: critical.length,
            color: "text-red-800",
            background: "bg-red-50",
          },
          {
            label: "Warnings",
            value: warnings.length,
            color: "text-amber-800",
            background: "bg-amber-50",
          },
          {
            label: "Checks Passed",
            value: passed.length,
            color: "text-emerald-800",
            background: "bg-emerald-50",
          },
        ].map((item) => (
          <div
            key={item.label}
            className={`rounded-2xl border border-slate-200 p-6 ${item.background}`}
          >
            <p className={`text-sm font-semibold ${item.color}`}>
              {item.label}
            </p>

            <p className={`mt-3 text-4xl font-bold tabular-nums ${item.color}`}>
              {item.value}
            </p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-7">
        <h2 className="text-2xl font-bold text-[#002144]">
          Review Summary
        </h2>

        {critical.length > 0 ? (
          <p className="mt-4 leading-7 text-red-800">
            <strong>Critical issues detected.</strong>{" "}
            Resolve the issues below before submitting
            this competition for publication approval.
          </p>
        ) : warnings.length > 0 ? (
          <p className="mt-4 leading-7 text-amber-800">
            <strong>No critical structural issues found.</strong>{" "}
            Review the warnings and verify the historical
            source material before proceeding.
          </p>
        ) : (
          <p className="mt-4 leading-7 text-emerald-800">
            <strong>All automated checks passed.</strong>{" "}
            A staff member still needs to verify
            results against the original source.
          </p>
        )}

        <div className="mt-6 grid gap-4 border-t border-slate-100 pt-6 sm:grid-cols-3">
          <div>
            <p className="text-xs font-bold uppercase text-slate-500">
              Active Rounds
            </p>
            <p className="mt-2 text-2xl font-bold text-[#002144]">
              {activeRoundCount}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-slate-500">
              Loaded Entries
            </p>
            <p className="mt-2 text-2xl font-bold text-[#002144]">
              {entries.length}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-slate-500">
              Publication Status
            </p>
            <p className="mt-2 text-lg font-bold text-[#002144]">
              {competition.publication_status === "published"
                ? "Published"
                : "Draft"}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-[#002144]">
          Critical Issues ({critical.length})
        </h2>

        {critical.length ? (
          critical.map((finding, index) => (
            <FindingCard
              key={`critical-${index}`}
              finding={finding}
              competitionId={id}
            />
          ))
        ) : (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-sm text-emerald-900">
            No critical structural issues detected.
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-[#002144]">
          Warnings ({warnings.length})
        </h2>

        {warnings.length ? (
          warnings.map((finding, index) => (
            <FindingCard
              key={`warning-${index}`}
              finding={finding}
              competitionId={id}
            />
          ))
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            No automated warnings detected.
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-[#002144]">
          Passed Checks ({passed.length})
        </h2>

        <div className="space-y-3">
          {passed.map((finding, index) => (
            <FindingCard
              key={`passed-${index}`}
              finding={finding}
              competitionId={id}
            />
          ))}
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

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white" aria-labelledby="source-review-title">
        <div className="border-b border-slate-200 bg-[#002144] px-6 py-6 text-white sm:px-7">
          <p className="text-xs font-bold uppercase tracking-widest text-[#eac0cd]">
            Historical evidence
          </p>
          <h2 id="source-review-title" className="mt-2 text-2xl font-bold">
            Source & Manual Verification
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-200">
            Automated review checks the structure of the record, not its historical accuracy.
            Staff must compare the entries and scores against trustworthy source material.
          </p>
        </div>

        <div className="space-y-7 p-6 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-slate-200 bg-[#f6f7f9] p-5">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Recorded online source
              </p>
              <p className="mt-2 font-semibold text-[#002144]">
                {sourceLink
                  ? "Source link recorded — manual verification needed"
                  : recordedSource
                    ? "Recorded link is invalid"
                    : "No online source recorded"}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {sourceLink
                  ? "Open the source and confirm it actually contains the event results. A URL alone is not proof of accuracy."
                  : recordedSource
                    ? "Update this competition with a complete http:// or https:// source URL."
                    : "If the source is an offline program or recap sheet, retain its citation in your existing documentation workflow."}
              </p>
              {recordedSource && (
                <p className="mt-2 break-all text-xs text-slate-500">
                  {recordedSource}
                </p>
              )}
            </div>
            {sourceLink && (
              <a
                href={sourceLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 rounded-lg bg-[#861F41] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#6d1733]"
              >
                Open source ↗
              </a>
            )}
          </div>

          <div>
            <h3 className="font-bold text-[#002144]">Manual review checklist</h3>
            <ul className="mt-3 grid list-disc gap-3 pl-5 text-sm leading-6 text-slate-700 md:grid-cols-2 md:gap-x-9">
              <li>Verify event name, date, and location.</li>
              <li>Confirm every participating ensemble and its classification.</li>
              <li>Compare caption scores and total scores to the source.</li>
              <li>Check class and overall placements, including ties.</li>
              <li>Verify penalties, disqualifications, and score corrections.</li>
              <li>Confirm that each round is represented accurately.</li>
            </ul>
          </div>

          <div className="border-t border-slate-200 pt-5">
            <p className="text-sm leading-6 text-slate-600">
              <strong className="text-[#002144]">Verification status:</strong>{" "}
              This page does not record a manual approval or certify a result as verified.
              Completing the checklist above is a staff review activity, not a saved sign-off.
            </p>
            <Link
              href={`/staff/competitions/${id}`}
              className="mt-4 inline-flex rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold text-[#002144] hover:bg-slate-50"
            >
              Return to competition management →
            </Link>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/staff/competitions/${id}`}
          className="rounded-lg bg-[#002144] px-6 py-3 text-sm font-bold text-white hover:bg-[#123B63]"
        >
          Return to Competition
        </Link>

        <Link
          href={`/staff/competitions/${id}/review`}
          className="rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-bold text-[#002144] hover:bg-slate-50"
        >
          Run Review Again
        </Link>
      </div>
    </div>
  );
}

export default function CompetitionReviewPage(props: Props) {
  return (
    <main className="min-h-screen bg-[#F4F6F9]">
      <Suspense
        fallback={
          <div
            role="status"
            className="mx-auto max-w-6xl px-6 py-10 text-sm text-slate-600"
          >
            Reviewing competition records...
          </div>
        }
      >
        <ReviewContent {...props} />
      </Suspense>
    </main>
  );
}
