import { ROLE_PERMISSIONS, UserRole } from "@/types";

export function hasPermission(role: UserRole, permission: string): boolean {
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
  return labels[category] || category;
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
