
import Link from "next/link";

type SectionOfflineProps = {
  sectionName?: string;
  message?: string;
};

export default function SectionOffline({
  sectionName = "This section",
  message = "We're currently working on this section of The Marching Archives. Thank you for your patience.",
}: SectionOfflineProps) {
  return (
    <main className="min-h-[75vh] bg-[#F7F8FA] px-6 py-20">
      <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
        {/* Archive icon */}
        <div className="mb-10 flex h-24 w-24 items-center justify-center rounded-3xl border border-slate-200 bg-white shadow-sm">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#861F41"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 7v14" />
            <path d="M3 18V5a2 2 0 0 1 2-2h3a4 4 0 0 1 4 4 4 4 0 0 1 4-4h3a2 2 0 0 1 2 2v13a1 1 0 0 1-1 1h-4a4 4 0 0 0-4 2 4 4 0 0 0-4-2H4a1 1 0 0 1-1-1Z" />
          </svg>
        </div>

        <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[#861F41]">
          The Marching Archives / Site Notice
        </p>

        <h1 className="max-w-2xl text-4xl font-extrabold tracking-tight text-[#002144] sm:text-5xl">
          {sectionName} is currently offline.
        </h1>

        <div className="my-8 h-1 w-20 rounded-full bg-[#861F41]" />

        <p className="max-w-xl text-base leading-8 text-slate-600 sm:text-lg">
          {message}
        </p>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg bg-[#861F41] px-6 py-3 font-semibold text-white transition hover:bg-[#6e1935] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#861F41]"
          >
            <span aria-hidden="true">←</span>
            Return to Homepage
          </Link>

          <Link
            href="/competitions"
            className="inline-flex items-center gap-2 rounded-lg border border-[#002144]/20 bg-white px-6 py-3 font-semibold text-[#002144] transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#861F41]"
          >
            <span aria-hidden="true">⌕</span>
            Browse Competitions
          </Link>
        </div>

        <div className="mt-20 border-t border-slate-200 pt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Competitive History, Preserved.
          </p>
        </div>
      </div>
    </main>
  );
}
