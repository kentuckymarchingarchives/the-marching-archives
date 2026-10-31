import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Archive News & Updates | The Marching Archives",
  description: "Latest documented history, research findings, corrections, and website updates from The Marching Archives.",
};

type Update = { id: string; slug: string; title: string; summary: string; category: string; published_at: string };
const formatDate = (value: string) => new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(value));

async function PublicUpdates() {
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("tma_public_archive_updates", { p_limit: 100 });
  const updates = (data ?? []) as Update[];
  return <div className="mx-auto max-w-6xl px-6 py-12">
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-900">Updates are temporarily unavailable.</p>}
    {!error && updates.length === 0 && <p className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-600">No announcements have been published yet. Check back for future archive updates.</p>}
    <div className="grid gap-5 md:grid-cols-2">
      {updates.map((update) => <article key={update.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition hover:border-[#861F41]/40 hover:shadow-md">
        <div className="flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-widest text-[#861F41]"><span>{update.category}</span><span className="text-slate-400">•</span><time dateTime={update.published_at}>{formatDate(update.published_at)}</time></div>
        <h2 className="mt-4 text-2xl font-black"><Link href={`/updates/${update.slug}`} className="hover:text-[#861F41]">{update.title}</Link></h2>
        <p className="mt-3 flex-1 leading-7 text-slate-600">{update.summary}</p>
        <Link href={`/updates/${update.slug}`} className="mt-6 text-sm font-extrabold text-[#861F41] hover:underline">Read announcement →</Link>
      </article>)}
    </div>
    {updates.length >= 100 && <p className="mt-7 text-sm text-slate-500">Showing the 100 most recently published updates.</p>}
  </div>;
}

export default function UpdatesPage() {
  return <main className="min-h-screen bg-[#f6f7f9] text-[#002144]">
    <header className="bg-[#002144] text-white"><div className="mx-auto max-w-6xl px-6 py-16"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#e8afc2]">The Marching Archives / Journal</p><h1 className="mt-4 text-4xl font-black sm:text-5xl">News & Updates</h1><p className="mt-5 max-w-2xl text-lg leading-8 text-slate-200">Newly documented competition history, research discoveries, corrections, and improvements to the archive.</p></div></header>
    <Suspense fallback={<div className="mx-auto max-w-6xl p-8">Loading published updates…</div>}><PublicUpdates/></Suspense>
  </main>;
}
