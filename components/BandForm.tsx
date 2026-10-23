
import {
  BAND_KINDS,
  type BandKind,
} from "@/lib/band-validation";

export type BandFormValues = {
  id?: string;
  name: string;
  kind: BandKind;
  city: string | null;
  state: string | null;
  country: string;
  notes: string | null;
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
