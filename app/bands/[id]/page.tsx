
import { Suspense } from "react";
import Link from "next/link";
import {
  notFound,
  permanentRedirect,
} from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN } from "@/lib/band-validation";
import { BAND_SLUG_PATTERN } from "@/lib/band-slugs";

type Props = {
  params: Promise<{ id: string }>;
};

async function BandProfileContent({ params }: Props) {
  const { id } = await params;

  const supabase = await createClient();

  // Redirect older UUID profile links.
  if (UUID_PATTERN.test(id)) {
    const { data: oldBand, error } = await supabase
      .from("bands")
      .select("slug")
      .eq("id", id)
      .maybeSingle();

    if (error || !oldBand) {
      notFound();
    }

    permanentRedirect(`/bands/${oldBand.slug}`);
  }

  // Validate readable profile URLs.
  if (
    id.length > 150 ||
    !BAND_SLUG_PATTERN.test(id)
  ) {
    notFound();
  }

  const { data: band, error } = await supabase
    .from("bands")
    .select(
      "id, slug, name, kind, city, state, country, notes"
    )
    .eq("slug", id)
    .maybeSingle();

  if (error || !band) {
    notFound();
  }

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
      "Unable to load historical names."
    );
  }

  return (
    <>
      {/* Band profile heading */}
      <section className="bg-[#002144] px-6 py-16 text-white">
        <div className="mx-auto max-w-5xl">
          <Link
            href="/bands"
            className="text-sm font-semibold text-[#E1BBC7]"
          >
            ← Band Directory
          </Link>

          <p className="mt-8 text-xs font-bold uppercase tracking-widest text-[#DAB1BF]">
            {band.kind === "drum_corps"
              ? "Drum Corps"
              : band.kind === "marching_band"
                ? "Marching Band"
                : "Ensemble"}
          </p>

          <h1 className="mt-3 font-serif text-4xl font-bold md:text-5xl">
            {band.name}
          </h1>

          <p className="mt-4 text-slate-300">
            {[band.city, band.state, band.country]
              .filter(Boolean)
              .join(", ")}
          </p>
        </div>
      </section>

      {/* Band profile information */}
      <div className="mx-auto max-w-5xl space-y-6 px-6 py-10">
        <section className="rounded-2xl border border-slate-200 bg-white p-7">
          <h2 className="text-xl font-bold text-[#002144]">
            About This Ensemble
          </h2>

          <p className="mt-4 whitespace-pre-wrap leading-7 text-slate-600">
            {band.notes ||
              "Additional historical information has not yet been recorded."}
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-7">
          <h2 className="text-xl font-bold text-[#002144]">
            Historical Names
          </h2>

          {names?.length ? (
            <div className="mt-5 space-y-4">
              {names.map((name) => (
                <div
                  key={name.id}
                  className="border-l-4 border-[#861F41] pl-4"
                >
                  <p className="font-semibold text-[#002144]">
                    {name.historical_name}
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    {name.start_year ?? "Unknown"}
                    {" – "}
                    {name.end_year ?? "Present / Unknown"}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-600">
              No historical names recorded.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-7">
          <h2 className="text-xl font-bold text-[#002144]">
            Competition History
          </h2>

          <p className="mt-4 text-sm text-slate-600">
            Historical competition appearances,
            scores, and placements will be added
            when we build the competition system.
          </p>
        </section>
      </div>
    </>
  );
}

export default function BandProfilePage({
  params,
}: Props) {
  return (
    <main className="min-h-screen bg-[#F4F6F9]">
      <Suspense
        fallback={
          <div
            role="status"
            className="mx-auto max-w-5xl px-6 py-16"
          >
            <div className="rounded-2xl border border-slate-200 bg-white p-8">
              <p className="text-sm text-slate-600">
                Loading band profile...
              </p>
            </div>
          </div>
        }
      >
        <BandProfileContent params={params} />
      </Suspense>
    </main>
  );
}
