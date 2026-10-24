
import { Suspense } from "react";
import Link from "next/link";
import { permanentRedirect } from "next/navigation";

import {
  getPublicCompetition,
  isRecordId,
  competitionPublicUrl,
  roundPublicUrl,
} from "@/lib/public-competition-routes";

export const instant = false;

type Props = {
  params: Promise<{ id: string }>;
};

function label(value: string | null): string {
  if (!value) return "Not specified";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function dateLabel(value: string | null): string {
  if (!value) return "Not recorded";

  const date = new Date(`${value}T12:00:00Z`);

  return Number.isNaN(date.getTime())
    ? "Not recorded"
    : date.toLocaleDateString("en-US", {
        dateStyle: "long",
        timeZone: "UTC",
      });
}

function sourceUrl(value: string | null) {
  if (!value) return null;

  try {
    const url = new URL(value);

    return ["http:", "https:"].includes(url.protocol)
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

async function CompetitionProfile({ params }: Props) {
  const { id } = await params;

  const { supabase, competition } =
    await getPublicCompetition(id);

  const canonicalUrl = competitionPublicUrl(
    competition.slug
  );

  if (isRecordId(id) || id !== competition.slug) {
    permanentRedirect(canonicalUrl);
  }

  const { data: rounds, count, error } =
    await supabase
      .from("competition_rounds")
      .select(
        "id, slug, name, round_kind, class_scope, sort_order",
        { count: "exact" }
      )
      .eq("competition_id", competition.id)
      .is("archived_at", null)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true })
      .limit(100);

  if (error) {
    throw new Error(
      "Unable to retrieve competition rounds."
    );
  }

  const location = [
    competition.city,
    competition.state,
    competition.country,
  ].filter(Boolean).join(", ");

  const source = sourceUrl(competition.source_url);

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-6 py-10">
      <Link
        href="/competitions"
        className="text-sm font-semibold text-[#861F41]"
      >
        ← All Competitions
      </Link>

      <header className="space-y-5">
        <div className="flex flex-wrap gap-3">
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
          {label(competition.competition_type)}
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          ["Date", dateLabel(competition.competition_date)],
          ["Location", location || "Not recorded"],
          ["Format", label(competition.competition_format)],
          ["Rounds", String(count ?? 0)],
        ].map(([title, value]) => (
          <div
            key={title}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
              {title}
            </p>
            <p className="mt-3 font-bold text-[#002144]">
              {value}
            </p>
          </div>
        ))}
      </section>

      {competition.smbc_stage && (
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
            Championship Stage
          </p>
          <p className="mt-3 font-semibold text-[#002144]">
            {label(competition.smbc_stage)}
          </p>
        </section>
      )}

      <section className="space-y-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
            Historical Results
          </p>

          <h2 className="mt-2 font-serif text-3xl font-bold text-[#002144]">
            Competition Rounds
          </h2>

          <p className="mt-3 text-sm leading-7 text-slate-600">
            Select a round to view its recorded scores,
            placements, classifications, and caption breakdowns.
          </p>
        </div>

        {rounds?.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {rounds.map((round, index) => (
              <Link
                key={round.id}
                href={roundPublicUrl(
                  competition.slug,
                  round.slug
                )}
                className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-[#861F41] hover:shadow-md"
              >
                <div className="flex items-start gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#002144] font-bold text-white">
                    {index + 1}
                  </span>

                  <div>
                    <h3 className="text-xl font-bold text-[#002144] group-hover:text-[#861F41]">
                      {round.name}
                    </h3>
                    <p className="mt-2 text-sm text-slate-600">
                      {label(round.round_kind)}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      {round.class_scope
                        ? `Class: ${round.class_scope}`
                        : "All eligible classifications"}
                    </p>
                  </div>
                </div>

                <p className="mt-5 border-t border-slate-100 pt-4 text-sm font-bold text-[#861F41]">
                  View Round Results →
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <p className="rounded-xl bg-white p-7 text-slate-600">
            No public rounds are available.
          </p>
        )}

        {(count ?? 0) > (rounds?.length ?? 0) && (
          <p className="text-sm text-amber-800">
            Additional rounds exist beyond the current
            display limit.
          </p>
        )}
      </section>

      {competition.notes && (
        <section className="rounded-2xl border border-slate-200 bg-white p-7">
          <h2 className="text-2xl font-bold text-[#002144]">
            Historical Information
          </h2>

          <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-600">
            {competition.notes}
          </p>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-7">
        <h2 className="text-2xl font-bold text-[#002144]">
          Historical Sources
        </h2>

        {source ? (
          <a
            href={source}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block font-bold text-[#861F41]"
          >
            View Recorded Source ↗
          </a>
        ) : (
          <p className="mt-3 text-sm text-slate-600">
            No online source has been recorded.
          </p>
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/competitions"
          className="rounded-lg bg-[#002144] px-6 py-3 text-sm font-bold text-white"
        >
          Browse Competitions
        </Link>

        <Link
          href="/bands"
          className="rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-bold text-[#002144]"
        >
          Bands & Corps
        </Link>
      </div>
    </div>
  );
}

export default function PublicCompetitionPage(
  props: Props
) {
  return (
    <main className="min-h-screen bg-[#F4F6F9]">
      <Suspense
        fallback={
          <div className="mx-auto max-w-6xl px-6 py-10 text-sm text-slate-600">
            Loading competition...
          </div>
        }
      >
        <CompetitionProfile params={props.params} />
      </Suspense>
    </main>
  );
}
