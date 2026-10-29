"use client";

import { useEffect, useState } from "react";

type Props = {
  name: string;
  src: string | null | undefined;
  size?: "small" | "medium" | "large" | "profile";
  className?: string;
};

const sizes = {
  small: "h-10 w-10",
  medium: "h-16 w-16 sm:h-20 sm:w-20",
  large: "h-24 w-24",
  profile: "h-28 w-28 sm:h-36 sm:w-36",
};

export default function EnsembleLogo({ name, src, size = "medium", className = "" }: Props) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const showImage = Boolean(src && !failed);

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-2 ${sizes[size]} ${className}`}
    >
      {showImage ? (
        // An ordinary img permits a fallback for broken Supabase storage URLs.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src!}
          alt={`${name} logo`}
          loading={size === "profile" ? "eager" : "lazy"}
          onError={() => setFailed(true)}
          className="h-full w-full object-contain"
        />
      ) : (
        <span role="img" aria-label={`No logo available for ${name}`} className="flex flex-col items-center justify-center gap-1 text-center text-slate-400">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="h-5 w-5 sm:h-7 sm:w-7">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <circle cx="8" cy="9" r="1.5" />
            <path d="m4 17 5-5 3 3 3-3 5 5" />
            <path d="M4 4 20 20" />
          </svg>
          <span className="max-w-full text-[9px] font-semibold leading-tight sm:text-[10px]">No logo<br />available</span>
        </span>
      )}
    </div>
  );
}
