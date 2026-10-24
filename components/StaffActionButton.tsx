
"use client";

import { useFormStatus } from "react-dom";

type Props = {
  label: string;
  pendingLabel: string;
  variant?: "navy" | "maroon" | "green" | "danger";
};

const styles = {
  navy: "bg-[#002144] text-white hover:bg-[#123B63]",
  maroon: "bg-[#861F41] text-white hover:bg-[#A02B52]",
  green: "bg-emerald-700 text-white hover:bg-emerald-800",
  danger:
    "border border-red-300 bg-red-50 text-red-800 hover:bg-red-100",
};

export default function StaffActionButton({
  label,
  pendingLabel,
  variant = "navy",
}: Props) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-3 rounded-lg px-6 py-3 text-sm font-bold transition disabled:cursor-wait disabled:opacity-60 ${styles[variant]}`}
    >
      {pending && (
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="h-4 w-4 animate-spin"
          fill="none"
        >
          <circle
            cx="12"
            cy="12"
            r="9"
            stroke="currentColor"
            strokeWidth="3"
            opacity="0.25"
          />
          <path
            d="M21 12a9 9 0 0 0-9-9"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      )}

      {pending ? pendingLabel : label}
    </button>
  );
}
