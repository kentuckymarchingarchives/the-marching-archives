
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type Props = {
  bandId: string;
  bandSlug: string;
};

type Entry = {
  round_id: string;
  class_placement: number | null;
  overall_placement: number | null;
};

type Round = {
  id: string;
  competition_id: string;
};

type Competition = {
  id: string;
  season_year: number;
};

const cardClass =
  "rounded-xl border border-slate-200 bg-[#F4F6F9] p-5";

export default async function BandStatisticsPreview({
  bandId,
  bandSlug,
}: Props) {
  const supabase = await createClient();

  const { data, count, error } = await supabase
    .from("competition_entries")
    .select(
      "round_id, class_placement, overall_placement",
      { count: "exact" }
    )
    .eq("band_id", bandId)
    .limit(1000);

  if (error) {
    return (
      <p className="text-sm text-slate-600">
        Statistics are temporarily unavailable.
      </p>
    );
  }

  const entries = (data ?? []) as Entry[];
  const incomplete = (count ?? 0) > entries.length;
  const roundIds = [
    ...new Set(entries.map((entry) => entry.round_id)),
  ];

  const rounds: Round[] = [];

  for (let i = 0; i < roundIds.length; i += 75) {
    const { data: batch, error: batchError } =
      await supabase
        .from("competition_rounds")
        .select("id, competition_id")
        .in("id", roundIds.slice(i, i + 75))
        .is("archived_at", null);

    if (batchError) {
      return (
        <p className="text-sm text-slate-600">
          Statistics are temporarily unavailable.
        </p>
      );
    }

    rounds.push(...((batch ?? []) as Round[]));
  }

  const competitionIds = [
    ...new Set(rounds.map((round) => round.competition_id)),
  ];

  const competitions: Competition[] = [];

  for (let i = 0; i < competitionIds.length; i += 75) {
    const { data: batch, error: batchError } =
      await supabase
        .from("competitions")
        .select("id, season_year")
        .in("id", competitionIds.slice(i, i + 75))
        .eq("publication_status", "published")
        .is("archived_at", null);

    if (batchError) {
      return (
        <p className="text-sm text-slate-600">
          Statistics are temporarily unavailable.
        </p>
      );
    }

    competitions.push(...((batch ?? []) as Competition[]));
  }

  const competitionMap = new Map(
    competitions.map((competition) => [
      competition.id,
      competition,
    ])
  );

  const roundMap = new Map(
    rounds.map((round) => [round.id, round])
  );

  const published = entries
    .map((entry) => {
      const round = roundMap.get(entry.round_id);
      const competition = round
        ? competitionMap.get(round.competition_id)
        : null;

      return competition ? { entry, competition } : null;
    })
    .filter(
      (
        item
      ): item is {
        entry: Entry;
        competition: Competition;
      } => item !== null
    );

  const overallFirsts = published.filter(
    ({ entry }) => entry.overall_placement === 1
  ).length;

  const classFirsts = published.filter(
    ({ entry }) => entry.class_placement === 1
  ).length;

  const seasons = new Set(
    published.map(
      ({ competition }) => competition.season_year
    )
  ).size;

  const cards = [
    {
      label: "Appearances",
      value: published.length,
      detail: "Published round entries",
    },
    {
      label: "Overall First Places",
      value: overallFirsts,
      detail: "Recorded overall victories",
    },
    {
      label: "Class First Places",
      value: classFirsts,
      detail: "Recorded class victories",
    },
    {
      label: "Seasons",
      value: seasons,
      detail: "Seasons represented",
    },
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
            Competitive Record
          </p>

          <h2 className="mt-3 font-serif text-2xl font-bold text-[#002144]">
            Statistics at a Glance
          </h2>
        </div>

        <Link
          href={`/bands/${bandSlug}/statistics`}
          className="rounded-lg bg-[#861F41] px-5 py-3 text-sm font-bold text-white hover:bg-[#701832]"
        >
          Full Statistics &rarr;
        </Link>
      </div>

      {incomplete && (
        <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Additional historical records exist beyond the
          current calculation limit. These figures are
          partial, not career totals.
        </p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className={cardClass}>
            <p className="text-xs font-bold uppercase tracking-wide text-[#861F41]">
              {card.label}
            </p>

            <p className="mt-3 text-3xl font-bold tabular-nums text-[#002144]">
              {card.value}
            </p>

            <p className="mt-2 text-xs text-slate-600">
              {card.detail}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-5 text-xs leading-6 text-slate-500">
        Figures are calculated from published,
        non-archived competitions and rounds.
        Semifinal and final appearances count separately.
        Championship titles are not inferred from these
        first-place totals.
      </p>

      <Link
        href={`/bands/${bandSlug}/achievements`}
        className="mt-5 inline-block text-sm font-bold text-[#861F41] hover:underline"
      >
        Explore Recorded Achievements &rarr;
      </Link>
    </section>
  );
}
