
import Image from "next/image";
import Link from "next/link";

import {
  getOrganizationBrand,
} from "@/lib/organization-branding";

type Props = {
  organizationCode: string;
  compact?: boolean;
  showArchiveLink?: boolean;
};

export default function OrganizationIdentity({
  organizationCode,
  compact = false,
  showArchiveLink = false,
}: Props) {
  const organization =
    getOrganizationBrand(organizationCode);

  if (!organization) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-sm font-semibold text-[#002144]">
          {organizationCode || "Unknown Organization"}
        </p>
      </div>
    );
  }

  return (
    <section
      aria-label={`${organization.name} information`}
      className={
        compact
          ? "flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4"
          : "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      }
    >
      <div
        className={
          compact
            ? "flex flex-wrap items-center gap-5"
            : "flex flex-wrap items-center gap-6"
        }
      >
        <a
          href={organization.website}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Visit the official ${organization.name} website`}
          title={`Visit ${organization.website}`}
          className="flex h-24 w-32 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-white p-2 transition hover:bg-slate-50"
        >
          <Image
            src={organization.logo}
            alt={`${organization.name} logo`}
            width={160}
            height={120}
            sizes="128px"
            className="max-h-full w-auto max-w-full object-contain"
          />
        </a>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">
            Competition Organization
          </p>

          <h2
            className={
              compact
                ? "mt-1 text-lg font-bold text-[#002144]"
                : "mt-2 text-xl font-bold text-[#002144]"
            }
          >
            {organization.name}
          </h2>

          {!compact && (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              {organization.description}
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
            <a
              href={organization.website}
              target="_blank"
              rel="noopener noreferrer"
              className="cursor-pointer text-sm font-bold text-[#861F41] hover:underline"
            >
              Official Website ↗
            </a>

            {showArchiveLink && (
              <Link
                href={`/competitions?organization=${organization.code}`}
                className="cursor-pointer text-sm font-bold text-[#002144] hover:underline"
              >
                Browse {organization.code} Results →
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
