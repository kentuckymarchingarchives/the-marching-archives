
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN } from "@/lib/band-validation";
import { readableLabel } from "@/lib/competition-config";

export const instant = false;

type Props = {
  params: Promise<{ id: string }>;
};

function formatDate(value: string | null): string {
  if (!value) return "Not recorded";

  const date = new Date(`${value}T12:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    return "Not recorded";
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function safeSourceUrl(
  value: string | null
): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);

    if (
      url.protocol !== "https:" &&
      url.protocol !== "http:"
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

async function CompetitionProfile({ params }: Props) {
  const { id } = await params;

  if (!UUID_PATTERN.test(id)) {
    notFound();
  }

  const supabase = await createClient();

  // Always check publication status explicitly.
  // This must also apply when the visitor is a
  // signed-in staff member.

  const { data: competition, error } = await supabase
    .from("competitions")
    .select(
      "id, name, season_year, organization_code, competition_type, competition_format, smbc_stage, competition_date, city, state, country, source_url, notes, publication_status, archived_at"
    )
    .eq("id", id)
    .eq("publication_status", "published")
    .is("archived_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(
      "Unable to load the competition profile."
    );
  }

  if (!competition) {
    notFound();
  }

  const { data: rounds, count, error: roundsError } =
    await supabase
      .from("competition_rounds")
      .select(
        "id, name, round_kind, class_scope, sort_order",
        { count: "exact" }
      )
      .eq("competition_id", id)
      .is("archived_at", null)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true })
      .limit(100);

  if (roundsError) {
    throw new Error(
      "Unable to load competition rounds."
    );
  }

  const location = [
    competition.city,
    competition.state,
    competition.country,
  ]
    .filter(Boolean)
    .join(", ");

  const source = safeSourceUrl(
    competition.source_url
  );

  const roundCount = count ?? 0;

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-6 py-10">
      <Link
        href="/competitions"
        className="inline-block text-sm font-semibold text-[#861F41] hover:underline"
      >
        ← All Competitions
      </Link>

      <header className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-[#002144] px-4 py-2 text-xs font-bold text-white">
            {competition.organization_code}
          </span>

          <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-[#002144]">
            {competition.season_year} Season
          </span>

          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-800">
            Published
          </span>
        </div>

        <h1 className="font-serif text-4xl font-bold text-[#002144] md:text-5xl">
          {competition.name}
        </h1>

        <p className="text-lg text-slate-600">
          {readableLabel(
            competition.competition_type
          )}
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
            Date
          </p>

          <p className="mt-3 font-bold text-[#002144]">
            {formatDate(
              competition.competition_date
            )}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
            Location
          </p>

          <p className="mt-3 font-bold text-[#002144]">
            {location || "Not recorded"}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
            Format
          </p>

          <p className="mt-3 font-bold text-[#002144]">
            {readableLabel(
              competition.competition_format
            )}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
            Rounds
          </p>

          <p className="mt-3 text-3xl font-bold tabular-nums text-[#002144]">
            {roundCount}
          </p>
        </div>
      </section>

      {competition.smbc_stage && (
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
            Championship Stage
          </p>

          <p className="mt-3 font-semibold text-[#002144]">
            {readableLabel(competition.smbc_stage)}
          </p>
        </section>
      )}

      <section className="space-y-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
            Competition Structure
          </p>

          <h2 className="mt-2 font-serif text-3xl font-bold text-[#002144]">
            Competition Rounds
          </h2>

          <p className="mt-3 text-sm leading-7 text-slate-600">
            Each round represents a separate set
            of historical competition results.
            Archived rounds are not displayed.
          </p>
        </div>

        {rounds?.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {rounds.map((round, index) => (
              <div
                key={round.id}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex items-start gap-4">
                  <span
                    aria-hidden="true"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#002144] font-bold text-white"
                  >
                    {index + 1}
                  </span>

                  <div className="min-w-0">
                    <h3 className="text-xl font-bold text-[#002144]">
                      {round.name}
                    </h3>

                    <p className="mt-2 text-sm text-slate-600">
                      {readableLabel(
                        round.round_kind
                      )}
                    </p>

                    <p className="mt-2 text-sm text-slate-500">
                      {round.class_scope
                        ? `Class: ${round.class_scope}`
                        : "All eligible classifications"}
                    </p>
                  </div>
                </div>

                <div className="mt-5 border-t border-slate-100 pt-4">
                  <p className="text-xs font-semibold text-slate-500">
                    Detailed round results coming in Phase 7.4
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600">
            No public competition rounds are currently available.
          </div>
        )}

        {roundCount > (rounds?.length ?? 0) && (
          <p className="text-sm text-amber-800">
            This competition has additional rounds
            beyond the current display limit.
          </p>
        )}
      </section>

      {competition.notes && (
        <section className="rounded-2xl border border-slate-200 bg-white p-7">
          <h2 className="text-2xl font-bold text-[#002144]">
            Historical Information
          </h2>

          <p className="mt-4 whitespace-pre-wrap text-sm leading-8 text-slate-700">
            {competition.notes}
          </p>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-7">
        <h2 className="text-2xl font-bold text-[#002144]">
          Historical Sources
        </h2>

        {source ? (
          <>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              A source link has been recorded
              for this competition.
            </p>

            <a
              href={source}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-block font-bold text-[#861F41] hover:underline"
            >
              View Recorded Source ↗
            </a>
          </>
        ) : (
          <p className="mt-3 text-sm leading-7 text-slate-600">
            No online source link is currently
            available for this competition.
            Historical documentation may exist
            in offline archive records.
          </p>
        )}
      </section>

      <section className="rounded-2xl bg-[#002144] px-8 py-10 text-center text-white">
        <h2 className="font-serif text-2xl font-bold">
          Exploring More Marching History?
        </h2>

        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-300">
          Explore additional historical
          competitions or browse the bands
          and drum corps documented by TMA.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/competitions"
            className="rounded-lg bg-[#861F41] px-6 py-3 text-sm font-bold text-white hover:bg-[#A02B52]"
          >
            More Competitions
          </Link>

          <Link
            href="/bands"
            className="rounded-lg border border-white/30 px-6 py-3 text-sm font-bold text-white hover:bg-white/10"
          >
            Bands & Corps
          </Link>
        </div>
      </section>
    </div>
  );
}

export default function CompetitionProfilePage(
  props: Props
) {
  return (
    <main className="min-h-screen bg-[#F4F6F9]">
      <Suspense
        fallback={
          <div
            role="status"
            className="mx-auto max-w-6xl px-6 py-10 text-sm text-slate-600"
          >
            Loading competition profile...
          </div>
        }
      >
        <CompetitionProfile params={props.params} />
      </Suspense>
    </main>
  );
}
