import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN } from "@/lib/band-validation";
import { addCompetitionSource, deleteCompetitionSource, setCompetitionSourceReviewed } from "./actions";

export const instant = false;

type Props = { params: Promise<{ id: string }> };
type Source = {
  id: string; title: string; source_type: string; url: string | null;
  citation: string | null; notes: string | null; reviewed_at: string | null;
  created_at: string;
};

const sourceTypes = [
  ["official_results", "Official results"], ["recap_sheet", "Recap sheet"],
  ["program", "Event program"], ["news", "Newspaper / article"],
  ["website", "Website"], ["other", "Other"],
] as const;

function safeLink(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : null;
  } catch { return null; }
}

async function SourceManagement({ params }: Props) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();
  const db = await createClient();
  const { data: auth, error: authError } = await db.auth.getClaims();
  if (authError || !auth?.claims?.sub) redirect("/staff/login");
  const { data: staff } = await db.from("staff_members").select("role,status")
    .eq("user_id", auth.claims.sub).maybeSingle();
  if (staff?.status !== "active" || !["owner", "admin", "editor"].includes(staff.role)) {
    redirect("/staff/login?error=unauthorized");
  }
  const { data: competition, error: compError } = await db.from("competitions")
    .select("id,name,source_url,archived_at").eq("id", id).maybeSingle();
  if (compError) throw new Error("Unable to retrieve competition.");
  if (!competition) notFound();
  const { data, error } = await db.from("competition_sources")
    .select("id,title,source_type,url,citation,notes,reviewed_at,created_at")
    .eq("competition_id", id).order("created_at", { ascending: false }).limit(300);
  if (error) throw new Error("Unable to retrieve source records. Apply the new Supabase migration first.");
  const sources = (data ?? []) as Source[];
  const canReview = ["owner", "admin"].includes(staff.role);
  const archived = Boolean(competition.archived_at);
  const reviewedCount = sources.filter((source) => source.reviewed_at).length;
  return (
    <main className="min-h-screen bg-[#f6f7f9] pb-20">
      <div className="bg-[#002144] px-6 py-10 text-white">
        <div className="mx-auto max-w-5xl">
          <Link href={`/staff/competitions/${id}`} className="text-sm text-[#edb7c9] hover:underline">← Competition management</Link>
          <p className="mt-5 text-xs font-bold uppercase tracking-widest text-[#edb7c9]">Historical research</p>
          <h1 className="mt-2 text-3xl font-bold">Sources & verification</h1>
          <p className="mt-2 text-slate-200">{competition.name}</p>
        </div>
      </div>
      <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-5">
          <div><p className="text-lg font-bold text-[#002144]">{sources.length} sources recorded</p>
          <p className="text-sm text-slate-600">{reviewedCount} reviewed · {sources.length - reviewedCount} awaiting review</p></div>
          <Link href={`/staff/competitions/${id}/review`} className="text-sm font-bold text-[#861F41] hover:underline">Review competition →</Link>
        </div>
        {competition.source_url && (
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-bold text-[#002144]">Original competition source</h2>
            <p className="mt-1 text-sm text-slate-600">This existing link is retained separately for compatibility with older pages.</p>
            {safeLink(competition.source_url) ? (
              <a href={safeLink(competition.source_url)!} target="_blank" rel="noopener noreferrer" className="mt-2 block break-all text-sm text-[#861F41] underline">{competition.source_url}</a>
            ) : <p className="mt-2 text-sm text-amber-800">Stored URL is not a valid HTTP(S) link.</p>}
          </section>
        )}
        {!archived && (
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-[#002144]">Add a source</h2>
            <p className="mt-1 text-sm text-slate-600">Add a reference link or written citation. Sources start as unreviewed.</p>
            <form action={addCompetitionSource} className="mt-5 grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="competition_id" value={id}/>
              <label className="text-sm font-semibold text-[#002144]">Source title *
                <input required minLength={3} maxLength={200} name="title" placeholder="2026 official recap sheet" className="mt-1 w-full rounded-lg border border-slate-300 p-3 font-normal" />
              </label>
              <label className="text-sm font-semibold text-[#002144]">Type
                <select name="source_type" className="mt-1 w-full rounded-lg border border-slate-300 p-3 font-normal">
                  {sourceTypes.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                </select>
              </label>
              <label className="text-sm font-semibold text-[#002144] sm:col-span-2">Link (HTTP or HTTPS)
                <input type="url" name="url" maxLength={2000} placeholder="https://..." className="mt-1 w-full rounded-lg border border-slate-300 p-3 font-normal" />
              </label>
              <label className="text-sm font-semibold text-[#002144] sm:col-span-2">Citation (required if no link)
                <textarea name="citation" maxLength={2000} rows={2} placeholder="Publisher, document title, year, page..." className="mt-1 w-full rounded-lg border border-slate-300 p-3 font-normal" />
              </label>
              <label className="text-sm font-semibold text-[#002144] sm:col-span-2">Research notes
                <textarea name="notes" maxLength={3000} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 p-3 font-normal" />
              </label>
              <button className="rounded-lg bg-[#861F41] px-5 py-3 text-sm font-bold text-white hover:bg-[#701832] sm:col-span-2">Save source</button>
            </form>
          </section>
        )}
        {archived && <p className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">Restore this archived competition before adding or changing sources.</p>}
        <section className="space-y-4" aria-label="Recorded sources">
          <h2 className="text-xl font-bold text-[#002144]">Recorded sources</h2>
          {sources.length === 0 && <p className="rounded-xl border bg-white p-6 text-slate-600">No additional sources recorded yet.</p>}
          {sources.map((source) => (
            <article key={source.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0"><h3 className="font-bold text-[#002144]">{source.title}</h3>
                  <p className="mt-1 text-xs text-slate-500">{sourceTypes.find(([key]) => key === source.source_type)?.[1] ?? "Other"} · Added {source.created_at.slice(0, 10)}</p></div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${source.reviewed_at ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>
                  {source.reviewed_at ? "Reviewed" : "Needs review"}</span>
              </div>
              {safeLink(source.url) && <a target="_blank" rel="noopener noreferrer" href={safeLink(source.url)!} className="mt-3 block break-all text-sm font-semibold text-[#861F41] underline">Open source ↗</a>}
              {source.citation && <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{source.citation}</p>}
              {source.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-500">Notes: {source.notes}</p>}
              {!archived && <div className="mt-4 flex flex-wrap gap-3 border-t border-slate-100 pt-4">
                {canReview && <form action={setCompetitionSourceReviewed}>
                  <input type="hidden" name="competition_id" value={id}/>
                  <input type="hidden" name="source_id" value={source.id}/>
                  <input type="hidden" name="reviewed" value={source.reviewed_at ? "false" : "true"}/>
                  <button className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-[#002144]">{source.reviewed_at ? "Reopen review" : "Mark reviewed"}</button>
                </form>}
                <form action={deleteCompetitionSource}>
                  <input type="hidden" name="competition_id" value={id}/>
                  <input type="hidden" name="source_id" value={source.id}/>
                  <button className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-800">Delete source</button>
                </form>
              </div>}
            </article>
          ))}
        </section>
        <p className="text-sm leading-6 text-slate-500">“Reviewed” means a staff reviewer has checked the reference. It does not independently certify every score or placement. Source files are linked or cited; this version does not upload documents.</p>
      </div>
    </main>
  );
}

export default function CompetitionSourcesPage({ params }: Props) {
  return <Suspense fallback={<main className="p-8">Loading sources…</main>}><SourceManagement params={params}/></Suspense>;
}
