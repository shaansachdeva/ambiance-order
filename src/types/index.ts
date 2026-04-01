// Product Categories
export type ProductCategory =
  | "BOPP_TAPE"
  | "BOPP_JUMBO"
  | "THERMAL_ROLL"
  | "BARCODE_LABEL"
  | "COMPUTER_STATIONERY";

export const PRODUCT_CATEGORIES: { value: ProductCategory; label: string }[] = [
  { value: "BOPP_TAPE", label: "BOPP Tape" },
  { value: "BOPP_JUMBO", label: "BOPP Jumbo" },
  { value: "THERMAL_ROLL", label: "Thermal Paper Roll" },
  { value: "BARCODE_LABEL", label: "Barcode Label" },
  { value: "COMPUTER_STATIONERY", label: "Computer Stationery" },
];

// Order Statuses
export type OrderStatus =
  | "ORDER_PLACED"
  | "CONFIRMED"
  | "IN_PRODUCTION"
  | "RAW_MATERIAL_NA"
  | "READY_FOR_DISPATCH"
  | "DISPATCHED";

export const ORDER_STATUSES: { value: OrderStatus; label: string; color: string }[] = [
  { value: "ORDER_PLACED", label: "Order Placed", color: "bg-blue-100 text-blue-800" },
  { value: "CONFIRMED", label: "Confirmed", color: "bg-purple-100 text-purple-800" },
  { value: "IN_PRODUCTION", label: "In Production", color: "bg-yellow-100 text-yellow-800" },
  { value: "RAW_MATERIAL_NA", label: "Raw Material N/A", color: "bg-red-100 text-red-800" },
  { value: "READY_FOR_DISPATCH", label: "Ready for Dispatch", color: "bg-green-100 text-green-800" },
  { value: "DISPATCHED", label: "Dispatched", color: "bg-gray-100 text-gray-800" },
];

// User Roles
export type UserRole = "ADMIN" | "SALES" | "PRODUCTION" | "DISPATCH" | "ACCOUNTANT";

export const USER_ROLES: { value: UserRole; label: string }[] = [
  { value: "ADMIN", label: "Admin" },
  { value: "SALES", label: "Sales / Order Entry" },
  { value: "PRODUCTION", label: "Production Supervisor" },
  { value: "DISPATCH", label: "Dispatch / Delivery" },
  { value: "ACCOUNTANT", label: "Accountant" },
];

// Production Stages
export const PRODUCTION_STAGES = [
  { key: "printing", label: "Printing" },
  { key: "coating", label: "Coating" },
  { key: "slitting", label: "Slitting" },
];

// BOPP Tape specific types
export const TAPE_TYPES = ["Transparent", "Brown", "Printed"];
export const TAPE_CORES = ["PAKZY3S", "WONDER", "WONDER MOTI"];

// BOPP Jumbo specific types
export const JUMBO_TYPES = ["Transparent", "Brown", "Coloured", "Printed"];

// Barcode Label types
export const LABEL_TYPES = ["Plain", "Printed"];
export const STICKER_TYPES = ["Chromo", "Polyester", "Direct Thermal"];

// Computer Stationery types
export const STATIONERY_TYPES = ["Plain", "Printed"];
export const STATIONERY_PARTS = ["Single Part", "Two Part", "Three Part"];

// Product Details Interfaces
export interface BoppTapeDetails {
  type: string;
  printName?: string;
  sizeInches: string;
  sizeMm: string;
  micron: string;
  length: string;
  core: string;
  boxes: string;
}

export interface BoppJumboDetails {
  type: string;
  sizeMm: string;
  micron: string;
  weight: string;
  meterPerRoll: string;
  quantity: string;
}

export interface ThermalRollDetails {
  type: string;
  size: string;
  meter: string;
  gsm: string;
  boxes: string;
}

export interface BarcodeLabelDetails {
  type: string;
  sticker: string;
  size: string;
  stickerPerRoll?: string;
  quantity: string;
}

export interface ComputerStationeryDetails {
  type: string;
  printName?: string;
  size: string;
  gsm: string;
  part: string;
  packets: string;
}

export type ProductDetails =
  | BoppTapeDetails
  | BoppJumboDetails
  | ThermalRollDetails
  | BarcodeLabelDetails
  | ComputerStationeryDetails;

// Role-based permissions
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  ADMIN: ["create_order", "view_order", "view_party", "update_status", "update_order", "manage_users", "update_challan", "view_dashboard"],
  SALES: ["create_order", "view_order", "view_party", "view_dashboard"],
  PRODUCTION: ["view_order", "update_status", "update_jumbo_code", "view_dashboard"],
  DISPATCH: ["view_order", "update_status", "update_challan", "view_dashboard"],
  ACCOUNTANT: ["view_order", "view_party", "update_order", "update_challan", "view_dashboard"],
};
