
export type OrganizationCode =
  | "KMEA"
  | "MSBA"
  | "BOA"
  | "DCI";

export type OrganizationBrand = {
  code: OrganizationCode;
  name: string;
  shortName: string;
  description: string;
  logo: string;
  website: string;
};

export const ORGANIZATION_BRANDING: Record<
  OrganizationCode,
  OrganizationBrand
> = {
  KMEA: {
    code: "KMEA",
    name: "Kentucky Music Educators Association",
    shortName: "KMEA",
    description:
      "Kentucky music education organization associated with the state's marching band championship program.",
    logo: "/organizations/kmea.png",
    website: "https://www.kmea.org/",
  },

  MSBA: {
    code: "MSBA",
    name: "Mid States Band Association",
    shortName: "MSBA",
    description:
      "Regional marching band competition circuit serving ensembles across Ohio, Kentucky, and Indiana.",
    logo: "/organizations/msba.png",
    website: "https://www.midstatesba.org/",
  },

  BOA: {
    code: "BOA",
    name: "Bands of America",
    shortName: "BOA",
    description:
      "Music for All's national marching band championships, including regional, super regional, and Grand National events.",
    logo: "/organizations/boa.png",
    website: "https://marching.musicforall.org/",
  },

  DCI: {
    code: "DCI",
    name: "Drum Corps International",
    shortName: "DCI",
    description:
      "Marching music organization known for its drum corps competitions and World Championships.",
    logo: "/organizations/dci.png",
    website: "https://www.dci.org/",
  },
};

export const ORGANIZATION_LIST: OrganizationBrand[] = [
  ORGANIZATION_BRANDING.KMEA,
  ORGANIZATION_BRANDING.MSBA,
  ORGANIZATION_BRANDING.BOA,
  ORGANIZATION_BRANDING.DCI,
];

export function getOrganizationBrand(
  value: string | null | undefined
): OrganizationBrand | null {
  if (!value) return null;

  const code = value.trim().toUpperCase();

  if (
    code === "KMEA" ||
    code === "MSBA" ||
    code === "BOA" ||
    code === "DCI"
  ) {
    return ORGANIZATION_BRANDING[code];
  }

  return null;
}
