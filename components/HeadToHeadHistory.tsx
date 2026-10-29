import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type Band = { id: string; name: string; slug: string | null };
type Entry = {
  round_id: string;
  overall_placement: number | null;
  class_placement: number | null;
  total_score: number | string | null;
  classification: string | null;
};
type Round = {
  id: string;
  slug: string | null;
  name: string;
  competition_id: string;
};
type Competition = {
  id: string;
  slug: string | null;
  name: string;
  season_year: number;
  organization_code: string;
  publication_status: string;
};
type Matchup = { round: Round; competition: Competition; first: Entry; second: Entry };
const LIMIT = 1000;

function place(value: number | null): string {
  return value === null ? "—" : String(value);
}
function score(value: number | string | null): string {
  if (value === null) return "—";
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(3) : "—";
}
function batch<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < values.length; i += size) result.push(values.slice(i, i + size));
  return result;
}

export default async function HeadToHeadHistory({ left, right }: { left: Band; right: Band }) {
  const supabase = await createClient();
  const [leftResult, rightResult] = await Promise.all([
    supabase.from("competition_entries")
      .select("round_id, overall_placement, class_placement, total_score, classification", { count: "exact" })
      .eq("band_id", left.id).order("round_id").limit(LIMIT),
    supabase.from("competition_entries")
      .select("round_id, overall_placement, class_placement, total_score, classification", { count: "exact" })
      .eq("band_id", right.id).order("round_id").limit(LIMIT),
  ]);
  if (leftResult.error || rightResult.error) {
    return <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">Head-to-head records could not be loaded.</section>;
  }
  const leftEntries = (leftResult.data ?? []) as Entry[];
  const rightEntries = (rightResult.data ?? []) as Entry[];
  const incomplete = (leftResult.count ?? 0) > leftEntries.length || (rightResult.count ?? 0) > rightEntries.length;
  const leftMap = new Map(leftEntries.map(e => [e.round_id, e]));
  const paired = rightEntries.filter(e => leftMap.has(e.round_id));
  const ids = [...new Set(paired.map(e => e.round_id))];
  const rounds: Round[] = [];
  for (const group of batch(ids, 75)) {
    const { data, error } = await supabase.from("competition_rounds")
      .select("id, slug, name, competition_id")
      .in("id", group).is("archived_at", null);
    if (error) return <p role="alert">Unable to load head-to-head competition rounds.</p>;
    rounds.push(...(data ?? []) as Round[]);
  }
  const competitions: Competition[] = [];
  for (const group of batch([...new Set(rounds.map(r => r.competition_id))], 75)) {
    const { data, error } = await supabase.from("competitions")
      .select("id, slug, name, season_year, organization_code, publication_status")
      .in("id", group).eq("publication_status", "published").is("archived_at", null);
    if (error) return <p role="alert">Unable to load head-to-head competitions.</p>;
    competitions.push(...(data ?? []) as Competition[]);
  }
  const competitionMap = new Map(competitions.map(c => [c.id, c]));
  const rightMap = new Map(paired.map(e => [e.round_id, e]));
  const matches: Matchup[] = rounds.flatMap(round => {
    const competition = competitionMap.get(round.competition_id);
    const first = leftMap.get(round.id);
    const second = rightMap.get(round.id);
    return competition && first && second ? [{ round, competition, first, second }] : [];
  }).sort((a, b) => b.competition.season_year - a.competition.season_year || a.competition.name.localeCompare(b.competition.name));
  let firstAhead = 0;
  let secondAhead = 0;
  let tied = 0;
  let unranked = 0;
  for (const m of matches) {
    const a = m.first.overall_placement;
    const b = m.second.overall_placement;
    if (a === null || b === null) unranked++;
    else if (a < b) firstAhead++;
    else if (b < a) secondAhead++;
    else tied++;
  }
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" id="head-to-head">
      <div className="border-b border-slate-200 px-6 py-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#861F41]">Shared competition rounds</p>
        <h2 className="mt-2 text-2xl font-extrabold text-[#002144]">Head-to-head history</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Only published results from the same competition round are included. Lower overall placement is better; ties and missing placements are tracked separately.</p>
      </div>
      {incomplete && <p role="alert" className="border-b border-amber-200 bg-amber-50 px-6 py-4 text-sm text-amber-900">At least one ensemble has more than {LIMIT.toLocaleString()} recorded entries. This head-to-head history may be incomplete.</p>}
      <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
        {[
          ["Shared rounds", matches.length],
          [`${left.name} ahead`, firstAhead],
          [`${right.name} ahead`, secondAhead],
          ["Tied / unranked", tied + unranked],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl bg-slate-50 p-4">
            <div className="text-2xl font-extrabold tabular-nums text-[#002144]">{value}</div>
            <div className="mt-1 text-xs text-slate-600">{label}</div>
          </div>
        ))}
      </div>
      {matches.length === 0 ? (
        <p className="px-6 pb-8 text-sm text-slate-600">No shared published competition rounds were found in the available archive records.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-190 text-left text-sm">
            <thead className="bg-[#002144] text-white">
              <tr>
                <th className="px-4 py-3">Season / competition round</th>
                <th className="px-4 py-3">{left.name} · place</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">{right.name} · place</th>
                <th className="px-4 py-3">Score</th>
              </tr>
            </thead>
            <tbody>
              {matches.map(m => (
                <tr key={m.round.id} className="border-t border-slate-100 even:bg-slate-50/60">
                  <td className="px-4 py-4">
                    <Link className="font-semibold text-[#002144] hover:text-[#861F41] hover:underline" href={`/competitions/${m.competition.slug || m.competition.id}/rounds/${m.round.slug || m.round.id}`}>
                      {m.competition.season_year} · {m.competition.name}
                    </Link>
                    <div className="mt-1 text-xs text-slate-500">{m.round.name} · {m.competition.organization_code}</div>
                  </td>
                  <td className="px-4 py-4 font-semibold tabular-nums">{place(m.first.overall_placement)}</td>
                  <td className="px-4 py-4 tabular-nums">{score(m.first.total_score)}</td>
                  <td className="px-4 py-4 font-semibold tabular-nums">{place(m.second.overall_placement)}</td>
                  <td className="px-4 py-4 tabular-nums">{score(m.second.total_score)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="border-t border-slate-200 px-6 py-4 text-xs leading-6 text-slate-500">Head-to-head counts compare recorded overall placements, not scores. Different classes may be judged within the same round; review event details for context. Results are limited by the archive’s historical coverage.</p>
    </section>
  );
}
