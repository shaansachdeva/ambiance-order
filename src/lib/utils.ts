import { ROLE_PERMISSIONS, UserRole } from "@/types";

export function hasPermission(
  role: UserRole,
  permission: string,
  customPermissions: string[] | null = null
): boolean {
  // If custom permissions are set, they override role-based permissions
  // Mapping of action permissions to feature keys for custom permission check
  const actionToFeature: Record<string, string> = {
    "create_order": "nav.newOrder",
    "view_order": "nav.orders",
    "update_status": "nav.production",
    "view_party": "nav.parties",
    "manage_users": "nav.settings",
    "view_dashboard": "nav.dashboard",
    "view_reports": "nav.reports",
  };

  const featureKey = actionToFeature[permission];
  if (customPermissions !== null && featureKey) {
    return customPermissions.includes(featureKey);
  }

  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function formatOrderId(num: number): string {
  return `ORD-${String(num).padStart(4, "0")}`;
}

export function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getProductCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    BOPP_TAPE: "BOPP Tape",
    BOPP_JUMBO: "BOPP Jumbo",
    THERMAL_ROLL: "Thermal Paper Roll",
    BARCODE_LABEL: "Barcode Label",
    COMPUTER_STATIONERY: "Computer Stationery",
  };
  if (labels[category]) return labels[category];
  // Custom product — humanize an internal-style key (e.g. "KRAFT_TAPE" → "Kraft Tape").
  // Existing user-friendly names (e.g. "Kraft Tape") pass through unchanged.
  return category
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/**
 * Pull the quantity value out of an item's product details.
 * Built-in categories use specific keys (BOPP_TAPE → boxes, BARCODE_LABEL → quantity, etc.).
 * Custom categories use a fuzzy match: any field whose name looks like quantity/qty/boxes/packets/rolls.
 */
const BUILTIN_QUANTITY_KEYS: Record<string, string> = {
  BOPP_TAPE: "boxes",
  BOPP_JUMBO: "quantity",
  THERMAL_ROLL: "boxes",
  BARCODE_LABEL: "quantity",
  COMPUTER_STATIONERY: "packets",
};

const QTY_FIELD_PATTERNS = [
  /^qty$/i,
  /^quantity$/i,
  /^boxes?$/i,
  /^packets?$/i,
  /^rolls?$/i,
  /^cartons?$/i,
  /\bqty\b/i,
  /\bquantity\b/i,
];

export function extractQuantity(category: string, details: Record<string, any> | null | undefined): { value: string; key: string } {
  if (!details || typeof details !== "object") return { value: "", key: "" };
  const builtinKey = BUILTIN_QUANTITY_KEYS[category];
  if (builtinKey && details[builtinKey] != null && String(details[builtinKey]).trim() !== "") {
    return { value: String(details[builtinKey]), key: builtinKey };
  }
  // Fuzzy: scan keys for the first one that looks like a quantity.
  for (const k of Object.keys(details)) {
    if (details[k] == null || String(details[k]).trim() === "") continue;
    if (QTY_FIELD_PATTERNS.some((p) => p.test(k))) {
      return { value: String(details[k]), key: k };
    }
  }
  return { value: "", key: "" };
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    ORDER_PLACED: "Order Placed",
    CONFIRMED: "Confirmed",
    IN_PRODUCTION: "In Production",
    RAW_MATERIAL_NA: "Raw Material N/A",
    READY_FOR_DISPATCH: "Ready for Dispatch",
    DISPATCHED: "Dispatched",
  };
  return labels[status] || status;
}

export function inchesToMm(inches: string): string {
  const num = parseFloat(inches);
  if (isNaN(num)) return "";
  return String(num * 24);
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function safeParseJSON(value: unknown, fallback: Record<string, any> = {}): Record<string, any> {
  if (!value) return fallback;
  if (typeof value === "object") return value as Record<string, any>;
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch { return fallback; }
  }
  return fallback;
}
