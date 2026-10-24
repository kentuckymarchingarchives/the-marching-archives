
import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN } from "@/lib/band-validation";

type Props = {
  bandIdentifier: string;
};

export default async function PublicBandLogo({
  bandIdentifier,
}: Props) {
  const supabase = await createClient();

  const { data: band, error } = await supabase
    .from("bands")
    .select("id, name, logo_path")
    .eq(
      UUID_PATTERN.test(bandIdentifier)
        ? "id"
        : "slug",
      bandIdentifier
    )
    .is("archived_at", null)
    .maybeSingle();

  if (error || !band || !band.logo_path) {
    return null;
  }

  // Only display images from the band's own
  // designated storage folder.
  if (
    !band.logo_path.startsWith(
      `bands/${band.id}/`
    )
  ) {
    return null;
  }

  const { data } = supabase.storage
    .from("band-logos")
    .getPublicUrl(band.logo_path);

  return (
    <section className="mx-auto max-w-6xl px-6 pt-8">
      <div className="flex flex-wrap items-center gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#F4F6F9] p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.publicUrl}
            alt={`${band.name} logo`}
            className="max-h-full max-w-full object-contain"
          />
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
            Official Ensemble Branding
          </p>

          <p className="mt-2 text-lg font-bold text-[#002144]">
            {band.name}
          </p>

          <p className="mt-2 text-sm text-slate-600">
            Ensemble logo
          </p>
        </div>
      </div>
    </section>
  );
}
