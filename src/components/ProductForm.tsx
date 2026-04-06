"use client";

import { useEffect } from "react";
import { cn, inchesToMm } from "@/lib/utils";
import type { ProductCategory } from "@/types";
import {
  TAPE_TYPES,
  TAPE_CORES,
  JUMBO_TYPES,
  LABEL_TYPES,
  STICKER_TYPES,
  STATIONERY_TYPES,
  STATIONERY_PARTS,
} from "@/types";

interface ProductFormProps {
  productCategory: ProductCategory;
  productDetails: Record<string, string>;
  onChange: (details: Record<string, string>) => void;
  disabled?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Reusable field renderers                                          */
/* ------------------------------------------------------------------ */

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  type?: "text" | "number";
  placeholder?: string;
  readOnly?: boolean;
  optional?: boolean;
}

function InputField({
  label,
  value,
  onChange,
  disabled,
  type = "text",
  placeholder,
  readOnly,
  optional,
}: FieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
        {optional && (
          <span className="text-gray-400 font-normal ml-1">(optional)</span>
        )}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || readOnly}
        readOnly={readOnly}
        placeholder={placeholder}
        className={cn(
          "w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg",
          "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500",
          "placeholder:text-gray-400 transition-colors",
          (disabled || readOnly) && "bg-gray-50 text-gray-500 cursor-not-allowed"
        )}
      />
    </div>
  );
}

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  disabled?: boolean;
  placeholder?: string;
}

function SelectField({
  label,
  value,
  onChange,
  options,
  disabled,
  placeholder,
}: SelectFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn(
          "w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg appearance-none",
          "bg-white bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%236b7280%22%20d%3D%22M6%208L1%203h10z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_0.75rem_center]",
          "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500",
          "transition-colors",
          disabled && "bg-gray-50 text-gray-500 cursor-not-allowed"
        )}
      >
        <option value="">{placeholder || "Select..."}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Category-specific forms                                           */
/* ------------------------------------------------------------------ */

function BoppTapeForm({
  details,
  update,
  disabled,
}: {
  details: Record<string, string>;
  update: (key: string, value: string) => void;
  disabled: boolean;
}) {
  // Auto-calculate mm from inches
  useEffect(() => {
    const mm = inchesToMm(details.sizeInches || "");
    if (mm !== details.sizeMm) {
      update("sizeMm", mm);
    }
  }, [details.sizeInches]);

  const typeValue = (details.type || "").toLowerCase();
  const showPrintName = typeValue.includes("printed") || typeValue.includes("customized");

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <InputField
        label="Type"
        value={details.type || ""}
        onChange={(v) => update("type", v)}
        disabled={disabled}
        placeholder="e.g. Transparent, Brown, Printed"
      />
      {showPrintName && (
        <InputField
          label="Print/Design Name"
          value={details.printName || ""}
          onChange={(v) => update("printName", v)}
          disabled={disabled}
          placeholder="Enter print/design name"
        />
      )}
      <InputField
        label="Size (inches)"
        value={details.sizeInches || ""}
        onChange={(v) => update("sizeInches", v)}
        disabled={disabled}
        type="number"
        placeholder="e.g. 2"
      />
      <InputField
        label="Size (mm)"
        value={details.sizeMm || ""}
        onChange={() => {}}
        readOnly
        disabled={disabled}
      />
      <InputField
        label="Micron"
        value={details.micron || ""}
        onChange={(v) => update("micron", v)}
        disabled={disabled}
        type="number"
        placeholder="e.g. 40"
      />
      <InputField
        label="Length (m)"
        value={details.length || ""}
        onChange={(v) => update("length", v)}
        disabled={disabled}
        type="number"
        placeholder="e.g. 65"
      />
      <SelectField
        label="Core"
        value={details.core || ""}
        onChange={(v) => update("core", v)}
        options={TAPE_CORES}
        disabled={disabled}
      />
      <InputField
        label="Boxes"
        value={details.boxes || ""}
        onChange={(v) => update("boxes", v)}
        disabled={disabled}
        type="number"
        placeholder="e.g. 100"
      />
      <InputField
        label="Jumbo Code"
        value={details.jumboCode || ""}
        onChange={(v) => update("jumboCode", v)}
        disabled={disabled}
        placeholder="e.g. J-42-1280"
        optional
      />
    </div>
  );
}

function BoppJumboForm({
  details,
  update,
  disabled,
}: {
  details: Record<string, string>;
  update: (key: string, value: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <SelectField
        label="Type"
        value={details.type || ""}
        onChange={(v) => update("type", v)}
        options={JUMBO_TYPES}
        disabled={disabled}
      />
      <InputField
        label="Size (mm)"
        value={details.sizeMm || ""}
        onChange={(v) => update("sizeMm", v)}
        disabled={disabled}
        type="number"
        placeholder="e.g. 1280"
      />
      <InputField
        label="Micron"
        value={details.micron || ""}
        onChange={(v) => update("micron", v)}
        disabled={disabled}
        type="number"
        placeholder="e.g. 42"
      />
      <InputField
        label="Weight"
        value={details.weight || ""}
        onChange={(v) => update("weight", v)}
        disabled={disabled}
        type="number"
        placeholder="e.g. 20"
      />
      <InputField
        label="Meter/Roll"
        value={details.meterPerRoll || ""}
        onChange={(v) => update("meterPerRoll", v)}
        disabled={disabled}
        type="number"
        placeholder="e.g. 6000"
      />
      <InputField
        label="Quantity"
        value={details.quantity || ""}
        onChange={(v) => update("quantity", v)}
        disabled={disabled}
        type="number"
        placeholder="e.g. 10"
      />
    </div>
  );
}

function ThermalRollForm({
  details,
  update,
  disabled,
}: {
  details: Record<string, string>;
  update: (key: string, value: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <InputField
        label="Type"
        value={details.type || ""}
        onChange={(v) => update("type", v)}
        disabled={disabled}
        placeholder="e.g. Thermal"
      />
      <InputField
        label="Size"
        value={details.size || ""}
        onChange={(v) => update("size", v)}
        disabled={disabled}
        placeholder="e.g. 79mm x 50mm"
      />
      <InputField
        label="Meter"
        value={details.meter || ""}
        onChange={(v) => update("meter", v)}
        disabled={disabled}
        type="number"
        placeholder="e.g. 50"
      />
      <InputField
        label="GSM"
        value={details.gsm || ""}
        onChange={(v) => update("gsm", v)}
        disabled={disabled}
        type="number"
        placeholder="e.g. 55"
      />
      <InputField
        label="Boxes"
        value={details.boxes || ""}
        onChange={(v) => update("boxes", v)}
        disabled={disabled}
        type="number"
        placeholder="e.g. 50"
      />
    </div>
  );
}

function BarcodeLabelForm({
  details,
  update,
  disabled,
}: {
  details: Record<string, string>;
  update: (key: string, value: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <SelectField
        label="Type"
        value={details.type || ""}
        onChange={(v) => update("type", v)}
        options={LABEL_TYPES}
        disabled={disabled}
      />
      <SelectField
        label="Sticker"
        value={details.sticker || ""}
        onChange={(v) => update("sticker", v)}
        options={STICKER_TYPES}
        disabled={disabled}
      />
      <InputField
        label="Size"
        value={details.size || ""}
        onChange={(v) => update("size", v)}
        disabled={disabled}
        placeholder="e.g. 50mm x 25mm"
      />
      <InputField
        label="Sticker/Roll"
        value={details.stickerPerRoll || ""}
        onChange={(v) => update("stickerPerRoll", v)}
        disabled={disabled}
        type="number"
        placeholder="e.g. 1000"
        optional
      />
      <InputField
        label="Quantity"
        value={details.quantity || ""}
        onChange={(v) => update("quantity", v)}
        disabled={disabled}
        type="number"
        placeholder="e.g. 50"
      />
    </div>
  );
}

function ComputerStationeryForm({
  details,
  update,
  disabled,
}: {
  details: Record<string, string>;
  update: (key: string, value: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <SelectField
        label="Type"
        value={details.type || ""}
        onChange={(v) => update("type", v)}
        options={STATIONERY_TYPES}
        disabled={disabled}
      />
      {details.type === "Printed" && (
        <InputField
          label="Print Name"
          value={details.printName || ""}
          onChange={(v) => update("printName", v)}
          disabled={disabled}
          placeholder="Enter print name"
        />
      )}
      <InputField
        label="Size"
        value={details.size || ""}
        onChange={(v) => update("size", v)}
        disabled={disabled}
        placeholder="e.g. 12 x 10 x 3"
      />
      <InputField
        label="GSM"
        value={details.gsm || ""}
        onChange={(v) => update("gsm", v)}
        disabled={disabled}
        type="number"
        placeholder="e.g. 70"
      />
      <SelectField
        label="Part"
        value={details.part || ""}
        onChange={(v) => update("part", v)}
        options={STATIONERY_PARTS}
        disabled={disabled}
      />
      <InputField
        label="No. of Packets"
        value={details.packets || ""}
        onChange={(v) => update("packets", v)}
        disabled={disabled}
        type="number"
        placeholder="e.g. 100"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main ProductForm component                                         */
/* ------------------------------------------------------------------ */

export default function ProductForm({
  productCategory,
  productDetails,
  onChange,
  disabled = false,
}: ProductFormProps) {
  function update(key: string, value: string) {
    onChange({ ...productDetails, [key]: value });
  }

  if (!productCategory) {
    return (
      <div className="text-sm text-gray-500 py-8 text-center border-2 border-dashed border-gray-200 rounded-xl">
        Select a product category to see the form fields.
      </div>
    );
  }

  const formProps = { details: productDetails, update, disabled };

  switch (productCategory) {
    case "BOPP_TAPE":
      return <BoppTapeForm {...formProps} />;
    case "BOPP_JUMBO":
      return <BoppJumboForm {...formProps} />;
    case "THERMAL_ROLL":
      return <ThermalRollForm {...formProps} />;
    case "BARCODE_LABEL":
      return <BarcodeLabelForm {...formProps} />;
    case "COMPUTER_STATIONERY":
      return <ComputerStationeryForm {...formProps} />;
    default:
      return (
        <div className="text-sm text-red-500 py-4">
          Unknown product category: {productCategory}
        </div>
      );
  }
}
