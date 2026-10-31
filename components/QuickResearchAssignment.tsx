import { createResearchTask } from "@/app/staff/research/actions";

type StaffMember = {
  user_id: string;
  display_name: string | null;
  greeting_name: string | null;
  role: string;
  status: string;
};

type Props = {
  competitionId: string;
  competitionName: string;
  organization: string;
  season: number;
  completenessScore: number;
  missing: string[];
  staff: StaffMember[];
  disabled?: boolean;
};

const fieldClass =
  "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-[#002144] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#861F41]";

export default function QuickResearchAssignment({
  competitionId,
  competitionName,
  organization,
  season,
  completenessScore,
  missing,
  staff,
  disabled = false,
}: Props) {
  const title = `Research ${season} ${organization}: ${competitionName}`.slice(0, 160);
  const description = [
    `Review the documentation for ${competitionName} (${organization}, ${season}).`,
    `Current documentation score: ${completenessScore}/100.`,
    missing.length ? `Areas to investigate: ${missing.join("; ")}.` : "Review the supporting historical evidence and confirm completeness.",
    `Competition record: /staff/competitions/${competitionId}`,
    "Confirm findings against available primary sources, update the competition record as appropriate, and document sources before completing this assignment.",
  ].join("\n\n");

  return (
    <details className="mt-3 rounded-xl border border-[#e0e5eb] bg-[#f9fafb] p-4">
      <summary className="cursor-pointer text-sm font-extrabold text-[#861F41] hover:underline">
        + Create research assignment
      </summary>
      <p className="mt-3 text-xs leading-5 text-slate-600">
        Information is prefilled from this record. Review it before creating a task; no assignment is created until you submit.
      </p>
      <form action={createResearchTask} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold sm:col-span-2">
          Task title
          <input name="title" required minLength={3} maxLength={160} defaultValue={title} className={fieldClass} />
        </label>
        <label className="text-sm font-semibold sm:col-span-2">
          Research instructions
          <textarea name="description" maxLength={5000} rows={6} defaultValue={description} className={fieldClass} />
        </label>
        <label className="text-sm font-semibold">
          Assign to
          <select name="assigned_to" defaultValue="" className={fieldClass} disabled={disabled}>
            <option value="">Unassigned</option>
            {staff.filter(member => member.status === "active").map(member => (
              <option key={member.user_id} value={member.user_id}>
                {member.display_name?.trim() || member.greeting_name?.trim() || `Staff ${member.user_id.slice(0, 8)}`} · {member.role}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Due date (optional)
          <input name="due_date" type="date" className={fieldClass} />
        </label>
        <label className="text-sm font-semibold">
          Priority
          <select name="priority" defaultValue="normal" className={fieldClass}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </label>
        <div className="flex items-end">
          <button type="submit" disabled={disabled} className="w-full rounded-lg bg-[#861F41] px-4 py-2.5 text-sm font-extrabold text-white hover:bg-[#6e1935] disabled:cursor-not-allowed disabled:opacity-50">
            Create assignment
          </button>
        </div>
      </form>
      {disabled && <p role="alert" className="mt-3 text-xs text-red-800">Staff choices could not be loaded. Please check staff access and reload.</p>}
    </details>
  );
}
