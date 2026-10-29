import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import BandStatusBadge from "@/components/BandStatusBadge";

const PAGE_SIZE = 24;

type DirectoryParams = {
  q?: string;
  type?: string;
  status?: string;
  page?: string;
};
type Props = { searchParams: Promise<DirectoryParams> };

type Band = {
  id: string;
  slug: string;
  name: string;
  kind: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  competitive_status: string | null;
  logo_path: string | null;
};

const types = [
  { value: "all", label: "All ensembles" },
  { value: "marching_band", label: "Marching bands" },
  { value: "drum_corps", label: "Drum corps" },
];

const statuses = [
  { value: "all", label: "All statuses" },
  { value: "active_competing", label: "Active — competing" },
  { value: "active_noncompeting", label: "Active — non-competing" },
  { value: "inactive", label: "Inactive" },
  { value: "unknown", label: "Unknown" },
];

function directoryUrl(
  filters: { q: string; type: string; status: string },
  page: number
) {
  const query = new URLSearchParams();
  if (filters.q) query.set("q", filters.q);
  if (filters.type !== "all") query.set("type", filters.type);
  if (filters.status !== "all") query.set("status", filters.status);
  if (page > 1) query.set("page", String(page));
  const suffix = query.toString();
  return suffix ? `/bands?${suffix}` : "/bands";
}

function BandLogo({ name, url }: { name: string; url: string | null }) {
  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2 sm:h-20 sm:w-20">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={`${name} logo`} loading="lazy" className="h-full w-full object-contain" />
      ) : (
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className="h-9 w-9 text-slate-300">
          <path d="M8 12h32v25H8zM14 19h20M14 25h20M14 31h14" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

function BandCard({ band, logoUrl }: { band: Band; logoUrl: string | null }) {
  const location = [band.city, band.state, band.country]
    .filter((part, index, parts) => Boolean(part) && (index === 0 || part !== parts[index - 1]))
    .join(", ") || "Location not recorded";
  const category = band.kind === "drum_corps" ? "Drum corps" : band.kind === "marching_band" ? "Marching band" : "Ensemble";

  return (
    <Link href={`/bands/${band.slug}`} className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#861F41]/50 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#861F41]">
      <div className="flex min-w-0 items-start gap-4">
        <BandLogo name={band.name} url={logoUrl} />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#861F41]">{category}</p>
          <h3 className="mt-1 text-lg font-extrabold leading-snug text-[#002144] transition-colors group-hover:text-[#861F41]">{band.name}</h3>
          <p className="mt-2 text-sm leading-5 text-slate-500">{location}</p>
        </div>
        <span aria-hidden="true" className="text-lg text-slate-400 transition group-hover:translate-x-1 group-hover:text-[#861F41]">→</span>
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-4">
        <BandStatusBadge status={band.competitive_status} />
        <span className="text-xs font-bold text-[#861F41]">View profile</span>
      </div>
    </Link>
  );
}

async function Directory({ searchParams }: Props) {
  const raw = await searchParams;
  const q = (raw.q ?? "").trim().slice(0, 100);
  const type = types.some((item) => item.value === raw.type) ? raw.type! : "all";
  const status = statuses.some((item) => item.value === raw.status) ? raw.status! : "all";
  const parsedPage = Number(raw.page ?? 1);
  const requestedPage = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? Math.min(parsedPage, 10000) : 1;
  const filters = { q, type, status };
  const hasFilters = Boolean(q || type !== "all" || status !== "all");

  const supabase = await createClient();
  let query = supabase
    .from("bands")
    .select("id, slug, name, kind, city, state, country, competitive_status, logo_path", { count: "exact" })
    .is("archived_at", null)
    .order("name", { ascending: true })
    .order("id", { ascending: true });

  if (q) query = query.ilike("name", `%${q.replace(/[%_\\]/g, "\\$&")}%`);
  if (type !== "all") query = query.eq("kind", type);
  if (status === "unknown") query = query.or("competitive_status.is.null,competitive_status.eq.unknown");
  else if (status !== "all") query = query.eq("competitive_status", status);

  // Counting first lets us avoid displaying an empty page when a stale page number is requested.
  const from = (requestedPage - 1) * PAGE_SIZE;
  const { data, error, count } = await query.range(from, from + PAGE_SIZE - 1);
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const bands = (data ?? []) as Band[];

  return (
    <div className="mx-auto max-w-7xl px-5 pb-20 pt-8 sm:px-8">
      <form method="get" action="/bands" role="search" className="relative -mt-16 rounded-2xl border border-slate-200 bg-white p-5 shadow-lg sm:p-7">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-extrabold text-[#002144]">Find an ensemble</h2>
            <p className="mt-1 text-sm text-slate-500">Search the archive or narrow down the directory.</p>
          </div>
          {hasFilters && <Link href="/bands" className="text-sm font-bold text-[#861F41] underline underline-offset-4">Clear filters</Link>}
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_205px_205px_auto] xl:items-end">
          <label className="block md:col-span-2 xl:col-span-1">
            <span className="block text-xs font-bold uppercase tracking-wide text-slate-600">Search by name</span>
            <input type="search" name="q" defaultValue={q} maxLength={100} placeholder="Enter a band or corps name…" className="mt-2 h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm text-[#002144] placeholder:text-slate-400 focus:border-[#861F41] focus:outline-none focus:ring-2 focus:ring-[#861F41]/15" />
          </label>
          <label className="block">
            <span className="block text-xs font-bold uppercase tracking-wide text-slate-600">Ensemble type</span>
            <select name="type" defaultValue={type} className="mt-2 h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-[#002144] focus:border-[#861F41] focus:outline-none">
              {types.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-bold uppercase tracking-wide text-slate-600">Competitive status</span>
            <select name="status" defaultValue={status} className="mt-2 h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-[#002144] focus:border-[#861F41] focus:outline-none">
              {statuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <button type="submit" className="h-12 rounded-lg bg-[#861F41] px-7 text-sm font-extrabold text-white transition hover:bg-[#6d1733]">Apply filters</button>
        </div>
      </form>

      <div className="mb-5 mt-11 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#861F41]">Directory</p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-[#002144]">{hasFilters ? "Matching ensembles" : "All bands & corps"}</h2>
        </div>
        {!error && <p aria-live="polite" className="text-sm text-slate-500">{total.toLocaleString()} {total === 1 ? "ensemble" : "ensembles"} found</p>}
      </div>

      {error ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-8 text-sm text-red-800">The directory could not be loaded. Please refresh and try again.</div>
      ) : bands.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {bands.map((band) => {
            const validLogo = typeof band.logo_path === "string" &&
              new RegExp(`^bands/${band.id}/[0-9a-f-]+\\.(png|jpg|webp)$`, "i").test(band.logo_path);
            const logoUrl = validLogo ? supabase.storage.from("band-logos").getPublicUrl(band.logo_path!).data.publicUrl : null;
            return <BandCard key={band.id} band={band} logoUrl={logoUrl} />;
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
          <h3 className="text-xl font-extrabold text-[#002144]">{total > 0 ? "Page not found" : "No ensembles found"}</h3>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600">{total > 0 ? "That page is outside the available results." : hasFilters ? "Try another name or change the directory filters." : "No band records have been published in the archive yet."}</p>
          <Link href={total > 0 ? directoryUrl(filters, totalPages) : "/bands"} className="mt-6 inline-flex rounded-lg bg-[#002144] px-5 py-3 text-sm font-bold text-white">{total > 0 ? "Last results page" : "View full directory"}</Link>
        </div>
      )}

      {!error && totalPages > 1 && (
        <nav aria-label="Directory pagination" className="mt-9 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Page {requestedPage.toLocaleString()} of {totalPages.toLocaleString()}</p>
          <div className="flex items-center gap-2">
            {requestedPage > 1 ? <Link href={directoryUrl(filters, requestedPage - 1)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-[#002144] hover:bg-slate-50">← Previous</Link> : <span className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-400">← Previous</span>}
            {requestedPage < totalPages ? <Link href={directoryUrl(filters, requestedPage + 1)} className="rounded-lg bg-[#002144] px-4 py-2 text-sm font-bold text-white hover:bg-[#123b63]">Next →</Link> : <span className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-400">Next →</span>}
          </div>
        </nav>
      )}
    </div>
  );
}

export default function BandsPage(props: Props) {
  return (
    <main className="min-h-screen bg-[#f6f7f9]">
      <section className="bg-[#002144] px-5 pb-28 pt-14 text-white sm:px-8 sm:pt-16">
        <div className="mx-auto max-w-7xl">
          <nav aria-label="Breadcrumb" className="mb-7 flex items-center gap-2 text-xs font-semibold text-slate-300">
            <Link href="/" className="hover:text-white">Home</Link><span aria-hidden="true">/</span><span className="text-white">Bands & Corps</span>
          </nav>
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#e9b4c5]">Explore the archive</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">Bands & Corps</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-200">Find marching bands and drum corps, explore their profiles, and follow their documented competitive histories.</p>
        </div>
      </section>
      <Suspense fallback={<div className="mx-auto max-w-7xl px-5 py-10 text-sm text-slate-600 sm:px-8" role="status">Loading directory…</div>}>
        <Directory searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
