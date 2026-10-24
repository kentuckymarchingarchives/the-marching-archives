
import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ArchiveControls from "@/components/ArchiveControls";

type Props = {
  children: React.ReactNode;
  params: Promise<{
    id: string;
    roundId: string;
  }>;
};

async function RoundNavigation({
  params,
}: {
  params: Props["params"];
}) {
  const { id, roundId } = await params;

  const base =
    `/staff/competitions/${id}/rounds/${roundId}`;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();

  let canManage = false;

  if (auth?.claims?.sub) {
    const { data: staff } = await supabase
      .from("staff_members")
      .select("role, status")
      .eq("user_id", auth.claims.sub)
      .maybeSingle();

    canManage =
      staff?.status === "active" &&
      ["owner", "admin"].includes(staff.role);
  }

  const { data: round } = await supabase
    .from("competition_rounds")
    .select("id, name, archived_at")
    .eq("id", roundId)
    .eq("competition_id", id)
    .maybeSingle();

  return (
    <div className="border-b border-slate-200 bg-white">
      <nav
        aria-label="Round management"
        className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-6 py-4"
      >
        <Link
          href={base}
          className="rounded-lg bg-[#002144] px-5 py-2.5 text-sm font-bold text-white"
        >
          Results Editor
        </Link>

        <Link
          href={`${base}/tools`}
          className="rounded-lg bg-[#861F41] px-5 py-2.5 text-sm font-bold text-white"
        >
          Results Tools
        </Link>

        <Link
          href={`/staff/competitions/${id}`}
          className="ml-auto text-sm font-semibold text-slate-600 hover:text-[#861F41]"
        >
          Competition Details →
        </Link>
      </nav>

      {canManage && round && (
        <div className="border-t border-slate-100">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-5 px-6 py-4">
            <ArchiveControls
              kind="round"
              recordId={round.id}
              name={round.name}
              archived={Boolean(round.archived_at)}
            />

            <Link
              href="/staff/archive"
              className="text-sm font-semibold text-[#861F41]"
            >
              Open Archive Center →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RoundLayout({
  children,
  params,
}: Props) {
  return (
    <>
      <Suspense
        fallback={
          <div className="border-b border-slate-200 bg-white p-4 text-sm text-slate-500">
            Loading round navigation...
          </div>
        }
      >
        <RoundNavigation params={params} />
      </Suspense>

      {children}
    </>
  );
}
