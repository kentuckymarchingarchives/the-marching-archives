
import {
  BAND_KINDS,
  type BandKind,
} from "@/lib/band-validation";

import {
  createBandSlug,
} from "@/lib/band-slugs";

export type BandFormValues = {
  id?: string;
  name: string;
  kind: BandKind;
  city: string | null;
  state: string | null;
  country: string;
  notes: string | null;
  slug?: string;
};

type Props = {
  action: (formData: FormData) => Promise<void>;
  band?: BandFormValues;
};

const inputClass =
  "mt-2 block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-[#002144] focus:border-[#861F41] focus:outline-none";

export default function BandForm({
  action,
  band,
}: Props) {
  return (
    <form
      action={action}
      className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8"
    >
      {band?.id && (
        <input
          type="hidden"
          name="band_id"
          value={band.id}
        />
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <label className="block text-sm font-semibold text-[#002144] md:col-span-2">
          Band / Corps Name *

          <input
            name="name"
            required
            minLength={2}
            maxLength={200}
            defaultValue={band?.name ?? ""}
            placeholder="Example: Lafayette High School"
            className={inputClass}
          />
        </label>

        <label className="block text-sm font-semibold text-[#002144]">
          Ensemble Type *

          <select
            name="kind"
            required
            defaultValue={
              band?.kind ?? "marching_band"
            }
            className={inputClass}
          >
            {BAND_KINDS.map((kind) => (
              <option
                key={kind.value}
                value={kind.value}
              >
                {kind.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-semibold text-[#002144]">
          Country *

          <input
            name="country"
            required
            maxLength={120}
            defaultValue={
              band?.country ?? "United States"
            }
            className={inputClass}
          />
        </label>

        <label className="block text-sm font-semibold text-[#002144]">
          City

          <input
            name="city"
            maxLength={120}
            defaultValue={band?.city ?? ""}
            className={inputClass}
          />
        </label>

        <label className="block text-sm font-semibold text-[#002144]">
          State / Province

          <input
            name="state"
            maxLength={120}
            defaultValue={band?.state ?? ""}
            className={inputClass}
          />
        </label>
      </div>

      <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-5">
        <h3 className="font-bold text-[#002144]">
          Public Profile URL
        </h3>

        {band?.id ? (
          <>
            <p className="mt-3 break-all text-sm font-semibold text-[#861F41]">
              marchingarchives.com/bands/{band.slug}
            </p>

            <p className="mt-2 text-xs leading-6 text-slate-600">
              Your existing URL stays the same
              when the band's name changes.
            </p>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-slate-600">
              Leave this blank to generate a URL
              automatically from the band name.
            </p>

            <label className="mt-4 block text-sm font-semibold text-[#002144]">
              Custom URL Slug (Optional)

              <input
                name="slug"
                maxLength={150}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                placeholder="lafayette"
                className={inputClass}
              />
            </label>

            <p className="mt-3 text-xs text-slate-500">
              Example: Lafayette High School
              becomes /bands/
              {createBandSlug("Lafayette High School")}.
              Only lowercase letters,
              numbers, and hyphens are allowed.
            </p>
          </>
        )}
      </div>

      <label className="block text-sm font-semibold text-[#002144]">
        Research Notes

        <textarea
          name="notes"
          rows={5}
          maxLength={5000}
          defaultValue={band?.notes ?? ""}
          placeholder="Optional historical information..."
          className={inputClass}
        />
      </label>

      <div className="flex justify-end">
        <button
          type="submit"
          className="rounded-lg bg-[#861F41] px-6 py-3 text-sm font-bold text-white hover:bg-[#701832]"
        >
          {band ? "Save Band Changes" : "Create Band"}
        </button>
      </div>
    </form>
  );
}
