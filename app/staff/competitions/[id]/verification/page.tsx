import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN } from "@/lib/band-validation";
import { verifyCompetition, revokeVerification } from "./actions";

export const instant = false;
type Props = {params: Promise<{id:string}>; searchParams: Promise<{status?:string}>};

export default async function VerificationPage({params, searchParams}:Props) {
 const {id} = await params;
 const {status} = await searchParams;
 if (!UUID_PATTERN.test(id)) notFound();
 const supabase = await createClient();
 const {data: auth} = await supabase.auth.getClaims();
 if (!auth?.claims?.sub) redirect("/staff/login");
 const {data: staff} = await supabase.from("staff_members")
  .select("role,status").eq("user_id",auth.claims.sub).maybeSingle();
 if (staff?.status !== "active" || !["owner","admin","editor"].includes(staff.role))
  redirect("/staff/login?error=unauthorized");
 const canVerify = staff.role === "owner" || staff.role === "admin";
 const [competition, approval, verification, sources, current] = await Promise.all([
   supabase.from("competitions").select("id,name,season_year,publication_status,archived_at").eq("id",id).maybeSingle(),
   supabase.from("competition_approvals").select("approved_at").eq("competition_id",id).maybeSingle(),
   supabase.from("competition_verifications").select("verified_at,verification_notes").eq("competition_id",id).maybeSingle(),
   supabase.from("competition_sources").select("id,reviewed_at").eq("competition_id",id).limit(1000),
   supabase.rpc("tma_verification_is_current",{p_id:id}),
 ]);
 const failure = [competition.error,approval.error,verification.error,sources.error,current.error].find(Boolean);
 if (failure) throw new Error(`Unable to load verification details: ${failure.message}`);
 if (!competition.data) notFound();
 const c=competition.data;
 const approved=Boolean(approval.data);
 const reviewed=(sources.data ?? []).filter(s=>s.reviewed_at !== null).length;
 const sourceCount=(sources.data ?? []).length;
 const published=c.publication_status === "published" && !c.archived_at;
 const isCurrent=current.data === true;
 const hasPrevious=Boolean(verification.data);
 const eligible=published && approved && reviewed > 0;
 return <main className="mx-auto max-w-5xl px-5 py-10 text-[#002144]">
  <Link href={`/staff/competitions/${id}`} className="text-sm font-semibold text-[#861F41] hover:underline">← Competition management</Link>
  <div className="mt-5 rounded-2xl bg-[#002144] p-8 text-white">
   <p className="text-xs font-bold uppercase tracking-widest text-[#eab3c5]">Historical records · Verification</p>
   <h1 className="mt-3 text-3xl font-extrabold">{c.name}</h1>
   <p className="mt-2 text-slate-200">{c.season_year} · Formal verification of published results</p>
  </div>
  {status === "verified" && <p className="mt-5 rounded-lg border border-green-200 bg-green-50 p-4 text-green-900">Verification recorded.</p>}
  {status === "revoked" && <p className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">Verification revoked.</p>}
  <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
   <h2 className="text-xl font-bold">Verification status</h2>
   <p className="mt-3 text-lg font-semibold">{isCurrent ? "Verified" : hasPrevious ? "Verification outdated" : "Not verified"}</p>
   <p className="mt-2 text-sm leading-6 text-slate-600">Publication, approval and verification are separate steps. A verified record remains current only while its published results and reviewed citations match the evidence recorded at verification.</p>
   <div className="mt-5 grid gap-3 sm:grid-cols-3">
    <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Publication</p><p className="mt-1 font-bold">{published ? "Published" : "Not published"}</p></div>
    <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Historical approval</p><p className="mt-1 font-bold">{approved ? "Recorded" : "Not recorded"}</p></div>
    <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Reviewed sources</p><p className="mt-1 font-bold">{reviewed} of {sourceCount}</p></div>
   </div>
   {verification.data && <p className="mt-5 text-sm text-slate-600">Last verified: {new Date(verification.data.verified_at).toLocaleString("en-US")} · Notes: {verification.data.verification_notes}</p>}
  </section>
  <div className="mt-6 flex flex-wrap gap-3">
   <Link href={`/staff/competitions/${id}/sources`} className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold">Manage sources</Link>
   <Link href={`/staff/competitions/${id}/review`} className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold">Review results</Link>
   <Link href={`/staff/competitions/${id}/publish`} className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold">Publishing</Link>
  </div>
  {canVerify && <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
   <h2 className="text-xl font-bold">{isCurrent ? "Renew verification" : "Verify historical results"}</h2>
   {!eligible && <p className="mt-3 text-sm text-amber-800">Publish the competition, approve its historical review and review at least one source before verification.</p>}
   <form action={verifyCompetition} className="mt-5 space-y-4">
    <input type="hidden" name="competition_id" value={id}/>
    <label className="block text-sm font-semibold" htmlFor="verification-notes">Verification notes</label>
    <textarea id="verification-notes" name="notes" minLength={10} maxLength={2000} required rows={4} placeholder="Explain what was checked against the reviewed historical sources." className="w-full rounded-lg border border-slate-300 p-3 text-sm"/>
    <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="confirmed" value="yes" required className="mt-1"/><span>I personally checked the competition results against the reviewed sources.</span></label>
    <button type="submit" disabled={!eligible} className="rounded-lg bg-[#861F41] px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{isCurrent ? "Renew verification" : "Mark verified"}</button>
   </form>
   {hasPrevious && <form action={revokeVerification} className="mt-6 border-t border-slate-200 pt-5"><input type="hidden" name="competition_id" value={id}/><button type="submit" className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700">Revoke verification</button></form>}
  </section>}
 </main>;
}
