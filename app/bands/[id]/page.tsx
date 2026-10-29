
import { Suspense } from "react";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN } from "@/lib/band-validation";
import { BAND_SLUG_PATTERN } from "@/lib/band-slugs";

import BandStatusBadge from "@/components/BandStatusBadge";
import BandStatisticsPreview from "@/components/BandStatisticsPreview";
import BandCompetitionHistory from "@/components/BandCompetitionHistory";

type Props = {
  params: Promise<{ id: string }>;
};

function ensembleType(kind: string): string {
  if (kind === "drum_corps") return "Drum Corps";
  if (kind === "marching_band") return "Marching Band";
  return "Ensemble";
}

function yearRange(
  start: number | null,
  end: number | null
): string {
  if (start !== null && end !== null) {
    return start === end
      ? String(start)
      : `${start}–${end}`;
  }

  if (start !== null) return `${start}–Present`;
  if (end !== null) return `Through ${end}`;

  return "Dates unknown";
}

async function BandProfileContent({ params }: Props) {
  const { id } = await params;

  const supabase = await createClient();

  if (UUID_PATTERN.test(id)) {
    const { data: previousBand, error } =
      await supabase
        .from("bands")
        .select("slug")
        .eq("id", id)
        .is("archived_at", null)
        .maybeSingle();

    if (error || !previousBand) notFound();

    permanentRedirect(`/bands/${previousBand.slug}`);
  }

  if (
    id.length > 150 ||
    !BAND_SLUG_PATTERN.test(id)
  ) {
    notFound();
  }

  const { data: band, error } = await supabase
    .from("bands")
    .select(
      "id, slug, name, kind, city, state, country, notes, competitive_status, logo_path"
    )
    .eq("slug", id)
    .is("archived_at", null)
    .maybeSingle();

  if (error || !band) notFound();

  const { data: names, error: namesError } =
    await supabase
      .from("band_names")
      .select(
        "id, historical_name, start_year, end_year"
      )
      .eq("band_id", band.id)
      .order("start_year", {
        ascending: false,
        nullsFirst: false,
      });

  if (namesError) {
    throw new Error(
      "Unable to load historical band names."
    );
  }

  const logoPathValid =
    typeof band.logo_path === "string" &&
    new RegExp(
      `^bands/${band.id}/[0-9a-f-]+\\.(png|jpg|webp)$`,
      "i"
    ).test(band.logo_path);

  const logoUrl = logoPathValid
    ? supabase.storage
        .from("band-logos")
        .getPublicUrl(band.logo_path!)
        .data.publicUrl
    : null;

  const location = [
    band.city,
    band.state,
    band.country,
  ]
    .filter(Boolean)
    .join(", ");

  const information = [
    {
      label: "Ensemble Type",
      value: ensembleType(band.kind),
    },
    {
      label: "City",
      value: band.city || "Not recorded",
    },
    {
      label: "State / Region",
      value: band.state || "Not recorded",
    },
    {
      label: "Country",
      value: band.country || "Not recorded",
    },
  ];

  return (
    <>
      <section className="bg-[#002144] px-6 py-14 text-white md:py-20">
        <div className="mx-auto max-w-5xl">
          <Link
            href="/bands"
            className="text-sm font-semibold text-[#E1BBC7] hover:text-white hover:underline"
          >
            &larr; All Bands &amp; Drum Corps
          </Link>

          <div className="mt-9 flex flex-wrap items-center gap-6 md:gap-8">
            <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-white p-3 shadow-lg md:h-36 md:w-36">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt={`${band.name} logo`}
                  className="h-full w-full object-contain"
                />
              ) : (
                <svg
                  viewBox="0 0 48 48"
                  aria-hidden="true"
                  className="h-14 w-14 text-slate-300"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect
                    x="5"
                    y="7"
                    width="38"
                    height="34"
                    rx="5"
                  />
                  <circle cx="17" cy="18" r="4" />
                  <path d="m9 35 11-11 7 7 5-5 7 9" />
                </svg>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#E1BBC7]">
                {ensembleType(band.kind)}
              </p>

              <h1 className="mt-3 font-serif text-4xl font-bold leading-tight md:text-5xl">
                {band.name}
              </h1>

              <p className="mt-4 text-base text-slate-300">
                {location || "Location not recorded"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="bg-[#F4F6F9]">
        <div className="mx-auto max-w-5xl space-y-8 px-6 py-12">
          <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
              Ensemble Information
            </p>

            <h2 className="mt-3 font-serif text-2xl font-bold text-[#002144]">
              About {band.name}
            </h2>

            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              {information.map((item) => (
                <div key={item.label}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {item.label}
                  </p>

                  <p className="mt-2 font-bold text-[#002144]">
                    {item.value}
                  </p>
                </div>
              ))}

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Competitive Status
                </p>

                <div className="mt-2">
                  <BandStatusBadge
                    status={band.competitive_status}
                  />
                </div>
              </div>
            </div>
          </section>

          <Suspense
            fallback={
              <section className="rounded-2xl border border-slate-200 bg-white p-7 text-sm text-slate-600">
                Loading statistics overview...
              </section>
            }
          >
            <BandStatisticsPreview
              bandId={band.id}
              bandSlug={band.slug}
            />
          </Suspense>

          <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
              Ensemble History
            </p>

            <h2 className="mt-3 font-serif text-2xl font-bold text-[#002144]">
              Historical Names
            </h2>

            {names?.length ? (
              <div className="mt-6 divide-y divide-slate-100">
                {names.map((name) => (
                  <div
                    key={name.id}
                    className="flex flex-wrap items-start justify-between gap-3 py-4"
                  >
                    <p className="font-semibold text-[#002144]">
                      {name.historical_name}
                    </p>

                    <span className="rounded-full bg-[#F4F6F9] px-3 py-1 text-xs font-semibold text-slate-600">
                      {yearRange(
                        name.start_year,
                        name.end_year
                      )}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm leading-7 text-slate-600">
                No historical name changes have been
                documented for this ensemble.
              </p>
            )}
          </section>

          {band.notes && (
            <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
                Historical Documentation
              </p>

              <h2 className="mt-3 font-serif text-2xl font-bold text-[#002144]">
                Additional Information
              </h2>

              <p className="mt-5 whitespace-pre-wrap text-sm leading-8 text-slate-700">
                {band.notes}
              </p>
            </section>
          )}
        </div>
      </div>

      {/* History is rendered ONLY on the main profile,
          not automatically on statistics or achievements. */}
      <Suspense
        fallback={
          <section className="bg-[#F4F6F9] px-6 py-12">
            <div className="mx-auto max-w-6xl rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600">
              Loading competition history...
            </div>
          </section>
        }
      >
        <BandCompetitionHistory
          bandIdentifier={band.slug}
        />
      </Suspense>
    </>
  );
}

export default function PublicBandPage(props: Props) {
  return (
    <main className="min-h-screen bg-[#F4F6F9]">
      <Suspense
        fallback={
          <div
            role="status"
            className="mx-auto max-w-5xl px-6 py-12 text-sm text-slate-600"
          >
            Loading ensemble profile...
          </div>
        }
      >
        <BandProfileContent params={props.params} />
      </Suspense>
    </main>
  );
}
