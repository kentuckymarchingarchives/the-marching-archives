import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Update = { id: string; slug: string; title: string; summary: string; category: string; published_at: string };
async function LatestFeed() {
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("tma_public_archive_updates", { p_limit: 3 });
  const updates = (data ?? []) as Update[];
  if (error || updates.length === 0) return null;
  return <section className="bg-white py-16 text-[#002144]">
    <div className="mx-auto max-w-7xl px-6 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.2em] text-[#861F41]">Latest from the archive</p><h2 className="mt-3 text-3xl font-black">News & Updates</h2></div><Link href="/updates" className="text-sm font-bold text-[#861F41] hover:underline">View all updates →</Link></div>
      <div className="mt-8 grid gap-5 md:grid-cols-3">{updates.map((item) => <article key={item.id} className="rounded-2xl border border-slate-200 bg-[#f6f7f9] p-6">
        <p className="text-xs font-bold uppercase tracking-wider text-[#861F41]">{item.category}</p><h3 className="mt-3 text-xl font-black"><Link className="hover:text-[#861F41]" href={`/updates/${item.slug}`}>{item.title}</Link></h3><p className="mt-3 text-sm leading-7 text-slate-600">{item.summary}</p>
      </article>)}</div>
    </div>
  </section>;
}
export default function LatestArchiveUpdates() {
  return <Suspense fallback={null}><LatestFeed/></Suspense>;
}
