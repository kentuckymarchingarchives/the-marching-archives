
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import ArchiveControls from "@/components/ArchiveControls";

export const instant = false;

type ArchivedItem = {
  id: string;
  name: string;
  archived_at: string;
};

type ArchivedRound = ArchivedItem & {
  competition_id: string;
};

async function ArchiveContent({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const { data: auth, error: authError } =
    await supabase.auth.getClaims();

  if (authError || !auth?.claims?.sub) {
    redirect("/staff/login");
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
    !["owner", "admin"].includes(staff.role)
  ) {
    redirect("/staff/dashboard");
  }

  const [
    bandsResult,
    competitionsResult,
    roundsResult,
  ] = await Promise.all([
    supabase
      .from("bands")
      .select("id, name, archived_at")
      .not("archived_at", "is", null)
      .order("archived_at", { ascending: false })
      .limit(200),

    supabase
      .from("competitions")
      .select("id, name, archived_at")
      .not("archived_at", "is", null)
      .order("archived_at", { ascending: false })
      .limit(200),

    supabase
      .from("competition_rounds")
      .select("id, name, competition_id, archived_at")
      .not("archived_at", "is", null)
      .order("archived_at", { ascending: false })
      .limit(200),
  ]);

  if (
    bandsResult.error ||
    competitionsResult.error ||
    roundsResult.error
  ) {
    throw new Error(
      "Unable to load archive records. Check the archive migration and staff permissions."
    );
  }

  const bands = (bandsResult.data ?? []) as ArchivedItem[];
  const competitions =
    (competitionsResult.data ?? []) as ArchivedItem[];
  const rounds = (roundsResult.data ?? []) as ArchivedRound[];

  const total =
    bands.length + competitions.length + rounds.length;

  const messages: Record<string, string> = {
    "band-archive": "Band archived successfully.",
    "band-restore": "Band restored successfully.",
    "band-delete": "Band permanently deleted.",
    "competition-archive": "Competition archived successfully.",
    "competition-restore": "Competition restored successfully.",
    "competition-delete": "Competition permanently deleted.",
    "round-archive": "Round archived successfully.",
    "round-restore": "Round restored successfully.",
    "round-delete": "Round permanently deleted.",
  };

  const message =
    params.message && messages[params.message]
      ? messages[params.message]
      : null;

  function ArchiveSection({
    heading,
    kind,
    records,
  }: {
    heading: string;
    kind: "band" | "competition" | "round";
    records: ArchivedItem[];
  }) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-[#002144]">
          {heading} ({records.length})
        </h2>

        {records.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            No archived records in this category.
          </div>
        ) : (
          <div className="space-y-4">
            {records.map((record) => (
              <div
                key={record.id}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="mb-5">
                  <h3 className="text-lg font-bold text-[#002144]">
                    {record.name}
                  </h3>

                  <p className="mt-2 text-xs text-slate-500">
                    Archived:{" "}
                    {new Date(
                      record.archived_at
                    ).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      timeZone: "UTC",
                    })}
                  </p>
                </div>

                <ArchiveControls
                  kind={kind}
                  recordId={record.id}
                  name={record.name}
                  archived={true}
                />
              </div>
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-6 py-10">
      <Link
        href="/staff/dashboard"
        className="text-sm font-semibold text-[#861F41]"
      >
        ← Staff Dashboard
      </Link>

      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
          Administration
        </p>

        <h1 className="mt-3 font-serif text-4xl font-bold text-[#002144]">
          Archive Center
        </h1>

        <p className="mt-4 max-w-3xl leading-7 text-slate-600">
          Restore archived historical records or
          permanently remove records that are no
          longer needed. Permanent deletion cannot
          be undone without a database backup.
        </p>
      </header>

      {message && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm font-semibold text-emerald-900"
        >
          {message}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Archived Bands", bands.length],
          ["Archived Competitions", competitions.length],
          ["Archived Rounds", rounds.length],
        ].map(([label, count]) => (
          <div
            key={String(label)}
            className="rounded-xl border border-slate-200 bg-white p-5"
          >
            <p className="text-sm text-slate-500">
              {label}
            </p>

            <p className="mt-2 text-3xl font-bold text-[#002144]">
              {count}
            </p>
          </div>
        ))}
      </div>

      {total === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Your Archive Center is empty. Archived
          records will appear here.
        </div>
      )}

      <ArchiveSection
        heading="Bands & Drum Corps"
        kind="band"
        records={bands}
      />

      <ArchiveSection
        heading="Competitions"
        kind="competition"
        records={competitions}
      />

      <ArchiveSection
        heading="Competition Rounds"
        kind="round"
        records={rounds}
      />

      <p className="text-xs text-slate-500">
        Displaying up to 200 archived records in each
        category. Archiving a competition hides its
        active rounds without individually placing
        those rounds in the Archive Center.
      </p>
    </div>
  );
}

export default function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  return (
    <main className="min-h-screen bg-[#F4F6F9]">
      <Suspense
        fallback={
          <div
            role="status"
            className="p-10 text-sm text-slate-600"
          >
            Loading archive records...
          </div>
        }
      >
        <ArchiveContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
