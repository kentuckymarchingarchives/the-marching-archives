
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signInStaff } from "@/app/staff/actions";

type Props = {
  searchParams: Promise<{
    error?: string;
  }>;
};

async function LoginContent({ searchParams }: Props) {
  const params = await searchParams;

  const supabase = await createClient();

  const { data: claims } =
    await supabase.auth.getClaims();

  if (claims?.claims?.sub) {
    const { data: staff } = await supabase
      .from("staff_members")
      .select("role, status")
      .eq("user_id", claims.claims.sub)
      .maybeSingle();

    if (staff?.status === "active") {
      redirect("/staff/dashboard");
    }
  }

  const errorMessage =
    params.error === "unauthorized"
      ? "This account does not have active staff access."
      : params.error === "invalid"
        ? "Invalid email or password."
        : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F4F6F9] px-5 py-12">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
        <div className="bg-[#002144] px-8 py-9 text-white">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#DAB1BF]">
            The Marching Archives
          </p>

          <h1 className="mt-3 font-serif text-3xl font-bold">
            Staff Login
          </h1>

          <p className="mt-3 text-sm text-slate-300">
            Authorized administrators and editors only.
          </p>
        </div>

        <form
          action={signInStaff}
          className="space-y-5 p-8"
        >
          {errorMessage && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              {errorMessage}
            </p>
          )}

          <label className="block text-sm font-semibold text-[#002144]">
            Email Address

            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3"
            />
          </label>

          <label className="block text-sm font-semibold text-[#002144]">
            Password

            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3"
            />
          </label>

          <button
            type="submit"
            className="w-full rounded-lg bg-[#861F41] px-5 py-3 font-bold text-white hover:bg-[#701832]"
          >
            Sign In
          </button>

          <div className="text-center">
            <Link
              href="/"
              className="text-sm font-semibold text-slate-600 hover:text-[#861F41]"
            >
              ← Return to the Archive
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}

export default function StaffLoginPage({
  searchParams,
}: Props) {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#F4F6F9]" />
      }
    >
      <LoginContent searchParams={searchParams} />
    </Suspense>
  );
}
