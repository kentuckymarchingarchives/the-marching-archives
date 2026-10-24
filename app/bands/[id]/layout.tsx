
import { Suspense } from "react";
import type { ReactNode } from "react";

import BandCompetitionHistory from "@/components/BandCompetitionHistory";

type BandLayoutProps = {
  children: ReactNode;
  params: Promise<{
    id: string;
  }>;
};

async function CompetitionHistorySection({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <BandCompetitionHistory
      bandIdentifier={id}
    />
  );
}

export default function BandLayout({
  children,
  params,
}: BandLayoutProps) {
  return (
    <>
      {children}

      <Suspense
        fallback={
          <section className="mx-auto max-w-6xl px-6 py-12">
            <div
              role="status"
              className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600"
            >
              Loading competition history...
            </div>
          </section>
        }
      >
        <CompetitionHistorySection params={params} />
      </Suspense>
    </>
  );
}
