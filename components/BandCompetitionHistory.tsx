
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN } from "@/lib/band-validation";
import { roundPublicUrl } from "@/lib/public-competition-routes";

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
  slug: string;
  competition_id: string;
  name: string;
};

type Competition = {
  id: string;
  slug: string;
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

function scoreText(value: number | string | null): string {
  if (value === null || value === undefined) return "—";

  const number = Number(value);

  if (!Number.isFinite(number)) return "—";

  return number
    .toFixed(4)
    .replace(/0+$/, "")
    .replace(/\.$/, "");
}

function rankText(
  value: number | null,
  isTie: boolean
): string {
  if (value === null) return "—";

  return `${value}${isTie ? " (T)" : ""}`;
}

function dateText(value: string | null): string {
  if (!value) return "Date not recorded";

  const date = new Date(`${value}T12:00:00Z`);

  return Number.isNaN(date.getTime())
    ? "Date not recorded"
    : date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      });
}

function EmptyHistory({
  bandName,
}: {
  bandName: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm sm:px-10">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#F4F6F9]">
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="h-10 w-10 text-[#861F41]"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M8 21h8" />
          <path d="M12 17v4" />
          <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
          <path d="M7 6H4v2a4 4 0 0 0 4 4" />
          <path d="M17 6h3v2a4 4 0 0 1-4 4" />
          <path d="M9 17h6" />
        </svg>
      </div>

      <h3 className="mt-6 font-serif text-2xl font-bold text-[#002144]">
        No Published Results Yet
      </h3>

      <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-slate-600">
        We don't have any published competition
        appearances for {bandName} just yet.
        As historical results are documented,
        reviewed, and published, they'll appear here
        automatically.
      </p>

      <Link
        href="/competitions"
        className="mt-7 inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#861F41] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#A02B52]"
      >
        Browse Competitions
        <span aria-hidden="true">&rarr;</span>
      </Link>
    </div>
  );
}

export default async function BandCompetitionHistory({
  bandIdentifier,
}: Props) {
  const supabase = await createClient();

  const { data: band, error: bandError } = await supabase
    .from("bands")
    .select("id, name")
    .eq(
      UUID_PATTERN.test(bandIdentifier)
        ? "id"
        : "slug",
      bandIdentifier
    )
    .is("archived_at", null)
    .maybeSingle();

  if (bandError || !band) return null;

  const { data, count, error } = await supabase
    .from("competition_entries")
    .select(
      "id, round_id, classification, total_score, class_placement, overall_placement",
      { count: "exact" }
    )
    .eq("band_id", band.id)
    .limit(1000);

  if (error) {
    return (
      <section
        id="competition-history"
        className="bg-[#F4F6F9] px-6 py-12"
      >
        <div className="mx-auto max-w-6xl rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
          Competition history is temporarily unavailable.
        </div>
      </section>
    );
  }

  const entries = (data ?? []) as Entry[];

  const roundIds = [
    ...new Set(entries.map((entry) => entry.round_id)),
  ];

  let rounds: Round[] = [];

  if (roundIds.length > 0) {
    const result = await supabase
      .from("competition_rounds")
      .select("id, slug, competition_id, name")
      .in("id", roundIds)
      .is("archived_at", null);

    if (result.error) {
      throw new Error(
        "Unable to load historical competition rounds."
      );
    }

    rounds = (result.data ?? []) as Round[];
  }

  const competitionIds = [
    ...new Set(
      rounds.map((round) => round.competition_id)
    ),
  ];

  let competitions: Competition[] = [];

  if (competitionIds.length > 0) {
    const result = await supabase
      .from("competitions")
      .select(
        "id, slug, name, season_year, organization_code, competition_date"
      )
      .in("id", competitionIds)
      .eq("publication_status", "published")
      .is("archived_at", null);

    if (result.error) {
      throw new Error(
        "Unable to load published competition history."
      );
    }

    competitions = (result.data ?? []) as Competition[];
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

  appearances.sort((a, b) => {
    const yearDifference =
      b.competition.season_year -
      a.competition.season_year;

    if (yearDifference !== 0) return yearDifference;

    const dateDifference = (
      b.competition.competition_date ?? ""
    ).localeCompare(
      a.competition.competition_date ?? ""
    );

    if (dateDifference !== 0) return dateDifference;

    const nameDifference =
      a.competition.name.localeCompare(
        b.competition.name
      );

    if (nameDifference !== 0) return nameDifference;

    return a.round.name.localeCompare(b.round.name);
  });

  const grouped = new Map<number, Appearance[]>();

  for (const appearance of appearances) {
    const year = appearance.competition.season_year;

    grouped.set(
      year,
      [
        ...(grouped.get(year) ?? []),
        appearance,
      ]
    );
  }

  const publicRoundIds = [
    ...new Set(
      appearances.map((item) => item.round.id)
    ),
  ];

  const tieKeys = new Set<string>();
  let tieCheckComplete = true;

  if (publicRoundIds.length > 0) {
    const result = await supabase
      .from("competition_entries")
      .select(
        "round_id, classification, class_placement, overall_placement",
        { count: "exact" }
      )
      .in("round_id", publicRoundIds)
      .limit(5000);

    if (
      result.error ||
      (result.count ?? 0) >
        (result.data?.length ?? 0)
    ) {
      tieCheckComplete = false;
    } else {
      const counts = new Map<string, number>();

      for (const row of result.data ?? []) {
        if (row.overall_placement !== null) {
          const key =
            `overall:${row.round_id}:${row.overall_placement}`;

          counts.set(
            key,
            (counts.get(key) ?? 0) + 1
          );
        }

        if (
          row.classification !== null &&
          row.class_placement !== null
        ) {
          const key =
            `class:${row.round_id}:${row.classification}:${row.class_placement}`;

          counts.set(
            key,
            (counts.get(key) ?? 0) + 1
          );
        }
      }

      for (const [key, amount] of counts) {
        if (amount > 1) {
          tieKeys.add(key);
        }
      }
    }
  }

  const incomplete =
    (count ?? 0) > entries.length;

  return (
    <section
      id="competition-history"
      className="scroll-mt-8 border-t border-slate-200 bg-[#F4F6F9] px-6 py-16"
    >
      <div className="mx-auto max-w-6xl space-y-9">
        {/* Section heading */}
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#861F41]">
              Historical Records
            </p>

            <h2 className="mt-3 font-serif text-3xl font-bold text-[#002144] md:text-4xl">
              Competition History
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
              Explore {band.name}'s documented
              competition appearances, organized by season.
            </p>
          </div>

          <span className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-bold text-[#002144] shadow-sm">
            {appearances.length}{" "}
            {appearances.length === 1
              ? "Appearance"
              : "Appearances"}
          </span>
        </div>

        {/* Empty state */}
        {appearances.length === 0 ? (
          <EmptyHistory bandName={band.name} />
        ) : (
          <>
            {(incomplete || !tieCheckComplete) && (
              <div
                role="status"
                className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900"
              >
                {incomplete
                  ? "Additional historical appearances may exist beyond the current display limit."
                  : "Tie markers could not be verified for every entry. Recorded placements are still displayed."}
              </div>
            )}

            {/* Season-by-season history */}
            {[...grouped.entries()].map(([year, items]) => (
              <section
                key={year}
                className="space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="h-8 w-1 rounded-full bg-[#861F41]"
                    />

                    <h3 className="font-serif text-2xl font-bold text-[#002144]">
                      {year} Season
                    </h3>
                  </div>

                  <span className="text-sm font-medium text-slate-500">
                    {items.length}{" "}
                    {items.length === 1
                      ? "appearance"
                      : "appearances"}
                  </span>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-[#002144] text-white">
                      <tr>
                        <th
                          scope="col"
                          className="px-5 py-4"
                        >
                          Competition / Round
                        </th>

                        <th
                          scope="col"
                          className="px-5 py-4"
                        >
                          Class
                        </th>

                        <th
                          scope="col"
                          className="px-5 py-4"
                        >
                          Class Place
                        </th>

                        <th
                          scope="col"
                          className="px-5 py-4"
                        >
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
                      {items.map((item) => {
                        const {
                          entry,
                          round,
                          competition,
                        } = item;

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
                            className="transition hover:bg-slate-50"
                          >
                            <td className="px-5 py-5">
                              <Link
                                href={roundPublicUrl(
                                  competition.slug,
                                  round.slug
                                )}
                                className="font-bold text-[#002144] hover:text-[#861F41] hover:underline"
                              >
                                {competition.name}
                                <span
                                  aria-hidden="true"
                                  className="ml-2 text-[#861F41]"
                                >
                                  &rarr;
                                </span>
                              </Link>

                              <p className="mt-2 text-sm text-slate-600">
                                {round.name}
                                {" · "}
                                {competition.organization_code}
                              </p>

                              <p className="mt-1 text-xs text-slate-500">
                                {dateText(
                                  competition.competition_date
                                )}
                              </p>
                            </td>

                            <td className="px-5 py-5 text-slate-700">
                              {entry.classification ?? "—"}
                            </td>

                            <td className="px-5 py-5 font-semibold text-[#002144]">
                              {rankText(
                                entry.class_placement,
                                classTie
                              )}
                            </td>

                            <td className="px-5 py-5 font-semibold text-[#002144]">
                              {rankText(
                                entry.overall_placement,
                                overallTie
                              )}
                            </td>

                            <td className="px-5 py-5 text-right font-bold tabular-nums text-[#002144]">
                              {scoreText(
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

            {/* Footnote and archive navigation */}
            <div className="flex flex-wrap items-center justify-between gap-5 border-t border-slate-200 pt-7">
              <p className="max-w-2xl text-xs leading-6 text-slate-500">
                (T) indicates a shared recorded placement.
                Historical scoring systems may differ
                between organizations and seasons.
                Missing values are shown as —.
              </p>

              <Link
                href="/competitions"
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#002144] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#123B63]"
              >
                Browse Competitions
                <span aria-hidden="true">&rarr;</span>
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
