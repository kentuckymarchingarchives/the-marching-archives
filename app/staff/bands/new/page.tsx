
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import BandForm from "@/components/BandForm";
import { createBand } from "../actions";

export const instant = false;

async function NewBandContent() {
  const supabase = await createClient();

  // Verify that the user is signed in.
  const { data: auth, error: authError } =
    await supabase.auth.getClaims();

  if (authError || !auth?.claims?.sub) {
    redirect("/staff/login");
  }

  // Verify that the user is active staff.
  const { data: staff, error: staffError } =
    await supabase
      .from("staff_members")
      .select("role, status")
      .eq("user_id", auth.claims.sub)
      .maybeSingle();

  if (
    staffError ||
    !staff ||
    staff.status !== "active" ||
    !["owner", "admin", "editor"].includes(
      staff.role
    )
  ) {
    redirect("/staff/login?error=unauthorized");
  }

  return (
    <div className="mx-auto max-w-4xl space-y-7 px-5 py-10">
      <Link
        href="/staff/bands"
        className="text-sm font-semibold text-[#861F41]"
      >
        ← Band Management
      </Link>

      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
          New Archive Record
        </p>

        <h1 className="mt-2 font-serif text-4xl font-bold text-[#002144]">
          Add Band / Drum Corps
        </h1>

        <p className="mt-3 text-slate-600">
          Create one permanent profile for each
          ensemble. Competition classifications
          will be recorded separately.
        </p>
      </div>

      <BandForm action={createBand} />
    </div>
  );
}

export default function NewBandPage() {
  return (
    <main className="min-h-screen bg-[#F4F6F9]">
      <Suspense
        fallback={
          <div className="mx-auto max-w-4xl px-5 py-10">
            <div
              role="status"
              className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600"
            >
              Loading band creation form...
            </div>
          </div>
        }
      >
        <NewBandContent />
      </Suspense>
    </main>
  );
}
