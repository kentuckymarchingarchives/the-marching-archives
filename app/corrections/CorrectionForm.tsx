"use client";

import { useActionState } from "react";
import { submitCorrection, type SubmissionState } from "./actions";

const initial: SubmissionState = { status: "idle", message: "" };
const inputClass = "mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:border-[#861F41] focus:outline-none focus:ring-2 focus:ring-[#861F41]/20";

export default function CorrectionForm() {
  const [state, formAction, pending] = useActionState(submitCorrection, initial);
  if (state.status === "success") {
    return <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-emerald-900"><h2 className="text-xl font-bold">Submission received</h2><p className="mt-2">{state.message}</p></div>;
  }
  return (
    <form action={formAction} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div>
        <label htmlFor="kind" className="block font-semibold">What would you like to report? *</label>
        <select id="kind" name="kind" required className={inputClass} defaultValue="correction">
          <option value="correction">Correction to an existing record</option>
          <option value="missing_result">Missing competition or result</option>
          <option value="other">Other historical record issue</option>
        </select>
      </div>
      <div><label htmlFor="subject" className="block font-semibold">Band, competition, or subject *</label><input className={inputClass} id="subject" name="subject" minLength={5} maxLength={180} required placeholder="e.g. 1998 State Finals placement" /></div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div><label htmlFor="season_year" className="block font-semibold">Season year (optional)</label><input className={inputClass} id="season_year" name="season_year" type="number" min="1800" max="2200" placeholder="1998" /></div>
        <div><label htmlFor="record_url" className="block font-semibold">Archive record URL (optional)</label><input className={inputClass} id="record_url" name="record_url" type="url" maxLength={2000} placeholder="https://marchingarchives.com/..." /></div>
      </div>
      <div><label htmlFor="details" className="block font-semibold">What needs to be added or corrected? *</label><textarea className={inputClass} id="details" name="details" required minLength={20} maxLength={5000} rows={6} placeholder="Describe the current record, the proposed correction, and why." /><p className="mt-1 text-xs text-slate-500">Please include the correct placement, score, or other detail where possible.</p></div>
      <div><label htmlFor="evidence_url" className="block font-semibold">Supporting source URL (optional)</label><input className={inputClass} id="evidence_url" name="evidence_url" type="url" maxLength={2000} placeholder="Official recap, newspaper, archive, etc." /></div>
      <div><label htmlFor="contact_email" className="block font-semibold">Contact email *</label><input className={inputClass} id="contact_email" name="contact_email" type="email" maxLength={254} required autoComplete="email" /><p className="mt-1 text-xs text-slate-500">Private; used only if staff need to clarify your submission. Do not include sensitive personal information.</p></div>
      <div className="absolute left-[9999px]" aria-hidden="true"><label htmlFor="website">Website (leave empty)</label><input id="website" name="website" tabIndex={-1} autoComplete="off" /></div>
      {state.status === "error" && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.message}</p>}
      <button disabled={pending} type="submit" className="rounded-lg bg-[#861F41] px-6 py-3 font-bold text-white hover:bg-[#6c1933] disabled:opacity-60">{pending ? "Submitting…" : "Submit for staff review"}</button>
      <p className="text-xs leading-5 text-slate-500">Reports are reviewed by staff and do not automatically change published records. Please do not submit copyrighted documents or sensitive personal data through this form.</p>
    </form>
  );
}
