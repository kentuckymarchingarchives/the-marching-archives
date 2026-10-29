
import { Suspense } from "react";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN } from "@/lib/band-validation";
import { BAND_SLUG_PATTERN } from "@/lib/band-slugs";
import BandProfileNavigation from "@/components/BandProfileNavigation";

export const instant = false;

type Props = {
  children: ReactNode;
  params: Promise<{ id: string }>;
};

async function ProfileNavigation({
  params,
}: {
  params: Props["params"];
}) {
  const { id } = await params;

  if (
    !id ||
    id.length > 150 ||
    (!UUID_PATTERN.test(id) && !BAND_SLUG_PATTERN.test(id))
  ) {
    notFound();
  }

  const supabase = await createClient();

  const { data: band, error } = await supabase
    .from("bands")
    .select("id, slug")
    .eq(UUID_PATTERN.test(id) ? "id" : "slug", id)
    .is("archived_at", null)
    .maybeSingle();

  if (error || !band) {
    notFound();
  }

  return (
    <BandProfileNavigation slug={band.slug || band.id} />
  );
}

export default function PublicBandLayout({
  children,
  params,
}: Props) {
  return (
    <>
      <Suspense
        fallback={
          <div className="bg-white px-6 py-5 text-sm text-slate-500">
            Loading ensemble navigation...
          </div>
        }
      >
        <ProfileNavigation params={params} />
      </Suspense>

      {children}
    </>
  );
}
