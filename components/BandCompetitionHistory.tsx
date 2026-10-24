
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN } from "@/lib/band-validation";

type Props = {
  bandIdentifier: string;
};

type Entry = {
  id: string;
  round_id: string;
  classification: string | null;
  total_score: number | string | null;
  class_placement: number | null;
  overall_placement: number | null;
};

type Round = {
  id: string;
  competition_id: string;
  name: string;
};

type Competition = {
  id: string;
  name: string;
  season_year: number;
  organization_code: string;
  competition_date: string | null;
};

type Appearance = {
  entry: Entry;
  round: Round;
  competition: Competition;
};

function displayScore(
  value: number | string | null
): string {
  if (value === null || value === undefined) {
    return "—";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return number
    .toFixed(4)
    .replace(/0+$/, "")
    .replace(/\.$/, "");
}

function displayPlacement(
  value: number | null,
  tied: boolean
): string {
  if (value === null) return "—";

  return `${value}${tied ? " (T)" : ""}`;
}

function displayDate(
  value: string | null
): string {
  if (!value) return "Date not recorded";

  const date = new Date(`${value}T12:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    return "Date not recorded";
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function organizeHistory(
  appearances: Appearance[]
): Map<number, Appearance[]> {
  const bySeason = new Map<number, Appearance[]>();

  for (const appearance of appearances) {
    const year = appearance.competition.season_year;
    const existing = bySeason.get(year) ?? [];

    existing.push(appearance);
    bySeason.set(year, existing);
  }

  return new Map(
    [...bySeason.entries()]
      .sort(([a], [b]) => b - a)
      .map(([year, events]) => [
        year,
        events.sort((a, b) => {
          const dateComparison = (
            b.competition.competition_date ?? ""
          ).localeCompare(
            a.competition.competition_date ?? ""
          );

          if (dateComparison !== 0) {
            return dateComparison;
          }

          const nameComparison =
            a.competition.name.localeCompare(
              b.competition.name
            );

          if (nameComparison !== 0) {
            return nameComparison;
          }

          return a.round.name.localeCompare(
            b.round.name
          );
        }),
      ])
  );
}

export default async function BandCompetitionHistory({
  bandIdentifier,
}: Props) {
  const supabase = await createClient();

  const isUuid = UUID_PATTERN.test(bandIdentifier);

  // Public profiles normally use band slugs.
  // UUID lookup also supports legacy band URLs.
  const { data: band, error: bandError } =
    await supabase
      .from("bands")
      .select("id, name, slug")
      .eq(
        isUuid ? "id" : "slug",
        bandIdentifier
      )
      .is("archived_at", null)
      .maybeSingle();

  if (bandError || !band) {
    return null;
  }

  const { data: entryData, count: entryCount, error: entryError } =
    await supabase
      .from("competition_entries")
      .select(
        "id, round_id, classification, total_score, class_placement, overall_placement",
        { count: "exact" }
      )
      .eq("band_id", band.id)
      .limit(1000);

  if (entryError) {
    return (
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
          Competition history is temporarily unavailable.
        </div>
      </section>
    );
  }

  const entries = (entryData ?? []) as Entry[];

  if (entries.length === 0) {
    return (
      <section
        id="competition-history"
        className="mx-auto max-w-6xl px-6 py-12"
      >
        <div className="rounded-2xl border border-slate-200 bg-white p-8">
          <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
            Historical Records
          </p>

          <h2 className="mt-3 font-serif text-3xl font-bold text-[#002144]">
            Competition History
          </h2>

          <p className="mt-4 text-sm leading-7 text-slate-600">
            No published competition appearances are
            currently available for this ensemble.
            Historical records will appear here
            as they are verified and published.
          </p>

          <Link
            href="/competitions"
            className="mt-5 inline-block text-sm font-bold text-[#861F41] hover:underline"
          >
            Browse Competition Archive →
          </Link>
        </div>
      </section>
    );
  }

  const roundIds = [
    ...new Set(entries.map((entry) => entry.round_id)),
  ];

  // Explicitly exclude archived rounds, including
  // when this page is viewed by a signed-in staff member.
  const { data: roundData, error: roundError } =
    await supabase
      .from("competition_rounds")
      .select("id, competition_id, name")
      .in("id", roundIds)
      .is("archived_at", null);

  if (roundError) {
    throw new Error("Unable to load band competition rounds.");
  }

  const rounds = (roundData ?? []) as Round[];

  const competitionIds = [
    ...new Set(
      rounds.map((round) => round.competition_id)
    ),
  ];

  let competitions: Competition[] = [];

  if (competitionIds.length > 0) {
    // This filter applies even for logged-in staff.
    const { data, error } = await supabase
      .from("competitions")
      .select(
        "id, name, season_year, organization_code, competition_date"
      )
      .in("id", competitionIds)
      .eq("publication_status", "published")
      .is("archived_at", null);

    if (error) {
      throw new Error(
        "Unable to load published competition history."
      );
    }

    competitions = (data ?? []) as Competition[];
  }

  const roundMap = new Map(
    rounds.map((round) => [round.id, round])
  );

  const competitionMap = new Map(
    competitions.map((competition) => [
      competition.id,
      competition,
    ])
  );

  const appearances: Appearance[] = [];

  for (const entry of entries) {
    const round = roundMap.get(entry.round_id);

    if (!round) continue;

    const competition = competitionMap.get(
      round.competition_id
    );

    if (!competition) continue;

    appearances.push({
      entry,
      round,
      competition,
    });
  }

  const history = organizeHistory(appearances);

  // A tie is determined from a shared recorded rank
  // within the same round, not from matching scores.
  //
  // To identify ties properly, read the public entries
  // for each round represented in this band's history.
  const publishedRoundIds = [
    ...new Set(appearances.map((item) => item.round.id)),
  ];

  const tieKeys = new Set<string>();
  let tieCheckComplete = true;

  if (publishedRoundIds.length > 0) {
    const { data: placementData, count, error } =
      await supabase
        .from("competition_entries")
        .select(
          "round_id, classification, class_placement, overall_placement",
          { count: "exact" }
        )
        .in("round_id", publishedRoundIds)
        .limit(5000);

    if (error) {
      tieCheckComplete = false;
    } else {
      const records = placementData ?? [];

      if ((count ?? 0) > records.length) {
        tieCheckComplete = false;
      } else {
        const rankCounts = new Map<string, number>();

        for (const record of records) {
          if (record.overall_placement !== null) {
            const key =
              `overall:${record.round_id}:${record.overall_placement}`;

            rankCounts.set(
              key,
              (rankCounts.get(key) ?? 0) + 1
            );
          }

          if (
            record.classification !== null &&
            record.class_placement !== null
          ) {
            const key =
              `class:${record.round_id}:${record.classification}:${record.class_placement}`;

            rankCounts.set(
              key,
              (rankCounts.get(key) ?? 0) + 1
            );
          }
        }

        for (const [key, countValue] of rankCounts) {
          if (countValue > 1) {
            tieKeys.add(key);
          }
        }
      }
    }
  }

  const incomplete =
    (entryCount ?? 0) > entries.length;

  return (
    <section
      id="competition-history"
      className="mx-auto max-w-6xl space-y-8 px-6 py-12"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
            Historical Records
          </p>

          <h2 className="mt-3 font-serif text-3xl font-bold text-[#002144]">
            Competition History
          </h2>

          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
            Published competition appearances for{" "}
            {band.name}, organized by season.
            Classifications and placements reflect
            the individual historical records.
          </p>
        </div>

        <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-[#002144]">
          {appearances.length}{" "}
          {appearances.length === 1
            ? "Appearance"
            : "Appearances"}
        </span>
      </div>

      {(incomplete || !tieCheckComplete) && (
        <div
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"
        >
          {incomplete
            ? "Additional historical appearances may exist beyond the current display limit."
            : "Some tie information could not be verified. Placement numbers are shown without inferred tie markers."}
        </div>
      )}

      {appearances.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600">
          This band has no publicly available
          competition appearances yet.
        </div>
      )}

      {[...history.entries()].map(([year, events]) => (
        <section
          key={year}
          className="space-y-4"
        >
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-2xl font-bold text-[#002144]">
              {year} Season
            </h3>

            <span className="text-sm text-slate-500">
              {events.length}{" "}
              {events.length === 1
                ? "appearance"
                : "appearances"}
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-[#002144] text-white">
                <tr>
                  <th scope="col" className="px-5 py-4">
                    Competition / Round
                  </th>
                  <th scope="col" className="px-5 py-4">
                    Class
                  </th>
                  <th scope="col" className="px-5 py-4">
                    Class Place
                  </th>
                  <th scope="col" className="px-5 py-4">
                    Overall
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-4 text-right"
                  >
                    Score
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {events.map((item) => {
                  const { entry, round, competition } =
                    item;

                  const overallTie =
                    tieCheckComplete &&
                    entry.overall_placement !== null &&
                    tieKeys.has(
                      `overall:${round.id}:${entry.overall_placement}`
                    );

                  const classTie =
                    tieCheckComplete &&
                    entry.classification !== null &&
                    entry.class_placement !== null &&
                    tieKeys.has(
                      `class:${round.id}:${entry.classification}:${entry.class_placement}`
                    );

                  return (
                    <tr
                      key={entry.id}
                      className="hover:bg-slate-50"
                    >
                      <td className="px-5 py-4">
                        <Link
                          href={`/competitions/${competition.id}/rounds/${round.id}`}
                          className="font-bold text-[#002144] hover:text-[#861F41] hover:underline"
                        >
                          {competition.name}
                        </Link>

                        <p className="mt-1 text-sm text-slate-600">
                          {round.name}
                          {" · "}
                          {competition.organization_code}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {displayDate(
                            competition.competition_date
                          )}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {entry.classification ?? "—"}
                      </td>

                      <td className="px-5 py-4 font-semibold text-[#002144]">
                        {displayPlacement(
                          entry.class_placement,
                          classTie
                        )}
                      </td>

                      <td className="px-5 py-4 font-semibold text-[#002144]">
                        {displayPlacement(
                          entry.overall_placement,
                          overallTie
                        )}
                      </td>

                      <td className="px-5 py-4 text-right font-bold tabular-nums text-[#002144]">
                        {displayScore(
                          entry.total_score
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <p className="text-xs leading-6 text-slate-500">
        (T) indicates a shared recorded placement.
        Scores from different competitions may use
        different scoring systems and should not
        necessarily be compared directly.
        Missing information is displayed as —.
      </p>

      <div>
        <Link
          href="/competitions"
          className="inline-block rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-bold text-[#002144] hover:border-[#861F41]"
        >
          Browse All Competitions →
        </Link>
      </div>
    </section>
  );
}
