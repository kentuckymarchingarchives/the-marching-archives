
import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN } from "@/lib/band-validation";

import {
  approveCompetition,
  publishCompetition,
  unpublishCompetition,
} from "@/app/staff/competitions/publishing-actions";

export const instant = false;

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    message?: string;
  }>;
};

const notices: Record<string, string> = {
  approved: "The competition review was approved.",
  published: "Competition published successfully.",
  unpublished:
    "Competition returned to draft. A new approval is required before republishing.",
};

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

  const { data: competition, error: competitionError } =
    await supabase
      .from("competitions")
      .select(
        "id, name, season_year, organization_code, publication_status, archived_at, source_url"
      )
      .eq("id", id)
      .maybeSingle();

  if (competitionError) {
    throw new Error(
      "Unable to load competition details."
    );
  }

  if (!competition) {
    notFound();
  }

  const { data: approval, error: approvalError } =
    await supabase
      .from("competition_approvals")
      .select(
        "approved_by, approved_at, review_notes"
      )
      .eq("competition_id", id)
      .maybeSingle();

  if (approvalError) {
    throw new Error(
      "Unable to load review approval."
    );
  }

  const canManage =
    staff.role === "owner" ||
    staff.role === "admin";

  const published =
    competition.publication_status === "published";

  const archived =
    Boolean(competition.archived_at);

  const successMessage =
    message && notices[message]
      ? notices[message]
      : null;

  return (
    <div className="mx-auto max-w-5xl space-y-9 px-6 py-10">
      <Link
        href={`/staff/competitions/${id}`}
        className="text-sm font-semibold text-[#861F41]"
      >
        ← Competition Details
      </Link>

      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
          Administration · Publishing
        </p>

        <h1 className="mt-3 font-serif text-4xl font-bold text-[#002144]">
          Review Approval & Publishing
        </h1>

        <p className="mt-3 text-xl font-semibold text-[#002144]">
          {competition.name}
        </p>

        <p className="mt-2 text-slate-600">
          {competition.organization_code} ·{" "}
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
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
          This competition is archived. It must be
          restored before it can be approved or published.
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Publication Status
          </p>

          <p className="mt-3 text-xl font-bold text-[#002144]">
            {published ? "Published" : "Draft"}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Recorded Approval
          </p>

          <p className="mt-3 text-xl font-bold text-[#002144]">
            {approval ? "On File" : "Not Approved"}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Your Staff Role
          </p>

          <p className="mt-3 text-xl font-bold capitalize text-[#002144]">
            {staff.role}
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-7">
        <h2 className="text-2xl font-bold text-[#002144]">
          Step 1 — Review Competition Results
        </h2>

        <p className="mt-3 text-sm leading-7 text-slate-600">
          Run the Phase 7.1 review and address any
          critical issues. Then verify the scores,
          placements, participating ensembles, and
          competition information against the original
          historical record.
        </p>

        <Link
          href={`/staff/competitions/${id}/review`}
          className="mt-5 inline-block cursor-pointer rounded-lg bg-[#002144] px-6 py-3 text-sm font-bold text-white hover:bg-[#123B63]"
        >
          Open Results Review →
        </Link>

        {competition.source_url && (
          <p className="mt-4 text-sm text-slate-600">
            A source URL is recorded for this competition.
            Confirm that it supports the results being published.
          </p>
        )}
      </section>

      <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-7">
        <div>
          <h2 className="text-2xl font-bold text-[#002144]">
            Step 2 — Approve Historical Results
          </h2>

          <p className="mt-3 text-sm leading-7 text-slate-600">
            Only an Owner or Administrator can
            approve the competition after manually
            reviewing its historical sources.
          </p>
        </div>

        {approval && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
            <p className="text-sm font-bold text-blue-900">
              Approval Recorded
            </p>

            <p className="mt-2 text-sm text-blue-900">
              Approved on{" "}
              {new Date(
                approval.approved_at
              ).toLocaleString("en-US", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "America/New_York",
              })}
            </p>

            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-blue-900">
              {approval.review_notes}
            </p>

            <p className="mt-3 text-xs leading-6 text-blue-800">
              An approval was recorded for a specific
              version of this competition. Publishing
              will verify that its underlying data has
              not changed since approval.
            </p>
          </div>
        )}

        {canManage && !published && !archived ? (
          <form
            action={approveCompetition}
            className="space-y-5"
          >
            <input
              type="hidden"
              name="competition_id"
              value={id}
            />

            <label className="block text-sm font-semibold text-[#002144]">
              Review Notes *

              <textarea
                name="review_notes"
                required
                minLength={10}
                maxLength={2000}
                rows={5}
                placeholder="Describe the historical sources reviewed, the accuracy checks completed, and any documented exceptions."
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
                I have reviewed the competition data
                and verified it against the available
                historical source material. I understand
                that this approval is recorded under
                my staff account.
              </span>
            </label>

            <button
              type="submit"
              className="cursor-pointer rounded-lg bg-[#002144] px-6 py-3 text-sm font-bold text-white hover:bg-[#123B63]"
            >
              {approval
                ? "Review & Approve Again"
                : "Approve Competition"}
            </button>
          </form>
        ) : !canManage ? (
          <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
            You can review and prepare results, but
            publishing approvals require an Owner
            or Administrator.
          </p>
        ) : published ? (
          <p className="text-sm text-slate-600">
            This competition is already published.
            Unpublish it before making corrections
            and recording a new approval.
          </p>
        ) : null}
      </section>

      <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-7">
        <h2 className="text-2xl font-bold text-[#002144]">
          Step 3 — Publish Competition
        </h2>

        <p className="text-sm leading-7 text-slate-600">
          Publishing makes the competition's
          non-archived rounds and historical results
          eligible for display on the public website.
          Its data will be locked against editing
          through the normal draft results editor.
        </p>

        {published ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm font-bold text-emerald-900">
            This competition is published.
          </div>
        ) : !canManage ? (
          <p className="text-sm text-slate-600">
            Publishing requires an Owner or Administrator.
          </p>
        ) : !approval ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            An approved review must be recorded
            before this competition can be published.
          </div>
        ) : archived ? (
          <p className="text-sm text-red-800">
            Restore this competition before publishing.
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
                I understand that this action
                publishes this competition's
                reviewed results and that the
                public will be able to access
                them once the public results
                pages are enabled.
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

      {published && canManage && (
        <section className="space-y-5 rounded-2xl border border-red-200 bg-white p-7">
          <h2 className="text-2xl font-bold text-red-900">
            Unpublish Competition
          </h2>

          <p className="text-sm leading-7 text-slate-600">
            Returning this competition to Draft will
            remove its results from normal public
            database queries. The records will
            remain saved for staff corrections.
          </p>

          <p className="text-sm leading-7 text-slate-600">
            The old approval will be cleared.
            When corrections are complete, the
            competition must be reviewed and
            approved again before republishing.
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

      <div>
        <Link
          href={`/staff/competitions/${id}`}
          className="text-sm font-semibold text-[#861F41]"
        >
          ← Return to Competition Management
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
            className="mx-auto max-w-5xl px-6 py-10 text-sm text-slate-600"
          >
            Loading publishing controls...
          </div>
        }
      >
        <PublishingContent {...props} />
      </Suspense>
    </main>
  );
}
