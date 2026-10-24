
import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import {
  UUID_PATTERN,
  type BandKind,
} from "@/lib/band-validation";

import BandForm from "@/components/BandForm";

import {
  addHistoricalName,
  removeHistoricalName,
  updateBand,
} from "../actions";

export const instant = false;

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    created?: string;
    saved?: string;
    name_added?: string;
    name_removed?: string;
  }>;
};

async function EditBandContent({
  params,
  searchParams,
}: Props) {
  const { id } = await params;
  const messages = await searchParams;

  if (!UUID_PATTERN.test(id)) {
    notFound();
  }

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
    !staff ||
    staff.status !== "active" ||
    !["owner", "admin", "editor"].includes(
      staff.role
    )
  ) {
    redirect("/staff/login?error=unauthorized");
  }

  const { data: band, error: bandError } =
    await supabase
      .from("bands")
      .select(
        "id, slug, name, kind, city, state, country, notes, competitive_status"
      )
      .eq("id", id)
      .maybeSingle();

  if (bandError) {
    throw new Error("Unable to load band details.");
  }

  if (!band) {
    notFound();
  }

  const { data: names, error: namesError } =
    await supabase
      .from("band_names")
      .select(
        "id, historical_name, start_year, end_year"
      )
      .eq("band_id", id)
      .order("start_year", {
        ascending: false,
        nullsFirst: false,
      });

  if (namesError) {
    throw new Error(
      "Unable to load historical names."
    );
  }

  const successMessage =
    messages.created === "1"
      ? "Band created successfully."
      : messages.saved === "1"
        ? "Band changes saved."
        : messages.name_added === "1"
          ? "Historical name added."
          : messages.name_removed === "1"
            ? "Historical name removed."
            : null;

  const inputClass =
    "mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm";

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-5 py-10">
      <Link
        href="/staff/bands"
        className="text-sm font-semibold text-[#861F41]"
      >
        ← Band Management
      </Link>

      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
          Edit Archive Record
        </p>

        <h1 className="mt-2 font-serif text-4xl font-bold text-[#002144]">
          {band.name}
        </h1>

        <Link
          href={`/bands/${band.slug}`}
          className="mt-3 inline-block text-sm font-semibold text-[#861F41]"
        >
          View public profile →
        </Link>
      </header>

      {successMessage && (
        <div
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 px-5 py-4 text-sm font-semibold text-green-900"
        >
          {successMessage}
        </div>
      )}

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-[#002144]">
          Band Details
        </h2>

        <BandForm
          action={updateBand}
          band={{
            ...band,
            kind: band.kind as BandKind,
          }}
        />
      </section>

      <section className="space-y-5">
        <h2 className="text-xl font-bold text-[#002144]">
          Historical Names
        </h2>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {names?.length ? (
            names.map((name) => (
              <div
                key={name.id}
                className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-5"
              >
                <div>
                  <p className="font-semibold text-[#002144]">
                    {name.historical_name}
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    {name.start_year ?? "Unknown"}
                    {" – "}
                    {name.end_year ?? "Present / Unknown"}
                  </p>
                </div>

                <form action={removeHistoricalName}>
                  <input
                    type="hidden"
                    name="band_id"
                    value={id}
                  />

                  <input
                    type="hidden"
                    name="name_id"
                    value={name.id}
                  />

                  <button
                    type="submit"
                    className="rounded-lg border border-red-200 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50"
                  >
                    Remove
                  </button>
                </form>
              </div>
            ))
          ) : (
            <p className="p-6 text-sm text-slate-600">
              No historical names recorded yet.
            </p>
          )}
        </div>

        <form
          action={addHistoricalName}
          className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6"
        >
          <input
            type="hidden"
            name="band_id"
            value={id}
          />

          <h3 className="text-lg font-bold text-[#002144]">
            Add Historical Name
          </h3>

          <label className="block text-sm font-semibold text-[#002144]">
            Historical Name *

            <input
              name="historical_name"
              required
              minLength={2}
              maxLength={200}
              className={inputClass}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-[#002144]">
              Start Year

              <input
                name="start_year"
                type="number"
                min={1800}
                max={2200}
                className={inputClass}
              />
            </label>

            <label className="block text-sm font-semibold text-[#002144]">
              End Year

              <input
                name="end_year"
                type="number"
                min={1800}
                max={2200}
                className={inputClass}
              />
            </label>
          </div>

          <button
            type="submit"
            className="rounded-lg bg-[#861F41] px-6 py-3 text-sm font-bold text-white hover:bg-[#701832]"
          >
            Add Historical Name
          </button>
        </form>
      </section>
    </div>
  );
}

export default function EditBandPage(props: Props) {
  return (
    <main className="min-h-screen bg-[#F4F6F9]">
      <Suspense
        fallback={
          <div className="mx-auto max-w-5xl px-5 py-10">
            <div
              role="status"
              className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600"
            >
              Loading band editor...
            </div>
          </div>
        }
      >
        <EditBandContent {...props} />
      </Suspense>
    </main>
  );
}
