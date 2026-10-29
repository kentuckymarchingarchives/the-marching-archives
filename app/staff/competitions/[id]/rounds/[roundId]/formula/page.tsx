
import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN } from "@/lib/band-validation";
import {
  defaultScoringFormula,
  type ScoringFormula,
} from "@/lib/scoring-formulas";
import RoundFormulaEditor from "@/components/RoundFormulaEditor";

export const instant = false;

type Props = {
  params: Promise<{
    id: string;
    roundId: string;
  }>;
};

async function FormulaContent({ params }: Props) {
  const { id, roundId } = await params;

  if (
    !UUID_PATTERN.test(id) ||
    !UUID_PATTERN.test(roundId)
  ) {
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

  const { data: competition } = await supabase
    .from("competitions")
    .select(
      "id, name, publication_status, archived_at"
    )
    .eq("id", id)
    .maybeSingle();

  const { data: round } = await supabase
    .from("competition_rounds")
    .select("id, name, archived_at")
    .eq("id", roundId)
    .eq("competition_id", id)
    .maybeSingle();

  if (!competition || !round) {
    notFound();
  }

  const { data: formulaData, error: formulaError } =
    await supabase
      .from("round_scoring_formulas")
      .select("method, penalty, groups")
      .eq("round_id", roundId)
      .maybeSingle();

  if (formulaError) {
    throw new Error(
      "Unable to load formula settings. Check the Supabase migration."
    );
  }

  const { data: captions, error: captionError } =
    await supabase
      .from("score_captions")
      .select("id, name")
      .eq("round_id", roundId)
      .order("sort_order", { ascending: true });

  if (captionError) {
    throw new Error(
      "Unable to load scoring captions."
    );
  }

  const initialFormula: ScoringFormula = formulaData
    ? {
        method: formulaData.method as
          ScoringFormula["method"],
        penalty: Number(formulaData.penalty),
        groups: Array.isArray(formulaData.groups)
          ? (formulaData.groups as
              ScoringFormula["groups"])
          : [],
      }
    : defaultScoringFormula();

  const editable =
    competition.publication_status === "draft" &&
    !competition.archived_at &&
    !round.archived_at;

  const base =
    `/staff/competitions/${id}` +
    `/rounds/${roundId}`;

  return (
    <main className="min-h-screen bg-[#F4F6F9]">
      <section className="bg-[#002144] px-6 py-12 text-white">
        <div className="mx-auto max-w-6xl">
          <Link
            href={base}
            className="text-sm font-bold text-[#E0B4C2] hover:underline"
          >
            &larr; Round Results
          </Link>

          <p className="mt-8 text-xs font-bold uppercase tracking-widest text-[#E0B4C2]">
            Scoring Administration
          </p>

          <h1 className="mt-3 font-serif text-4xl font-bold">
            Custom Scoring Formula
          </h1>

          <p className="mt-4 text-slate-300">
            {competition.name} — {round.name}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-7 px-6 py-10">
        <p className="max-w-3xl text-sm leading-7 text-slate-600">
          Define how caption scores are combined for
          this specific historical round. The formula
          affects automatic calculations, not saved
          manual official totals.
        </p>

        {!editable && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            This competition is published or archived.
            Its scoring formula is read-only.
          </div>
        )}

        <RoundFormulaEditor
          competitionId={id}
          roundId={roundId}
          editable={editable}
          captions={captions ?? []}
          initialFormula={initialFormula}
        />

        <Link
          href={`${base}/spreadsheet`}
          className="inline-block rounded-lg bg-[#002144] px-6 py-3 text-sm font-bold text-white"
        >
          Open Results Spreadsheet &rarr;
        </Link>
      </div>
    </main>
  );
}

export default function FormulaSettingsPage(
  props: Props
) {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#F4F6F9] p-10 text-sm text-slate-600">
          Loading scoring formula...
        </main>
      }
    >
      <FormulaContent params={props.params} />
    </Suspense>
  );
}
