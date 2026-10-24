
import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN } from "@/lib/band-validation";
import {
  ROUND_KINDS,
  organizationClasses,
  readableLabel,
} from "@/lib/competition-config";

import CompetitionForm from "@/components/CompetitionForm";

import {
  updateCompetition,
  addCompetitionRound,
} from "../actions";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    created?: string;
    saved?: string;
    round_added?: string;
  }>;
};

async function CompetitionEditor({
  params,
  searchParams,
}: Props) {
  const { id } = await params;
  const messages = await searchParams;

  if (!UUID_PATTERN.test(id)) {
    notFound();
  }

  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getClaims();

  if (!auth?.claims?.sub) {
    redirect("/staff/login");
  }

  const { data: staff } = await supabase
    .from("staff_members")
    .select("role, status")
    .eq("user_id", auth.claims.sub)
    .maybeSingle();

  if (
    staff?.status !== "active" ||
    !["owner", "admin", "editor"].includes(staff.role)
  ) {
    redirect("/staff/login?error=unauthorized");
  }

  const { data: competition, error } = await supabase
    .from("competitions")
    .select(
      "id, name, season_year, organization_code, competition_type, competition_format, smbc_stage, competition_date, city, state, country, source_url, notes, publication_status"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to load competition.");
  }

  if (!competition) {
    notFound();
  }

  const { data: rounds, error: roundError } =
    await supabase
      .from("competition_rounds")
      .select(
        "id, name, round_kind, class_scope, sort_order"
      )
      .eq("competition_id", id)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

  if (roundError) {
    throw new Error("Unable to load competition rounds.");
  }

  const successMessage =
    messages.created === "1"
      ? "Competition created successfully."
      : messages.saved === "1"
        ? "Competition details saved."
        : messages.round_added === "1"
          ? "Competition round added."
          : null;

  const classes = organizationClasses(
    competition.organization_code
  );

  const canEdit =
    competition.publication_status === "draft" ||
    staff.role === "owner" ||
    staff.role === "admin";

  const isDraft =
    competition.publication_status === "draft";

  const inputClass =
    "mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-[#002144]";

  return (
    <div className="mx-auto max-w-5xl space-y-9 px-6 py-10">
      <Link
        href="/staff/competitions"
        className="text-sm font-semibold text-[#861F41]"
      >
        ← All Competitions
      </Link>

      <header>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
            {competition.organization_code} ·{" "}
            {competition.season_year}
          </p>

          <span
            className={
              isDraft
                ? "rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800"
                : "rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800"
            }
          >
            {isDraft ? "Draft" : "Published"}
          </span>
        </div>

        <h1 className="mt-4 font-serif text-4xl font-bold text-[#002144]">
          {competition.name}
        </h1>

        <p className="mt-3 text-slate-600">
          {readableLabel(competition.competition_type)}
          {" · "}
          {readableLabel(competition.competition_format)}
          {competition.smbc_stage
            ? ` · ${readableLabel(competition.smbc_stage)}`
            : ""}
        </p>
      </header>

      {successMessage && (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-900"
        >
          {successMessage}
        </div>
      )}

      <section className="space-y-5">
        <div>
          <h2 className="text-2xl font-bold text-[#002144]">
            Competition Rounds
          </h2>

          <p className="mt-2 text-sm text-slate-600">
            Every round holds its own participating
            bands, classes, placements, and scores.
          </p>
        </div>

        {rounds?.length ? (
          <div className="space-y-3">
            {rounds.map((round, index) => (
              <div
                key={round.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#002144] text-sm font-bold text-white">
                    {index + 1}
                  </div>

                  <div>
                    <h3 className="font-bold text-[#002144]">
                      {round.name}
                    </h3>

                    <p className="mt-1 text-xs text-slate-500">
                      {readableLabel(round.round_kind)}
                      {" · "}
                      {round.class_scope
                        ? `${round.class_scope} Class`
                        : "All Classes"}
                    </p>
                  </div>
                </div>

                <span className="text-xs font-bold text-slate-400">
                  Scores in Phase 6
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-7 text-sm text-slate-600">
            No rounds have been added. This is normal
            for a custom-format competition.
          </div>
        )}
      </section>

      {isDraft && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-[#002144]">
            Add Competition Round
          </h2>

          <form
            action={addCompetitionRound}
            className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6"
          >
            <input
              type="hidden"
              name="competition_id"
              value={competition.id}
            />

            <label className="block text-sm font-semibold text-[#002144]">
              Round Name *
              <input
                name="round_name"
                required
                minLength={2}
                maxLength={120}
                placeholder="Example: International Class Finals"
                className={inputClass}
              />
            </label>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="block text-sm font-semibold text-[#002144]">
                Round Type *
                <select
                  name="round_kind"
                  defaultValue="custom"
                  className={inputClass}
                >
                  {ROUND_KINDS.map((kind) => (
                    <option
                      key={kind.value}
                      value={kind.value}
                    >
                      {kind.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-semibold text-[#002144]">
                Classification Scope
                <select
                  name="class_scope"
                  defaultValue=""
                  className={inputClass}
                >
                  <option value="">
                    All Classes / Not Restricted
                  </option>

                  {classes.map((className) => (
                    <option
                      key={className}
                      value={className}
                    >
                      {className}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <p className="text-xs leading-6 text-slate-500">
              Only restrict a round to one class
              when the source documents a
              class-specific round. Otherwise,
              leave the scope unrestricted.
            </p>

            <button
              type="submit"
              className="rounded-lg bg-[#002144] px-6 py-3 text-sm font-bold text-white hover:bg-[#123B63]"
            >
              + Add Round
            </button>
          </form>
        </section>
      )}

      <section className="space-y-5">
        <h2 className="text-2xl font-bold text-[#002144]">
          Competition Details
        </h2>

        {canEdit ? (
          <CompetitionForm
            action={updateCompetition}
            competition={competition}
          />
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            This competition is published. Editors
            cannot modify published records.
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-bold text-[#002144]">
          Historical Results
        </h2>

        <p className="mt-3 text-sm leading-7 text-slate-600">
          The competition structure is ready.
          In Phase 6, we'll add band participation,
          classification, scores, caption breakdowns,
          and placements for each round.
        </p>
      </section>
    </div>
  );
}

export default function EditCompetitionPage(
  props: Props
) {
  return (
    <main className="min-h-screen bg-[#F4F6F9]">
      <Suspense
        fallback={
          <div
            role="status"
            className="mx-auto max-w-5xl px-6 py-10 text-sm text-slate-600"
          >
            Loading competition...
          </div>
        }
      >
        <CompetitionEditor {...props} />
      </Suspense>
    </main>
  );
}
