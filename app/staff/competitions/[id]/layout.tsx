
import { Suspense } from "react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN } from "@/lib/band-validation";
import ArchiveControls from "@/components/ArchiveControls";

type Props = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

async function CompetitionToolbar({
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

  const { data: competition, error } =
    await supabase
      .from("competitions")
      .select(
        "id, name, archived_at, publication_status"
      )
      .eq("id", id)
      .maybeSingle();

  if (error || !competition) {
    return null;
  }

  const canManage =
    staff.role === "owner" ||
    staff.role === "admin";

  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5 px-6 py-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#861F41]">
            Competition Management
          </p>

          <p className="mt-1 text-sm font-semibold text-[#002144]">
            {competition.name}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {competition.archived_at
              ? "Archived"
              : competition.publication_status === "published"
                ? "Published"
                : "Draft"}
          </p>
        </div>

        <nav
          aria-label="Competition actions"
          className="flex flex-wrap items-center gap-3"
        >
          <Link
            href={`/staff/competitions/${id}`}
            className="cursor-pointer rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-[#002144] hover:bg-slate-50"
          >
            Details
          </Link>

          <Link
            href={`/staff/competitions/${id}/review`}
            className="cursor-pointer rounded-lg bg-[#002144] px-5 py-3 text-sm font-bold text-white hover:bg-[#123B63]"
          >
            Review Results
          </Link>

          <Link
            href={`/staff/competitions/${id}/research`}
            className="cursor-pointer rounded-lg border border-[#861F41]/30 bg-white px-5 py-3 text-sm font-bold text-[#861F41] hover:bg-[#fff3f7]"
          >
            Research Tasks
          </Link>

          <Link
            href={`/staff/competitions/${id}/publish`}
            className="cursor-pointer rounded-lg bg-[#861F41] px-5 py-3 text-sm font-bold text-white hover:bg-[#A02B52]"
          >
            Publishing
          </Link>
        </nav>
      </div>

      {canManage && (
        <div className="border-t border-slate-100">
          <div className="mx-auto flex flex-wrap items-center justify-between gap-4 px-6 py-4">
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
      )}
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
        <CompetitionToolbar params={params} />
      </Suspense>

      {children}
    </>
  );
}
