
"use client";

import { useState } from "react";
import {
  ORGANIZATIONS,
  COMPETITION_TYPES,
  COMPETITION_FORMATS,
  SMBC_STAGES,
  allowedFormats,
  defaultFormat,
} from "@/lib/competition-config";

export type CompetitionValues = {
  id?: string;
  name: string;
  season_year: number;
  organization_code: string;
  competition_type: string;
  competition_format: string;
  smbc_stage: string | null;
  competition_date: string | null;
  city: string | null;
  state: string | null;
  country: string;
  source_url: string | null;
  notes: string | null;
  publication_status?: string;
};

type Props = {
  action: (formData: FormData) => Promise<void>;
  competition?: CompetitionValues;
};

const field =
  "mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-[#002144] focus:border-[#861F41] focus:outline-none";

export default function CompetitionForm({
  action,
  competition,
}: Props) {
  const editing = Boolean(competition);

  const [organization, setOrganization] = useState(
    competition?.organization_code ?? "KMEA"
  );

  const [type, setType] = useState(
    competition?.competition_type ?? "regular_season"
  );

  const [format, setFormat] = useState(
    competition?.competition_format ?? "single_show"
  );

  const [stage, setStage] = useState(
    competition?.smbc_stage ?? "regionals_quarterfinals"
  );

  const types = COMPETITION_TYPES[organization] ?? [];
  const formats = allowedFormats(organization, type);

  const isSmbc = organization === "KMEA" && type === "smbc";

  function changeOrganization(value: string) {
    const firstType = COMPETITION_TYPES[value]?.[0]?.value ??
      "regular_season";

    setOrganization(value);
    setType(firstType);
    setFormat(defaultFormat(value, firstType));
    setStage("regionals_quarterfinals");
  }

  function changeType(value: string) {
    setType(value);
    setFormat(defaultFormat(organization, value));
    setStage("regionals_quarterfinals");
  }

  return (
    <form
      action={action}
      className="space-y-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8"
    >
      {competition?.id && (
        <input
          type="hidden"
          name="competition_id"
          value={competition.id}
        />
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <label className="block text-sm font-semibold text-[#002144] md:col-span-2">
          Competition Name *
          <input
            name="name"
            required
            maxLength={200}
            minLength={3}
            defaultValue={competition?.name ?? ""}
            placeholder="Example: 2026 KMEA State Semifinals"
            className={field}
          />
        </label>

        <label className="block text-sm font-semibold text-[#002144]">
          Organization *
          <select
            name="organization_code"
            value={organization}
            onChange={(e) => changeOrganization(e.target.value)}
            disabled={editing}
            className={field}
          >
            {ORGANIZATIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-semibold text-[#002144]">
          Competition Type *
          <select
            name="competition_type"
            value={type}
            onChange={(e) => changeType(e.target.value)}
            disabled={editing}
            className={field}
          >
            {types.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-semibold text-[#002144]">
          Competition Format *
          <select
            name="competition_format"
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            disabled={editing}
            className={field}
          >
            {COMPETITION_FORMATS.filter((item) =>
              formats.includes(item.value)
            ).map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-semibold text-[#002144]">
          Season Year *
          <input
            name="season_year"
            type="number"
            min={1800}
            max={2200}
            required
            defaultValue={
              competition?.season_year ?? 2026
            }
            className={field}
          />
        </label>

        {isSmbc && (
          <label className="block text-sm font-semibold text-[#002144] md:col-span-2">
            SMBC Championship Stage *
            <select
              name="smbc_stage"
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              disabled={editing}
              className={field}
            >
              {SMBC_STAGES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block text-sm font-semibold text-[#002144]">
          Competition Date
          <input
            type="date"
            name="competition_date"
            defaultValue={competition?.competition_date ?? ""}
            className={field}
          />
        </label>

        <label className="block text-sm font-semibold text-[#002144]">
          City
          <input
            name="city"
            maxLength={120}
            defaultValue={competition?.city ?? ""}
            className={field}
          />
        </label>

        <label className="block text-sm font-semibold text-[#002144]">
          State / Province
          <input
            name="state"
            maxLength={120}
            defaultValue={competition?.state ?? ""}
            className={field}
          />
        </label>

        <label className="block text-sm font-semibold text-[#002144]">
          Country *
          <input
            name="country"
            required
            defaultValue={competition?.country ?? "United States"}
            className={field}
          />
        </label>
      </div>

      <label className="block text-sm font-semibold text-[#002144]">
        Source URL
        <input
          name="source_url"
          type="url"
          maxLength={2000}
          placeholder="https://example.com/results"
          defaultValue={competition?.source_url ?? ""}
          className={field}
        />
      </label>

      <label className="block text-sm font-semibold text-[#002144]">
        Competition Notes
        <textarea
          name="notes"
          rows={5}
          maxLength={5000}
          defaultValue={competition?.notes ?? ""}
          placeholder="Historical context, venue details, or scoring notes..."
          className={field}
        />
      </label>

      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
        {editing
          ? "Organization, competition type, format, and SMBC stage are locked after creation to protect existing rounds. You can edit the event details here."
          : "TMA will automatically create the standard competition rounds after saving. Custom-format events start without rounds so you can add them manually."}
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          className="rounded-lg bg-[#861F41] px-7 py-3 text-sm font-bold text-white hover:bg-[#701832]"
        >
          {editing
            ? "Save Competition Changes"
            : "Create Competition"}
        </button>
      </div>
    </form>
  );
}
