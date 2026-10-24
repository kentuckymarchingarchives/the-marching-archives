
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

import CompetitionForm from "@/components/CompetitionForm";
import { createCompetition } from "../actions";

async function NewCompetitionContent() {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getClaims();

  if (!auth?.claims?.sub) {
    redirect("/staff/login");
  }

  const { data: staff } = await supabase
    .from("staff_members")
    .select("role, status")
    .eq("user_id", auth.claims.sub)
    .maybeSingle();

  if (
    staff?.status !== "active" ||
    !["owner", "admin", "editor"].includes(staff.role)
  ) {
    redirect("/staff/login?error=unauthorized");
  }

  return (
    <div className="mx-auto max-w-4xl space-y-7 px-6 py-10">
      <Link
        href="/staff/competitions"
        className="text-sm font-semibold text-[#861F41]"
      >
        ← Competition Management
      </Link>

      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
          New Archive Record
        </p>

        <h1 className="mt-2 font-serif text-4xl font-bold text-[#002144]">
          Add Competition
        </h1>

        <p className="mt-3 text-slate-600">
          Choose the organization, competition type,
          format, and stage. TMA will prepare the
          appropriate scoring rounds.
        </p>
      </div>

      <CompetitionForm action={createCompetition} />
    </div>
  );
}

export default function NewCompetitionPage() {
  return (
    <main className="min-h-screen bg-[#F4F6F9]">
      <Suspense
        fallback={
          <div className="mx-auto max-w-4xl px-6 py-10 text-sm text-slate-600">
            Loading competition form...
          </div>
        }
      >
        <NewCompetitionContent />
      </Suspense>
    </main>
  );
}
