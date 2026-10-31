"use server";

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { managedSections } from '@/lib/section-controls';

export async function saveSectionControl(formData: FormData) {
  const sectionKey = String(formData.get('section_key') ?? '');
  const offline = formData.get('is_offline') === 'on';
  const notice = String(formData.get('notice') ?? '').trim();
  if (!(managedSections as readonly string[]).includes(sectionKey) ||
      notice.length < 10 || notice.length > 500) {
    redirect('/staff/sections?error=invalid');
  }
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  if (authError || !auth?.claims?.sub) redirect('/staff/login');
  // RPC enforces active Owner at the database layer.
  const { error } = await supabase.rpc('tma_owner_set_section_control', {
    p_section_key: sectionKey,
    p_is_offline: offline,
    p_notice: notice,
  });
  if (error) redirect('/staff/sections?error=save');
  revalidatePath('/staff/sections');
  revalidatePath('/maintenance');
  redirect('/staff/sections?saved=1');
}


/** Schedule a maintenance window, or remove an existing schedule. */
export async function saveSectionSchedule(formData: FormData) {
  const sectionKey = String(formData.get('section_key') ?? '');
  if (!(managedSections as readonly string[]).includes(sectionKey)) {
    redirect('/staff/sections?error=invalid');
  }

  const enabled = formData.get('schedule_enabled') === 'on';
  const start = String(formData.get('schedule_start_utc') ?? '');
  const end = String(formData.get('schedule_end_utc') ?? '');
  let startIso: string | null = null;
  let endIso: string | null = null;
  if (enabled) {
    const startMs = Date.parse(start);
    const endMs = Date.parse(end);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) ||
        endMs <= startMs || endMs <= Date.now()) {
      redirect('/staff/sections?error=schedule');
    }
    startIso = new Date(startMs).toISOString();
    endIso = new Date(endMs).toISOString();
  }

  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  if (authError || !auth?.claims?.sub) redirect('/staff/login');

  // This RPC verifies the current user is an active Owner inside PostgreSQL.
  const { error } = await supabase.rpc('tma_owner_set_section_schedule', {
    p_section_key: sectionKey,
    p_start_at: startIso,
    p_end_at: endIso,
  });
  if (error) redirect('/staff/sections?error=schedule');

  revalidatePath('/staff/sections');
  revalidatePath('/maintenance');
  redirect('/staff/sections?saved=schedule');
}
