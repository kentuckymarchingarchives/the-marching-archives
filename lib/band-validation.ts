
export type BandKind =
  | "marching_band"
  | "drum_corps"
  | "other";

export const BAND_KINDS = [
  {
    value: "marching_band",
    label: "Marching Band",
  },
  {
    value: "drum_corps",
    label: "Drum Corps",
  },
  {
    value: "other",
    label: "Other Ensemble",
  },
] as const;

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isBandKind(
  value: string
): value is BandKind {
  return BAND_KINDS.some(
    (kind) => kind.value === value
  );
}

export function validateBandFields(
  formData: FormData
) {
  const read = (key: string): string => {
    const value = formData.get(key);
    return typeof value === "string"
      ? value.trim()
      : "";
  };

  const name = read("name");
  const kind = read("kind");
  const city = read("city");
  const state = read("state");
  const country = read("country");
  const notes = read("notes");
  const competitiveStatus = read("competitive_status");

  if (name.length < 2 || name.length > 200) {
    throw new Error(
      "Band name must contain 2–200 characters."
    );
  }

  if (!isBandKind(kind)) {
    throw new Error("Choose a valid ensemble type.");
  }

  if (
    city.length > 120 ||
    state.length > 120 ||
    country.length < 2 ||
    country.length > 120 ||
    notes.length > 5000
  ) {
    throw new Error(
      "One or more band details are invalid."
    );
  }

  const allowedStatuses = [
    "active_competing",
    "active_noncompeting",
    "inactive",
    "unknown",
  ];

  if (!allowedStatuses.includes(competitiveStatus)) {
    throw new Error("Choose a valid band status.");
  }

  return {
    name,
    kind,
    city: city || null,
    state: state || null,
    country,
    notes: notes || null,
    competitive_status: competitiveStatus,
  };
}

export function validateHistoricalName(
  formData: FormData
) {
  const read = (key: string): string => {
    const value = formData.get(key);
    return typeof value === "string"
      ? value.trim()
      : "";
  };

  const historicalName = read("historical_name");
  const startRaw = read("start_year");
  const endRaw = read("end_year");

  if (
    historicalName.length < 2 ||
    historicalName.length > 200
  ) {
    throw new Error(
      "Historical name must contain 2–200 characters."
    );
  }

  function validYear(value: string): boolean {
    return (
      /^\d{4}$/.test(value) &&
      Number(value) >= 1800 &&
      Number(value) <= 2200
    );
  }

  if (
    (startRaw && !validYear(startRaw)) ||
    (endRaw && !validYear(endRaw))
  ) {
    throw new Error(
      "Enter a valid four-digit year."
    );
  }

  const startYear = startRaw
    ? Number(startRaw)
    : null;

  const endYear = endRaw
    ? Number(endRaw)
    : null;

  if (
    startYear !== null &&
    endYear !== null &&
    startYear > endYear
  ) {
    throw new Error(
      "Start year cannot be after end year."
    );
  }

  return {
    historical_name: historicalName,
    start_year: startYear,
    end_year: endYear,
  };
}
