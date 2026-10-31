import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { updateSession } from '@/lib/supabase/proxy';
import { sectionKeyFromPath } from '@/lib/section-controls';

// IMPORTANT: Keeps the existing Supabase session refresh behavior.
export async function proxy(request: NextRequest) {
  const sessionResponse = await updateSession(request);
  const sectionKey = sectionKeyFromPath(request.nextUrl.pathname);
  if (!sectionKey) return sessionResponse;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return sessionResponse;

  try {
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
    });
    const { data, error } = await supabase.rpc('tma_public_section_status', {
      p_section_key: sectionKey,
    });
    if (error || !Array.isArray(data) || !data[0]?.is_offline) return sessionResponse;

    // Redirect instead of rendering the original page; maintenance has robots:noindex.
    // Staff routes and /maintenance are excluded so Owners can always restore access.
    const destination = request.nextUrl.clone();
    destination.pathname = '/maintenance';
    destination.search = '';
    destination.searchParams.set('section', sectionKey);
    const response = NextResponse.redirect(destination, 307);
    response.headers.set('Cache-Control', 'no-store, private');
    // Retain any refreshed Supabase auth cookies.
    sessionResponse.cookies.getAll().forEach(({ name, value, ...options }) => {
      response.cookies.set(name, value, options);
    });
    return response;
  } catch {
    // Maintenance is a presentation control, not an access-control boundary.
    return sessionResponse;
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
