
export const ORGANIZATIONS = [
  { value: "KMEA", label: "KMEA" },
  { value: "MSBA", label: "MSBA" },
  { value: "BOA", label: "Bands of America" },
  { value: "DCI", label: "Drum Corps International" },
] as const;

export const COMPETITION_TYPES: Record<
  string,
  { value: string; label: string }[]
> = {
  KMEA: [
    { value: "regular_season", label: "Regular Season" },
    { value: "smbc", label: "State Marching Band Championships" },
  ],
  MSBA: [
    { value: "regular_season", label: "Regular Season" },
    { value: "championships", label: "Championships" },
  ],
  BOA: [
    { value: "regional", label: "Regional" },
    { value: "super_regional", label: "Super Regional" },
    { value: "grand_nationals", label: "Grand Nationals" },
  ],
  DCI: [
    { value: "regular_competition", label: "Regular Competition" },
    { value: "world_championship", label: "World Championship" },
  ],
};

export const COMPETITION_FORMATS = [
  { value: "single_show", label: "Single Show" },
  { value: "prelims_finals", label: "Prelims / Finals" },
  {
    value: "prelims_semis_finals",
    label: "Prelims / Semifinals / Finals",
  },
  { value: "class_specific", label: "Class-Specific Rounds" },
  { value: "custom", label: "Custom / Historical Exception" },
] as const;

export const SMBC_STAGES = [
  {
    value: "regionals_quarterfinals",
    label: "Regionals / Quarterfinals",
  },
  { value: "semifinals", label: "Semifinals" },
  { value: "finals", label: "Finals" },
  {
    value: "semifinals_finals",
    label: "Combined Semifinals & Finals Event",
  },
] as const;

export const ROUND_KINDS = [
  { value: "single_show", label: "Single Show" },
  {
    value: "regionals_quarterfinals",
    label: "Regionals / Quarterfinals",
  },
  { value: "prelims", label: "Prelims" },
  { value: "semifinals", label: "Semifinals" },
  { value: "finals", label: "Finals" },
  { value: "custom", label: "Custom" },
] as const;

export type RoundKind =
  (typeof ROUND_KINDS)[number]["value"];

export type RoundTemplate = {
  name: string;
  round_kind: RoundKind;
  class_scope: string | null;
  sort_order: number;
};

export function allowedFormats(
  organization: string,
  type: string
): string[] {
  if (organization === "KMEA") {
    return type === "smbc"
      ? ["single_show", "custom"]
      : ["single_show", "prelims_finals", "custom"];
  }

  if (organization === "MSBA") {
    return type === "championships"
      ? ["prelims_finals", "custom"]
      : ["single_show", "prelims_finals", "custom"];
  }

  if (organization === "BOA") {
    return type === "grand_nationals"
      ? ["prelims_semis_finals", "custom"]
      : ["prelims_finals", "custom"];
  }

  if (organization === "DCI") {
    return type === "world_championship"
      ? ["class_specific", "custom"]
      : [
          "single_show",
          "prelims_finals",
          "prelims_semis_finals",
          "custom",
        ];
  }

  return [];
}

export function defaultFormat(
  organization: string,
  type: string
): string {
  if (type === "world_championship") {
    return "class_specific";
  }
  if (type === "grand_nationals") {
    return "prelims_semis_finals";
  }
  if (
    type === "championships" ||
    type === "regional" ||
    type === "super_regional"
  ) {
    return "prelims_finals";
  }
  return "single_show";
}

export function organizationClasses(
  organization: string
): string[] {
  if (organization === "KMEA" || organization === "MSBA") {
    return ["1A", "2A", "3A", "4A", "5A"];
  }
  if (organization === "BOA") {
    return ["1A", "2A", "3A", "4A"];
  }
  if (organization === "DCI") {
    return ["World", "Open", "All-Age", "International"];
  }
  return [];
}

export function makeRoundTemplates(
  organization: string,
  type: string,
  format: string,
  stage: string | null
): RoundTemplate[] {
  const rounds: Omit<RoundTemplate, "sort_order">[] = [];

  const add = (
    name: string,
    kind: RoundKind,
    scope: string | null = null
  ) => {
    rounds.push({
      name,
      round_kind: kind,
      class_scope: scope,
    });
  };

  if (organization === "KMEA" && type === "smbc") {
    switch (stage) {
      case "regionals_quarterfinals":
        add("Regionals / Quarterfinals", "regionals_quarterfinals");
        break;
      case "semifinals":
        add("Semifinals", "semifinals");
        break;
      case "finals":
        add("Finals", "finals");
        break;
      case "semifinals_finals":
        add("Semifinals", "semifinals");
        add("Finals", "finals");
        break;
    }
  } else if (
    organization === "DCI" &&
    type === "world_championship" &&
    format === "class_specific"
  ) {
    // Each class has its own scoring rounds.
    for (const kind of ["prelims", "semifinals", "finals"] as const) {
      add(`World Class ${capitalize(kind)}`, kind, "World");
    }

    for (const scope of ["Open", "All-Age"]) {
      for (const kind of ["prelims", "finals"] as const) {
        add(`${scope} ${capitalize(kind)}`, kind, scope);
      }
    }

    // International rounds can be added manually once verified.
  } else if (format === "single_show") {
    add("Single Show", "single_show");
  } else if (format === "prelims_finals") {
    add("Prelims", "prelims");
    add("Finals", "finals");
  } else if (format === "prelims_semis_finals") {
    add("Prelims", "prelims");
    add("Semifinals", "semifinals");
    add("Finals", "finals");
  }

  // Custom format starts with no rounds.
  // Staff can add historically accurate rounds manually.

  return rounds.map((round, index) => ({
    ...round,
    sort_order: index + 1,
  }));
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function readableLabel(
  value: string | null | undefined
): string {
  if (!value) return "Not specified";

  const all = [
    ...ORGANIZATIONS,
    ...COMPETITION_FORMATS,
    ...SMBC_STAGES,
    ...ROUND_KINDS,
    ...Object.values(COMPETITION_TYPES).flat(),
  ];

  return all.find((item) => item.value === value)?.label ??
    value.replaceAll("_", " ");
}
