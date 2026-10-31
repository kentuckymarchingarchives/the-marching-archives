import { NextResponse } from "next/server";
import { getPublicCompetition, isRecordId, validPublicIdentifier } from "@/lib/public-competition-routes";

type Params = { params: Promise<{ id: string; roundId: string }> };

type Entry = {
  band_id: string;
  classification: string | null;
  overall_placement: number | null;
  class_placement: number | null;
  total_score: number | string | null;
};
type Band = { id: string; name: string };

function csvField(value: string | number | null | undefined) {
  let text = value === null || value === undefined ? "" : String(value);
  // Avoid spreadsheet formula injection, even when the source is a database field.
  if (/^[\s\uFEFF]*[=+@-]/.test(text)) text = "'" + text;
  return `"${text.replaceAll('"', '""')}"`;
}
function scoreText(value: number | string | null) {
  if (value === null) return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  const [whole, decimals = ""] = String(value).split(".");
  if (/^\d+$/.test(whole) && /^\d*$/.test(decimals) && decimals.length >= 3) return String(value);
  return n.toFixed(3);
}
function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(_request: Request, { params }: Params) {
  const { id, roundId } = await params;
  if (!validPublicIdentifier(id) || !validPublicIdentifier(roundId)) return fail("Invalid competition or round.", 400);

  // Shared helper excludes unpublished and archived competitions.
  const { supabase, competition } = await getPublicCompetition(id);
  const { data: round, error: roundError } = await supabase
    .from("competition_rounds")
    .select("id, slug, name")
    .eq("competition_id", competition.id)
    .eq(isRecordId(roundId) ? "id" : "slug", roundId)
    .is("archived_at", null)
    .maybeSingle();
  if (roundError) return fail("Unable to read round.", 500);
  if (!round) return fail("Round not found.", 404);

  const { data, count, error } = await supabase
    .from("competition_entries")
    .select("band_id, classification, overall_placement, class_placement, total_score", { count: "exact" })
    .eq("round_id", round.id)
    .order("overall_placement", { ascending: true, nullsFirst: false })
    .limit(500);
  if (error) return fail("Unable to export results.", 500);
  const entries = (data ?? []) as Entry[];
  if ((count ?? 0) > entries.length) return fail("This round exceeds the export limit; no partial CSV was generated.", 409);

  const ids = [...new Set(entries.map((entry) => entry.band_id))];
  let bands: Band[] = [];
  if (ids.length) {
    const bandResult = await supabase.from("bands")
      .select("id, name")
      .in("id", ids)
      .is("archived_at", null)
      .limit(500);
    if (bandResult.error) return fail("Unable to read ensembles.", 500);
    bands = (bandResult.data ?? []) as Band[];
  }
  const bandMap = new Map(bands.map((band) => [band.id, band.name]));
  if (bandMap.size !== ids.length) return fail("Some ensemble names are unavailable; no partial CSV was generated.", 409);

  const headers = ["Organization", "Season", "Competition", "Round", "Band", "Classification", "Overall placement", "Class placement", "Total score", "Archive URL", "Original source URL"];
  const archivePath = `/competitions/${competition.slug}/rounds/${round.slug}`;
  // Use pathname, not an unchecked Host header, to avoid embedding spoofed origins.
  const rows = entries.map((entry) => [
    competition.organization_code,
    competition.season_year,
    competition.name,
    round.name,
    bandMap.get(entry.band_id) ?? "",
    entry.classification,
    entry.overall_placement,
    entry.class_placement,
    scoreText(entry.total_score),
    archivePath,
    competition.source_url,
  ]);
  const csv = [headers, ...rows].map((row) => row.map(csvField).join(",")).join("\r\n") + "\r\n";
  const filename = `${competition.slug}-${round.slug}-results.csv`.replace(/[^a-z0-9._-]/gi, "-");
  return new Response("\uFEFF" + csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
