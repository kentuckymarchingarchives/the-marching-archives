import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { saveSectionControl } from './actions';
import ScheduleEditor from './ScheduleEditor';

export const instant = false;

type Section = {
  section_key: string;
  section_name: string;
  is_offline: boolean;
  notice: string;
  updated_at: string;
};

type Schedule = {
  section_key: string;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  schedule_active: boolean;
};

async function Controls({ searchParams }: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  if (authError || !auth?.claims?.sub) redirect('/staff/login');
  const { data: staff, error: staffError } = await supabase.from('staff_members')
    .select('role,status').eq('user_id', auth.claims.sub).maybeSingle();
  if (staffError || staff?.status !== 'active' || staff.role !== 'owner') redirect('/staff/dashboard');
  const { data, error } = await supabase.rpc('tma_owner_list_section_controls');
  const sections = (data ?? []) as Section[];
  const { data: schedulesData, error: schedulesError } = await supabase.rpc('tma_owner_list_section_schedules');
  const scheduleMap = new Map(((schedulesData ?? []) as Schedule[]).map(s => [s.section_key, s]));
  const params = await searchParams;
  const offlineCount = sections.filter(s => s.is_offline || scheduleMap.get(s.section_key)?.schedule_active).length;
  return <main className="min-h-screen bg-[#f6f8fb] px-5 py-12 text-[#002144] sm:px-8">
    <div className="mx-auto max-w-6xl">
      <Link href="/staff/dashboard" className="text-sm font-bold text-[#861F41] hover:underline">← Staff dashboard</Link>
      <div className="mt-6 rounded-3xl bg-[#002144] px-7 py-9 text-white sm:px-10">
        <p className="text-xs font-black uppercase tracking-[.18em] text-[#e8afc2]">Owner administration / Website controls</p>
        <h1 className="mt-3 text-3xl font-black sm:text-4xl">Section availability</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200">Take public sections offline immediately or schedule a start and end time without redeploying. Staff tools remain accessible so you can restore them.</p>
        <p className="mt-5 text-sm font-bold text-white">{offlineCount} of {sections.length} sections currently offline</p>
      </div>
      {params.saved && <p role="status" className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">Section settings saved. New visits will reflect the change.</p>}
      {params.error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Could not save the setting. Check your Owner access and the notice length (10–500 characters).</p>}
      {(error || schedulesError) && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Unable to load section settings. Make sure migration 028 has been installed.</p>}
      <div className="mt-7 grid gap-5 lg:grid-cols-2">
        {sections.map(section => {
          const schedule = scheduleMap.get(section.section_key);
          const effectiveOffline = section.is_offline || Boolean(schedule?.schedule_active);
          return <div key={section.section_key} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <form action={saveSectionControl}>
          <input type="hidden" name="section_key" value={section.section_key}/>
          <div className="flex items-start justify-between gap-3">
            <div><h2 className="text-xl font-extrabold">{section.section_name}</h2><p className="mt-1 text-xs text-slate-500">/{section.section_key} and its subpages</p></div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${effectiveOffline ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>{effectiveOffline ? 'Offline' : 'Online'}</span>
          </div>
          <label className="mt-5 flex items-center gap-3 text-sm font-semibold">
            <input type="checkbox" name="is_offline" defaultChecked={section.is_offline} className="h-5 w-5 accent-[#861F41]"/>
            Show maintenance notice instead of the public section
          </label>
          <label htmlFor={`notice-${section.section_key}`} className="mt-5 block text-xs font-bold uppercase tracking-wider text-slate-600">Maintenance message</label>
          <textarea id={`notice-${section.section_key}`} name="notice" defaultValue={section.notice} required minLength={10} maxLength={500} rows={3} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm leading-6 focus:border-[#861F41] focus:outline-2 focus:outline-[#861F41]"/>
          <div className="mt-5 flex items-center justify-between gap-3"><Link href={`/${section.section_key}`} className="text-sm font-semibold text-[#861F41] hover:underline">Visit section ↗</Link><button type="submit" className="rounded-xl bg-[#861F41] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#6e1935]">Save changes</button></div>
          </form>
          <ScheduleEditor sectionKey={section.section_key} startAt={schedule?.scheduled_start_at ?? null} endAt={schedule?.scheduled_end_at ?? null} />
          {schedule?.scheduled_start_at && schedule?.scheduled_end_at && (
            <p className="mt-3 text-xs font-medium text-slate-600">
              {schedule.schedule_active ? 'Scheduled window is active.' : 'Scheduled window saved.'}
              {' '}The times shown in the editor use your browser timezone.
            </p>
          )}
        </div>;
        })}
      </div>
      <p className="mt-8 text-sm text-slate-600">This hides public pages from normal navigation requests; it does not disable API endpoints or revoke public database access. Do not use it to secure confidential records.</p>
    </div>
  </main>;
}

export default function StaffSectionsPage({ searchParams }: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  return <Suspense fallback={<main className="p-10 text-[#002144]">Loading section controls…</main>}><Controls searchParams={searchParams}/></Suspense>;
}
