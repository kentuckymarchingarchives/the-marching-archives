
"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";

const MAX_SIZE = 2 * 1024 * 1024;
const ACCEPTED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
];

export default function BandCreationLogoField() {
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  function selectFile(nextFile: File | undefined) {
    setError("");

    if (!nextFile) {
      setFile(null);
      return;
    }

    if (!ACCEPTED_TYPES.includes(nextFile.type)) {
      setFile(null);
      setError("Please select a PNG, JPG, or WebP image.");

      if (inputRef.current) {
        inputRef.current.value = "";
      }
      return;
    }

    if (nextFile.size === 0 || nextFile.size > MAX_SIZE) {
      setFile(null);
      setError("Logo files must be larger than 0 bytes and no more than 2 MB.");

      if (inputRef.current) {
        inputRef.current.value = "";
      }
      return;
    }

    setFile(nextFile);
  }

  function handleInputChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    selectFile(event.target.files?.[0]);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);

    const droppedFile = event.dataTransfer.files?.[0];
    if (!droppedFile) return;

    selectFile(droppedFile);

    if (
      inputRef.current &&
      ACCEPTED_TYPES.includes(droppedFile.type) &&
      droppedFile.size > 0 &&
      droppedFile.size <= MAX_SIZE
    ) {
      const transfer = new DataTransfer();
      transfer.items.add(droppedFile);
      inputRef.current.files = transfer.files;
    }
  }

  function clearFile() {
    setFile(null);
    setError("");

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  return (
    <section className="space-y-5 rounded-xl border border-slate-200 bg-[#F8FAFC] p-5">
      <div>
        <h3 className="text-lg font-bold text-[#002144]">
          Ensemble Logo
          <span className="ml-2 text-sm font-normal text-slate-500">
            (Optional)
          </span>
        </h3>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          Upload a logo now, or add one after creating
          the ensemble. Transparent PNG images are
          recommended.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-[140px_1fr] sm:items-center">
        <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-4">
          {preview ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={preview}
              alt="Selected ensemble logo preview"
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="text-center text-slate-400">
              <svg
                viewBox="0 0 48 48"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="mx-auto h-12 w-12"
                aria-hidden="true"
              >
                <rect x="5" y="7" width="38" height="34" rx="5" />
                <circle cx="17" cy="18" r="4" />
                <path d="m9 35 11-11 7 7 5-5 7 9" />
              </svg>

              <p className="mt-2 text-xs">Logo Preview</p>
            </div>
          )}
        </div>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setDragging(false);
          }}
          onDrop={handleDrop}
          className={`rounded-xl border-2 border-dashed p-5 ${
            dragging
              ? "border-[#861F41] bg-rose-50"
              : "border-slate-300 bg-white"
          }`}
        >
          <p className="text-sm font-bold text-[#002144]">
            Drag a logo here, or choose an image.
          </p>

          <input
            ref={inputRef}
            type="file"
            name="logo"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleInputChange}
            className="mt-3 block w-full cursor-pointer text-sm text-slate-600 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-[#002144] file:px-4 file:py-2 file:font-semibold file:text-white"
          />

          <p className="mt-3 text-xs text-slate-500">
            PNG, JPEG, or WebP · Maximum 2 MB
          </p>

          {file && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="min-w-0 break-all text-xs font-semibold text-[#002144]">
                {file.name}
              </p>

              <button
                type="button"
                onClick={clearFile}
                className="cursor-pointer text-xs font-bold text-[#861F41] hover:underline"
              >
                Clear Selection
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}
    </section>
  );
}
