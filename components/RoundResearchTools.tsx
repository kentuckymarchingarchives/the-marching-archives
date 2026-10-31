"use client";

import { useState } from "react";

type Props = {
  competitionName: string;
  roundName: string;
  seasonYear: number;
  organizationCode: string;
  competitionDate: string | null;
  sourceUrl: string | null;
  csvUrl: string;
  canExport: boolean;
};

function citationText({ competitionName, roundName, seasonYear, organizationCode, competitionDate }: Props): string {
  const issued = competitionDate ? ` (${competitionDate})` : ` (${seasonYear})`;
  const location = typeof window === "undefined" ? "" : window.location.href.split("#")[0].split("?")[0];
  const accessed = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
  return `The Marching Archives. “${competitionName} — ${roundName} Results.” ${organizationCode}${issued}. ${location}. Accessed ${accessed}.`;
}

export default function RoundResearchTools(props: Props) {
  const [copied, setCopied] = useState(false);
  async function copyCitation() {
    const citation = citationText(props);
    try {
      await navigator.clipboard.writeText(citation);
      setCopied(true);
    } catch {
      // Clipboard can be unavailable in insecure contexts; fall back to selection.
      const textarea = document.createElement("textarea");
      textarea.value = citation;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const copiedLegacy = document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(copiedLegacy);
    }
  }

  return (
    <section aria-labelledby="research-tools" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">Research tools</p>
          <h2 id="research-tools" className="mt-1 text-xl font-extrabold text-[#002144]">Cite or export these results</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">Export recorded placements and scores, or copy a citation for this archive page. Verify original sources before scholarly use.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={copyCitation} className="rounded-lg bg-[#002144] px-4 py-3 text-sm font-semibold text-white hover:bg-[#133b63] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#861F41]">
            {copied ? "Citation copied" : "Copy citation"}
          </button>
          {props.canExport ? (
            <a href={props.csvUrl} download className="rounded-lg bg-[#861F41] px-4 py-3 text-sm font-semibold text-white hover:bg-[#701a36] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#861F41]">Download CSV</a>
          ) : (
            <span className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">CSV unavailable: results may be incomplete</span>
          )}
        </div>
      </div>
      {props.sourceUrl && (
        <p className="mt-4 text-sm text-slate-600">Original recorded source: <a href={props.sourceUrl} rel="noopener noreferrer" target="_blank" className="font-semibold text-[#861F41] underline">Open source</a></p>
      )}
      <p className="mt-3 text-xs text-slate-500">Citation format is an archive reference, not a verified MLA, APA, or Chicago citation.</p>
    </section>
  );
}
