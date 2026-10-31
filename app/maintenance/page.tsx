import type { Metadata } from 'next';
import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import SectionOffline from '@/components/SectionOffline';
import { managedSections } from '@/lib/section-controls';

export const metadata: Metadata = {
  title: 'Section Offline | The Marching Archives',
  description: 'This section of The Marching Archives is temporarily unavailable.',
  robots: { index: false, follow: true },
};

async function MaintenanceContent({ searchParams }: {
  searchParams: Promise<{ section?: string }>;
}) {
  const params = await searchParams;
  const section = params.section ?? '';
  if (!(managedSections as readonly string[]).includes(section)) return <SectionOffline />;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('tma_public_section_status', { p_section_key: section });
  const setting = !error && Array.isArray(data) ? data[0] : null;
  if (!setting?.is_offline) return <SectionOffline />;
  return <SectionOffline sectionName={setting.section_name} message={setting.notice} />;
}

export default function MaintenancePage({ searchParams }: {
  searchParams: Promise<{ section?: string }>;
}) {
  return <Suspense fallback={<SectionOffline />}><MaintenanceContent searchParams={searchParams}/></Suspense>;
}
