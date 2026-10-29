import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { addDocument, updateDocumentStatus } from "./actions";

export const instant = false;
type Props = { searchParams: Promise<{ error?: string; success?: string }> };
type Doc = { id:string; title:string; document_type:string; publication_status:string; season_year:number|null; document_url:string };
const input = "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm";
async function StaffDocuments({searchParams}: Props) {
  const p = await searchParams;
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  if (authError || !auth?.claims?.sub) redirect("/staff/login");
  const {data: staff} = await supabase.from("staff_members").select("role,status").eq("user_id",auth.claims.sub).maybeSingle();
  if (staff?.status!=="active" || !["owner","admin","editor"].includes(staff.role)) redirect("/staff/login?error=unauthorized");
  const canPublish = staff.role==="owner" || staff.role==="admin";
  const {data,error} = await supabase.from("archive_documents").select("id,title,document_type,publication_status,season_year,document_url").order("created_at",{ascending:false}).limit(100);
  const docs = (data??[]) as Doc[];
  return <main className="min-h-screen bg-[#f6f7f9] text-[#002144]">
    <section className="bg-[#002144] px-6 py-12 text-white"><div className="mx-auto max-w-6xl">
      <Link href="/staff/dashboard" className="text-sm text-slate-200 hover:underline">← Staff Dashboard</Link>
      <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-[#e6a9bc]">Archive administration</p>
      <h1 className="mt-2 text-3xl font-extrabold">Historical Document Library</h1>
      <p className="mt-3 text-slate-200">Register citation links and rights information. Documents stay in draft until published.</p>
    </div></section>
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-9">
      {p.error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{p.error==="url"?"Enter a valid HTTPS document link.":p.error==="permission"?"Only Owners and Administrators can publish.":"Could not save. Review the fields and confirm the migration is installed."}</p>}
      {p.success && <p role="status" className="rounded-lg border border-slate-200 bg-white p-4 text-sm">Document record saved.</p>}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-extrabold">Add document reference</h2>
        <p className="mt-2 text-sm text-slate-500">Add metadata and a link to an authorized external host; this version does not upload files.</p>
        <form action={addDocument} className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold sm:col-span-2">Title *<input required minLength={3} maxLength={200} name="title" className={input} placeholder="1986 State Finals Program"/></label>
          <label className="text-sm font-semibold">Type *<select required name="document_type" className={input}><option value="program">Competition program</option><option value="recap">Recap sheet</option><option value="results">Official results</option><option value="newspaper">Newspaper</option><option value="photograph">Photograph</option><option value="other">Other</option></select></label>
          <label className="text-sm font-semibold">Organization<select name="organization_code" className={input}><option value="">Not specified</option>{["KMEA","MSBA","BOA","DCI"].map(o=><option key={o}>{o}</option>)}</select></label>
          <label className="text-sm font-semibold">Season year<input name="season_year" type="number" min={1800} max={2200} className={input}/></label>
          <label className="text-sm font-semibold">Document link (HTTPS) *<input name="document_url" type="url" required pattern="https://.*" maxLength={2000} className={input} placeholder="https://…"/></label>
          <label className="text-sm font-semibold sm:col-span-2">Source citation *<textarea name="citation" required minLength={3} maxLength={2000} rows={2} className={input} placeholder="Publisher, title, date, page…"/></label>
          <label className="text-sm font-semibold sm:col-span-2">Description<textarea name="description" maxLength={2000} rows={2} className={input}/></label>
          <label className="text-sm font-semibold sm:col-span-2">Rights / use statement *<input name="rights_note" required minLength={3} maxLength={500} className={input} placeholder="Hosted by the original publisher; see source for usage terms"/></label>
          {canPublish && <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2"><input name="publish" value="yes" type="checkbox"/> Publish immediately (review link and rights first)</label>}
          <div className="sm:col-span-2"><button type="submit" className="rounded-lg bg-[#861F41] px-6 py-3 font-bold text-white">Save document reference</button></div>
        </form>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-extrabold">Recent documents</h2><Link href="/documents" className="text-sm font-bold text-[#861F41] hover:underline">Public library →</Link></div>
        {error ? <p role="alert" className="mt-5 text-red-800">Could not load records. Verify the SQL migration and permissions.</p> : docs.length===0 ? <p className="mt-5 text-sm text-slate-500">No document records yet.</p> : <div className="mt-5 divide-y divide-slate-100">{docs.map(doc=><div key={doc.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><h3 className="font-bold">{doc.title}</h3><p className="mt-1 text-xs text-slate-500">{doc.document_type} · {doc.season_year??"No year"} · {doc.publication_status}</p><a href={doc.document_url} rel="noopener noreferrer" target="_blank" className="text-sm text-[#861F41] underline">Check original link ↗</a></div>{canPublish && <form action={updateDocumentStatus}><input type="hidden" name="id" value={doc.id}/><input type="hidden" name="status" value={doc.publication_status==="published"?"draft":"published"}/><button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">{doc.publication_status==="published"?"Unpublish":"Publish"}</button></form>}</div>)}</div>}
        <p className="mt-4 text-xs text-slate-500">Showing the 100 most recently added records.</p>
      </section>
    </div>
  </main>;
}
export default function StaffDocumentsPage(props: Props) {return <Suspense fallback={<main className="p-8">Loading document administration…</main>}><StaffDocuments {...props}/></Suspense>;}
