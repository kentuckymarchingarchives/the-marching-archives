import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type ResearchTask = {
  id: string; title: string; status: string; priority: string;
  assigned_to: string | null; created_by: string;
  competition_id: string | null; due_date: string | null;
  updated_at: string; completed_at: string | null;
};
export type ResearchApproval = {
  task_id: string; state: string; submitted_by: string;
  submitted_at: string; reviewed_by: string | null;
  reviewed_at: string | null; review_note: string;
};
export type ResearchEvent = {
  id: number; task_id: string; actor_id: string;
  event: string; note: string; occurred_at: string;
};
export type ResearchMember = {
  user_id: string; display_name: string | null;
  greeting_name: string | null; role: string; status: string;
};

export async function researchSession() {
  const db = await createClient();
  const { data: auth, error } = await db.auth.getClaims();
  const id = auth?.claims?.sub;
  if (error || !id) redirect("/staff/login");
  const { data: staff, error: staffError } = await db.from("staff_members")
    .select("role,status,display_name,greeting_name").eq("user_id", id).maybeSingle();
  if (staffError || !staff || staff.status !== "active" ||
      !["owner", "admin", "editor"].includes(staff.role)) {
    redirect("/staff/login?error=unauthorized");
  }
  return { db, id, role: staff.role as string,
    greeting: staff.greeting_name || staff.display_name || "Researcher" };
}

export function personName(id: string | null, members: ResearchMember[]) {
  if (!id) return "Unassigned";
  const member = members.find((m) => m.user_id === id);
  return member?.display_name || member?.greeting_name || "Staff member";
}

export function dateText(value: string | null) {
  if (!value) return "Not set";
  const d = new Date(value.includes("T") ? value : `${value}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? "Unknown" : d.toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: "UTC"
  });
}

export const researchLinks = [
  { href: "/staff/research", label: "Assignments" },
  { href: "/staff/research/approvals", label: "Approvals" },
  { href: "/staff/research/mine", label: "My Research" },
  { href: "/staff/research/analytics", label: "Analytics" },
  { href: "/staff/research/review-history", label: "Review History" },
];
