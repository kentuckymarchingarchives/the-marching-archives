
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
      <section className="relative overflow-hidden bg-[#002144] text-white"><div aria-hidden="true" className="pointer-events-none absolute -right-40 -top-52 h-145 w-145 rounded-full border border-white/10" /><div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-32 h-97.5 w-97.5 rounded-full border border-white/10" />
        <div className="relative mx-auto max-w-6xl px-5 pb-12 pt-10 sm:px-8 md:pb-16">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
            <Link href="/" className="hover:text-white">Home</Link>
            <span aria-hidden="true">/</span>
            <Link href="/bands" className="hover:text-white">Bands &amp; Corps</Link>
            <span aria-hidden="true">/</span>
            <span className="font-semibold text-white" aria-current="page">{band.name}</span>
          </nav>
          <div className="mt-9 flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
            <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-[26px] border border-white/20 bg-white p-3 shadow-[0_24px_48px_rgba(0,0,0,0.18)] sm:h-36 sm:w-36">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={`${band.name} logo`} className="h-full w-full object-contain" />
              ) : (
                <span aria-hidden="true" className="text-5xl font-black text-[#002144]">{band.name.slice(0, 1)}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#efb8ca]">{ensembleType(band.kind)}</p>
              <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] sm:text-5xl md:text-6xl">{band.name}</h1>
              <p className="mt-3 text-sm text-slate-200 sm:text-base">{location || "Location not recorded"}</p>
              <div className="mt-5 inline-flex rounded-full bg-white px-3 py-1.5 text-[#002144]">
                <BandStatusBadge status={band.competitive_status} />
              </div>
            </div>
          </div>
          <nav aria-label="Band profile sections" className="mt-11 flex flex-wrap gap-2 border-t border-white/20 pt-6">
            <a href="#overview" className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-[#002144]">Overview</a>
            <a href="#history" className="rounded-lg border border-white/25 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">Competition history</a>
            <a href="#names" className="rounded-lg border border-white/25 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">Historical names</a>
            <Link href={`/bands/${band.slug}/timeline`} className="rounded-lg border border-white/25 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">Interactive timeline ↗</Link>
            <Link href={`/bands/${band.slug}/achievements`} className="rounded-lg border border-white/25 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">Achievements ↗</Link>
            <Link href={`/bands/${band.slug}/statistics`} className="rounded-lg border border-white/25 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">Statistics ↗</Link>
          </nav>
        </div>
      </section>

      <div id="overview" className="bg-[#F6F8FA]">
        <div className="mx-auto max-w-6xl space-y-7 px-5 py-12 sm:px-8">
          <section className="rounded-[26px] border border-[#DFE6EE] bg-white p-6 shadow-[0_8px_35px_rgba(0,33,68,0.04)] sm:p-8">
            <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
              Ensemble Information
            </p>

            <h2 className="mt-3 text-2xl font-black tracking-tight text-[#002144]">
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

          <section id="names" className="scroll-mt-28 rounded-[26px] border border-[#DFE6EE] bg-white p-6 shadow-[0_8px_35px_rgba(0,33,68,0.04)] sm:p-8">
            <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
              Ensemble History
            </p>

            <h2 className="mt-3 text-2xl font-black tracking-tight text-[#002144]">
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
            <section className="rounded-[26px] border border-[#DFE6EE] bg-white p-6 shadow-[0_8px_35px_rgba(0,33,68,0.04)] sm:p-8">
              <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
                Historical Documentation
              </p>

              <h2 className="mt-3 text-2xl font-black tracking-tight text-[#002144]">
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
      <div id="history" className="scroll-mt-28">
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
      </div>
    </>
  );
}

export default function PublicBandPage(props: Props) {
  return (
    <main className="min-h-screen bg-[#F6F8FA]">
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
