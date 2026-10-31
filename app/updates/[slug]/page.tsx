import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ slug: string }> };
type Update = { slug: string; title: string; summary: string; content: string; category: string; published_at: string };
const formatDate = (value: string) => new Intl.DateTimeFormat("en-US", { year:"numeric", month:"long", day:"numeric", timeZone:"UTC" }).format(new Date(value));

async function loadUpdate(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("tma_public_archive_update", { p_slug: slug });
  if (error) throw new Error("Unable to load archive update");
  return (data?.[0] ?? null) as Update | null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await connection();
  const { slug } = await params;
  const update = await loadUpdate(slug);
  return update ? { title: `${update.title} | The Marching Archives`, description: update.summary } : { title: "Update Not Found | The Marching Archives" };
}

async function UpdateContent({ params }: Props) {
  await connection();
  const { slug } = await params;
  const update = await loadUpdate(slug);
  if (!update) notFound();
  const paragraphs = update.content.split(/\n\s*\n/).filter(Boolean);
  return <main className="min-h-screen bg-[#f6f7f9] text-[#002144]">
    <header className="bg-[#002144] text-white"><div className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/updates" className="text-sm text-[#e8afc2] hover:underline">← All archive updates</Link>
      <p className="mt-8 text-xs font-black uppercase tracking-[.18em] text-[#e8afc2]">{update.category} · <time dateTime={update.published_at}>{formatDate(update.published_at)}</time></p>
      <h1 className="mt-4 text-4xl font-black leading-tight sm:text-5xl">{update.title}</h1><p className="mt-6 text-lg leading-8 text-slate-200">{update.summary}</p>
    </div></header>
    <article className="mx-auto max-w-3xl px-6 py-12"><div className="rounded-2xl border border-slate-200 bg-white px-6 py-9 shadow-sm sm:px-10">
      {paragraphs.map((paragraph, i) => <p key={i} className="mb-6 whitespace-pre-line text-base leading-8 text-slate-700 last:mb-0">{paragraph.trim()}</p>)}
    </div><Link href="/updates" className="mt-8 inline-block text-sm font-bold text-[#861F41] hover:underline">← Back to News & Updates</Link></article>
  </main>;
}
export default function UpdatePage(props: Props) {
  return <Suspense fallback={<main className="p-10">Loading announcement…</main>}><UpdateContent {...props}/></Suspense>;
}
