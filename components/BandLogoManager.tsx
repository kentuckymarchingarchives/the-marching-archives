
"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
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

const MAX_SIZE = 2 * 1024 * 1024;

const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
];

export default function BandLogoManager({
  bandId,
  bandName,
  logoUrl,
}: Props) {
  const [uploadState, uploadAction, uploading] =
    useActionState(uploadBandLogo, initialState);

  const [removeState, removeAction, removing] =
    useActionState(removeBandLogo, initialState);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [previewUrl, setPreviewUrl] =
    useState<string | null>(null);

  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [confirmRemove, setConfirmRemove] =
    useState(false);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedFile]);

  useEffect(() => {
    if (uploadState.ok) {
      setSelectedFile(null);
      setError("");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [uploadState]);

  useEffect(() => {
    if (removeState.ok) {
      setConfirmRemove(false);
    }
  }, [removeState]);

  function chooseFile(file?: File) {
    setError("");

    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      setSelectedFile(null);
      setError(
        "Please select a PNG, JPEG, or WebP image."
      );
      return;
    }

    if (file.size > MAX_SIZE) {
      setSelectedFile(null);
      setError(
        "Your image is too large. The maximum size is 2 MB."
      );
      return;
    }

    if (file.size === 0) {
      setSelectedFile(null);
      setError("The selected file is empty.");
      return;
    }

    setSelectedFile(file);
  }

  function onFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    chooseFile(event.target.files?.[0]);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);

    if (uploading || removing) return;

    const file = event.dataTransfer.files[0];

    if (!file) return;

    chooseFile(file);

    if (
      ALLOWED_TYPES.includes(file.type) &&
      file.size > 0 &&
      file.size <= MAX_SIZE &&
      fileInputRef.current
    ) {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      fileInputRef.current.files = transfer.files;
    }
  }

  function clearSelection() {
    setSelectedFile(null);
    setError("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  const displayUrl = previewUrl ?? logoUrl;
  const hasSavedLogo = Boolean(logoUrl);
  const busy = uploading || removing;

  return (
    <section
      id="band-logo"
      className="scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
            Ensemble Branding
          </p>

          <h2 className="mt-2 text-2xl font-bold text-[#002144]">
            Logo Management
          </h2>

          <p className="mt-2 text-sm leading-7 text-slate-600">
            Upload and manage the logo displayed
            beside {bandName} in the public archive.
          </p>
        </div>

        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
          {hasSavedLogo ? "Logo on file" : "No logo on file"}
        </span>
      </div>

      <div className="mt-7 grid gap-7 lg:grid-cols-[240px_1fr]">
        <div className="space-y-3">
          <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-[#F8FAFC] p-5">
            {displayUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={displayUrl}
                alt={`${bandName} logo preview`}
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="text-center text-slate-400">
                <svg
                  viewBox="0 0 48 48"
                  aria-hidden="true"
                  className="mx-auto h-16 w-16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect
                    x="5"
                    y="7"
                    width="38"
                    height="34"
                    rx="5"
                  />
                  <circle cx="17" cy="18" r="4" />
                  <path d="m9 35 11-11 7 7 5-5 7 9" />
                </svg>

                <p className="mt-3 text-sm font-semibold">
                  No logo yet
                </p>
              </div>
            )}
          </div>

          <p className="text-center text-xs text-slate-500">
            {previewUrl
              ? "Preview — not saved yet"
              : hasSavedLogo
                ? "Currently saved logo"
                : "Logo preview"}
          </p>
        </div>

        <div className="min-w-0 space-y-5">
          <form action={uploadAction} className="space-y-5">
            <input
              type="hidden"
              name="band_id"
              value={bandId}
            />

            <div
              onDragOver={(event) => {
                event.preventDefault();
                if (!busy) setDragging(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setDragging(false);
              }}
              onDrop={onDrop}
              className={`rounded-2xl border-2 border-dashed p-6 text-center transition ${
                dragging
                  ? "border-[#861F41] bg-[#FFF5F8]"
                  : "border-slate-300 bg-[#F8FAFC]"
              }`}
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#861F41]">
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 16V4" />
                  <path d="m7 9 5-5 5 5" />
                  <path d="M4 16v4h16v-4" />
                </svg>
              </div>

              <p className="mt-3 font-bold text-[#002144]">
                Drag and drop a logo here
              </p>

              <p className="mt-2 text-sm text-slate-500">
                Or choose a file from your computer.
              </p>

              <input
                ref={fileInputRef}
                name="logo"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                required
                disabled={busy}
                onChange={onFileChange}
                className="mt-5 block w-full cursor-pointer rounded-lg border border-slate-200 bg-white p-3 text-sm text-[#002144] file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-[#002144] file:px-4 file:py-2 file:font-semibold file:text-white"
              />

              <p className="mt-3 text-xs text-slate-500">
                PNG, JPG, or WebP · Up to 2 MB
              </p>
            </div>

            {selectedFile && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[#002144]">
                    {selectedFile.name}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                    {" · "}Ready to upload
                  </p>
                </div>

                <button
                  type="button"
                  onClick={clearSelection}
                  disabled={busy}
                  className="cursor-pointer text-sm font-semibold text-[#861F41] hover:underline disabled:opacity-50"
                >
                  Clear
                </button>
              </div>
            )}

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
              >
                {error}
              </p>
            )}

            {uploadState.message && (
              <p
                role="status"
                className={`rounded-lg border p-4 text-sm ${
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
              disabled={!selectedFile || busy}
              className="cursor-pointer rounded-lg bg-[#861F41] px-7 py-3 text-sm font-bold text-white transition hover:bg-[#A02B52] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading
                ? "Saving Logo..."
                : hasSavedLogo
                  ? "Save Replacement Logo"
                  : "Upload Logo"}
            </button>
          </form>

          {hasSavedLogo && (
            <div className="border-t border-slate-200 pt-5">
              {!confirmRemove ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmRemove(true)}
                  className="cursor-pointer rounded-lg border border-red-200 bg-white px-5 py-3 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  Remove Saved Logo
                </button>
              ) : (
                <form
                  action={removeAction}
                  className="space-y-4 rounded-xl border border-red-200 bg-red-50 p-5"
                >
                  <input
                    type="hidden"
                    name="band_id"
                    value={bandId}
                  />

                  <p className="text-sm font-bold text-red-900">
                    Remove this logo?
                  </p>

                  <p className="text-sm leading-6 text-red-800">
                    The logo will disappear from the
                    public directory and band profile.
                    The band's historical records will
                    remain unchanged.
                  </p>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="submit"
                      disabled={busy}
                      className="cursor-pointer rounded-lg bg-red-800 px-5 py-3 text-sm font-bold text-white hover:bg-red-900 disabled:opacity-50"
                    >
                      {removing
                        ? "Removing..."
                        : "Yes, Remove Logo"}
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setConfirmRemove(false)}
                      className="cursor-pointer rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {removeState.message && (
                <p
                  role="status"
                  className={`mt-4 rounded-lg border p-4 text-sm ${
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
        </div>
      </div>
    </section>
  );
}
