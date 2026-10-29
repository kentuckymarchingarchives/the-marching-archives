"use server";

import { createClient } from "@/lib/supabase/server";

export type SubmissionState = { status: "idle" | "success" | "error"; message: string };

export async function submitCorrection(
  _previous: SubmissionState,
  form: FormData,
): Promise<SubmissionState> {
  const read = (key: string) => String(form.get(key) ?? "").trim();
  const kind = read("kind");
  const subject = read("subject");
  const recordUrl = read("record_url");
  const details = read("details");
  const evidenceUrl = read("evidence_url");
  const contactEmail = read("contact_email");
  const yearText = read("season_year");
  const year = yearText ? Number(yearText) : null;
  const website = read("website");

  if (!(["correction", "missing_result", "other"].includes(kind)) ||
      subject.length < 5 || subject.length > 180 ||
      details.length < 20 || details.length > 5000 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail) ||
      contactEmail.length > 254 ||
      (year !== null && (!Number.isInteger(year) || year < 1800 || year > 2200)) ||
      [recordUrl, evidenceUrl].some((url) => url.length > 2000 || (url && !/^https?:\/\/\S+$/i.test(url)))) {
    return { status: "error", message: "Check the required fields, links, and year, then try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_archive_correction", {
    p_kind: kind,
    p_subject: subject,
    p_record_url: recordUrl || null,
    p_season_year: year,
    p_details: details,
    p_evidence_url: evidenceUrl || null,
    p_contact_email: contactEmail,
    p_website: website,
  });
  if (error) {
    return { status: "error", message: error.message.includes("Submission limit")
      ? "Submission limit reached. Please try again tomorrow."
      : "We could not save your submission. Check your details and try again." };
  }
  return { status: "success", message: "Your report has been received for staff review. Thank you for helping document marching history." };
}
