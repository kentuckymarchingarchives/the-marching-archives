
export type ImportRow = {
  band_slug: string;
  classification: string | null;
  total_score: number | null;
  class_placement: number | null;
  overall_placement: number | null;
  notes: string | null;
};

export const CSV_HEADERS = [
  "band_slug",
  "classification",
  "total_score",
  "class_placement",
  "overall_placement",
  "notes",
] as const;

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  const source = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < source.length; i++) {
    const char = source[i];

    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          value += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        value += char;
      }
      continue;
    }

    if (char === '"') {
      if (value !== "") {
        throw new Error("Invalid quotation mark in CSV.");
      }
      quoted = true;
    } else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") {
        i++;
      }
      row.push(value);
      if (row.some((cell) => cell.trim() !== "")) {
        rows.push(row);
      }
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  if (quoted) {
    throw new Error("CSV contains an unclosed quote.");
  }

  row.push(value);

  if (row.some((cell) => cell.trim() !== "")) {
    rows.push(row);
  }

  return rows;
}

function numberOrNull(
  text: string,
  label: string,
  line: number,
  integer: boolean
): number | null {
  if (!text) return null;

  const pattern = integer
    ? /^\d+$/
    : /^\d+(?:\.\d{1,4})?$/;

  if (!pattern.test(text)) {
    throw new Error(
      `Line ${line}: invalid ${label}.`
    );
  }

  const value = Number(text);

  if (
    !Number.isSafeInteger(value) && integer ||
    !Number.isFinite(value) ||
    value > (integer ? 1000000 : 999999) ||
    (integer && value < 1)
  ) {
    throw new Error(
      `Line ${line}: invalid ${label}.`
    );
  }

  return value;
}

export function validateImportRows(
  input: unknown
): ImportRow[] {
  if (!Array.isArray(input) || input.length < 1 ||
      input.length > 100) {
    throw new Error("Import between 1 and 100 rows.");
  }

  const seen = new Set<string>();

  return input.map((value, index) => {
    const line = index + 2;

    if (!value || typeof value !== "object" ||
        Array.isArray(value)) {
      throw new Error(`Invalid row ${line}.`);
    }

    const obj = value as Record<string, unknown>;

    function stringField(name: string) {
      const v = obj[name];
      if (v === null || v === undefined) return "";
      if (typeof v !== "string") {
        throw new Error(`Line ${line}: invalid ${name}.`);
      }
      return v.trim();
    }

    const band_slug = stringField("band_slug");
    const classification =
      stringField("classification") || null;
    const notes = stringField("notes") || null;

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(band_slug) ||
        band_slug.length > 150) {
      throw new Error(
        `Line ${line}: invalid band slug.`
      );
    }

    if (seen.has(band_slug)) {
      throw new Error(
        `Line ${line}: duplicate band slug.`
      );
    }

    seen.add(band_slug);

    if (
      classification &&
      ![
        "1A", "2A", "3A", "4A", "5A",
        "World", "Open", "All-Age", "International",
      ].includes(classification)
    ) {
      throw new Error(
        `Line ${line}: invalid classification.`
      );
    }

    if (notes && notes.length > 5000) {
      throw new Error(
        `Line ${line}: notes are too long.`
      );
    }

    const readNumeric = (
      field: "total_score" |
        "class_placement" | "overall_placement",
      integer: boolean
    ) => {
      const raw = obj[field];
      if (raw === null || raw === undefined ||
          raw === "") return null;
      if (typeof raw !== "number" &&
          typeof raw !== "string") {
        throw new Error(
          `Line ${line}: invalid ${field}.`
        );
      }
      return numberOrNull(
        String(raw),
        field,
        line,
        integer
      );
    };

    return {
      band_slug,
      classification,
      total_score: readNumeric("total_score", false),
      class_placement: readNumeric(
        "class_placement", true
      ),
      overall_placement: readNumeric(
        "overall_placement", true
      ),
      notes,
    };
  });
}

export function readImportCSV(text: string): ImportRow[] {
  const rows = parseCSV(text);

  if (!rows.length) {
    throw new Error("The CSV file is empty.");
  }

  const header = rows[0].map(
    (cell) => cell.trim().toLowerCase()
  );

  if (
    header.length !== CSV_HEADERS.length ||
    !CSV_HEADERS.every((expected, index) =>
      header[index] === expected
    )
  ) {
    throw new Error(
      "CSV headers must be: " +
      CSV_HEADERS.join(",")
    );
  }

  const data = rows.slice(1).map((cells, index) => {
    if (cells.length !== CSV_HEADERS.length) {
      throw new Error(
        `Line ${index + 2}: expected six columns.`
      );
    }

    return Object.fromEntries(
      CSV_HEADERS.map((name, i) => [
        name,
        cells[i].trim(),
      ])
    );
  });

  return validateImportRows(data);
}
