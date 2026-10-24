
import { Suspense } from "react";
import type { ReactNode } from "react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN } from "@/lib/band-validation";

import ArchiveControls from "@/components/ArchiveControls";
import BandLogoManager from "@/components/BandLogoManager";

type Props = {
  children: ReactNode;
  params: Promise<{ id: string }>;
};

async function BandManagementToolbar({
  params,
}: {
  params: Props["params"];
}) {
  const { id } = await params;

  if (!UUID_PATTERN.test(id)) {
    return null;
  }

  const supabase = await createClient();

  const { data: auth, error: authError } =
    await supabase.auth.getClaims();

  if (authError || !auth?.claims?.sub) {
    return null;
  }

  const { data: staff, error: staffError } =
    await supabase
      .from("staff_members")
      .select("role, status")
      .eq("user_id", auth.claims.sub)
      .maybeSingle();

  if (
    staffError ||
    staff?.status !== "active" ||
    !["owner", "admin", "editor"].includes(staff.role)
  ) {
    return null;
  }

  const { data: band, error: bandError } =
    await supabase
      .from("bands")
      .select(
        "id, name, slug, logo_path, archived_at"
      )
      .eq("id", id)
      .maybeSingle();

  if (bandError || !band) {
    return null;
  }

  const canManageArchive =
    staff.role === "owner" ||
    staff.role === "admin";

  const logoUrl = band.logo_path
    ? supabase.storage
        .from("band-logos")
        .getPublicUrl(band.logo_path)
        .data.publicUrl
    : null;

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5 px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#861F41]">
              Band Record Management
            </p>

            <p className="mt-1 font-bold text-[#002144]">
              {band.name}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {band.slug && (
              <Link
                href={`/bands/${band.slug}`}
                className="cursor-pointer rounded-lg border border-slate-300 px-5 py-3 text-sm font-bold text-[#002144]"
              >
                Public Profile →
              </Link>
            )}

            {canManageArchive && (
              <Link
                href="/staff/archive"
                className="cursor-pointer rounded-lg border border-slate-300 px-5 py-3 text-sm font-bold text-[#861F41]"
              >
                Archive Center
              </Link>
            )}
          </div>
        </div>

        {canManageArchive && (
          <div className="border-t border-slate-100">
            <div className="mx-auto max-w-6xl px-6 py-4">
              <ArchiveControls
                kind="band"
                recordId={band.id}
                name={band.name}
                archived={Boolean(band.archived_at)}
              />
            </div>
          </div>
        )}
      </div>

      {!band.archived_at && (
        <div className="mx-auto max-w-6xl px-6">
          <BandLogoManager
            bandId={band.id}
            bandName={band.name}
            logoUrl={logoUrl}
          />
        </div>
      )}

      {band.archived_at && (
        <div className="mx-auto max-w-6xl px-6">
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            This band is archived. Restore it before
            uploading or changing its logo.
          </p>
        </div>
      )}
    </div>
  );
}

export default function StaffBandLayout({
  children,
  params,
}: Props) {
  return (
    <>
      <Suspense fallback={null}>
        <BandManagementToolbar params={params} />
      </Suspense>

      {children}
    </>
  );
}
