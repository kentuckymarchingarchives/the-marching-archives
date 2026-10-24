
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN } from "@/lib/band-validation";
import {
  roundPublicUrl,
} from "@/lib/public-competition-routes";

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

function scoreText(
  value: number | string | null
) {
  if (value === null) return "—";

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
) {
  if (value === null) return "—";
  return `${value}${isTie ? " (T)" : ""}`;
}

function dateText(value: string | null) {
  if (!value) return "Date not recorded";

  const date = new Date(`${value}T12:00:00Z`);

  return Number.isNaN(date.getTime())
    ? "Date not recorded"
    : date.toLocaleDateString("en-US", {
        dateStyle: "medium",
        timeZone: "UTC",
      });
}

export default async function BandCompetitionHistory({
  bandIdentifier,
}: Props) {
  const supabase = await createClient();

  const { data: band, error: bandError } =
    await supabase
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
      <section className="mx-auto max-w-6xl px-6 py-10">
        <p role="alert" className="rounded-xl bg-red-50 p-6 text-red-800">
          Competition history is temporarily unavailable.
        </p>
      </section>
    );
  }

  const entries = (data ?? []) as Entry[];

  const roundIds = [...new Set(
    entries.map((entry) => entry.round_id)
  )];

  let rounds: Round[] = [];

  if (roundIds.length > 0) {
    const result = await supabase
      .from("competition_rounds")
      .select("id, slug, competition_id, name")
      .in("id", roundIds)
      .is("archived_at", null);

    if (result.error) {
      throw new Error(
        "Unable to load historical rounds."
      );
    }

    rounds = (result.data ?? []) as Round[];
  }

  const competitionIds = [...new Set(
    rounds.map((round) => round.competition_id)
  )];

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
        "Unable to load published history."
      );
    }

    competitions =
      (result.data ?? []) as Competition[];
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

    if (yearDifference) return yearDifference;

    const dateDifference =
      (b.competition.competition_date ?? "")
        .localeCompare(
          a.competition.competition_date ?? ""
        );

    if (dateDifference) return dateDifference;

    const nameDifference =
      a.competition.name.localeCompare(
        b.competition.name
      );

    if (nameDifference) return nameDifference;

    return a.round.name.localeCompare(b.round.name);
  });

  const grouped = new Map<number, Appearance[]>();

  for (const item of appearances) {
    const year = item.competition.season_year;

    grouped.set(
      year,
      [...(grouped.get(year) ?? []), item]
    );
  }

  // Check ties against the other public entries
  // in each round, not merely identical total scores.
  const publicRoundIds = [...new Set(
    appearances.map((item) => item.round.id)
  )];

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
      (result.count ?? 0) > (result.data?.length ?? 0)
    ) {
      tieCheckComplete = false;
    } else {
      const counts = new Map<string, number>();

      for (const row of result.data ?? []) {
        if (row.overall_placement !== null) {
          const key =
            `overall:${row.round_id}:${row.overall_placement}`;

          counts.set(key, (counts.get(key) ?? 0) + 1);
        }

        if (
          row.classification !== null &&
          row.class_placement !== null
        ) {
          const key =
            `class:${row.round_id}:${row.classification}:${row.class_placement}`;

          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
      }

      for (const [key, amount] of counts) {
        if (amount > 1) tieKeys.add(key);
      }
    }
  }

  const incomplete = (count ?? 0) > entries.length;

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

          <p className="mt-3 text-sm leading-7 text-slate-600">
            Published appearances for {band.name},
            organized by season.
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
        <p
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"
        >
          {incomplete
            ? "Additional historical entries may exist beyond the display limit."
            : "Tie markers could not be verified for every entry."}
        </p>
      )}

      {appearances.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8">
          <p className="text-sm leading-7 text-slate-600">
            No published competition appearances are
            currently available for this ensemble.
          </p>

          <Link
            href="/competitions"
            className="mt-4 inline-block text-sm font-bold text-[#861F41]"
          >
            Browse Competitions →
          </Link>
        </div>
      )}

      {[...grouped.entries()].map(([year, items]) => (
        <section key={year} className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold text-[#002144]">
              {year} Season
            </h3>
            <span className="text-sm text-slate-500">
              {items.length} appearances
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[750px] text-left text-sm">
              <thead className="bg-[#002144] text-white">
                <tr>
                  <th className="px-5 py-4">
                    Competition / Round
                  </th>
                  <th className="px-5 py-4">Class</th>
                  <th className="px-5 py-4">Class Place</th>
                  <th className="px-5 py-4">Overall</th>
                  <th className="px-5 py-4 text-right">
                    Score
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {items.map((item) => {
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
                    <tr key={entry.id}>
                      <td className="px-5 py-4">
                        <Link
                          href={roundPublicUrl(
                            competition.slug,
                            round.slug
                          )}
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
                          {dateText(
                            competition.competition_date
                          )}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        {entry.classification ?? "—"}
                      </td>

                      <td className="px-5 py-4 font-semibold">
                        {rankText(
                          entry.class_placement,
                          classTie
                        )}
                      </td>

                      <td className="px-5 py-4 font-semibold">
                        {rankText(
                          entry.overall_placement,
                          overallTie
                        )}
                      </td>

                      <td className="px-5 py-4 text-right font-bold tabular-nums text-[#002144]">
                        {scoreText(entry.total_score)}
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
        Different historical scoring systems may
        not be directly comparable. Missing values
        are displayed as —.
      </p>

      <Link
        href="/competitions"
        className="inline-block rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-bold text-[#002144]"
      >
        Browse Competition Archive →
      </Link>
    </section>
  );
}
