
import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ArchiveControls from "@/components/ArchiveControls";

type Props = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

async function CompetitionArchiveToolbar({
  params,
}: {
  params: Props["params"];
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: auth } =
    await supabase.auth.getClaims();

  if (!auth?.claims?.sub) return null;

  const { data: staff } = await supabase
    .from("staff_members")
    .select("role, status")
    .eq("user_id", auth.claims.sub)
    .maybeSingle();

  if (
    staff?.status !== "active" ||
    !["owner", "admin"].includes(staff.role)
  ) {
    return null;
  }

  const { data: competition } = await supabase
    .from("competitions")
    .select("id, name, archived_at")
    .eq("id", id)
    .maybeSingle();

  if (!competition) return null;

  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#861F41]">
            Competition Management
          </p>

          <p className="mt-1 text-sm font-semibold text-[#002144]">
            {competition.name}
          </p>
        </div>

        <ArchiveControls
          kind="competition"
          recordId={competition.id}
          name={competition.name}
          archived={Boolean(competition.archived_at)}
        />

        <Link
          href="/staff/archive"
          className="text-sm font-semibold text-[#861F41]"
        >
          Archive Center →
        </Link>
      </div>
    </div>
  );
}

export default function CompetitionLayout({
  children,
  params,
}: Props) {
  return (
    <>
      <Suspense fallback={null}>
        <CompetitionArchiveToolbar params={params} />
      </Suspense>
      {children}
    </>
  );
}
