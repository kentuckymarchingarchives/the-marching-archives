import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { addCompetitionResearchNote, setCompetitionResearchNoteStatus } from "./actions";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
};
type ResearchNote = {
  id: string; author_id: string; body: string; status: string;
  created_at: string; updated_at: string; resolved_at: string | null;
};
type Member = { user_id: string; display_name: string | null; greeting_name: string | null };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function NotesContent({ params, searchParams }: PageProps) {
  await connection();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  if (authError || !auth?.claims?.sub) redirect("/staff/login");
  const { data: member, error: memberError } = await supabase.from("staff_members")
    .select("role,status").eq("user_id", auth.claims.sub).maybeSingle();
  if (memberError || member?.status !== "active" || !["owner", "admin", "editor"].includes(member.role)) {
    redirect("/staff/login?error=unauthorized");
  }
  const { data: competition, error: competitionError } = await supabase.from("competitions")
    .select("id,name,organization_code,season_year").eq("id", id).maybeSingle();
  if (competitionError) throw new Error("Unable to load competition.");
  if (!competition) notFound();

  const [notesResponse, staffResponse] = await Promise.all([
    supabase.from("competition_research_notes")
      .select("id,author_id,body,status,created_at,updated_at,resolved_at")
      .eq("competition_id", id).order("created_at", { ascending: false }).limit(200),
    supabase.from("staff_members").select("user_id,display_name,greeting_name"),
  ]);
  const notes = (notesResponse.data ?? []) as ResearchNote[];
  const staff = (staffResponse.data ?? []) as Member[];
  const canModerate = member.role === "owner" || member.role === "admin";
  const { saved, error } = await searchParams;
  const authorLabel = (uid: string) => {
    const user = staff.find(s => s.user_id === uid);
    return user?.display_name?.trim() || user?.greeting_name?.trim() || "Former staff member";
  };
  return (
    <main className="min-h-screen bg-[#f6f7f8] text-[#002144]">
      <header className="bg-[#002144] px-6 py-12 text-white">
        <div className="mx-auto max-w-6xl">
          <Link href={`/staff/competitions/${id}`} className="text-sm font-semibold text-[#e8afc2] hover:underline">← Competition editor</Link>
          <p className="mt-6 text-xs font-black uppercase tracking-widest text-[#e8afc2]">The Marching Archives / Staff Research</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Research Notes & Discussions</h1>
          <p className="mt-3 text-slate-200">{competition.name} · {competition.organization_code} · {competition.season_year}</p>
        </div>
      </header>
      <div className="mx-auto max-w-6xl space-y-7 px-6 py-10">
        <div className="flex flex-wrap gap-3 text-sm font-semibold">
          <Link href={`/staff/competitions/${id}/research`} className="rounded-xl border border-slate-300 bg-white px-4 py-2 hover:bg-slate-50">Research Tasks</Link>
          <Link href="/staff/research" className="rounded-xl border border-slate-300 bg-white px-4 py-2 hover:bg-slate-50">All Assignments</Link>
        </div>
        {saved && <p role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">Research discussion updated.</p>}
        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">{error === "invalid" ? "Check the note content and try again." : "Unable to save. Confirm migration 034 is installed and your account has permission."}</p>}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black">Add a research note</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Internal staff discussion only. Record conflicting scoresheets, missing placements, source leads, or questions needing verification. Notes are not publicly displayed.</p>
          <form action={addCompetitionResearchNote} className="mt-5 space-y-4">
            <input type="hidden" name="competition_id" value={id} />
            <label htmlFor="research-note-body" className="block text-sm font-bold">Note or question</label>
            <textarea id="research-note-body" name="body" minLength={3} maxLength={4000} required rows={5}
              className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm leading-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#861F41]"
              placeholder="Example: A 1994 printed program lists a different placement. Locate the original judges' recap before updating results." />
            <button type="submit" className="rounded-xl bg-[#861F41] px-6 py-3 text-sm font-bold text-white hover:bg-[#6d1735]">Post private note</button>
          </form>
        </section>
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-black">Discussion history</h2>
            <span className="text-sm text-slate-600">{notesResponse.error ? "Unavailable" : `${notes.length} recent notes`}</span>
          </div>
          {(notesResponse.error || staffResponse.error) && <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">{notesResponse.error ? "Could not load research notes. Check migration 034." : "Staff names are temporarily unavailable."}</p>}
          {!notesResponse.error && notes.length === 0 && <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">No research notes have been posted for this competition.</p>}
          {notes.map(note => <article key={note.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-bold">{authorLabel(note.author_id)}</p>
                <p className="mt-1 text-xs text-slate-500">{new Date(note.created_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" })} ET</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${note.status === "resolved" ? "bg-green-100 text-green-900" : "bg-amber-100 text-amber-900"}`}>{note.status === "resolved" ? "Resolved" : "Open"}</span>
            </div>
            <p className="mt-4 whitespace-pre-wrap wrap-break-word text-sm leading-7 text-slate-700">{note.body}</p>
            {canModerate && <form action={setCompetitionResearchNoteStatus} className="mt-5 border-t border-slate-100 pt-4">
              <input type="hidden" name="competition_id" value={id} />
              <input type="hidden" name="note_id" value={note.id} />
              <input type="hidden" name="status" value={note.status === "resolved" ? "open" : "resolved"} />
              <button type="submit" className="rounded-lg bg-[#002144] px-4 py-2 text-xs font-bold text-white hover:bg-[#173d63]">{note.status === "resolved" ? "Reopen question" : "Mark resolved"}</button>
            </form>}
          </article>)}
          {notes.length === 200 && <p className="text-sm text-amber-800">Showing the most recent 200 notes. Older entries are retained in the database.</p>}
        </section>
      </div>
    </main>
  );
}

export default function CompetitionResearchNotesPage(props: PageProps) {
  return <Suspense fallback={<main className="p-10 text-[#002144]">Loading research discussions…</main>}><NotesContent {...props} /></Suspense>;
}
