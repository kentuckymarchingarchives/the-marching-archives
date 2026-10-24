
"use client";

import {
  useActionState,
  useState,
} from "react";

import {
  uploadBandLogo,
  removeBandLogo,
  type LogoActionState,
} from "@/app/staff/bands/logo-actions";

type Props = {
  bandId: string;
  bandName: string;
  logoUrl: string | null;
};

const initialState: LogoActionState = {
  ok: false,
  message: "",
};

export default function BandLogoManager({
  bandId,
  bandName,
  logoUrl,
}: Props) {
  const [
    uploadState,
    uploadAction,
    uploading,
  ] = useActionState(
    uploadBandLogo,
    initialState
  );

  const [
    removeState,
    removeAction,
    removing,
  ] = useActionState(
    removeBandLogo,
    initialState
  );

  const [filename, setFilename] = useState("");
  const [confirmRemove, setConfirmRemove] =
    useState(false);

  return (
    <section
      id="band-logo"
      className="scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
          Ensemble Branding
        </p>

        <h2 className="mt-2 text-2xl font-bold text-[#002144]">
          Band / Corps Logo
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          Upload a logo for {bandName}. It will appear
          on the public band profile.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-6">
        <div className="flex h-36 w-36 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-[#F4F6F9] p-3">
          {logoUrl ? (
            // External Supabase Storage image.
            // A plain image element avoids needing
            // a Next.js remote image configuration.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={`${bandName} logo`}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <div className="text-center">
              <span
                aria-hidden="true"
                className="text-4xl text-slate-300"
              >
                ◇
              </span>
              <p className="mt-2 text-xs text-slate-500">
                No Logo
              </p>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-bold text-[#002144]">
            {logoUrl
              ? "Current Logo"
              : "No Logo Uploaded"}
          </p>

          <p className="mt-2 text-sm text-slate-600">
            Transparent PNGs are recommended,
            although JPEG and WebP are supported.
          </p>

          <p className="mt-2 text-xs text-slate-500">
            Maximum file size: 2 MB
          </p>
        </div>
      </div>

      <form
        action={uploadAction}
        className="mt-6 space-y-4 border-t border-slate-100 pt-6"
      >
        <input
          type="hidden"
          name="band_id"
          value={bandId}
        />

        <label className="block text-sm font-semibold text-[#002144]">
          {logoUrl
            ? "Select a Replacement Logo"
            : "Select a Logo"}

          <input
            name="logo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            required
            disabled={uploading || removing}
            onChange={(event) => {
              const file = event.target.files?.[0];
              setFilename(file?.name ?? "");
            }}
            className="mt-2 block w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-600 file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-[#002144] file:px-4 file:py-2 file:font-semibold file:text-white"
          />
        </label>

        {filename && (
          <p className="text-xs text-slate-500">
            Selected: {filename}
          </p>
        )}

        {uploadState.message && (
          <p
            role="status"
            className={`rounded-lg border p-3 text-sm ${
              uploadState.ok
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {uploadState.message}
          </p>
        )}

        <button
          type="submit"
          disabled={uploading || removing}
          className="cursor-pointer rounded-lg bg-[#861F41] px-6 py-3 text-sm font-bold text-white hover:bg-[#A02B52] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading
            ? "Uploading..."
            : logoUrl
              ? "Replace Logo"
              : "Upload Logo"}
        </button>
      </form>

      {logoUrl && (
        <div className="mt-6 space-y-4 border-t border-slate-100 pt-6">
          <button
            type="button"
            onClick={() =>
              setConfirmRemove((value) => !value)
            }
            disabled={uploading || removing}
            className="cursor-pointer rounded-lg border border-red-300 bg-red-50 px-5 py-3 text-sm font-bold text-red-800 hover:bg-red-100"
          >
            Remove Current Logo
          </button>

          {confirmRemove && (
            <form
              action={removeAction}
              className="space-y-4 rounded-xl border border-red-200 bg-red-50 p-5"
            >
              <input
                type="hidden"
                name="band_id"
                value={bandId}
              />

              <p className="text-sm leading-6 text-red-900">
                Remove this logo from the band's
                public profile? The band record
                and its competition history will
                remain intact.
              </p>

              <button
                type="submit"
                disabled={uploading || removing}
                className="cursor-pointer rounded-lg bg-red-800 px-5 py-3 text-sm font-bold text-white hover:bg-red-900 disabled:opacity-50"
              >
                {removing
                  ? "Removing..."
                  : "Yes, Remove Logo"}
              </button>
            </form>
          )}

          {removeState.message && (
            <p
              role="status"
              className={`rounded-lg border p-3 text-sm ${
                removeState.ok
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-red-200 bg-red-50 text-red-800"
              }`}
            >
              {removeState.message}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

