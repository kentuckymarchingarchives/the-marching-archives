import EnsembleLogo from "@/components/EnsembleLogo";

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
    <EnsembleLogo
      name={name}
      src={imageUrl}
      size={size}
      className={className}
    />
  );
}
