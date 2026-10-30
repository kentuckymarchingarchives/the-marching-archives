import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type PublicMember = {
  display_name: string;
  staff_title: string | null;
  biography: string | null;
  research_specialties: string | null;
  profile_photo_url: string | null;
};

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part.slice(0, 1)).join("").toUpperCase();
}

async function TeamContents() {
  const supabase = await createClient();
  // Safe public RPC: only opted-in active staff, no authentication identifiers.
  const { data, error } = await supabase.rpc("tma_public_team");
  const members = (data ?? []) as PublicMember[];

  return <main className="min-h-screen bg-[#f6f7f9] text-[#002144]">
    <header className="bg-[#002144] text-white">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#efbbce]">The Marching Archives</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">Meet the Team</h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-200">Meet the people preserving competitive marching arts history, researching results, and keeping historical records accessible.</p>
      </div>
    </header>
    <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
      {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">Team information is temporarily unavailable. Please try again later.</p> :
        members.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center"><h2 className="text-xl font-bold">Our team profiles are coming soon</h2><p className="mt-2 text-sm text-slate-600">Check back as we introduce our archive team.</p></div> :
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{members.map((member, index) => <article key={`${member.display_name}-${index}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="h-2 bg-[#861F41]" />
          <div className="p-6">
            <div className="flex items-center gap-4">
              {member.profile_photo_url ? <img src={member.profile_photo_url} alt="" referrerPolicy="no-referrer" className="h-20 w-20 shrink-0 rounded-full border border-slate-200 object-cover" /> :
                <div aria-hidden="true" className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-[#002144] text-xl font-bold text-white">{initials(member.display_name)}</div>}
              <div className="min-w-0"><h2 className="wwrap-break-word text-xl font-extrabold">{member.display_name}</h2>{member.staff_title && <p className="mt-1 text-sm font-semibold text-[#861F41]">{member.staff_title}</p>}</div>
            </div>
            {member.biography && <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-slate-700">{member.biography}</p>}
            {member.research_specialties && <div className="mt-5 border-t border-slate-100 pt-4"><h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Research specialties</h3><div className="mt-3 flex flex-wrap gap-2">{member.research_specialties.split(",").map(x => x.trim()).filter(Boolean).map((specialty, i) => <span key={`${specialty}-${i}`} className="rounded-full bg-[#002144]/5 px-3 py-1 text-xs font-medium text-[#002144]">{specialty}</span>)}</div></div>}
          </div>
        </article>)}</div>}
      <div className="mt-10 text-center"><Link href="/" className="inline-flex items-center rounded-lg border border-[#002144] px-5 py-2.5 text-sm font-semibold hover:bg-white">← Return to the archive</Link></div>
    </div>
  </main>;
}

export default function MeetTheTeamPage() {
  return <Suspense fallback={<main className="min-h-screen p-10 text-center">Loading team profiles…</main>}><TeamContents /></Suspense>;
}
