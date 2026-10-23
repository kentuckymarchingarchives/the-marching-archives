
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function signInStaff(
  formData: FormData
) {
  const email = String(
    formData.get("email") ?? ""
  ).trim();

  const password = String(
    formData.get("password") ?? ""
  );

  if (!email || !password) {
    redirect("/staff/login?error=invalid");
  }

  const supabase = await createClient();

  const { error } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });

  if (error) {
    redirect("/staff/login?error=invalid");
  }

  const { data: claims } =
    await supabase.auth.getClaims();

  const userId = claims?.claims?.sub;

  if (!userId) {
    await supabase.auth.signOut();
    redirect("/staff/login?error=invalid");
  }

  const { data: staff, error: staffError } =
    await supabase
      .from("staff_members")
      .select("role, status")
      .eq("user_id", userId)
      .maybeSingle();

  if (
    staffError ||
    !staff ||
    staff.status !== "active" ||
    !["owner", "admin", "editor"].includes(
      staff.role
    )
  ) {
    await supabase.auth.signOut();
    redirect("/staff/login?error=unauthorized");
  }

  revalidatePath("/", "layout");
  redirect("/staff/dashboard");
}

export async function signOutStaff() {
  const supabase = await createClient();

  await supabase.auth.signOut();

  revalidatePath("/", "layout");
  redirect("/staff/login");
}
