export interface CustomField {
  name: string;
  type: "text" | "number" | "formula" | "quantity";
  formula?: string; // for type "formula" — e.g. "{sizeInches} * 25.4"
  unit?: string;    // for type "quantity" — e.g. "Box", "Roll", "Pcs", "Kg", "Meter"
}

/** Preset units admins can pick from when defining a quantity field */
export const QTY_UNIT_PRESETS = [
  "Box",
  "Roll",
  "Pcs",
  "Packet",
  "Kg",
  "Meter",
  "Bundle",
  "Carton",
] as const;

/** Parse a stored field that could be a plain string or a CustomField object */
export function parseField(raw: string | CustomField): CustomField {
  if (typeof raw === "object" && raw !== null) return raw;
  return { name: raw as string, type: "text" };
}
