
import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN } from "@/lib/band-validation";
import { organizationClasses } from "@/lib/competition-config";
import {
  defaultScoringFormula,
  type ScoringFormula,
} from "@/lib/scoring-formulas";

import LiveResultsSpreadsheet, {
  type SpreadsheetCaption,
  type SpreadsheetRow,
} from "@/components/LiveResultsSpreadsheet";

export const instant = false;

type Props = {
  params: Promise<{
    id: string;
    roundId: string;
  }>;
};

function asText(
  value: number | string | null | undefined
): string {
  return value === null || value === undefined
    ? ""
    : String(value);
}

async function SpreadsheetContent({ params }: Props) {
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
      "id, name, season_year, organization_code, publication_status, archived_at"
    )
    .eq("id", id)
    .maybeSingle();

  const { data: round } = await supabase
    .from("competition_rounds")
    .select("id, name, class_scope, archived_at")
    .eq("id", roundId)
    .eq("competition_id", id)
    .maybeSingle();

  if (!competition || !round) {
    notFound();
  }

  const editable =
    competition.publication_status === "draft" &&
    !competition.archived_at &&
    !round.archived_at;

  const [entriesResponse, captionsResponse, formulaResponse] =
    await Promise.all([
      supabase
        .from("competition_entries")
        .select(
          "id, band_id, classification, total_score, class_placement, overall_placement, notes",
          { count: "exact" }
        )
        .eq("round_id", roundId)
        .order("id", { ascending: true })
        .limit(500),

      supabase
        .from("score_captions")
        .select(
          "id, name, max_score, multiplier, sort_order"
        )
        .eq("round_id", roundId)
        .order("sort_order", { ascending: true }),

      supabase
        .from("round_scoring_formulas")
        .select("method, penalty, groups")
        .eq("round_id", roundId)
        .maybeSingle(),
    ]);

  if (
    entriesResponse.error ||
    captionsResponse.error ||
    formulaResponse.error
  ) {
    throw new Error(
      "Unable to load results, captions, or formula settings."
    );
  }

  const entries = entriesResponse.data ?? [];

  const captions: SpreadsheetCaption[] =
    (captionsResponse.data ?? []).map((caption) => ({
      id: caption.id,
      name: caption.name,
      max_score: Number(caption.max_score),
      multiplier: Number(caption.multiplier),
    }));

  const saved = formulaResponse.data;

  const formula: ScoringFormula = saved
    ? {
        method: saved.method as ScoringFormula["method"],
        penalty: Number(saved.penalty),
        groups: Array.isArray(saved.groups)
          ? (saved.groups as ScoringFormula["groups"])
          : [],
      }
    : defaultScoringFormula();

  const incomplete =
    (entriesResponse.count ?? 0) > entries.length;

  const bandIds = [
    ...new Set(entries.map((entry) => entry.band_id)),
  ];

  const bandNames = new Map<string, string>();

  for (let i = 0; i < bandIds.length; i += 75) {
    const { data, error } = await supabase
      .from("bands")
      .select("id, name")
      .in("id", bandIds.slice(i, i + 75));

    if (error) {
      throw new Error("Unable to load ensemble names.");
    }

    for (const band of data ?? []) {
      bandNames.set(band.id, band.name);
    }
  }

  const savedScores = new Map<string, string>();
  const entryIds = entries.map((entry) => entry.id);

  for (let i = 0; i < entryIds.length; i += 25) {
    const { data, count, error } = await supabase
      .from("caption_scores")
      .select("entry_id, caption_id, score", {
        count: "exact",
      })
      .in("entry_id", entryIds.slice(i, i + 25))
      .limit(1000);

    if (
      error ||
      (count ?? 0) > (data?.length ?? 0)
    ) {
      throw new Error(
        "Unable to safely load all caption scores."
      );
    }

    for (const item of data ?? []) {
      savedScores.set(
        `${item.entry_id}:${item.caption_id}`,
        asText(item.score)
      );
    }
  }

  const rows: SpreadsheetRow[] = entries.map(
    (entry) => {
      const values: Record<string, string> = {};

      for (const caption of captions) {
        values[caption.id] =
          savedScores.get(
            `${entry.id}:${caption.id}`
          ) ?? "";
      }

      return {
        entryId: entry.id,
        bandName:
          bandNames.get(entry.band_id) ??
          "Unknown Ensemble",
        classification: entry.classification,
        totalMode:
          entry.total_score !== null
            ? "manual"
            : "automatic",
        manualTotal: asText(entry.total_score),
        classPlacement: asText(
          entry.class_placement
        ),
        overallPlacement: asText(
          entry.overall_placement
        ),
        notes: entry.notes ?? "",
        captions: values,
      };
    }
  );

  rows.sort((a, b) =>
    a.bandName.localeCompare(b.bandName)
  );

  const base =
    `/staff/competitions/${id}` +
    `/rounds/${roundId}`;

  return (
    <main className="min-h-screen bg-[#F4F6F9]">
      <section className="bg-[#002144] px-6 py-12 text-white">
        <div className="mx-auto max-w-7xl">
          <Link
            href={`/staff/competitions/${id}`}
            className="text-sm font-bold text-[#E0B4C2] hover:underline"
          >
            &larr; Competition Management
          </Link>

          <p className="mt-8 text-xs font-bold uppercase tracking-widest text-[#E0B4C2]">
            Live Results Spreadsheet
          </p>

          <h1 className="mt-3 font-serif text-4xl font-bold">
            {round.name}
          </h1>

          <p className="mt-3 text-slate-300">
            {competition.name}
            {" · "}
            {competition.organization_code}
            {" · "}
            {competition.season_year}
          </p>

          <p className="mt-4 text-sm font-semibold text-[#E0B4C2]">
            {editable
              ? "Draft — Editable"
              : "Read-Only Results"}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-[1600px] space-y-7 px-5 py-10">
        <div>
          <h2 className="font-serif text-2xl font-bold text-[#002144]">
            Enter Competition Results
          </h2>

          <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-600">
            Caption values calculate live using this
            round's configured formula. Official totals
            and recorded placements can still be entered
            manually when needed.
          </p>

          <Link
            href={`${base}/formula`}
            className="mt-3 inline-block text-sm font-bold text-[#861F41] hover:underline"
          >
            Review Scoring Formula &rarr;
          </Link>
        </div>

        <LiveResultsSpreadsheet
          competitionId={id}
          roundId={roundId}
          editable={editable}
          classes={organizationClasses(
            competition.organization_code
          )}
          captions={captions}
          initialRows={rows}
          incomplete={incomplete}
          formula={formula}
        />
      </div>
    </main>
  );
}

export default function SpreadsheetPage(props: Props) {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#F4F6F9] p-10 text-sm text-slate-600">
          Loading spreadsheet...
        </main>
      }
    >
      <SpreadsheetContent params={props.params} />
    </Suspense>
  );
}
