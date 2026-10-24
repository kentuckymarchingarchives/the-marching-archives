
export type BandStatus =
  | "active_competing"
  | "active_noncompeting"
  | "inactive"
  | "unknown";

export const BAND_STATUSES = [
  {
    value: "active_competing",
    label: "Active — Competing",
  },
  {
    value: "active_noncompeting",
    label: "Active — Non-Competing",
  },
  {
    value: "inactive",
    label: "Inactive",
  },
  {
    value: "unknown",
    label: "Unknown",
  },
] as const;

const statusStyles: Record<BandStatus, string> = {
  active_competing:
    "border-emerald-200 bg-emerald-50 text-emerald-800",
  active_noncompeting:
    "border-blue-200 bg-blue-50 text-blue-800",
  inactive:
    "border-amber-200 bg-amber-50 text-amber-800",
  unknown:
    "border-slate-200 bg-slate-100 text-slate-600",
};

export default function BandStatusBadge({
  status,
}: {
  status: string | null | undefined;
}) {
  const validStatus: BandStatus =
    status === "active_competing" ||
    status === "active_noncompeting" ||
    status === "inactive"
      ? status
      : "unknown";

  const label =
    BAND_STATUSES.find(
      (item) => item.value === validStatus
    )?.label ?? "Unknown";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles[validStatus]}`}
    >
      <span
        aria-hidden="true"
        className="mr-2 h-1.5 w-1.5 rounded-full bg-current"
      />
      {label}
    </span>
  );
}
