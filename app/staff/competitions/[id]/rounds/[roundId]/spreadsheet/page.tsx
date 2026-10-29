import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN } from "@/lib/band-validation";
import { organizationClasses } from "@/lib/competition-config";
import { defaultScoringFormula, type ScoringFormula } from "@/lib/scoring-formulas";
import { totalPenaltyForEntries } from "@/lib/penalty-calculations";

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

function textValue(
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

  const { data: competition, error: competitionError } =
    await supabase
      .from("competitions")
      .select(
        "id, name, season_year, organization_code, publication_status, archived_at"
      )
      .eq("id", id)
      .maybeSingle();

  if (competitionError || !competition) {
    notFound();
  }

  const { data: round, error: roundError } =
    await supabase
      .from("competition_rounds")
      .select("id, name, class_scope, archived_at")
      .eq("id", roundId)
      .eq("competition_id", id)
      .maybeSingle();

  if (roundError || !round) {
    notFound();
  }

  const editable =
    competition.publication_status === "draft" &&
    !competition.archived_at &&
    !round.archived_at;

  const [entryResult, captionResult, formulaResult] =
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
      supabase.from("round_scoring_formulas")
        .select("method, penalty, groups")
        .eq("round_id", roundId).maybeSingle(),
    ]);

  if (entryResult.error || captionResult.error || formulaResult.error) {
    throw new Error(
      "Unable to load spreadsheet entries or captions."
    );
  }

  const entries = entryResult.data ?? [];

  const captions: SpreadsheetCaption[] =
    (captionResult.data ?? []).map((caption) => ({
      id: caption.id,
      name: caption.name,
      max_score: Number(caption.max_score),
      multiplier: Number(caption.multiplier),
    }));

  const saved = formulaResult.data;
  const formula: ScoringFormula = saved
    ? {
        method: saved.method as ScoringFormula["method"],
        penalty: Number(saved.penalty),
        groups: Array.isArray(saved.groups)
          ? saved.groups as ScoringFormula["groups"]
          : [],
      }
    : defaultScoringFormula();

  const incomplete =
    (entryResult.count ?? 0) > entries.length;

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
      throw new Error(
        "Unable to load spreadsheet band names."
      );
    }

    for (const band of data ?? []) {
      bandNames.set(band.id, band.name);
    }
  }

  const scores = new Map<string, string>();

  const entryIds = entries.map((entry) => entry.id);

  // Load caption scores in small batches so the
  // database's default row limits don't silently
  // omit values.
  for (let i = 0; i < entryIds.length; i += 25) {
    const batch = entryIds.slice(i, i + 25);

    const { data, count, error } = await supabase
      .from("caption_scores")
      .select("entry_id, caption_id, score", {
        count: "exact",
      })
      .in("entry_id", batch)
      .limit(1000);

    if (
      error ||
      (count ?? 0) > (data?.length ?? 0)
    ) {
      throw new Error(
        "Caption score data exceeded the safe loading limit."
      );
    }

    for (const item of data ?? []) {
      scores.set(
        `${item.entry_id}:${item.caption_id}`,
        textValue(item.score)
      );
    }
  }

  const penaltyRecords: { entry_id: string; amount: number | string }[] = [];
  for (let i = 0; i < entryIds.length; i += 25) {
    const { data, count, error } = await supabase
      .from("round_entry_penalties")
      .select("entry_id, amount", { count: "exact" })
      .in("entry_id", entryIds.slice(i, i + 25))
      .limit(1000);
    if (error || (count ?? 0) > (data?.length ?? 0)) {
      throw new Error("Unable to load all individual penalties.");
    }
    penaltyRecords.push(...(data ?? []));
  }
  const penaltyTotals = totalPenaltyForEntries(penaltyRecords);

  const rows: SpreadsheetRow[] = entries.map(
    (entry) => {
      const captionValues: Record<string, string> = {};

      for (const caption of captions) {
        captionValues[caption.id] =
          scores.get(`${entry.id}:${caption.id}`) ?? "";
      }

      return {
        entryId: entry.id,
        bandName:
          bandNames.get(entry.band_id) ?? "Unknown Ensemble",
        classification: entry.classification,
        // Preserve existing official totals unless the
        // editor deliberately switches to automatic.
        totalMode:
          entry.total_score !== null
            ? "manual"
            : "automatic",
        manualTotal: textValue(entry.total_score),
        classPlacement: textValue(
          entry.class_placement
        ),
        overallPlacement: textValue(
          entry.overall_placement
        ),
        notes: entry.notes ?? "",
        captions: captionValues,
      };
    }
  );

  rows.sort((a, b) =>
    a.bandName.localeCompare(b.bandName)
  );

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

          <h1 className="mt-3 font-serif text-3xl font-bold md:text-4xl">
            {round.name}
          </h1>

          <p className="mt-3 text-slate-300">
            {competition.name}
            {" · "}
            {competition.organization_code}
            {" · "}
            {competition.season_year}
          </p>

          <span className="mt-5 inline-block rounded-full bg-white/10 px-4 py-2 text-xs font-bold">
            {editable ? "Draft — Editable" : "Read Only"}
          </span>
        </div>
      </section>

      <div className="mx-auto max-w-[1600px] space-y-7 px-5 py-10">
        <div>
          <h2 className="font-serif text-2xl font-bold text-[#002144]">
            Enter Competition Results
          </h2>

          <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-600">
            Enter caption scores across the table.
            Calculated totals and preliminary rankings
            update immediately. Review official results,
            classifications, and placements before saving.
          </p>
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
          penaltyTotals={penaltyTotals}
        />
      </div>
    </main>
  );
}

export default function SpreadsheetPage(props: Props) {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#F4F6F9] px-6 py-12">
          <p
            role="status"
            className="mx-auto max-w-7xl text-sm text-slate-600"
          >
            Loading live results spreadsheet...
          </p>
        </main>
      }
    >
      <SpreadsheetContent params={props.params} />
    </Suspense>
  );
}
