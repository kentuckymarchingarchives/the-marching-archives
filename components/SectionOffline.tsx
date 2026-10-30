import Link from "next/link";

type SectionOfflineProps = {
  sectionName?: string;
  message?: string;
  homeHref?: string;
};

/** A reusable, informational maintenance screen. This component does not change route availability. */
export default function SectionOffline({
  sectionName = "This section",
  message = "We're making improvements to this part of the archive. Please check back soon.",
  homeHref = "/",
}: SectionOfflineProps) {
  return (
    <main className="flex min-h-[calc(100vh-5rem)] flex-col items-center justify-center bg-[#f7f8fa] px-5 py-16 text-center text-[#002144]">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center">
        <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-2xl border border-[#002144]/10 bg-white shadow-sm" aria-hidden="true">
          <svg viewBox="0 0 64 64" fill="none" className="h-12 w-12" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 13h34v38H15z" rx="4" fill="#002144" />
            <path d="M22 23h20M22 31h15M22 39h12" stroke="white" strokeWidth="3" strokeLinecap="round" />
            <circle cx="46" cy="45" r="12" fill="#861F41" stroke="white" strokeWidth="2" />
            <path d="M46 38v8l5 3" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <p className="mb-4 text-xs font-extrabold uppercase tracking-[0.22em] text-[#861F41]">
          The Marching Archives · Site notice
        </p>
        <h1 className="max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl md:text-6xl">
          {sectionName} is currently offline.
        </h1>
        <div className="my-8 h-1 w-20 rounded-full bg-[#861F41]" aria-hidden="true" />
        <p className="max-w-xl text-base leading-8 text-slate-600 sm:text-lg">{message}</p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={homeHref}
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#861F41] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#6d1733] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#861F41]"
          >
            Return to Homepage
          </Link>
          <Link
            href="/competitions"
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#002144]/20 bg-white px-6 py-3 text-sm font-bold text-[#002144] transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#861F41]"
          >
            Browse Competitions
          </Link>
        </div>
        <p className="mt-12 text-xs font-medium uppercase tracking-widest text-slate-400">
          Competitive history, preserved.
        </p>
      </div>
    </main>
  );
}
