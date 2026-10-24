
import { Suspense } from "react";
import type { ReactNode } from "react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN } from "@/lib/band-validation";
import OrganizationIdentity from "@/components/OrganizationIdentity";

export const instant = false;

type Props = {
  children: ReactNode;
  params: Promise<{
    id: string;
  }>;
};

async function OrganizationBanner({
  params,
}: {
  params: Props["params"];
}) {
  const { id } = await params;

  const isUuid = UUID_PATTERN.test(id);

  if (
    !isUuid &&
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)
  ) {
    return null;
  }

  const supabase = await createClient();

  const { data: competition, error } =
    await supabase
      .from("competitions")
      .select("id, organization_code")
      .eq(isUuid ? "id" : "slug", id)
      .eq("publication_status", "published")
      .is("archived_at", null)
      .maybeSingle();

  if (error || !competition) {
    return null;
  }

  return (
    <section
      aria-label="Competition organization"
      className="border-b border-slate-200 bg-[#F4F6F9]"
    >
      <div className="mx-auto max-w-7xl px-6 py-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
            Organized By
          </p>

          <Link
            href="/organizations"
            className="cursor-pointer text-sm font-semibold text-[#861F41] hover:underline"
          >
            All Organizations →
          </Link>
        </div>

        <OrganizationIdentity
          organizationCode={
            competition.organization_code
          }
          compact
          showArchiveLink
        />
      </div>
    </section>
  );
}

export default function CompetitionIdentityLayout({
  children,
  params,
}: Props) {
  return (
    <>
      <Suspense fallback={null}>
        <OrganizationBanner params={params} />
      </Suspense>

      {children}
    </>
  );
}
