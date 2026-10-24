
import { Suspense } from "react";
import type { ReactNode } from "react";

import PublicBandLogo from "@/components/PublicBandLogo";
import BandCompetitionHistory from "@/components/BandCompetitionHistory";

type Props = {
  children: ReactNode;
  params: Promise<{
    id: string;
  }>;
};

async function BandLogoSection({
  params,
}: {
  params: Props["params"];
}) {
  const { id } = await params;

  return (
    <PublicBandLogo bandIdentifier={id} />
  );
}

async function CompetitionHistorySection({
  params,
}: {
  params: Props["params"];
}) {
  const { id } = await params;

  return (
    <BandCompetitionHistory
      bandIdentifier={id}
    />
  );
}

export default function PublicBandLayout({
  children,
  params,
}: Props) {
  return (
    <>
      <Suspense fallback={null}>
        <BandLogoSection params={params} />
      </Suspense>

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
