
"use client";

import { useActionState, useState } from "react";
import type {
  CaptionGroup,
  ScoringFormula,
} from "@/lib/scoring-formulas";
import {
  saveRoundScoringFormula,
  type FormulaSaveState,
} from "@/app/staff/competitions/formula-actions";

type Props = {
  competitionId: string;
  roundId: string;
  editable: boolean;
  captions: { id: string; name: string }[];
  initialFormula: ScoringFormula;
};

const initialState: FormulaSaveState = {
  status: "idle",
  message: "",
};

const fieldClass =
  "mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-[#002144]";

export default function RoundFormulaEditor({
  competitionId,
  roundId,
  editable,
  captions,
  initialFormula,
}: Props) {
  const [formula, setFormula] =
    useState<ScoringFormula>(initialFormula);

  const [state, action, pending] = useActionState(
    saveRoundScoringFormula,
    initialState
  );

  const groups = formula.groups ?? [];

  function addGroup() {
    const next: CaptionGroup = {
      id: `group-${Date.now()}-${groups.length}`,
      name: `Group ${groups.length + 1}`,
      method: "sum",
      multiplier: 1,
      captionIds: [],
    };

    setFormula((previous) => ({
      ...previous,
      groups: [...(previous.groups ?? []), next],
    }));
  }

  function updateGroup(
    id: string,
    change: Partial<CaptionGroup>
  ) {
    setFormula((previous) => ({
      ...previous,
      groups: (previous.groups ?? []).map((group) =>
        group.id === id
          ? { ...group, ...change }
          : group
      ),
    }));
  }

  function removeGroup(id: string) {
    setFormula((previous) => ({
      ...previous,
      groups: (previous.groups ?? []).filter(
        (group) => group.id !== id
      ),
    }));
  }

  function assignCaption(
    captionId: string,
    groupId: string
  ) {
    setFormula((previous) => ({
      ...previous,
      groups: (previous.groups ?? []).map((group) => ({
        ...group,
        captionIds:
          group.id === groupId
            ? [...new Set([...group.captionIds, captionId])]
            : group.captionIds.filter(
                (id) => id !== captionId
              ),
      })),
    }));
  }

  const unassigned = captions.filter(
    (caption) =>
      !groups.some((group) =>
        group.captionIds.includes(caption.id)
      )
  );

  return (
    <form action={action} className="space-y-7">
      <input
        type="hidden"
        name="competition_id"
        value={competitionId}
      />

      <input
        type="hidden"
        name="round_id"
        value={roundId}
      />

      <input
        type="hidden"
        name="formula"
        readOnly
        value={JSON.stringify(formula)}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="font-serif text-2xl font-bold text-[#002144]">
          Calculation Method
        </h2>

        <label className="mt-5 block text-sm font-bold text-[#002144]">
          Scoring Formula
          <select
            value={formula.method}
            disabled={!editable || pending}
            onChange={(event) =>
              setFormula((previous) => ({
                ...previous,
                method: event.target.value as
                  ScoringFormula["method"],
              }))
            }
            className={fieldClass}
          >
            <option value="weighted_sum">
              Weighted Caption Sum
            </option>
            <option value="weighted_average">
              Weighted Caption Average
            </option>
            <option value="grouped">
              Custom Caption Groups
            </option>
          </select>
        </label>

        <p className="mt-4 text-sm leading-7 text-slate-600">
          Weighted Sum adds each caption score times
          its multiplier. Weighted Average divides
          the weighted total by the sum of the caption
          multipliers. Custom Groups let you choose
          how caption scores are combined in sections.
        </p>

        <label className="mt-6 block max-w-xs text-sm font-bold text-[#002144]">
          Round-Level Penalty Deduction
          <input
            type="number"
            min="0"
            max="999999"
            step="0.0001"
            value={formula.penalty}
            disabled={!editable || pending}
            onChange={(event) =>
              setFormula((previous) => ({
                ...previous,
                penalty: Number(event.target.value),
              }))
            }
            className={fieldClass}
          />
        </label>

        <p className="mt-2 text-xs leading-6 text-slate-500">
          This is one fixed deduction applied to every
          automatically calculated result in the round,
          not a per-band penalty.
        </p>
      </section>

      {formula.method === "grouped" && (
        <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-serif text-2xl font-bold text-[#002144]">
                Scoring Groups
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Create groups, then assign each caption
                to exactly one group.
              </p>
            </div>

            {editable && (
              <button
                type="button"
                onClick={addGroup}
                disabled={pending || groups.length >= 30}
                className="rounded-lg bg-[#002144] px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                + Add Group
              </button>
            )}
          </div>

          {groups.map((group) => (
            <div
              key={group.id}
              className="rounded-xl border border-slate-200 bg-[#F4F6F9] p-5"
            >
              <div className="grid gap-4 md:grid-cols-3">
                <label className="text-sm font-bold text-[#002144]">
                  Group Name
                  <input
                    value={group.name}
                    maxLength={100}
                    disabled={!editable || pending}
                    onChange={(event) =>
                      updateGroup(group.id, {
                        name: event.target.value,
                      })
                    }
                    className={fieldClass}
                  />
                </label>

                <label className="text-sm font-bold text-[#002144]">
                  Group Method
                  <select
                    value={group.method}
                    disabled={!editable || pending}
                    onChange={(event) =>
                      updateGroup(group.id, {
                        method: event.target.value as
                          CaptionGroup["method"],
                      })
                    }
                    className={fieldClass}
                  >
                    <option value="sum">Sum</option>
                    <option value="average">Average</option>
                  </select>
                </label>

                <label className="text-sm font-bold text-[#002144]">
                  Group Multiplier
                  <input
                    type="number"
                    min="0"
                    max="999999"
                    step="0.0001"
                    value={group.multiplier}
                    disabled={!editable || pending}
                    onChange={(event) =>
                      updateGroup(group.id, {
                        multiplier: Number(
                          event.target.value
                        ),
                      })
                    }
                    className={fieldClass}
                  />
                </label>
              </div>

              <p className="mt-4 text-xs text-slate-600">
                Assigned captions:{" "}
                {group.captionIds.length
                  ? captions
                      .filter((caption) =>
                        group.captionIds.includes(caption.id)
                      )
                      .map((caption) => caption.name)
                      .join(", ")
                  : "None"}
              </p>

              {editable && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => removeGroup(group.id)}
                  className="mt-4 text-sm font-bold text-red-700 hover:underline"
                >
                  Remove Group
                </button>
              )}
            </div>
          ))}

          <div className="border-t border-slate-200 pt-5">
            <h3 className="font-bold text-[#002144]">
              Caption Assignments
            </h3>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {captions.map((caption) => {
                const selected =
                  groups.find((group) =>
                    group.captionIds.includes(caption.id)
                  )?.id ?? "";

                return (
                  <label
                    key={caption.id}
                    className="text-sm font-semibold text-[#002144]"
                  >
                    {caption.name}
                    <select
                      value={selected}
                      disabled={!editable || pending}
                      onChange={(event) =>
                        assignCaption(
                          caption.id,
                          event.target.value
                        )
                      }
                      className={fieldClass}
                    >
                      <option value="">
                        Not Assigned
                      </option>

                      {groups.map((group) => (
                        <option
                          key={group.id}
                          value={group.id}
                        >
                          {group.name}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </div>

            {unassigned.length > 0 && (
              <p className="mt-4 text-sm font-semibold text-amber-800">
                {unassigned.length} caption(s) still
                need a group assignment.
              </p>
            )}
          </div>
        </section>
      )}

      {state.status !== "idle" && (
        <div
          role={
            state.status === "error" ? "alert" : "status"
          }
          className={`rounded-xl border p-5 text-sm font-semibold ${
            state.status === "error"
              ? "border-red-200 bg-red-50 text-red-900"
              : "border-emerald-200 bg-emerald-50 text-emerald-900"
          }`}
        >
          {state.message}
        </div>
      )}

      {editable && (
        <button
          type="submit"
          disabled={
            pending ||
            (formula.method === "grouped" &&
              (groups.length === 0 ||
                unassigned.length > 0))
          }
          className="rounded-lg bg-[#861F41] px-7 py-3 font-bold text-white hover:bg-[#701832] disabled:opacity-50"
        >
          {pending
            ? "Saving Formula..."
            : "Save Round Formula"}
        </button>
      )}
    </form>
  );
}
