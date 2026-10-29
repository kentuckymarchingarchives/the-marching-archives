"use client";

import { useState } from "react";

type Props = {
  competition: string;
  season: number;
  round: string;
  path: string;
};

export default function RecordCitation({ competition, season, round, path }: Props) {
  const [copied, setCopied] = useState(false);
  const citation = `The Marching Archives. “${competition} — ${round}” (${season}).`;

  function copyCitation() {
    const url = new URL(path, window.location.origin).toString();
    const complete = `${citation} ${url} (accessed ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}).`;
    void navigator.clipboard.writeText(complete).then(() => {
      setCopied(true);
    }).catch(() => {
      setCopied(false);
    });
  }

  return (
    <section aria-labelledby="citation-title" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="citation-title" className="text-xl font-extrabold text-[#002144]">Cite this record</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{citation} Include the record URL and access date when referencing this page.</p>
        </div>
        <button type="button" onClick={copyCitation} className="rounded-lg bg-[#002144] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#163c63]">
          {copied ? "Citation copied" : "Copy citation"}
        </button>
      </div>
    </section>
  );
}
