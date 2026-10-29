import { notFound } from "next/navigation";
import { getPublicCompetition, isRecordId, validPublicIdentifier } from "@/lib/public-competition-routes";

type Context = { params: Promise<{ id: string; roundId: string }> };
type Entry = { id: string; band_id: string; classification: string | null; overall_placement: number | null; class_placement: number | null; total_score: number | string | null };
type Caption = { id: string; name: string };
type CaptionScore = { entry_id: string; caption_id: string; score: number | string | null };
type Band = { id: string; name: string; slug: string };

function cell(value: unknown): string {
  const raw = value == null ? "" : String(value);
  // Prevent spreadsheet formula execution when opening downloaded CSV files.
  const safe = /^[\s]*[=+@-]/.test(raw) && !/^-[0-9]+(?:\.[0-9]+)?$/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}
function score(value: number | string | null | undefined, minimum = 2): string {
  if (value == null || value === "") return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  const raw = String(value);
  const decimals = raw.includes(".") ? raw.split(".")[1].length : 0;
  return n.toFixed(Math.max(minimum, Math.min(decimals, 10)));
}

export async function GET(_request: Request, { params }: Context) {
  const { id, roundId } = await params;
  if (!validPublicIdentifier(roundId)) notFound();
  const { supabase, competition } = await getPublicCompetition(id);
  const { data: round, error: roundError } = await supabase
    .from("competition_rounds")
    .select("id, slug, name")
    .eq("competition_id", competition.id)
    .eq(isRecordId(roundId) ? "id" : "slug", roundId)
    .is("archived_at", null)
    .maybeSingle();
  if (roundError) throw new Error("Unable to retrieve the published round.");
  if (!round) notFound();

  const [entriesResponse, captionsResponse] = await Promise.all([
    supabase.from("competition_entries").select("id, band_id, classification, overall_placement, class_placement, total_score", { count: "exact" }).eq("round_id", round.id).order("overall_placement", { ascending: true, nullsFirst: false }).limit(5000),
    supabase.from("score_captions").select("id, name", { count: "exact" }).eq("round_id", round.id).order("sort_order", { ascending: true }).limit(250),
  ]);
  if (entriesResponse.error || captionsResponse.error) throw new Error("Unable to retrieve published results.");
  const entries = (entriesResponse.data ?? []) as Entry[];
  const captions = (captionsResponse.data ?? []) as Caption[];
  if ((entriesResponse.count ?? 0) > entries.length || (captionsResponse.count ?? 0) > captions.length) {
    return new Response("Export unavailable: records exceed the safe export limit.", { status: 409 });
  }
  const bandIds = [...new Set(entries.map((e) => e.band_id))];
  const entryIds = entries.map((e) => e.id);
  const [bandsResponse, scoresResponse] = await Promise.all([
    bandIds.length ? supabase.from("bands").select("id, name, slug").in("id", bandIds).is("archived_at", null).limit(5000) : Promise.resolve({ data: [] as Band[], error: null }),
    entryIds.length ? supabase.from("caption_scores").select("entry_id, caption_id, score", { count: "exact" }).in("entry_id", entryIds).limit(15000) : Promise.resolve({ data: [] as CaptionScore[], error: null, count: 0 }),
  ]);
  if (bandsResponse.error || scoresResponse.error) throw new Error("Unable to retrieve caption details.");
  const bands = new Map(((bandsResponse.data ?? []) as Band[]).map(b => [b.id, b]));
  const scores = (scoresResponse.data ?? []) as CaptionScore[];
  if ((scoresResponse.count ?? 0) > scores.length || bands.size < bandIds.length) {
    return new Response("Export unavailable: linked results are incomplete.", { status: 409 });
  }
  const scoreMap = new Map(scores.map(s => [`${s.entry_id}:${s.caption_id}`, s.score]));
  const columns = ["Season", "Organization", "Competition", "Round", "Ensemble", "Band Slug", "Classification", "Overall Placement", "Class Placement", "Total Score", ...captions.map(c => `Caption: ${c.name}`)];
  const rows = entries.map(e => {
    const band = bands.get(e.band_id)!;
    return [competition.season_year, competition.organization_code, competition.name, round.name, band.name, band.slug, e.classification, e.overall_placement, e.class_placement, score(e.total_score, 3), ...captions.map(c => score(scoreMap.get(`${e.id}:${c.id}`)))].map(cell).join(",");
  });
  const csv = "\uFEFF" + [columns.map(cell).join(","), ...rows].join("\r\n") + "\r\n";
  const filename = `tma-${competition.season_year}-${competition.slug}-${round.slug}.csv`.replace(/[^a-z0-9._-]/gi, "-");
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
