
import Image from "next/image";

import {
  getOrganizationBrand,
} from "@/lib/organization-branding";

type Props = {
  code: string;
  size?: "small" | "medium";
  linked?: boolean;
};

export default function OrganizationMark({
  code,
  size = "medium",
  linked = false,
}: Props) {
  const organization = getOrganizationBrand(code);

  if (!organization) {
    return (
      <span className="inline-flex h-12 w-14 shrink-0 items-center justify-center rounded-lg bg-[#002144] px-2 text-xs font-bold text-white">
        {code}
      </span>
    );
  }

  const sizeClass =
    size === "small"
      ? "h-10 w-14"
      : "h-16 w-20";

  const content = (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-2 ${sizeClass}`}
    >
      <Image
        src={organization.logo}
        alt={`${organization.shortName} logo`}
        width={100}
        height={80}
        sizes={size === "small" ? "56px" : "80px"}
        className="h-full w-full object-contain"
      />
    </span>
  );

  if (!linked) {
    return content;
  }

  return (
    <a
      href={organization.website}
      target="_blank"
      rel="noopener noreferrer"
      title={`Visit ${organization.name}`}
      aria-label={`Visit the official ${organization.name} website`}
      className="inline-flex cursor-pointer rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#861F41]"
    >
      {content}
    </a>
  );
}
