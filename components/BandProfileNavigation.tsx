
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  slug: string;
};

export default function BandProfileNavigation({
  slug,
}: Props) {
  const pathname = usePathname();
  const base = `/bands/${slug}`;

  const links = [
    { label: "Overview", href: base, section: "overview" },
    {
      label: "Competition Results",
      href: `${base}#competition-history`,
      section: "results",
    },
    {
      label: "Statistics",
      href: `${base}/statistics`,
      section: "statistics",
    },
    {
      label: "Championship History",
      href: `${base}/championships`,
      section: "championships",
    },
    {
      label: "Timeline",
      href: `${base}/timeline`,
      section: "timeline",
    },
    {
      label: "Achievements",
      href: `${base}/achievements`,
      section: "achievements",
    },
  ];

  return (
    <nav
      aria-label="Ensemble profile navigation"
      className="border-b border-slate-200 bg-white"
    >
      <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-5 py-3">
        {links.map((link) => {
          const active =
            link.section === "overview"
              ? pathname === base
              : link.section === "results"
                ? false
                : pathname === link.href;

          return (
            <Link
              key={link.section}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`shrink-0 rounded-lg px-4 py-3 text-sm font-bold transition ${
                active
                  ? "bg-[#002144] text-white"
                  : "text-[#002144] hover:bg-[#F4F6F9] hover:text-[#861F41]"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
