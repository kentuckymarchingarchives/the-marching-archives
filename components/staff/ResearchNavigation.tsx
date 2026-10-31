import Link from "next/link";
import { researchLinks } from "@/lib/research-insights";

/** Shared, server-rendered navigation for the five staff research pages. */
export default function ResearchNavigation({ currentPath }: { currentPath: string }) {
  return (
    <nav aria-label="Research workspace navigation" className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap gap-2">
        {researchLinks.map((link) => {
          const active = link.href === currentPath;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-lg px-4 py-2.5 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#861F41] ${active ? "bg-[#861F41] text-white" : "border border-slate-200 bg-white text-[#002144] hover:border-[#861F41] hover:text-[#861F41]"}`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
