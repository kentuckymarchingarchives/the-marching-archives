import type { Metadata } from "next";
import Link from "next/link";
import CorrectionForm from "./CorrectionForm";

export const metadata: Metadata = { title: "Submit a Correction" };

export default function CorrectionsPage() {
  return (
    <main className="min-h-screen bg-[#f6f7f9] text-[#002144]">
      <header className="bg-[#002144] px-5 py-12 text-white sm:py-16">
        <div className="mx-auto max-w-4xl"><Link href="/" className="text-sm text-rose-200 hover:underline">← The Marching Archives</Link><p className="mt-7 text-xs font-bold uppercase tracking-[0.2em] text-rose-200">Help preserve the record</p><h1 className="mt-3 text-3xl font-extrabold sm:text-5xl">Submit a correction or missing result</h1><p className="mt-4 max-w-2xl leading-7 text-slate-200">Found a missing competition, an incorrect score, or a historical detail that needs attention? Share what you know and where the information came from.</p></div>
      </header>
      <section className="mx-auto max-w-4xl px-5 py-10"><CorrectionForm /></section>
    </main>
  );
}
