
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BandForm from "@/components/BandForm";
import { createBand } from "../actions";

export default async function NewBandPage() {
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
    !["owner", "admin", "editor"].includes(
      staff.role
    )
  ) {
    redirect("/staff/login");
  }

  return (
    <main className="mx-auto max-w-4xl space-y-7 px-5 py-10">
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
          Create one permanent profile for the
          ensemble. Competition classifications
          will be recorded separately.
        </p>
      </div>

      <BandForm action={createBand} />
    </main>
  );
}
