
type Props = {
  name: string;
  logoPath: string | null | undefined;
  bandId: string;
  supabaseUrl: string;
  size?: "small" | "medium" | "large";
  className?: string;
};

const sizes = {
  small: "h-10 w-10",
  medium: "h-16 w-16",
  large: "h-24 w-24",
};

export default function BandLogo({
  name,
  logoPath,
  bandId,
  supabaseUrl,
  size = "small",
  className = "",
}: Props) {
  const validPath =
    Boolean(logoPath) &&
    new RegExp(
      `^bands/${bandId}/[0-9a-f-]+\\.(png|jpg|webp)$`,
      "i"
    ).test(logoPath ?? "");

  const base = supabaseUrl.replace(/\/$/, "");

  const imageUrl =
    validPath && logoPath
      ? `${base}/storage/v1/object/public/band-logos/${logoPath}`
      : null;

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white p-1.5 ${sizes[size]} ${className}`}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={`${name} logo`}
          loading="lazy"
          className="h-full w-full object-contain"
        />
      ) : (
        <svg
          viewBox="0 0 48 48"
          aria-hidden="true"
          className="h-1/2 w-1/2 text-slate-300"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="5" y="7" width="38" height="34" rx="5" />
          <circle cx="17" cy="18" r="4" />
          <path d="m9 35 11-11 7 7 5-5 7 9" />
        </svg>
      )}
    </span>
  );
}
