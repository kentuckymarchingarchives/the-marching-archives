import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { saveArchiveUpdate } from "./actions";

type Update = {
  id: string; slug: string; title: string; summary: string; content: string;
  category: string; status: string; published_at: string | null;
  created_at: string; updated_at: string;
};
type Query = { edit?: string; saved?: string; error?: string };
const categories = ["archive", "research", "correction", "website"];

async function UpdatesEditor({ searchParams }: { searchParams: Promise<Query> }) {
  await connection();
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  if (authError || !auth?.claims?.sub) redirect("/staff/login");
  const { data: staff, error: staffError } = await supabase.from("staff_members")
    .select("role,status").eq("user_id", auth.claims.sub).maybeSingle();
  if (staffError || staff?.status !== "active" || staff.role !== "owner") redirect("/staff/dashboard");

  const { data, error } = await supabase.rpc("tma_owner_archive_updates");
  const updates = (data ?? []) as Update[];
  const query = await searchParams;
  const selected = updates.find((item) => item.id === query.edit);
  const draftCount = updates.filter((item) => item.status === "draft").length;

  return <main className="min-h-screen bg-[#f6f7f9] text-[#002144]">
    <section className="bg-[#002144] text-white"><div className="mx-auto max-w-6xl px-6 py-12">
      <Link href="/staff/dashboard" className="text-sm text-slate-200 hover:underline">← Staff dashboard</Link>
      <p className="mt-8 text-xs font-black uppercase tracking-[.2em] text-[#e8afc2]">Owner administration / Editorial</p>
      <h1 className="mt-3 text-4xl font-extrabold">Archive News & Updates</h1>
      <p className="mt-4 max-w-2xl text-slate-200">Draft and publish archive announcements. Only published updates appear to visitors.</p>
    </div></section>
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
      <div className="grid gap-4 sm:grid-cols-3">
        {[{label:"Total updates",n:updates.length},{label:"Published",n:updates.length-draftCount},{label:"Drafts",n:draftCount}].map((entry) =>
          <div key={entry.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-600">{entry.label}</p><p className="mt-2 text-3xl font-black">{error ? "—" : entry.n}</p>
          </div>)}
      </div>
      {query.saved === "1" && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-900">Update saved successfully.</p>}
      {query.error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-900">{query.error === "duplicate" ? "That URL slug is already in use. Choose another." : query.error === "access" ? "Only an active Owner can publish updates." : query.error === "invalid" ? "Please check the required fields and their lengths." : "Unable to save. Check migration 030 and your database connection."}</p>}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-900">Could not load the update list. Verify migration 030.</p>}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs font-black uppercase tracking-widest text-[#861F41]">Editorial workspace</p><h2 className="mt-2 text-2xl font-black">{selected ? "Edit update" : "Write an update"}</h2></div>
          {selected && <Link href="/staff/updates" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold">Create new</Link>}
        </div>
        <form key={selected?.id ?? "new"} action={saveArchiveUpdate} className="mt-7 grid gap-5 sm:grid-cols-2">
          <input type="hidden" name="id" value={selected?.id ?? ""}/>
          <label className="block text-sm font-bold sm:col-span-2">Headline
            <input name="title" required minLength={5} maxLength={160} defaultValue={selected?.title ?? ""} placeholder="New historical results added to the archive" className="mt-2 block w-full rounded-lg border border-slate-300 px-4 py-3 font-normal"/>
          </label>
          <label className="block text-sm font-bold">URL slug
            <input name="slug" required maxLength={100} pattern="[a-z0-9]+(-[a-z0-9]+)*" defaultValue={selected?.slug ?? ""} placeholder="historical-results-added" className="mt-2 block w-full rounded-lg border border-slate-300 px-4 py-3 font-normal"/>
          </label>
          <label className="block text-sm font-bold">Category
            <select name="category" defaultValue={selected?.category ?? "archive"} className="mt-2 block w-full rounded-lg border border-slate-300 px-4 py-3 font-normal">
              {categories.map((category) => <option key={category} value={category}>{category[0].toUpperCase()+category.slice(1)}</option>)}
            </select>
          </label>
          <label className="block text-sm font-bold sm:col-span-2">Short summary
            <textarea name="summary" required minLength={10} maxLength={320} rows={2} defaultValue={selected?.summary ?? ""} className="mt-2 block w-full rounded-lg border border-slate-300 px-4 py-3 font-normal"/>
          </label>
          <label className="block text-sm font-bold sm:col-span-2">Announcement (plain text; separate paragraphs with blank lines)
            <textarea name="content" required minLength={20} maxLength={10000} rows={10} defaultValue={selected?.content ?? ""} className="mt-2 block w-full rounded-lg border border-slate-300 px-4 py-3 font-normal leading-7"/>
          </label>
          <label className="block text-sm font-bold">Publication status
            <select name="status" defaultValue={selected?.status ?? "draft"} className="mt-2 block w-full rounded-lg border border-slate-300 px-4 py-3 font-normal">
              <option value="draft">Draft — staff only</option><option value="published">Published — public</option>
            </select>
          </label>
          <div className="flex items-end"><button type="submit" className="w-full rounded-lg bg-[#861F41] px-5 py-3 font-bold text-white hover:bg-[#6b1935]">{selected ? "Save changes" : "Create update"}</button></div>
        </form>
        <p className="mt-5 text-xs leading-6 text-slate-500">Changing a published update back to Draft removes it from the public feed. URL slugs must be unique. Changing a published slug changes its URL.</p>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-2xl font-black">Your updates</h2>
        <div className="mt-5 divide-y divide-slate-200">
          {updates.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-4 py-5">
            <div className="min-w-0"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.status === "published" ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`}>{item.status}</span>
              <h3 className="mt-2 font-bold">{item.title}</h3><p className="mt-1 text-sm text-slate-600">{item.summary}</p></div>
            <div className="flex gap-3"><Link href={`/staff/updates?edit=${item.id}`} className="text-sm font-bold text-[#861F41] hover:underline">Edit</Link>{item.status === "published" && <Link href={`/updates/${item.slug}`} className="text-sm font-bold text-[#861F41] hover:underline">View</Link>}</div>
          </div>)}
          {!error && updates.length === 0 && <p className="py-8 text-sm text-slate-500">No announcements yet. Create a draft above.</p>}
        </div>
      </section>
    </div>
  </main>;
}

export default function StaffUpdatesPage(props: { searchParams: Promise<Query> }) {
  return <Suspense fallback={<main className="p-10">Loading editorial workspace…</main>}><UpdatesEditor {...props}/></Suspense>;
}