import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";

export const instant = false;
const PAGE_SIZE = 18;
const TYPES = ["program", "recap", "newspaper", "results", "photograph", "other"];
const ORGS = ["KMEA", "MSBA", "BOA", "DCI"];
type Search = { q?: string; type?: string; org?: string; year?: string; page?: string };
type Props = { searchParams: Promise<Search> };
type Document = { id: string; title: string; document_type: string; organization_code: string | null; season_year: number | null; description: string | null; citation: string; document_url: string; rights_note: string };
function href(filters: Record<string,string>, page: number) {
  const params = new URLSearchParams(Object.entries(filters).filter(([,v]) => !!v));
  if (page > 1) params.set("page", String(page));
  return `/documents${params.size ? `?${params.toString()}` : ""}`;
}
async function DocumentCatalog({searchParams}: Props) {
  const p = await searchParams;
  const q = (p.q ?? "").slice(0,100).trim();
  const type = TYPES.includes(p.type ?? "") ? p.type! : "";
  const org = ORGS.includes(p.org ?? "") ? p.org! : "";
  const year = /^\d{4}$/.test(p.year ?? "") && Number(p.year) >= 1800 && Number(p.year) <= 2200 ? p.year! : "";
  const n = Number(p.page ?? 1);
  const page = Number.isSafeInteger(n) && n > 0 && n <= 10000 ? n : 1;
  const filters = {q,type,org,year};
  const supabase = await createClient();
  let query = supabase.from("archive_documents")
    .select("id,title,document_type,organization_code,season_year,description,citation,document_url,rights_note",{count:"exact"})
    .eq("publication_status","published")
    .order("season_year",{ascending:false,nullsFirst:false})
    .order("created_at",{ascending:false});
  if (q) query = query.ilike("title",`%${q.replace(/[\\%_]/g,"\\$&")}%`);
  if (type) query = query.eq("document_type",type);
  if (org) query = query.eq("organization_code",org);
  if (year) query = query.eq("season_year",Number(year));
  const {data,error,count} = await query.range((page-1)*PAGE_SIZE,page*PAGE_SIZE-1);
  const docs = (data ?? []) as Document[];
  const pages = Math.ceil((count ?? 0)/PAGE_SIZE);
  return <main className="min-h-screen bg-[#f6f7f9] text-[#002144]">
    <section className="bg-[#002144] px-6 py-14 text-white"><div className="mx-auto max-w-6xl">
      <Link href="/" className="text-sm text-slate-200 hover:underline">← Home</Link>
      <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-[#e6a9bc]">Research the evidence</p>
      <h1 className="mt-3 text-4xl font-extrabold">Historical Document Library</h1>
      <p className="mt-4 max-w-3xl text-slate-200">Find cited competition programs, recap sheets, newspaper articles, and other archival references. Documents are linked to their original hosts; The Marching Archives does not claim ownership of third-party materials.</p>
    </div></section>
    <div className="mx-auto max-w-6xl space-y-7 px-6 py-9">
      <form action="/documents" method="get" className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-sm font-semibold lg:col-span-2">Document title<input name="q" type="search" maxLength={100} defaultValue={q} placeholder="Search titles…" className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5"/></label>
        <label className="text-sm font-semibold">Type<select name="type" defaultValue={type} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"><option value="">All types</option>{TYPES.map(x=><option key={x} value={x}>{x.replaceAll("_"," ")}</option>)}</select></label>
        <label className="text-sm font-semibold">Organization<select name="org" defaultValue={org} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"><option value="">All</option>{ORGS.map(x=><option key={x}>{x}</option>)}</select></label>
        <label className="text-sm font-semibold">Year<input name="year" type="number" min={1800} max={2200} defaultValue={year} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5" placeholder="Any"/></label>
        <div className="flex gap-3 sm:col-span-2 lg:col-span-5"><button className="rounded-lg bg-[#861F41] px-6 py-2.5 font-bold text-white">Search documents</button><Link href="/documents" className="rounded-lg border border-slate-200 px-5 py-2.5">Clear</Link></div>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-extrabold">Documents</h2><span className="text-sm text-slate-500">{count ?? 0} published references</span></div>
      {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-5">Unable to load the library. Check that the database migration has been applied.</p> : docs.length===0 ? <p className="rounded-xl border border-slate-200 bg-white p-8 text-slate-600">No documents match these filters yet.</p> : <div className="grid gap-4 md:grid-cols-2">{docs.map(doc=><article key={doc.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-[#861F41]">{doc.document_type} {doc.organization_code ? `· ${doc.organization_code}`:""} {doc.season_year ? `· ${doc.season_year}`:""}</p>
        <h3 className="mt-3 text-xl font-extrabold">{doc.title}</h3>
        {doc.description && <p className="mt-3 text-sm leading-6 text-slate-600">{doc.description}</p>}
        <p className="mt-4 text-sm text-slate-600"><strong>Source:</strong> {doc.citation}</p>
        <p className="mt-2 text-xs text-slate-500"><strong>Rights:</strong> {doc.rights_note}</p>
        <a href={doc.document_url} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex rounded-lg bg-[#002144] px-4 py-2.5 text-sm font-bold text-white">Open original document ↗</a>
      </article>)}</div>}
      {pages>1 && <nav className="flex items-center justify-between gap-4" aria-label="Document pages"><span>Page {page} of {pages}</span><div className="flex gap-3">{page>1 && <Link href={href(filters,page-1)} className="rounded-lg border border-slate-300 px-4 py-2">Previous</Link>}{page<pages && <Link href={href(filters,page+1)} className="rounded-lg border border-slate-300 px-4 py-2">Next</Link>}</div></nav>}
    </div>
  </main>;
}
export default function DocumentsPage(props: Props) {
  return <Suspense fallback={<main className="mx-auto max-w-6xl p-10">Loading historical documents…</main>}><DocumentCatalog {...props}/></Suspense>;
}
