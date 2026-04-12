export interface CustomField {
  name: string;
  type: "text" | "number" | "formula";
  formula?: string; // e.g. "{sizeInches} * 25.4"
}

/** Parse a stored field that could be a plain string or a CustomField object */
export function parseField(raw: string | CustomField): CustomField {
  if (typeof raw === "object" && raw !== null) return raw;
  return { name: raw as string, type: "text" };
}
