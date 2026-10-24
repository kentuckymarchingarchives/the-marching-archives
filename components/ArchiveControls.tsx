
"use client";

import { useState } from "react";
import { manageArchive } from "@/app/staff/archive/actions";

type ArchiveKind = "band" | "competition" | "round";

type Props = {
  kind: ArchiveKind;
  recordId: string;
  archived: boolean;
  name: string;
  allowManage?: boolean;
};

export default function ArchiveControls({
  kind,
  recordId,
  archived,
  name,
  allowManage = true,
}: Props) {
  const [showDelete, setShowDelete] = useState(false);
  const [confirmation, setConfirmation] = useState("");

  if (!allowManage) return null;

  return (
    <div className="space-y-4">
      {!archived ? (
        <form
          action={manageArchive}
          onSubmit={(event) => {
            if (
              !window.confirm(
                `Archive "${name}"? It will be hidden from public archive listings until restored.`
              )
            ) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="record_id" value={recordId} />
          <input type="hidden" name="operation" value="archive" />

          <button
            type="submit"
            className="cursor-pointer rounded-lg border border-amber-300 bg-amber-50 px-5 py-3 text-sm font-bold text-amber-900 hover:bg-amber-100"
          >
            Archive {kind === "band" ? "Ensemble" : kind === "round" ? "Round" : "Competition"}
          </button>
        </form>
      ) : (
        <div className="flex flex-wrap gap-3">
          <form action={manageArchive}>
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="record_id" value={recordId} />
            <input type="hidden" name="operation" value="restore" />

            <button
              type="submit"
              className="cursor-pointer rounded-lg bg-[#002144] px-5 py-3 text-sm font-bold text-white hover:bg-[#123B63]"
            >
              Restore
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setShowDelete(!showDelete);
              setConfirmation("");
            }}
            className="cursor-pointer rounded-lg border border-red-300 bg-red-50 px-5 py-3 text-sm font-bold text-red-800 hover:bg-red-100"
          >
            Permanently Delete
          </button>
        </div>
      )}

      {archived && showDelete && (
        <form
          action={manageArchive}
          onSubmit={(event) => {
            if (
              !window.confirm(
                `Permanently delete "${name}"? This cannot be undone.`
              )
            ) {
              event.preventDefault();
            }
          }}
          className="space-y-4 rounded-xl border border-red-300 bg-red-50 p-5"
        >
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="record_id" value={recordId} />
          <input type="hidden" name="operation" value="delete" />

          <h3 className="font-bold text-red-900">
            Confirm permanent deletion
          </h3>

          <p className="text-sm leading-6 text-red-800">
            You are about to permanently delete
            <strong> {name}</strong>.
            This action cannot be undone through TMA.
            For competitions and rounds, related results
            and caption scores will also be deleted.
          </p>

          <label className="block text-sm font-semibold text-red-900">
            Type DELETE FOREVER to continue

            <input
              name="confirmation"
              required
              autoComplete="off"
              value={confirmation}
              onChange={(event) =>
                setConfirmation(event.target.value)
              }
              className="mt-2 block w-full rounded-lg border border-red-300 bg-white px-4 py-3 text-sm"
            />
          </label>

          <button
            type="submit"
            disabled={confirmation !== "DELETE FOREVER"}
            className="cursor-pointer rounded-lg bg-red-800 px-5 py-3 text-sm font-bold text-white hover:bg-red-900 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Yes, Permanently Delete
          </button>
        </form>
      )}
    </div>
  );
}
