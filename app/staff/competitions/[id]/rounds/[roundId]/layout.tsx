
import { Suspense } from "react";
import Link from "next/link";

type Props = {
  children: React.ReactNode;
  params: Promise<{
    id: string;
    roundId: string;
  }>;
};

async function RoundNavigation({
  params,
}: {
  params: Props["params"];
}) {
  const { id, roundId } = await params;

  const base =
    `/staff/competitions/${id}/rounds/${roundId}`;

  return (
    <nav
      aria-label="Round management"
      className="border-b border-slate-200 bg-white"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-6 py-4">
        <Link
          href={base}
          className="rounded-lg bg-[#002144] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#123B63]"
        >
          Results Editor
        </Link>

        <Link
          href={`${base}/tools`}
          className="rounded-lg bg-[#861F41] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#701832]"
        >
          Results Tools
        </Link>

        <Link
          href={`/staff/competitions/${id}`}
          className="ml-auto text-sm font-semibold text-slate-600 hover:text-[#861F41]"
        >
          Competition Details
        </Link>
      </div>
    </nav>
  );
}

export default function RoundLayout({
  children,
  params,
}: Props) {
  return (
    <>
      <Suspense
        fallback={
          <div className="border-b border-slate-200 bg-white p-4 text-sm text-slate-500">
            Loading round navigation...
          </div>
        }
      >
        <RoundNavigation params={params} />
      </Suspense>

      {children}
    </>
  );
}
