"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Barcode, Plus, Trash2, Printer, ChevronDown, ChevronUp,
  X, Bookmark, BookmarkCheck, Image as ImageIcon, RotateCcw,
  Palette, Type, Minus, Square, RotateCw, Move, AlignLeft, AlignCenter, AlignRight,
  Bold, Italic, Underline, SeparatorHorizontal, Pencil, Copy, Loader2, Search, ClipboardPaste,
  Building2,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import { convertAutoLayoutToDesignerDoc } from "@/lib/autoLayoutToDesigner";
import {
  DesignerLabelPreview, collectFieldNames, toMM,
  type LabelDoc,
} from "@/components/DesignerLabelPreview";
import {
  LabelPreview, getAutoBarcode, getProductName,
  DEFAULT_DESIGN,
  type LabelField, type DesignLine, type LabelDesign, type LabelTemplate,
} from "@/components/LabelPreviewRenderer";

// ─── Constants ────────────────────────────────────────────────────────────────
const FORMATS = [
  { value: "CODE128", label: "CODE 128 (Universal)" },
  { value: "CODE39",  label: "CODE 39" },
  { value: "EAN13",   label: "EAN-13 (13 digits)" },
  { value: "EAN8",    label: "EAN-8 (8 digits)" },
  { value: "UPC",     label: "UPC-A (12 digits)" },
  { value: "ITF14",   label: "ITF-14 (14 digits)" },
  { value: "QRCODE",  label: "QR Code (2D)" },
];

// Types, DEFAULT_DESIGN, PREVIEW_W, computeSizes, getAutoBarcode, getProductName,
// BarcodeSVG, LabelPreview are all imported from @/components/LabelPreviewRenderer

const FONT_OPTIONS = [
  "Arial, sans-serif",
  "'Times New Roman', serif",
  "'Courier New', monospace",
  "Georgia, serif",
  "Verdana, sans-serif",
  "Tahoma, sans-serif",
  "'Trebuchet MS', sans-serif",
  "Impact, sans-serif",
];

interface SavedTemplate {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  topMarginMm: number;
  bottomMarginMm: number;
  leftMarginMm: number;
  rightMarginMm: number;
  fields: { heading: string }[];
  barcodeFormat: string;
  showBarcode: boolean;
  logoPosition: "top" | "bottom" | "none";
  logoHeightMm: number;
  fontScale: number;
  showBorder: boolean;
  rotated: boolean;
  design: LabelDesign; // full design: font, alignment, decorative lines, mode
  logoDataUrl?: string; // base64 logo if uploaded
  labelsAcross?: number;
  labelGapMm?: number;
}

const STORAGE_KEY = "ambiance_label_tpl_v5";

// ─── Defaults ─────────────────────────────────────────────────────────────────
// A fresh template starts at all-zero values with no pre-filled fields. The
// user picks a size, adds the fields they need, configures the barcode, etc.

// Common thermal label media sizes (industry standard). Picking one of these
// sets only width × height — it does NOT touch fields, design, or content.
// "Custom" stays implicit: if the user types numbers that don't match any of
// these, no chip is highlighted.
const SIZE_PRESETS: { label: string; w: number; h: number }[] = [
  { label: "25 × 15",   w: 25,  h: 15  },
  { label: "40 × 25",   w: 40,  h: 25  },
  { label: "50 × 25",   w: 50,  h: 25  },
  { label: "50 × 30",   w: 50,  h: 30  },
  { label: "75 × 50",   w: 75,  h: 50  },
  { label: "100 × 50",  w: 100, h: 50  },
  { label: "100 × 75",  w: 100, h: 75  },
  { label: "100 × 100", w: 100, h: 100 },
  { label: "100 × 150", w: 100, h: 150 },
  { label: "100 × 200", w: 100, h: 200 },
];

let _ctr = 0;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fieldsFromHeadings(hs: { heading: string }[], seed: string): LabelField[] {
  return hs.map((h, i) => ({ id: `f-${seed}-${i}`, heading: h.heading, value: "" }));
}

function makeLabel(saved?: SavedTemplate): LabelTemplate {
  const cid = `lbl-${++_ctr}`;
  if (saved) {
    return {
      id: cid, name: saved.name,
      widthMm: saved.widthMm, heightMm: saved.heightMm,
      topMarginMm: saved.topMarginMm, bottomMarginMm: saved.bottomMarginMm,
      leftMarginMm: saved.leftMarginMm ?? 0, rightMarginMm: saved.rightMarginMm ?? 0,
      // Restore per-field styling (highlight/hidden/bold/scale) when the saved
      // template captured them. Values themselves are always reset to empty.
      fields: saved.fields.map((f: any, i: number) => ({
        id: `f-${cid}-${i}`,
        heading: f.heading,
        value: "",
        ...(f.highlight ? { highlight: true } : {}),
        ...(f.bold ? { bold: true } : {}),
        ...(f.hidden ? { hidden: true } : {}),
        ...(f.scale ? { scale: f.scale } : {}),
        ...(f.freePos ? {
          freePos: true,
          posX: f.posX, posY: f.posY, posW: f.posW, posH: f.posH, posRot: f.posRot,
          ...(f.stackLines ? { stackLines: true } : {}),
          ...(f.textAlign ? { textAlign: f.textAlign } : {}),
        } : {}),
      })),
      barcodeFormat: saved.barcodeFormat, barcodeValue: "", barcodeAuto: true,
      showBarcode: saved.showBarcode ?? true, copies: 1,
      logoDataUrl: saved.logoDataUrl ?? "", logoPosition: saved.logoPosition ?? "none",
      logoHeightMm: saved.logoHeightMm ?? 10, fontScale: saved.fontScale ?? 1,
      showBorder: saved.showBorder ?? true, rotated: saved.rotated ?? false,
      design: saved.design ? { ...DEFAULT_DESIGN, ...saved.design } : { ...DEFAULT_DESIGN },
      labelsAcross: saved.labelsAcross ?? 1,
      labelGapMm: saved.labelGapMm ?? 3,
      barcodeHeightScale: (saved as any).barcodeHeightScale ?? 1,
      barcodeWidthScale: (saved as any).barcodeWidthScale ?? 1,
      barcodeFree: (saved as any).barcodeFree ?? false,
      barcodeX: (saved as any).barcodeX,
      barcodeY: (saved as any).barcodeY,
      barcodeW: (saved as any).barcodeW,
      barcodeH: (saved as any).barcodeH,
      barcodeRot: (saved as any).barcodeRot,
      contentTopReserveMm: (saved as any).contentTopReserveMm ?? 0,
      contentBottomReserveMm: (saved as any).contentBottomReserveMm ?? 0,
      productNameDivider: (saved as any).productNameDivider ?? true,
      productNameGapMm: (saved as any).productNameGapMm ?? 0,
      manufacturedBy: (saved as any).manufacturedBy ?? "",
      manufacturedAddress: (saved as any).manufacturedAddress ?? "",
      manufacturedEmail: (saved as any).manufacturedEmail ?? "",
      sourceTemplateId: saved.id,
    };
  }
  return {
    // Truly blank canvas — every numeric default is 0 so the user explicitly
    // chooses dimensions, margins, copies, etc. No pre-filled fields either.
    id: cid, name: "Untitled Label",
    widthMm: 0, heightMm: 0,
    topMarginMm: 0, bottomMarginMm: 0, leftMarginMm: 0, rightMarginMm: 0,
    fields: [],
    barcodeFormat: "CODE128", barcodeValue: "", barcodeAuto: true,
    showBarcode: true, copies: 0, logoDataUrl: "", logoPosition: "none",
    logoHeightMm: 0, fontScale: 1, showBorder: true, rotated: false,
    design: { ...DEFAULT_DESIGN },
    labelsAcross: 1, // must stay ≥ 1 — divide-by-zero risk in row math otherwise
    labelGapMm: 0,
  };
}


// ─── Design Tab ───────────────────────────────────────────────────────────────
function DesignTab({ lbl, onUpdate }: { lbl: LabelTemplate; onUpdate: (patch: Partial<LabelTemplate>) => void }) {
  const d = lbl.design;
  const upD = (patch: Partial<LabelDesign>) => onUpdate({ design: { ...d, ...patch } });

  const addLine = () => upD({
    lines: [...d.lines, { id: `ln-${Date.now()}`, xPercent: 50, yPercent: 50, lengthPercent: 100, thickness: 1, color: "#000000", style: "solid" }]
  });
  const updLine = (id: string, patch: Partial<DesignLine>) =>
    upD({ lines: d.lines.map(l => l.id === id ? { ...l, ...patch } : l) });
  const delLine = (id: string) => upD({ lines: d.lines.filter(l => l.id !== id) });

  const sectionCls = "rounded-lg border border-gray-200 bg-white p-3 space-y-2.5";
  const labelCls   = "text-[11px] uppercase tracking-wider font-bold text-gray-500 flex items-center gap-1.5";
  const btnCls     = (active: boolean) =>
    `p-1.5 rounded-md border transition-colors ${active ? "bg-gray-900 border-gray-900 text-white" : "bg-white border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700"}`;

  return (
    <div className="space-y-4">

      {/* ── Font Family ── */}
      <div className={sectionCls}>
        <p className={labelCls}><Type className="w-3.5 h-3.5" /> Font Family</p>
        <select value={d.fontFamily} onChange={e => upD({ fontFamily: e.target.value })}
          className="w-full px-2.5 py-2 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500">
          {FONT_OPTIONS.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f.split(",")[0].replace(/'/g,"")}</option>)}
        </select>
      </div>

      {/* ── Heading Style ── */}
      <div className={sectionCls}>
        <p className={labelCls}><Palette className="w-3.5 h-3.5" /> Heading Style</p>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[10px] text-gray-400">Align:</span>
          <button className={btnCls(d.headingAlign === "left")}   onClick={() => upD({ headingAlign: "left" })}><AlignLeft className="w-3.5 h-3.5" /></button>
          <button className={btnCls(d.headingAlign === "center")} onClick={() => upD({ headingAlign: "center" })}><AlignCenter className="w-3.5 h-3.5" /></button>
          <button className={btnCls(d.headingAlign === "right")}  onClick={() => upD({ headingAlign: "right" })}><AlignRight className="w-3.5 h-3.5" /></button>
          <span className="text-[10px] text-gray-400 ml-2">Style:</span>
          <button className={btnCls(d.headingBold)}      onClick={() => upD({ headingBold: !d.headingBold })}><Bold className="w-3.5 h-3.5" /></button>
          <button className={btnCls(d.headingItalic)}    onClick={() => upD({ headingItalic: !d.headingItalic })}><Italic className="w-3.5 h-3.5" /></button>
          <button className={btnCls(d.headingUnderline)} onClick={() => upD({ headingUnderline: !d.headingUnderline })}><Underline className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {/* ── Body Style ── */}
      <div className={sectionCls}>
        <p className={labelCls}><AlignLeft className="w-3.5 h-3.5" /> Body Row Style</p>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[10px] text-gray-400">Align:</span>
          <button className={btnCls(d.bodyAlign === "left")}   onClick={() => upD({ bodyAlign: "left" })}><AlignLeft className="w-3.5 h-3.5" /></button>
          <button className={btnCls(d.bodyAlign === "center")} onClick={() => upD({ bodyAlign: "center" })}><AlignCenter className="w-3.5 h-3.5" /></button>
          <button className={btnCls(d.bodyAlign === "right")}  onClick={() => upD({ bodyAlign: "right" })}><AlignRight className="w-3.5 h-3.5" /></button>
          <span className="text-[10px] text-gray-400 ml-2">Bold values:</span>
          <button className={btnCls(d.bodyBold)} onClick={() => upD({ bodyBold: !d.bodyBold })}><Bold className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {/* ── Border ── */}
      <div className={sectionCls}>
        <div className="flex items-center justify-between">
          <p className={labelCls}><Square className="w-3.5 h-3.5" /> Outer Border</p>
          <label className="inline-flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
            <input type="checkbox" checked={lbl.showBorder}
              onChange={(e) => onUpdate({ showBorder: e.target.checked })}
              className="w-3.5 h-3.5 accent-brand-500" />
            <span>{lbl.showBorder ? "Visible (2 px black)" : "Hidden"}</span>
          </label>
        </div>
      </div>

      {/* ── Product Name Spacing ── */}
      <div className={sectionCls}>
        <div className="flex items-center justify-between">
          <p className={labelCls}><Minus className="w-3.5 h-3.5" /> Product Name</p>
          <label className="inline-flex items-center gap-2 text-[11px] text-gray-600 cursor-pointer">
            <input type="checkbox"
              checked={lbl.productNameDivider ?? true}
              onChange={(e) => onUpdate({ productNameDivider: e.target.checked })}
              className="w-3.5 h-3.5 accent-brand-500" />
            <span>Underline</span>
          </label>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[11px] text-gray-600 font-semibold">Gap below (mm)</label>
            <span className="text-[10px] font-medium text-gray-700 tabular-nums">{lbl.productNameGapMm ?? 0}</span>
          </div>
          <input type="range" min={0} max={20} step={1}
            value={lbl.productNameGapMm ?? 0}
            onChange={(e) => onUpdate({ productNameGapMm: parseInt(e.target.value) })}
            className="w-full accent-gray-900" />
          <p className="text-[10px] text-gray-400 mt-0.5">
            Adds space between the product name and the first field row.
          </p>
        </div>
      </div>

      {/* ── Barcode ── */}
      <div className={sectionCls}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className={labelCls}><Barcode className="w-3.5 h-3.5" /> Barcode</p>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
              <input type="checkbox" checked={lbl.showBarcode}
                onChange={(e) => onUpdate({ showBarcode: e.target.checked })}
                className="w-3.5 h-3.5 accent-brand-500" />
              Show
            </label>
            <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
              <input type="checkbox" checked={lbl.barcodeAuto}
                onChange={(e) => onUpdate({
                  barcodeAuto: e.target.checked,
                  barcodeValue: e.target.checked ? getAutoBarcode(lbl.fields) : lbl.barcodeValue,
                })}
                className="w-3.5 h-3.5 accent-brand-500" />
              Auto from Product Code
            </label>
          </div>
        </div>
        {lbl.showBarcode && (
          <>
            <div className="flex gap-2">
              <input
                type="text"
                value={lbl.barcodeAuto ? getAutoBarcode(lbl.fields) : lbl.barcodeValue}
                disabled={lbl.barcodeAuto}
                onChange={(e) => onUpdate({ barcodeValue: e.target.value })}
                placeholder={lbl.barcodeAuto ? "Auto from Product Code field" : "Enter barcode value"}
                className="flex-1 px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-100 disabled:text-gray-400 font-mono"
              />
              <select
                value={lbl.barcodeFormat}
                onChange={(e) => onUpdate({ barcodeFormat: e.target.value })}
                className="w-36 px-2 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {FORMATS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>

            {/* Default-position sizing — height + container width */}
            {!lbl.barcodeFree && (
              <div className="grid grid-cols-2 gap-3 mt-1">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-gray-600">Height</label>
                    <span className="text-[10px] font-medium text-gray-700 tabular-nums">{Math.round((lbl.barcodeHeightScale ?? 1) * 100)}%</span>
                  </div>
                  <input type="range" min={20} max={150} step={5}
                    value={Math.round((lbl.barcodeHeightScale ?? 1) * 100)}
                    onChange={(e) => onUpdate({ barcodeHeightScale: parseInt(e.target.value) / 100 })}
                    className="w-full accent-gray-900" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-gray-600">Width</label>
                    <span className="text-[10px] font-medium text-gray-700 tabular-nums">{Math.round((lbl.barcodeWidthScale ?? 1) * 100)}%</span>
                  </div>
                  <input type="range" min={30} max={100} step={5}
                    value={Math.round((lbl.barcodeWidthScale ?? 1) * 100)}
                    onChange={(e) => onUpdate({ barcodeWidthScale: parseInt(e.target.value) / 100 })}
                    className="w-full accent-gray-900" />
                </div>
              </div>
            )}

            {/* Place freely — unlocks X/Y/Width/Height/Rotation controls */}
            <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mt-1">
              <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!lbl.barcodeFree}
                  onChange={(e) =>
                    onUpdate({
                      barcodeFree: e.target.checked,
                      // Seed sensible defaults when first enabling
                      ...(e.target.checked && lbl.barcodeX === undefined
                        ? {
                            barcodeX: 10, barcodeY: 60, barcodeW: 80, barcodeH: 20, barcodeRot: 0,
                            // Also reserve space at the bottom so text doesn't overlap.
                            ...((lbl.contentBottomReserveMm ?? 0) === 0
                              ? { contentBottomReserveMm: Math.round(lbl.heightMm * 0.35) }
                              : {}),
                          }
                        : {}),
                    })
                  }
                  className="w-3.5 h-3.5 accent-gray-900"
                />
                Place barcode freely
              </label>
              <span className="text-[10px] text-gray-400">drag-positioning via sliders</span>
            </div>

            {/* Reserve text-area space — pushes auto-layout fields away so they
                don't collide with a free-positioned barcode (or just to leave breathing room). */}
            {lbl.barcodeFree && (
              <div className="border border-gray-200 rounded-lg bg-white p-3 space-y-2">
                <p className="text-[11px] font-semibold text-gray-600">Reserve text space</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] text-gray-500">Top (mm)</label>
                      <span className="text-[10px] text-gray-700 tabular-nums">{lbl.contentTopReserveMm ?? 0}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={Math.max(0, Math.round(lbl.heightMm * 0.6))}
                      step={1}
                      value={lbl.contentTopReserveMm ?? 0}
                      onChange={(e) => onUpdate({ contentTopReserveMm: parseInt(e.target.value) })}
                      className="w-full accent-gray-900"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] text-gray-500">Bottom (mm)</label>
                      <span className="text-[10px] text-gray-700 tabular-nums">{lbl.contentBottomReserveMm ?? 0}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={Math.max(0, Math.round(lbl.heightMm * 0.6))}
                      step={1}
                      value={lbl.contentBottomReserveMm ?? 0}
                      onChange={(e) => onUpdate({ contentBottomReserveMm: parseInt(e.target.value) })}
                      className="w-full accent-gray-900"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-gray-400">
                  Shrinks the area where text auto-arranges, leaving room for the barcode.
                </p>
              </div>
            )}

            {lbl.barcodeFree && (
              <div className="border border-gray-200 rounded-lg bg-white p-3 space-y-2.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-gray-600">X position</label>
                      <span className="text-[10px] text-gray-700 tabular-nums">{Math.round(lbl.barcodeX ?? 10)}%</span>
                    </div>
                    <input type="range" min={0} max={100} step={1}
                      value={lbl.barcodeX ?? 10}
                      onChange={(e) => onUpdate({ barcodeX: parseInt(e.target.value) })}
                      className="w-full accent-gray-900" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-gray-600">Y position</label>
                      <span className="text-[10px] text-gray-700 tabular-nums">{Math.round(lbl.barcodeY ?? 60)}%</span>
                    </div>
                    <input type="range" min={0} max={100} step={1}
                      value={lbl.barcodeY ?? 60}
                      onChange={(e) => onUpdate({ barcodeY: parseInt(e.target.value) })}
                      className="w-full accent-gray-900" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-gray-600">Width</label>
                      <span className="text-[10px] text-gray-700 tabular-nums">{Math.round(lbl.barcodeW ?? 80)}%</span>
                    </div>
                    <input type="range" min={10} max={100} step={1}
                      value={lbl.barcodeW ?? 80}
                      onChange={(e) => onUpdate({ barcodeW: parseInt(e.target.value) })}
                      className="w-full accent-gray-900" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-gray-600">Height</label>
                      <span className="text-[10px] text-gray-700 tabular-nums">{Math.round(lbl.barcodeH ?? 20)}%</span>
                    </div>
                    <input type="range" min={5} max={60} step={1}
                      value={lbl.barcodeH ?? 20}
                      onChange={(e) => onUpdate({ barcodeH: parseInt(e.target.value) })}
                      className="w-full accent-gray-900" />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-600 block mb-1.5">Rotation</label>
                  <div className="flex bg-white border border-gray-200 rounded-lg overflow-hidden p-0.5">
                    {[0, 90, 180, 270].map((r) => (
                      <button
                        key={r}
                        onClick={() => onUpdate({ barcodeRot: r })}
                        className={`flex-1 py-1.5 text-xs rounded-md transition ${
                          (lbl.barcodeRot ?? 0) === r ? "bg-gray-900 text-white font-medium" : "text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        {r}°
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <p className="text-[10px] text-gray-400">
          Format & sizing live with the template — per-row values come from your data in Data Entry mode.
        </p>
      </div>

      {/* ── Rotation ── */}
      <div className={sectionCls}>
        <div className="flex items-center justify-between">
          <p className={labelCls}><RotateCw className="w-3.5 h-3.5" /> Rotation</p>
          <span className="text-xs font-medium text-brand-600">{d.rotationDeg}°</span>
        </div>
        <input type="range" min={0} max={360} step={1} value={d.rotationDeg}
          onChange={e => upD({ rotationDeg: parseInt(e.target.value) })}
          className="w-full accent-brand-500" />
        <div className="flex gap-2 flex-wrap">
          {[0,90,180,270,360].map(deg => (
            <button key={deg} onClick={() => upD({ rotationDeg: deg })}
              className={`px-2.5 py-1 text-[10px] rounded-lg border transition-colors ${d.rotationDeg === deg ? "bg-brand-500 text-white border-brand-500" : "bg-white border-gray-300 text-gray-600 hover:border-brand-400"}`}>
              {deg}°
            </button>
          ))}
        </div>
      </div>

      {/* ── Decorative Lines ── */}
      <div className={sectionCls}>
        <div className="flex items-center justify-between">
          <p className={labelCls}><SeparatorHorizontal className="w-3.5 h-3.5" /> Decorative Lines</p>
          <button onClick={addLine}
            className="flex items-center gap-1 text-xs text-brand-600 font-medium hover:text-brand-700">
            <Plus className="w-3.5 h-3.5" /> Add Line
          </button>
        </div>
        {d.lines.length === 0 && <p className="text-[10px] text-gray-400 italic">No lines added yet.</p>}
        {d.lines.map(ln => (
          <div key={ln.id} className="bg-white border border-gray-200 rounded-lg p-2 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="grid grid-cols-3 gap-2 w-full">
                <div>
                  <label className="block text-[10px] text-gray-400 mb-0.5">X (%)</label>
                  <input type="number" step={0.5} value={ln.xPercent ?? 50}
                    onChange={e => updLine(ln.id, { xPercent: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 mb-0.5">Y (%)</label>
                  <input type="number" step={0.5} value={ln.yPercent}
                    onChange={e => updLine(ln.id, { yPercent: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 mb-0.5">Length (%)</label>
                  <input type="number" step={0.5} value={ln.lengthPercent ?? 100}
                    onChange={e => updLine(ln.id, { lengthPercent: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-gray-400 mb-0.5">Thickness (px)</label>
                <input type="number" min={0} max={10} value={ln.thickness}
                  onChange={e => updLine(ln.id, { thickness: parseInt(e.target.value) || 0 })}
                  className="w-20 px-2 py-1 text-xs border border-gray-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-[10px] text-gray-400 mb-0.5">Color</label>
                <input type="color" value={ln.color} onChange={e => updLine(ln.id, { color: e.target.value })}
                  className="w-10 h-7 border border-gray-300 rounded cursor-pointer p-0" />
              </div>
              <div>
                <label className="block text-[10px] text-gray-400 mb-0.5">Style</label>
                <select value={ln.style} onChange={e => updLine(ln.id, { style: e.target.value as DesignLine["style"] })}
                  className="px-2 py-1 text-xs border border-gray-300 rounded-lg bg-white">
                  <option value="solid">Solid</option>
                  <option value="dashed">Dashed</option>
                  <option value="dotted">Dotted</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-gray-400 mb-0.5">Rotation (°)</label>
                <div className="flex gap-0.5">
                  <button onClick={() => updLine(ln.id, { rot: ((ln.rot || 0) + 90) % 360 })} className="p-1 border border-gray-300 rounded bg-gray-50 text-gray-500 hover:bg-gray-100"><RotateCw className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <button onClick={() => delLine(ln.id)} className="p-1 text-gray-400 hover:text-red-500 transition-colors mt-3">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>



    </div>
  );
}

// LabelPreview is imported from @/components/LabelPreviewRenderer

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BarcodePage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  // Everyone may open this page and print with the shared format library.
  // Only admins may create, edit, rename, duplicate or delete a format — the
  // API enforces this too; the flag below just hides the controls.
  const isAdmin = (session?.user as any)?.role === "ADMIN";

  const [labels, setLabels]     = useState<LabelTemplate[]>([makeLabel()]);
  const [expanded, setExpanded] = useState<string>(labels[0].id);
  const [printing, setPrinting] = useState(false);
  const [savedTemplates, setSavedTemplates]     = useState<SavedTemplate[]>([]);
  const [designerTemplates, setDesignerTemplates] = useState<Array<{ id: string; name: string; doc: LabelDoc; labelsAcross?: number; labelGapMm?: number }>>([]);
  // When a designer (freeform) template is loaded into the unified data-entry
  // view, we stash its doc here. Null while editing an auto-layout template.
  const [masterDoc, setMasterDoc]               = useState<LabelDoc | null>(null);
  // Source template id so "Update design" can PATCH this exact record from /designer
  // instead of creating a new duplicate.
  const [masterDocId, setMasterDocId]           = useState<string>("");
  const [masterDocName, setMasterDocName]       = useState<string>("");
  const [masterDocLabelsAcross, setMasterDocLabelsAcross] = useState(1);
  const [masterDocLabelGapMm, setMasterDocLabelGapMm]     = useState(3);
  const [templatesLoaded, setTemplatesLoaded]   = useState(false);
  const [savingFor, setSavingFor]               = useState<string | null>(null);
  const [saveName, setSaveName]                 = useState("");
  const [activeTabs, setActiveTabs]             = useState<Record<string,"data"|"design">>({});
  const getTab = (id: string) => activeTabs[id] ?? "data";
  const setTab = (id: string, tab: "data"|"design") => setActiveTabs(p => ({ ...p, [id]: tab }));
  const previewRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // ─── 3-step page flow ──────────────────────────────────────────────────────
  //   "picker"  – landing: choose which saved format to use (or design a new one)
  //   "data"    – table where each row is one label using the chosen format
  //   "design"  – template editor (size, fields, design, barcode, save)
  type BulkRow = { id: string; values: Record<string, string>; copies: number };
  type PageMode = "picker" | "data" | "design";
  const [pageMode, setPageMode] = useState<PageMode>("picker");
  // Design mode is the format editor — admins only. The entry points are hidden
  // for other roles, but this bounces them back if they get there any other way.
  useEffect(() => {
    if (pageMode === "design" && sessionStatus === "authenticated" && !isAdmin) {
      setPageMode("picker");
    }
  }, [pageMode, sessionStatus, isAdmin]);
  // Counter used to mint stable row IDs WITHOUT relying on Date.now / Math.random
  // during initial render — those would produce different values on the server
  // vs. the client and trigger a hydration mismatch.
  const rowCounter = useRef(0);
  const newRow = (): BulkRow => ({
    id: `row-${++rowCounter.current}`,
    values: {},
    copies: 1,
  });
  // Seed with a single stable row. Counter starts at 0 → first id = "row-1".
  const [bulkRows, setBulkRows] = useState<BulkRow[]>(() => {
    rowCounter.current = 1;
    return [{ id: "row-1", values: {}, copies: 1 }];
  });
  const [activeRowId, setActiveRowId] = useState<string>("");
  const bulkPreviewRef = useRef<HTMLDivElement | null>(null);
  // One hidden preview DOM node per bulk row, used as html2canvas capture sources
  // for the multi-row print job. Keyed by row id.
  const bulkRowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  // The first label acts as the master template for the data view.
  const masterTemplate = labels[0];

  // ─── Picker view state ─────────────────────────────────────────────────────
  const [pickerSearch, setPickerSearch] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  // Unified picker model — auto-layout templates AND designer (freeform) templates
  // share a single grid so the user picks any format the same way.
  type PickerItem =
    | { kind: "auto"; id: string; name: string; tpl: SavedTemplate }
    | { kind: "designer"; id: string; name: string; doc: LabelDoc; labelsAcross?: number; labelGapMm?: number };
  const pickerItems: PickerItem[] = [
    ...savedTemplates.map<PickerItem>((t) => ({ kind: "auto", id: t.id, name: t.name, tpl: t })),
    ...designerTemplates.map<PickerItem>((t) => ({ kind: "designer", id: t.id, name: t.name, doc: t.doc, labelsAcross: t.labelsAcross, labelGapMm: t.labelGapMm })),
  ];
  const filteredPickerItems = pickerSearch.trim()
    ? pickerItems.filter((i) => i.name.toLowerCase().includes(pickerSearch.trim().toLowerCase()))
    : pickerItems;

  // Dirty-tracking for the Design editor — flipped to true on any mutation,
  // reset to false on save / when entering Design with a fresh template.
  const [designDirty, setDesignDirty] = useState(false);
  // Discard-vs-save modal for navigation guard.
  const [pendingNav, setPendingNav] = useState<null | { target: PageMode; setupAfter?: () => void }>(null);
  // Set to true while a save is in flight to disable controls.
  const [savePending, setSavePending] = useState(false);

  // Wrapper for any navigation OUT of design mode — prompts the discard/save
  // modal if dirty, otherwise navigates immediately.
  const navigateFromDesign = (target: PageMode, setupAfter?: () => void) => {
    if (pageMode === "design" && designDirty) {
      setPendingNav({ target, setupAfter });
      return;
    }
    setupAfter?.();
    setPageMode(target);
  };
  // Compute the "live" template for the preview by overlaying the active row's
  // field values on top of the master template.
  const activeRow = bulkRows.find((r) => r.id === activeRowId) || bulkRows[0];
  const livePreviewLabel: LabelTemplate = {
    ...masterTemplate,
    fields: masterTemplate.fields.map((f) => ({
      ...f,
      value: activeRow?.values[f.heading] ?? f.value,
    })),
  };

  // Unified field list for the data-entry table — same shape regardless of
  // whether we're filling an auto-layout template (fields keyed by heading) or
  // a designer/freeform template (fields keyed by placeholder key).
  const dataFields: Array<{ key: string; label: string }> = masterDoc
    ? collectFieldNames(masterDoc)
    : masterTemplate.fields.map((f) => ({ key: f.heading, label: f.heading }));

  // Dimensions + multi-up config of whatever the master currently is — used by
  // the header label, the data view, and the print pipeline.
  const masterWidthMm  = masterDoc ? toMM(masterDoc.width,  masterDoc.units) : masterTemplate.widthMm;
  const masterHeightMm = masterDoc ? toMM(masterDoc.height, masterDoc.units) : masterTemplate.heightMm;
  const masterLabelsAcross = masterDoc ? masterDocLabelsAcross : (masterTemplate.labelsAcross ?? 1);
  const masterLabelGapMm   = masterDoc ? masterDocLabelGapMm   : (masterTemplate.labelGapMm ?? 3);
  const masterDisplayName  = masterDoc ? masterDocName : masterTemplate.name;

  // Templates live in the database and are shared org-wide, so every user on
  // every device reads the same format library. The one-time migration of
  // leftover localStorage templates only runs for admins — they're the only
  // role the API lets POST a format.
  const migrationRanRef = useRef(false);
  useEffect(() => {
    // A dead session would otherwise leave the picker stuck on its skeleton
    // forever, since the fetch below never runs to flip templatesLoaded.
    if (sessionStatus === "unauthenticated") { setTemplatesLoaded(true); return; }
    if (sessionStatus !== "authenticated" || migrationRanRef.current) return;
    migrationRanRef.current = true;
    let cancelled = false;
    (async () => {
      const MIGRATION_KEY = STORAGE_KEY + "_migrated_v1";
      try {
        if (isAdmin && !localStorage.getItem(MIGRATION_KEY)) {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const local: SavedTemplate[] = JSON.parse(raw);
            if (Array.isArray(local) && local.length > 0) {
              for (const tpl of local) {
                try {
                  await fetch("/api/barcode-templates", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: tpl.name, data: tpl }),
                  });
                } catch {}
              }
              toast.success(`Synced ${local.length} local template${local.length !== 1 ? "s" : ""} to your account`);
            }
          }
          localStorage.setItem(MIGRATION_KEY, new Date().toISOString());
        }
      } catch {}

      try {
        const res = await fetch("/api/barcode-templates", { cache: "no-store" });
        if (!res.ok) return;
        const rows = await res.json();
        if (cancelled) return;
        const all = rows.map((r: any) => {
          let parsed: any = {};
          try { parsed = JSON.parse(r.data || "{}"); } catch {}
          return { ...parsed, id: r.id, name: r.name, __raw: parsed };
        });
        // Auto Layout templates: have `fields` array and aren't tagged __designer.
        const tpls: SavedTemplate[] = all.filter((t: any) => !t.__raw?.__designer && Array.isArray(t.fields));
        setSavedTemplates(tpls);
        // Designer-saved templates ({ __designer: true, doc: LabelDoc }) — exposed
        // as a separate section so users can fill data and print them too.
        const dx = all
          .filter((t: any) => t.__raw?.__designer && t.__raw?.doc)
          .map((t: any) => ({
            id: t.id,
            name: typeof t.name === "string" ? t.name.replace(/^\[Designer\]\s*/, "") : "Designer",
            doc: t.__raw.doc as LabelDoc,
            labelsAcross: t.__raw.labelsAcross ?? 1,
            labelGapMm: t.__raw.labelGapMm ?? 3,
          }));
        setDesignerTemplates(dx);
      } catch {}
      // Always mark loaded — even on fetch failure — so the empty-state can show
      // after a genuine attempt (vs. on the initial first paint before the request).
      if (!cancelled) setTemplatesLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [sessionStatus, isAdmin]);

  async function createTemplateRemote(tpl: SavedTemplate): Promise<SavedTemplate | null> {
    try {
      const res = await fetch("/api/barcode-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: tpl.name, data: tpl }),
      });
      if (!res.ok) { toast.error("Failed to save template"); return null; }
      const row = await res.json();
      return { ...tpl, id: row.id };
    } catch {
      toast.error("Failed to save template");
      return null;
    }
  }

  async function deleteTemplateRemote(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/barcode-templates/${id}`, { method: "DELETE" });
      if (!res.ok) { toast.error("Failed to delete template"); return false; }
      return true;
    } catch {
      toast.error("Failed to delete template");
      return false;
    }
  }

  async function renameTemplateRemote(id: string, newName: string, full: SavedTemplate): Promise<boolean> {
    try {
      const updated = { ...full, name: newName };
      const res = await fetch(`/api/barcode-templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, data: updated }),
      });
      if (!res.ok) { toast.error("Failed to rename"); return false; }
      return true;
    } catch {
      toast.error("Failed to rename");
      return false;
    }
  }

  // ── Mutations ────────────────────────────────────────────────────────────────
  const update = (id: string, patch: Partial<LabelTemplate>) => {
    setLabels(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
    // Any field touched while in Design mode flags this as a dirty edit so the
    // navigation guard can prompt before discarding.
    if (pageMode === "design") setDesignDirty(true);
  };

  const updateField = (lblId: string, fieldId: string, patch: Partial<LabelField>) =>
    setLabels(prev => prev.map(l => {
      if (l.id !== lblId) return l;
      const fields = l.fields.map(f => f.id === fieldId ? { ...f, ...patch } : f);
      return { ...l, fields, ...(l.barcodeAuto ? { barcodeValue: getAutoBarcode(fields) } : {}) };
    }));

  const addField = (lblId: string) =>
    setLabels(prev => prev.map(l =>
      l.id !== lblId ? l : { ...l, fields: [...l.fields, { id: `f-${Date.now()}`, heading: "", value: "" }] }
    ));

  const removeField = (lblId: string, fieldId: string) =>
    setLabels(prev => prev.map(l =>
      l.id !== lblId ? l : { ...l, fields: l.fields.filter(f => f.id !== fieldId) }
    ));

  // Hand off the current Auto Layout label to the Bartender-style /designer.
  // We render the auto-layout preview pixel-for-pixel by translating each
  // field + barcode into a positioned designer element. Layout math mirrors
  // LabelPreviewRenderer's auto layout — heading on top with optional divider,
  // body fields stacked, barcode in the lower band.
  /* Open the current Auto-Layout label in the Designer with full fidelity —
     fonts, margins, lines, footer, shapes are preserved by the shared
     converter. The Designer reads `sessionStorage["designer:import"]` on
     mount and loads the doc. */
  const openInDesigner = (lbl: LabelTemplate) => {
    try {
      const doc = convertAutoLayoutToDesignerDoc(lbl);
      sessionStorage.setItem("designer:import", JSON.stringify(doc));
      router.push("/designer?import=auto");
    } catch (err) {
      console.error("openInDesigner failed", err);
      toast.error("Could not open Designer");
    }
  };

  /* Same as above but seeded from a SavedTemplate (picker card click). We
     convert the saved JSON into a usable LabelTemplate-like input first. */
  const importSavedToDesigner = (tpl: SavedTemplate) => {
    try {
      const doc = convertAutoLayoutToDesignerDoc(tpl as any);
      doc.labelName = tpl.name || doc.labelName;
      sessionStorage.setItem("designer:import", JSON.stringify(doc));
      router.push("/designer?import=auto");
    } catch (err) {
      console.error("importSavedToDesigner failed", err);
      toast.error("Could not import template");
    }
  };


  const applySaved = (lblId: string, saved: SavedTemplate) => {
    const fields = saved.fields.map((f, i) => ({ id: `f-${lblId}-s${i}`, heading: f.heading, value: "" }));
    setLabels(prev => prev.map(l =>
      l.id !== lblId ? l : {
        ...l, name: saved.name, widthMm: saved.widthMm, heightMm: saved.heightMm,
        topMarginMm: saved.topMarginMm, bottomMarginMm: saved.bottomMarginMm,
        leftMarginMm: saved.leftMarginMm ?? 0, rightMarginMm: saved.rightMarginMm ?? 0,
        fields, barcodeFormat: saved.barcodeFormat, barcodeValue: "", barcodeAuto: true,
        showBarcode: saved.showBarcode ?? true, logoPosition: saved.logoPosition ?? "none",
        logoHeightMm: saved.logoHeightMm ?? 10, fontScale: saved.fontScale ?? 1,
        showBorder: saved.showBorder ?? true,
        // Restore full design (font, alignment, decorative lines, mode) if saved
        design: saved.design ? { ...saved.design } : { ...DEFAULT_DESIGN },
        labelsAcross: saved.labelsAcross ?? 1,
        labelGapMm: saved.labelGapMm ?? 3,
        manufacturedBy: (saved as any).manufacturedBy ?? "",
        manufacturedAddress: (saved as any).manufacturedAddress ?? "",
        manufacturedEmail: (saved as any).manufacturedEmail ?? "",
      }
    ));
  };

  const saveTemplate = async (lbl: LabelTemplate, opts?: { navigateAfter?: PageMode }) => {
    const name = saveName.trim();
    if (!name) { toast.error("Enter a template name"); return false; }
    setSavePending(true);
    const draft: SavedTemplate = {
      // Use the source id when updating an existing template; harmless placeholder for new.
      id: lbl.sourceTemplateId || `pending-${Date.now()}`,
      name,
      widthMm: lbl.widthMm, heightMm: lbl.heightMm,
      topMarginMm: lbl.topMarginMm, bottomMarginMm: lbl.bottomMarginMm,
      leftMarginMm: lbl.leftMarginMm, rightMarginMm: lbl.rightMarginMm,
      // Persist per-field styling so highlights / hidden / bold / free-pos survive a save+reload.
      fields: lbl.fields.map((f) => ({
        heading: f.heading,
        ...(f.highlight ? { highlight: true } : {}),
        ...(f.bold ? { bold: true } : {}),
        ...(f.hidden ? { hidden: true } : {}),
        ...(f.scale && f.scale !== 1 ? { scale: f.scale } : {}),
        ...(f.freePos
          ? {
              freePos: true,
              posX: f.posX, posY: f.posY, posW: f.posW, posH: f.posH, posRot: f.posRot,
              ...(f.stackLines ? { stackLines: true } : {}),
              ...(f.textAlign ? { textAlign: f.textAlign } : {}),
            }
          : {}),
      })) as any,
      barcodeFormat: lbl.barcodeFormat, showBarcode: lbl.showBarcode,
      logoPosition: lbl.logoPosition, logoHeightMm: lbl.logoHeightMm,
      fontScale: lbl.fontScale, showBorder: lbl.showBorder, rotated: lbl.rotated,
      design: { ...lbl.design },
      logoDataUrl: lbl.logoDataUrl || undefined,
      labelsAcross: lbl.labelsAcross ?? 1,
      labelGapMm: lbl.labelGapMm ?? 3,
      barcodeHeightScale: lbl.barcodeHeightScale ?? 1,
      barcodeWidthScale: lbl.barcodeWidthScale ?? 1,
      barcodeFree: lbl.barcodeFree ?? false,
      barcodeX: lbl.barcodeX,
      barcodeY: lbl.barcodeY,
      barcodeW: lbl.barcodeW,
      barcodeH: lbl.barcodeH,
      barcodeRot: lbl.barcodeRot,
      contentTopReserveMm: lbl.contentTopReserveMm ?? 0,
      contentBottomReserveMm: lbl.contentBottomReserveMm ?? 0,
      productNameDivider: lbl.productNameDivider ?? true,
      productNameGapMm: lbl.productNameGapMm ?? 0,
      manufacturedBy: lbl.manufacturedBy ?? "",
      manufacturedAddress: lbl.manufacturedAddress ?? "",
      manufacturedEmail: lbl.manufacturedEmail ?? "",
    } as any;

    let savedRow: SavedTemplate | null = null;
    if (lbl.sourceTemplateId) {
      // UPDATE existing — preserves identity, so picker doesn't show a duplicate.
      const ok = await renameTemplateRemote(lbl.sourceTemplateId, name, draft);
      if (ok) savedRow = draft;
    } else {
      // CREATE new.
      savedRow = await createTemplateRemote(draft);
    }
    setSavePending(false);
    if (!savedRow) return false;

    setSavedTemplates(prev => {
      const idx = prev.findIndex(t => t.id === savedRow!.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = savedRow!;
        return copy;
      }
      return [...prev, savedRow!];
    });
    // Keep the current labels[0] linked to whatever id it now lives under.
    update(lbl.id, { sourceTemplateId: savedRow.id });
    setSavingFor(null); setSaveName("");
    setDesignDirty(false);
    toast.success(`Template "${name}" saved`);
    // Always return to the picker after a successful save (the user can re-edit from there).
    setPageMode(opts?.navigateAfter || "picker");
    return true;
  };

  const handleLogoUpload = (lblId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      update(lblId, { logoDataUrl: e.target?.result as string });
      toast.success("Logo uploaded");
    };
    reader.readAsDataURL(file);
  };

  // ── Print: html2canvas → popup window with one page per copy ────────────────
  const handlePrint = useCallback(async () => {
    const valid = labels.filter(l => l.fields.some(f => f.value.trim()) && l.copies > 0);
    if (!valid.length) { toast.error("Fill in at least one label with copies > 0"); return; }
    setPrinting(true);

    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const images: {
        dataUrl: string;
        widthMm: number;
        heightMm: number;
        copies: number;
        labelsAcross: number;
        labelGapMm: number;
      }[] = [];

      for (const lbl of valid) {
        const el = previewRefs.current[lbl.id];
        if (!el) continue;

        // scale 2 ≈ 192 DPI raster — matches the 203 DPI native resolution of
        // Zebra ZD220 / TSC TE244 closely enough for crisp barcodes without
        // generating PNGs that overflow the printer's command buffer.
        const captured = await html2canvas(el, {
          scale: 2,
          backgroundColor: "#ffffff",
          useCORS: true,
          logging: false,
        });

        // html2canvas does NOT honour a transform on the element it's snapshotting,
        // so the "Rotate 180°" checkbox only rotates the on-screen preview. Apply
        // the rotation here in pixel space so the printed PNG is actually flipped.
        let canvas = captured;
        if (lbl.rotated) {
          const rotated = document.createElement("canvas");
          rotated.width = captured.width;
          rotated.height = captured.height;
          const ctx = rotated.getContext("2d");
          if (ctx) {
            ctx.translate(captured.width / 2, captured.height / 2);
            ctx.rotate(Math.PI);
            ctx.drawImage(captured, -captured.width / 2, -captured.height / 2);
            canvas = rotated;
          }
        }

        images.push({
          dataUrl: canvas.toDataURL("image/png"),
          widthMm: lbl.widthMm,
          heightMm: lbl.heightMm,
          copies: lbl.copies,
          labelsAcross: Math.max(1, lbl.labelsAcross ?? 1),
          labelGapMm: Math.max(0, lbl.labelGapMm ?? 3),
        });
      }

      if (!images.length) { toast.error("Could not render labels"); setPrinting(false); return; }

      const first = images[0];
      // Each printed "page" represents one row on the roll. For multi-up media the
      // row width is N labels + (N-1) gaps. The printer's gap sensor advances
      // exactly one row between pages.
      const pageWidthMm = first.widthMm * first.labelsAcross + first.labelGapMm * (first.labelsAcross - 1);
      const pageCss = `@page { size: ${pageWidthMm}mm ${first.heightMm}mm; margin: 0; }`;

      // Build pages: for each label, group its copies into rows of `labelsAcross`.
      // A final row with fewer than N labels gets blank slots padded out so the
      // printer still feeds the correct full row.
      const itemsHtml = images.flatMap((img) => {
        const rowWidthMm = img.widthMm * img.labelsAcross + img.labelGapMm * (img.labelsAcross - 1);
        const pages: string[] = [];
        for (let i = 0; i < img.copies; i += img.labelsAcross) {
          const remaining = Math.min(img.labelsAcross, img.copies - i);
          const slots: string[] = [];
          for (let s = 0; s < img.labelsAcross; s++) {
            if (s < remaining) {
              slots.push(
                `<img src="${img.dataUrl}" style="width:${img.widthMm}mm;height:${img.heightMm}mm;display:block;flex:0 0 auto;" />`
              );
            } else {
              slots.push(
                `<div style="width:${img.widthMm}mm;height:${img.heightMm}mm;flex:0 0 auto;"></div>`
              );
            }
            if (s < img.labelsAcross - 1) {
              slots.push(`<div style="width:${img.labelGapMm}mm;height:${img.heightMm}mm;flex:0 0 auto;"></div>`);
            }
          }
          pages.push(
            `<div class="lbl" style="width:${rowWidthMm}mm;height:${img.heightMm}mm;display:flex;flex-direction:row;">${slots.join("")}</div>`
          );
        }
        return pages;
      }).join("\n");

      // Print via a hidden iframe to avoid popup blockers
      const iframe = document.createElement("iframe");
      iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
      document.body.appendChild(iframe);

      const doc = iframe.contentDocument!;
      doc.open();
      doc.write(`<!DOCTYPE html><html><head><title>Print Labels</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  .lbl { page-break-after: always; break-after: page; page-break-inside: avoid; break-inside: avoid; overflow: hidden; }
  .lbl:last-child { page-break-after: auto; break-after: auto; }
  @media print { ${pageCss} }
</style></head><body>${itemsHtml}</body></html>`);
      doc.close();

      const imgs = Array.from(doc.images);
      await Promise.all(imgs.map(img =>
        img.complete && img.naturalWidth > 0
          ? Promise.resolve()
          : new Promise<void>(res => {
              img.onload = () => res();
              img.onerror = () => res();
            })
      ));

      const w = iframe.contentWindow!;
      const cleanup = () => { try { iframe.remove(); } catch {} };
      w.onafterprint = cleanup;
      setTimeout(cleanup, 60_000);
      w.focus();
      w.print();
    } catch (err) {
      toast.error("Print failed: " + (err instanceof Error ? err.message : String(err)));
    }
    setPrinting(false);
  }, [labels]);

  // ── Bulk print: each row of the data-entry table produces one label using the
  // master template's design overlaid with that row's values. ──────────────────
  const handleBulkPrint = useCallback(async () => {
    const validRows = bulkRows.filter(
      (r) => r.copies > 0 && Object.values(r.values).some((v) => v && v.trim())
    );
    if (!validRows.length) {
      toast.error("Fill at least one row with data and copies > 0");
      return;
    }
    setPrinting(true);
    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const images: {
        dataUrl: string;
        widthMm: number;
        heightMm: number;
        copies: number;
        labelsAcross: number;
        labelGapMm: number;
      }[] = [];

      for (const row of validRows) {
        const el = bulkRowRefs.current[row.id];
        if (!el) continue;

        const captured = await html2canvas(el, {
          scale: 1.5,
          backgroundColor: "#ffffff",
          useCORS: true,
          logging: false,
        });

        images.push({
          dataUrl: captured.toDataURL("image/png"),
          widthMm: masterWidthMm,
          heightMm: masterHeightMm,
          copies: row.copies,
          labelsAcross: Math.max(1, masterLabelsAcross),
          labelGapMm: Math.max(0, masterLabelGapMm),
        });
      }

      if (!images.length) {
        toast.error("Could not render labels");
        setPrinting(false);
        return;
      }

      const first = images[0];
      const pageWidthMm =
        first.widthMm * first.labelsAcross + first.labelGapMm * (first.labelsAcross - 1);
      const pageCss = `@page { size: ${pageWidthMm}mm ${first.heightMm}mm; margin: 0; }`;

      const itemsHtml = images
        .flatMap((img) => {
          const rowWidthMm =
            img.widthMm * img.labelsAcross + img.labelGapMm * (img.labelsAcross - 1);
          const pages: string[] = [];
          for (let i = 0; i < img.copies; i += img.labelsAcross) {
            const remaining = Math.min(img.labelsAcross, img.copies - i);
            const slots: string[] = [];
            for (let s = 0; s < img.labelsAcross; s++) {
              if (s < remaining) {
                slots.push(
                  `<img src="${img.dataUrl}" style="width:${img.widthMm}mm;height:${img.heightMm}mm;display:block;flex:0 0 auto;" />`
                );
              } else {
                slots.push(
                  `<div style="width:${img.widthMm}mm;height:${img.heightMm}mm;flex:0 0 auto;"></div>`
                );
              }
              if (s < img.labelsAcross - 1) {
                slots.push(
                  `<div style="width:${img.labelGapMm}mm;height:${img.heightMm}mm;flex:0 0 auto;"></div>`
                );
              }
            }
            pages.push(
              `<div class="lbl" style="width:${rowWidthMm}mm;height:${img.heightMm}mm;display:flex;flex-direction:row;">${slots.join(
                ""
              )}</div>`
            );
          }
          return pages;
        })
        .join("\n");

      const iframe = document.createElement("iframe");
      iframe.style.cssText =
        "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
      document.body.appendChild(iframe);

      const doc = iframe.contentDocument!;
      doc.open();
      doc.write(`<!DOCTYPE html><html><head><title>Print Labels</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  .lbl { page-break-after: always; break-after: page; page-break-inside: avoid; break-inside: avoid; overflow: hidden; }
  .lbl:last-child { page-break-after: auto; break-after: auto; }
  @media print { ${pageCss} }
</style></head><body>${itemsHtml}</body></html>`);
      doc.close();

      const imgs = Array.from(doc.images);
      await Promise.all(
        imgs.map((img) =>
          img.complete && img.naturalWidth > 0
            ? Promise.resolve()
            : new Promise<void>((res) => {
                img.onload = () => res();
                img.onerror = () => res();
              })
        )
      );

      const w = iframe.contentWindow!;
      const cleanup = () => { try { iframe.remove(); } catch {} };
      w.onafterprint = cleanup;
      setTimeout(cleanup, 60_000);
      w.focus();
      w.print();
    } catch (err) {
      toast.error("Print failed: " + (err instanceof Error ? err.message : String(err)));
    }
    setPrinting(false);
  }, [bulkRows, masterWidthMm, masterHeightMm, masterLabelsAcross, masterLabelGapMm]);

  // ── Render ───────────────────────────────────────────────────────────────────
  const totalLabelsToPrint = pageMode === "data"
    ? bulkRows.reduce((s, r) => s + r.copies, 0)
    : labels.reduce((s, l) => s + l.copies, 0);

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <Toaster position="top-right" />

      {/* Page header — context-aware controls per step */}
      <div className="flex items-end justify-between gap-4 flex-wrap pb-2 border-b border-gray-200">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Labels</h1>
          <p className="text-xs text-gray-500 mt-1">
            {pageMode === "picker" && "Pick a saved format to start entering label data."}
            {pageMode === "data" && `Using ${masterDisplayName} · ${masterWidthMm}×${masterHeightMm} mm${masterDoc ? " · custom" : ""}`}
            {pageMode === "design" && "Design a label format, then save it to your library."}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* === PICKER controls === */}
          {pageMode === "picker" && isAdmin && (
            <button
              onClick={() => {
                // Fresh blank template seeded into labels[0] so the Design view starts clean.
                setLabels([makeLabel()]);
                setExpanded(labels[0]?.id || "");
                setPageMode("design");
                setSavingFor(null);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-black text-white text-sm font-semibold rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Design new format
            </button>
          )}

          {/* === DATA controls === */}
          {pageMode === "data" && (
            <>
              <button
                onClick={() => setPageMode("picker")}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 rounded-lg ring-1 ring-gray-200 transition-colors"
              >
                <ChevronUp className="w-3.5 h-3.5 rotate-[-90deg]" />
                Change format
              </button>
              {isAdmin && (
                <button
                  onClick={() => {
                    if (masterDoc) {
                      // Designer (freeform) format — re-open in /designer with the
                      // source id so Save can PATCH this exact record (Update design)
                      // instead of creating a duplicate template.
                      try {
                        sessionStorage.setItem("designer:import", JSON.stringify(masterDoc));
                        if (masterDocId) {
                          sessionStorage.setItem("designer:updateId", masterDocId);
                          sessionStorage.setItem("designer:updateName", masterDocName);
                        } else {
                          sessionStorage.removeItem("designer:updateId");
                          sessionStorage.removeItem("designer:updateName");
                        }
                        router.push("/designer?import=auto");
                      } catch {
                        toast.error("Could not open Designer");
                      }
                    } else {
                      setPageMode("design");
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 rounded-lg ring-1 ring-gray-200 transition-colors"
                  title={masterDoc ? "Update this design in the Designer" : "Edit the auto-layout format"}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  {masterDoc ? "Update design" : "Edit format"}
                </button>
              )}
              <button
                onClick={handleBulkPrint}
                disabled={printing || totalLabelsToPrint === 0}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-black text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {printing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                {printing ? "Printing" : `Print ${totalLabelsToPrint || ""}`.trim()}
              </button>
            </>
          )}

          {/* === DESIGN controls === */}
          {pageMode === "design" && (
            <>
              {designDirty && (
                <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-amber-700 bg-amber-50 ring-1 ring-amber-200 rounded">
                  Unsaved changes
                </span>
              )}
              <button
                onClick={() => {
                  const startFresh = () => {
                    const fresh = makeLabel();
                    setLabels([fresh]);
                    setExpanded(fresh.id);
                    setDesignDirty(false);
                  };
                  if (designDirty) {
                    setPendingNav({ target: "design", setupAfter: startFresh });
                  } else {
                    startFresh();
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 rounded-lg ring-1 ring-gray-200 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                New template
              </button>
              <button
                onClick={() => navigateFromDesign("picker")}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 rounded-lg ring-1 ring-gray-200 transition-colors"
              >
                <ChevronUp className="w-3.5 h-3.5 rotate-[-90deg]" />
                Back to formats
              </button>
              <button
                onClick={handlePrint}
                disabled={printing || totalLabelsToPrint === 0}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-black text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {printing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                Test print
              </button>
            </>
          )}
        </div>
      </div>

      {/* ─── PICKER MODE ──────────────────────────────────────────────────── */}
      {pageMode === "picker" && (
        <div className="space-y-4">
          {!templatesLoaded ? (
            // Skeleton — shown only during the initial API load.  Prevents the
            // "No formats yet" empty state from flashing while templates fetch.
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
                  <div className="bg-gray-100 rounded-md h-[100px] mb-3" />
                  <div className="h-4 bg-gray-100 rounded w-2/3 mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-1/3" />
                </div>
              ))}
            </div>
          ) : pickerItems.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 text-gray-500 mb-4">
                <Bookmark className="w-5 h-5" />
              </div>
              <p className="text-base font-semibold text-gray-900">No formats yet</p>
              <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                {isAdmin
                  ? "Design a label format first — set its size, fields, and barcode — then save it so you can reuse it for data entry."
                  : "No label formats have been created yet. Ask an admin to add one — it will show up here for everyone."}
              </p>
              {isAdmin && (
                <button
                  onClick={() => {
                    setLabels([makeLabel()]);
                    setExpanded(labels[0]?.id || "");
                    setPageMode("design");
                    setSavingFor(null);
                  }}
                  className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-black text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Design first format
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={pickerSearch}
                    onChange={(e) => setPickerSearch(e.target.value)}
                    placeholder="Search formats by name…"
                    className="w-full pl-9 pr-9 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 placeholder:text-gray-400"
                  />
                  {pickerSearch && (
                    <button
                      onClick={() => setPickerSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-gray-500 tabular-nums">
                  {filteredPickerItems.length} of {pickerItems.length}
                </p>
              </div>

              {filteredPickerItems.length === 0 ? (
                <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center">
                  <p className="text-sm text-gray-500">No format matches &quot;{pickerSearch}&quot;.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredPickerItems.map((item) => {
                    const isRenaming = renamingId === item.id;
                    // Common dims (mm) so card aspect matches the actual label.
                    const widthMm  = item.kind === "auto"
                      ? item.tpl.widthMm
                      : toMM(item.doc.width, item.doc.units);
                    const heightMm = item.kind === "auto"
                      ? item.tpl.heightMm
                      : toMM(item.doc.height, item.doc.units);
                    const aspect = Math.max(widthMm, 1) / Math.max(heightMm, 1);
                    const labelsAcross = item.kind === "auto"
                      ? (item.tpl.labelsAcross ?? 1)
                      : (item.labelsAcross ?? 1);

                    return (
                      <div
                        key={item.id}
                        className="group relative bg-white rounded-xl border border-gray-200 hover:border-gray-900 hover:shadow-sm transition-all overflow-hidden"
                      >
                        <button
                          onClick={() => {
                            if (isRenaming) return;
                            if (item.kind === "auto") {
                              // Load auto-layout template into labels[0] and switch
                              // to row-based data entry.
                              setMasterDoc(null);
                              setMasterDocId("");
                              setMasterDocName("");
                              setLabels((prev) => [makeLabel(item.tpl), ...prev.slice(1)]);
                            } else {
                              // Load designer (freeform) template into the same
                              // data-entry view via masterDoc state.
                              setMasterDoc(item.doc);
                              setMasterDocId(item.id);
                              setMasterDocName(item.name);
                              setMasterDocLabelsAcross(Math.max(1, item.labelsAcross ?? 1));
                              setMasterDocLabelGapMm(Math.max(0, item.labelGapMm ?? 3));
                            }
                            setBulkRows([newRow()]);
                            setActiveRowId("");
                            setPageMode("data");
                          }}
                          className="w-full text-left p-4 flex flex-col gap-3"
                        >
                          {/* Wireframe thumbnail */}
                          <div className="flex justify-center bg-gray-50 rounded-md py-3 px-2 border border-gray-100">
                            <div
                              className="bg-white border border-gray-300 relative"
                              style={{
                                width: aspect >= 1 ? "120px" : `${120 * aspect}px`,
                                height: aspect >= 1 ? `${120 / aspect}px` : "120px",
                                maxHeight: "100px",
                              }}
                            >
                              {item.kind === "auto" ? (
                                <div className="absolute inset-0 flex flex-col justify-around p-1.5 gap-0.5">
                                  {(item.tpl.fields ?? []).slice(0, 4).map((_, i) => (
                                    <div
                                      key={i}
                                      className="h-[2px] bg-gray-300 rounded-sm"
                                      style={{ width: `${60 + ((i * 13) % 30)}%` }}
                                    />
                                  ))}
                                  {item.tpl.showBarcode && (
                                    <div className="mt-auto h-2.5 bg-gray-800 rounded-sm" style={{ width: "70%", alignSelf: "center" }} />
                                  )}
                                </div>
                              ) : (
                                // Mini silhouette of designer elements
                                item.doc.elements.slice(0, 12).map((el) => {
                                  const w = Math.max(item.doc.width, 1);
                                  const h = Math.max(item.doc.height, 1);
                                  const tone =
                                    el.type === "barcode" || el.type === "qr" ? "#1F2937" :
                                    el.type === "rect" || el.type === "circle" || el.type === "line" ? "#D1D5DB" :
                                    "#9CA3AF";
                                  return (
                                    <span key={el.id} style={{
                                      position: "absolute",
                                      left: `${(el.x / w) * 100}%`,
                                      top: `${(el.y / h) * 100}%`,
                                      width: `${(el.w / w) * 100}%`,
                                      height: `${(el.h / h) * 100}%`,
                                      background: tone,
                                      opacity: 0.7,
                                      borderRadius: el.type === "circle" ? "50%" : 1,
                                    }} />
                                  );
                                })
                              )}
                            </div>
                          </div>

                          {/* Name + size */}
                          {isRenaming ? (
                            <input
                              type="text"
                              value={renameValue}
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={async (e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  const next = renameValue.trim();
                                  if (!next || next === item.name) { setRenamingId(null); return; }
                                  if (item.kind === "auto") {
                                    const ok = await renameTemplateRemote(item.id, next, item.tpl);
                                    if (ok) {
                                      setSavedTemplates((prev) => prev.map((t) => t.id === item.id ? { ...t, name: next } : t));
                                      toast.success("Renamed");
                                    }
                                  } else {
                                    // Designer templates are stored as JSON with __designer flag;
                                    // we PATCH preserving the raw doc payload.
                                    try {
                                      const res = await fetch(`/api/barcode-templates/${item.id}`, {
                                        method: "PATCH",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                          name: `[Designer] ${next}`,
                                          data: { __designer: true, doc: item.doc, labelsAcross: item.labelsAcross ?? 1, labelGapMm: item.labelGapMm ?? 3 },
                                        }),
                                      });
                                      if (!res.ok) throw new Error("rename failed");
                                      setDesignerTemplates((prev) => prev.map((t) => t.id === item.id ? { ...t, name: next } : t));
                                      toast.success("Renamed");
                                    } catch {
                                      toast.error("Failed to rename");
                                    }
                                  }
                                  setRenamingId(null);
                                }
                                if (e.key === "Escape") setRenamingId(null);
                              }}
                              onBlur={() => setRenamingId(null)}
                              className="text-sm font-semibold text-gray-900 bg-white border border-gray-300 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900"
                            />
                          ) : (
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                              <p className="text-[11px] text-gray-500 mt-0.5 tabular-nums">
                                {widthMm} × {heightMm} mm
                                {item.kind === "auto"
                                  ? <> · {item.tpl.fields.length} field{item.tpl.fields.length !== 1 ? "s" : ""}</>
                                  : <> · {collectFieldNames(item.doc).length} field{collectFieldNames(item.doc).length !== 1 ? "s" : ""}</>}
                              </p>
                            </div>
                          )}

                          {/* Meta line */}
                          <div className="flex items-center gap-2 text-[10px] text-gray-500 pt-2 border-t border-gray-100">
                            {item.kind === "auto" ? (
                              <>
                                <span className="flex items-center gap-1">
                                  <Barcode className="w-3 h-3" />
                                  {item.tpl.showBarcode ? item.tpl.barcodeFormat : "no barcode"}
                                </span>
                                {labelsAcross > 1 && <span>· {labelsAcross}-up</span>}
                                {item.tpl.logoDataUrl && <span>· logo</span>}
                              </>
                            ) : (
                              <>
                                <span className="flex items-center gap-1">
                                  <Palette className="w-3 h-3" />
                                  custom
                                </span>
                                <span>· {item.doc.elements.length} element{item.doc.elements.length !== 1 ? "s" : ""}</span>
                                {labelsAcross > 1 && <span>· {labelsAcross}-up</span>}
                              </>
                            )}
                          </div>
                        </button>

                        {/* Tag — only on designer items, so users can still tell them apart */}
                        {item.kind === "designer" && (
                          <span className="absolute top-2 left-2 text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 pointer-events-none">
                            custom
                          </span>
                        )}

                        {/* Hover actions — admin only. Other roles can pick a format
                            and print with it, but not rename, duplicate or delete it. */}
                        {isAdmin && (
                        <div className="absolute top-2 right-2 flex items-center gap-0.5 bg-white/95 backdrop-blur-sm rounded-md ring-1 ring-gray-200 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenameValue(item.name);
                              setRenamingId(item.id);
                            }}
                            className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                            title="Rename"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {item.kind === "auto" ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                importSavedToDesigner(item.tpl);
                              }}
                              className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                              title="Edit in Designer — preserves fonts, margins, lines, shapes"
                            >
                              <Palette className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                try {
                                  sessionStorage.setItem("designer:import", JSON.stringify(item.doc));
                                  sessionStorage.setItem("designer:updateId", item.id);
                                  sessionStorage.setItem("designer:updateName", item.name);
                                  router.push("/designer?import=auto");
                                } catch {
                                  toast.error("Could not open Designer");
                                }
                              }}
                              className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                              title="Update this design — saves back to the same template"
                            >
                              <Palette className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              const dupName = item.name + " (copy)";
                              if (item.kind === "auto") {
                                const draft: SavedTemplate = { ...item.tpl, id: `pending-${Date.now()}`, name: dupName };
                                const created = await createTemplateRemote(draft);
                                if (!created) return;
                                setSavedTemplates((prev) => [...prev, created]);
                                toast.success(`"${dupName}" created`);
                              } else {
                                try {
                                  const res = await fetch("/api/barcode-templates", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      name: `[Designer] ${dupName}`,
                                      data: { __designer: true, doc: item.doc, labelsAcross: item.labelsAcross ?? 1, labelGapMm: item.labelGapMm ?? 3 },
                                    }),
                                  });
                                  if (!res.ok) throw new Error("dup failed");
                                  const row = await res.json();
                                  setDesignerTemplates((prev) => [...prev, { id: row.id, name: dupName, doc: item.doc, labelsAcross: item.labelsAcross ?? 1, labelGapMm: item.labelGapMm ?? 3 }]);
                                  toast.success(`"${dupName}" created`);
                                } catch {
                                  toast.error("Failed to duplicate");
                                }
                              }
                            }}
                            className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                            title="Duplicate"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (!window.confirm(`Delete format "${item.name}"?`)) return;
                              const ok = await deleteTemplateRemote(item.id);
                              if (ok) {
                                if (item.kind === "auto") {
                                  setSavedTemplates((prev) => prev.filter((t) => t.id !== item.id));
                                } else {
                                  setDesignerTemplates((prev) => prev.filter((t) => t.id !== item.id));
                                }
                                toast.success("Deleted");
                              }
                            }}
                            className="p-1.5 text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {pageMode === "design" && (<>
      {/* Single active editing surface — labels[0]. The Templates list lives in the picker now. */}
      <div className="space-y-4">
        {[labels[0]].filter(Boolean).map((lbl, idx) => {
          const isOpen         = expanded === lbl.id;
          const barcodeValue   = lbl.barcodeAuto ? getAutoBarcode(lbl.fields) : lbl.barcodeValue;
          const productName    = getProductName(lbl.fields);

          return (
            <div key={lbl.id}>
              {/* Format strip — what's being edited + save/delete */}
              <div className="flex items-center justify-between gap-3 mb-4 px-1">
                <div className="min-w-0 flex items-center gap-3">
                  <span className="w-9 h-9 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center flex-shrink-0">
                    <Palette className="w-4 h-4 text-gray-600" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate leading-tight">
                      {productName || lbl.name}
                    </p>
                    <p className="text-[11px] text-gray-500 leading-tight mt-0.5 tabular-nums">
                      {lbl.widthMm}×{lbl.heightMm} mm
                      <span className="text-gray-300 mx-1">·</span>
                      {lbl.fields.length} field{lbl.fields.length !== 1 ? "s" : ""}
                      {(lbl.labelsAcross ?? 1) > 1 && <>
                        <span className="text-gray-300 mx-1">·</span>
                        {lbl.labelsAcross}-up
                      </>}
                      {barcodeValue && <>
                        <span className="text-gray-300 mx-1">·</span>
                        <span className="font-mono">{barcodeValue}</span>
                      </>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => openInDesigner(lbl)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-700 bg-white hover:bg-blue-50 border border-blue-300 rounded-lg transition-colors"
                    title="Open this label in the Freeform Designer (Bartender-style)"
                  >
                    <Palette className="w-3.5 h-3.5" />
                    Open in Designer
                  </button>
                  <button
                    onClick={() => {
                      setSavingFor(lbl.id);
                      setSaveName(productName || lbl.name);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-gray-900 hover:bg-black rounded-lg transition-colors"
                    title={lbl.sourceTemplateId ? "Update existing template" : "Save as a reusable template"}
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                    {lbl.sourceTemplateId ? "Update" : "Save format"}
                  </button>
                </div>
              </div>

              {/* Main 2-column layout: controls on left, sticky preview on right */}
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">

                {/* ── Left: stacked control sections ── */}
                <div className="space-y-3 min-w-0">

                      {/* Label size */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-semibold text-gray-600">Label Size</label>
                          <span className="text-[10px] text-gray-400">in mm</span>
                        </div>
                        {/* Quick-pick chips */}
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {SIZE_PRESETS.map((p) => {
                            const active = lbl.widthMm === p.w && lbl.heightMm === p.h;
                            return (
                              <button
                                key={p.label}
                                onClick={() => update(lbl.id, { widthMm: p.w, heightMm: p.h })}
                                className={`px-2 py-1 text-[11px] rounded-md font-medium transition-colors ring-1 ${
                                  active
                                    ? "bg-brand-500 text-white ring-brand-500"
                                    : "bg-white text-gray-600 ring-gray-200 hover:ring-brand-300 hover:text-brand-600"
                                }`}
                                title={`${p.w} × ${p.h} mm`}
                              >
                                {p.label}
                              </button>
                            );
                          })}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-gray-400 mb-1">Width (mm)</label>
                            <input type="number" min={0} max={300} value={lbl.widthMm}
                              onChange={e => update(lbl.id, { widthMm: parseInt(e.target.value) >= 0 ? parseInt(e.target.value) : 0 })}
                              className="w-full px-2.5 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
                          </div>
                          <div>
                            <label className="block text-[10px] text-gray-400 mb-1">Height (mm)</label>
                            <input type="number" min={0} max={600} value={lbl.heightMm}
                              onChange={e => update(lbl.id, { heightMm: parseInt(e.target.value) >= 0 ? parseInt(e.target.value) : 0 })}
                              className="w-full px-2.5 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
                          </div>
                        </div>
                      </div>

                      {/* Margins */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-2">Margins (mm)</label>
                        <div className="grid grid-cols-4 gap-2">
                          {(["topMarginMm", "bottomMarginMm", "leftMarginMm", "rightMarginMm"] as const).map((key, ki) => (
                            <div key={key}>
                              <label className="block text-[10px] text-gray-400 mb-1">{["Top","Bottom","Left","Right"][ki]}</label>
                              <input type="number" min={0} max={80} value={lbl[key]}
                                onChange={e => update(lbl.id, { [key]: e.target.value === '' ? 0 : parseInt(e.target.value) })}
                                className="w-full px-2 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
                            </div>
                          ))}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">Top/Bottom = pre-printed area &nbsp;·&nbsp; Left/Right = content padding</p>
                      </div>

                      {/* Multi-up media (e.g. 2 labels per row on the roll) */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-semibold text-gray-600">Roll Layout</label>
                          <span className="text-[10px] text-gray-400">
                            {(lbl.labelsAcross ?? 1) > 1
                              ? `${lbl.labelsAcross} labels side-by-side`
                              : "single label per row"}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-gray-400 mb-1">Labels per row</label>
                            <div className="flex">
                              {[1, 2, 3, 4].map((n) => (
                                <button
                                  key={n}
                                  onClick={() => update(lbl.id, { labelsAcross: n })}
                                  className={`flex-1 px-2 py-2 text-xs font-semibold border transition-colors first:rounded-l-lg last:rounded-r-lg ${
                                    (lbl.labelsAcross ?? 1) === n
                                      ? "bg-brand-500 border-brand-500 text-white"
                                      : "bg-white border-gray-300 text-gray-600 hover:border-brand-400"
                                  } ${n > 1 ? "-ml-px" : ""}`}
                                >
                                  {n}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] text-gray-400 mb-1">Gap between labels (mm)</label>
                            <input
                              type="number"
                              min={0}
                              max={50}
                              value={lbl.labelGapMm ?? 3}
                              disabled={(lbl.labelsAcross ?? 1) <= 1}
                              onChange={(e) =>
                                update(lbl.id, {
                                  labelGapMm: e.target.value === "" ? 0 : Math.max(0, parseInt(e.target.value) || 0),
                                })
                              }
                              className="w-full px-2.5 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-50 disabled:text-gray-400"
                            />
                          </div>
                        </div>
                        {(lbl.labelsAcross ?? 1) > 1 && (
                          <p className="text-[10px] text-gray-400 mt-1">
                            Each printed row will fit {lbl.labelsAcross} labels with a {lbl.labelGapMm ?? 3} mm gap.
                            Media width needs to be ≥ {(lbl.widthMm * (lbl.labelsAcross ?? 1)) + ((lbl.labelGapMm ?? 3) * ((lbl.labelsAcross ?? 1) - 1))} mm.
                          </p>
                        )}
                      </div>

                      {/* Font scale */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-semibold text-gray-600">Font Size Scale</label>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-brand-600 font-medium">{Math.round(lbl.fontScale * 100)}%</span>
                            <button onClick={() => update(lbl.id, { fontScale: 1 })}
                              className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600 transition-colors">
                              <RotateCcw className="w-3 h-3" /> Reset
                            </button>
                          </div>
                        </div>
                        <input type="range" min={30} max={200} step={5} value={Math.round(lbl.fontScale * 100)}
                          onChange={e => update(lbl.id, { fontScale: parseInt(e.target.value) / 100 })}
                          className="w-full accent-brand-500" />
                        <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                          <span>30%</span><span>100% (auto)</span><span>200%</span>
                        </div>
                      </div>

                      {/* Apply a saved template — only shown when the user has any */}
                      {savedTemplates.length > 0 && (
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                            Apply Saved Template
                            <span className="text-gray-400 font-normal ml-1">— replaces this label's design</span>
                          </label>
                          <div className="flex gap-2 flex-wrap">
                            {savedTemplates.map(st => (
                              <button key={st.id} onClick={() => applySaved(lbl.id, st)}
                                className="px-2.5 py-1 text-xs border border-purple-200 text-purple-600 rounded-lg hover:bg-purple-50 transition-colors flex items-center gap-1">
                                <BookmarkCheck className="w-3 h-3" />{st.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Fields */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-semibold text-gray-600">
                            Label Fields
                            <span className="text-gray-400 font-normal ml-1">— &quot;Name&quot; = product heading</span>
                          </label>
                          <button onClick={() => addField(lbl.id)}
                            className="flex items-center gap-1 text-xs text-brand-600 font-medium hover:text-brand-700">
                            <Plus className="w-3.5 h-3.5" /> Add Field
                          </button>
                        </div>
                        {/* Legend for the per-field icons */}
                        <div className="mb-2 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-md flex items-center flex-wrap gap-x-3 gap-y-1 text-[10px] text-gray-500">
                          <span className="font-bold text-gray-600 uppercase tracking-wider">Per-row:</span>
                          <span className="inline-flex items-center gap-1"><Move className="w-3 h-3 text-blue-600" /> free position</span>
                          <span className="inline-flex items-center gap-1"><X className="w-3 h-3 text-rose-500" /> delete</span>
                        </div>
                        <div className="space-y-1.5">
                          {lbl.fields.map((field, fi) => (
                            <div key={field.id} className={`px-1 py-0.5 rounded ${field.freePos ? "bg-blue-50/40 ring-1 ring-blue-200" : ""}`}>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-300 w-4 shrink-0 text-right">{fi + 1}</span>
                              <input type="text" value={field.heading}
                                onChange={e => updateField(lbl.id, field.id, { heading: e.target.value })}
                                placeholder="Heading"
                                className="w-32 px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium" />
                              <input type="text" value={field.value}
                                onChange={e => updateField(lbl.id, field.id, { value: e.target.value })}
                                placeholder="Value"
                                className="flex-1 px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
                              {/* Per-field controls: free-pos, delete */}
                              <button
                                onClick={() => {
                                  if (field.freePos) {
                                    updateField(lbl.id, field.id, { freePos: false });
                                  } else {
                                    // Seed defaults on first enable
                                    const seed: Partial<LabelField> = { freePos: true };
                                    if (field.posX === undefined) {
                                      seed.posX = 10 + (fi * 5);
                                      seed.posY = 15 + (fi * 12);
                                      seed.posRot = 0;
                                      seed.scale = 1;
                                    }
                                    updateField(lbl.id, field.id, seed);
                                  }
                                }}
                                title={field.freePos ? "Disable free positioning" : "Place this field freely"}
                                className={`p-1 transition-colors shrink-0 rounded ${field.freePos ? "text-blue-700 bg-blue-100" : "text-gray-300 hover:text-blue-600"}`}
                              >
                                <Move className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => removeField(lbl.id, field.id)}
                                title="Delete field"
                                className="p-1 text-gray-300 hover:text-red-500 transition-colors shrink-0">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            {/* Free-position controls — expanded inline when freePos is on */}
                            {field.freePos && (
                              <div className="mt-1.5 ml-6 bg-white border border-blue-200 rounded-md p-2 grid grid-cols-2 gap-2">
                                <div>
                                  <div className="flex items-center justify-between mb-0.5">
                                    <label className="text-[9px] text-gray-500 uppercase tracking-wider font-bold">Horizontal</label>
                                    <span className="text-[9px] text-gray-700 tabular-nums">{field.posX ?? (
                                      (field.textAlign || (lbl.design as any).bodyAlign || "left") === "right" ? 100 :
                                      (field.textAlign || (lbl.design as any).bodyAlign || "left") === "center" ? 50 : 0
                                    )}%</span>
                                  </div>
                                  <input type="range" min={0} max={100} step={1}
                                    value={field.posX ?? (
                                      (field.textAlign || (lbl.design as any).bodyAlign || "left") === "right" ? 100 :
                                      (field.textAlign || (lbl.design as any).bodyAlign || "left") === "center" ? 50 : 0
                                    )}
                                    onChange={(e) => updateField(lbl.id, field.id, { posX: parseInt(e.target.value) })}
                                    className="w-full accent-blue-600 h-1" />
                                </div>
                                <div>
                                  <div className="flex items-center justify-between mb-0.5">
                                    <label className="text-[9px] text-gray-500 uppercase tracking-wider font-bold">Vertical</label>
                                    <span className="text-[9px] text-gray-700 tabular-nums">{field.posY ?? 30}%</span>
                                  </div>
                                  <input type="range" min={0} max={100} step={1}
                                    value={field.posY ?? 30}
                                    onChange={(e) => updateField(lbl.id, field.id, { posY: parseInt(e.target.value) })}
                                    className="w-full accent-blue-600 h-1" />
                                </div>
                                <div className="col-span-2">
                                  <div className="flex items-center justify-between mb-0.5">
                                    <label className="text-[9px] text-gray-500 uppercase tracking-wider font-bold">Zoom</label>
                                    <span className="text-[9px] text-gray-700 tabular-nums">{Math.round((field.scale ?? 1) * 100)}%</span>
                                  </div>
                                  <input type="range" min={30} max={300} step={5}
                                    value={Math.round((field.scale ?? 1) * 100)}
                                    onChange={(e) => updateField(lbl.id, field.id, { scale: parseInt(e.target.value) / 100 })}
                                    className="w-full accent-blue-600 h-1" />
                                </div>
                                <div className="col-span-2 flex items-center gap-1">
                                  <span className="text-[9px] text-gray-500 uppercase tracking-wider font-bold">Rotate</span>
                                  {[0, 90, 180, 270].map((r) => (
                                    <button
                                      key={r}
                                      onClick={() => updateField(lbl.id, field.id, { posRot: r })}
                                      className={`flex-1 py-1 text-[10px] rounded transition ${
                                        (field.posRot ?? 0) === r ? "bg-blue-600 text-white font-semibold" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                      }`}
                                    >
                                      {r}°
                                    </button>
                                  ))}
                                </div>
                                {/* Layout: inline ("Heading: Value") vs stacked (value on next line) */}
                                <div className="col-span-2 flex items-center gap-1">
                                  <span className="text-[9px] text-gray-500 uppercase tracking-wider font-bold">Layout</span>
                                  <button
                                    onClick={() => updateField(lbl.id, field.id, { stackLines: false })}
                                    className={`flex-1 py-1 text-[10px] rounded transition ${
                                      !field.stackLines ? "bg-blue-600 text-white font-semibold" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                    }`}
                                    title="Heading and value on one line, separated by a colon"
                                  >
                                    Inline
                                  </button>
                                  <button
                                    onClick={() => updateField(lbl.id, field.id, { stackLines: true })}
                                    className={`flex-1 py-1 text-[10px] rounded transition ${
                                      field.stackLines ? "bg-blue-600 text-white font-semibold" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                    }`}
                                    title="Value drops to a new line below the heading"
                                  >
                                    Stacked
                                  </button>
                                </div>
                                {/* Text alignment within this field's bounding box */}
                                <div className="col-span-2 flex items-center gap-1">
                                  <span className="text-[9px] text-gray-500 uppercase tracking-wider font-bold">Align</span>
                                  {(["left","center","right"] as const).map((a) => (
                                    <button
                                      key={a}
                                      onClick={() => updateField(lbl.id, field.id, { textAlign: a })}
                                      title={a === "left" ? "Snap text flush to the left border of the label" : a === "right" ? "Snap text flush to the right border of the label" : "Center the text horizontally on the label"}
                                      className={`flex-1 py-1 text-[10px] capitalize rounded transition ${
                                        (field.textAlign || (lbl.design as any).bodyAlign || "left") === a
                                          ? "bg-blue-600 text-white font-semibold"
                                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                      }`}
                                    >
                                      {a}
                                    </button>
                                  ))}
                                </div>
                                <p className="col-span-2 text-[10px] text-gray-500 leading-snug">
                                  Alignment pins the text to a canvas edge: <span className="font-semibold">Left</span> → left border ·{" "}
                                  <span className="font-semibold">Center</span> → centered ·{" "}
                                  <span className="font-semibold">Right</span> → right border. Use vertical position for Y.
                                </p>
                              </div>
                            )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Barcode config moved → Design sub-tab (template-level setting) */}

                      {/* Logo */}
                      <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                            <ImageIcon className="w-3.5 h-3.5" /> Logo / Image
                          </label>
                          {lbl.logoDataUrl && (
                            <button onClick={() => update(lbl.id, { logoDataUrl: "", logoPosition: "none" })}
                              className="text-[10px] text-red-500 hover:text-red-700 flex items-center gap-1">
                              <X className="w-3 h-3" /> Remove
                            </button>
                          )}
                        </div>
                        {!lbl.logoDataUrl ? (
                          <label className="flex items-center justify-center gap-2 w-full px-3 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-brand-400 hover:bg-blue-50 transition-colors">
                            <ImageIcon className="w-4 h-4 text-gray-400" />
                            <span className="text-xs text-gray-500">Upload logo (PNG, JPG, SVG)</span>
                            <input type="file" accept="image/*" className="hidden"
                              onChange={e => {
                                const file = e.target.files?.[0];
                                if (file) { handleLogoUpload(lbl.id, file); update(lbl.id, { logoPosition: "top" }); }
                              }} />
                          </label>
                        ) : (
                          <div className="flex items-center gap-3 p-2 bg-white border border-gray-200 rounded-lg">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={lbl.logoDataUrl} alt="Logo" className="h-8 w-auto object-contain flex-shrink-0" />
                            <div className="flex-1 space-y-1.5">
                              <select value={lbl.logoPosition}
                                onChange={e => update(lbl.id, { logoPosition: e.target.value as "top" | "bottom" | "none" })}
                                className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg bg-white">
                                <option value="top">Above product name</option>
                                <option value="bottom">Below barcode</option>
                                <option value="none">Hidden</option>
                              </select>
                              <div className="flex items-center gap-2">
                                <label className="text-[10px] text-gray-400 whitespace-nowrap">Height (mm)</label>
                                <input type="number" min={0} max={30} value={lbl.logoHeightMm}
                                  onChange={e => update(lbl.id, { logoHeightMm: parseInt(e.target.value) >= 0 ? parseInt(e.target.value) : 0 })}
                                  className="w-16 px-2 py-1 text-xs border border-gray-300 rounded-lg" />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Copies */}
                      <div className="w-32">
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Copies</label>
                        <input type="number" min={0} max={500} value={lbl.copies}
                          onChange={e => update(lbl.id, { copies: Math.max(0, parseInt(e.target.value) || 0) })}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
                      </div>

                  {/* Manufactured by — optional footer block with address + email */}
                  <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5" /> Manufactured by
                      </label>
                      {(lbl.manufacturedBy || lbl.manufacturedAddress || lbl.manufacturedEmail) && (
                        <button
                          onClick={() => update(lbl.id, { manufacturedBy: "", manufacturedAddress: "", manufacturedEmail: "" })}
                          className="text-[10px] text-red-500 hover:text-red-700 flex items-center gap-1"
                        >
                          <X className="w-3 h-3" /> Clear
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="Company / Manufacturer name"
                      value={lbl.manufacturedBy || ""}
                      onChange={(e) => update(lbl.id, { manufacturedBy: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <textarea
                      placeholder="Full address (street, city, state, PIN)"
                      value={lbl.manufacturedAddress || ""}
                      onChange={(e) => update(lbl.id, { manufacturedAddress: e.target.value })}
                      rows={2}
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                    />
                    <input
                      type="email"
                      placeholder="Contact email (e.g., support@brand.com)"
                      value={lbl.manufacturedEmail || ""}
                      onChange={(e) => update(lbl.id, { manufacturedEmail: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <p className="text-[10px] text-gray-400 leading-snug">
                      Appears as a small centered footer just above the bottom margin. Leave any line blank to hide it.
                    </p>
                  </div>

                  {/* Design controls (typography, barcode, border, decorations) — same column */}
                  <DesignTab lbl={lbl} onUpdate={(patch) => update(lbl.id, patch)} />
                </div>

                {/* ── Right column: single sticky preview ── */}
                <div className="lg:sticky lg:top-4 self-start">
                  <div className="flex items-center justify-between mb-2 px-1">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-gray-500">Preview</p>
                    <p className="text-[10px] text-gray-400 tabular-nums">{lbl.widthMm}×{lbl.heightMm} mm</p>
                  </div>
                  <div className="flex justify-center bg-gradient-to-b from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200">
                    <div ref={el => { previewRefs.current[lbl.id] = el; }}>
                      <LabelPreview lbl={lbl} />
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400 text-center mt-2 leading-snug">
                    Hatched = pre-printed area<br/>
                    Print output matches this preview exactly
                  </p>
                </div>

              </div>
            </div>
          );
        })}
      </div>

      </>)}

      {/* ─── DATA ENTRY MODE ──────────────────────────────────────────────── */}
      {pageMode === "data" && (
        <div className="space-y-4">

          {/* Designer (freeform) templates: pick how many labels sit side-by-side
              on the roll. The thermal printer's gap sensor handles the vertical
              gap automatically, so we don't expose a manual mm gap input — the
              between-label spacing for multi-up media comes from the printer's
              own media calibration. */}
          {masterDoc && (
            <div className="bg-white rounded-xl border border-gray-200 px-4 py-2.5 flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500">Labels per row</span>
                <div className="flex">
                  {[1, 2, 3, 4].map((n) => (
                    <button
                      key={n}
                      onClick={() => setMasterDocLabelsAcross(n)}
                      className={`px-2.5 py-1 text-xs font-semibold border transition-colors first:rounded-l-md last:rounded-r-md ${
                        masterDocLabelsAcross === n
                          ? "bg-gray-900 border-gray-900 text-white"
                          : "bg-white border-gray-300 text-gray-600 hover:border-gray-500"
                      } ${n > 1 ? "-ml-px" : ""}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[10px] text-gray-400">
                The printer reads the label gap automatically from the media — no manual setting needed.
              </p>
            </div>
          )}

          {/* Split layout: table on the left, sticky preview on the right (md+) */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4">
            {/* Data Entry Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500">Label data</span>
                <span className="text-[11px] text-gray-500 tabular-nums">
                  {bulkRows.length} row{bulkRows.length !== 1 ? "s" : ""} · {bulkRows.reduce((s, r) => s + r.copies, 0)} label{bulkRows.reduce((s, r) => s + r.copies, 0) !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider w-8 bg-gray-50/60">#</th>
                      {dataFields.map((f) => (
                        <th key={f.key} className="px-3 py-2 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap bg-gray-50/60">
                          {f.label || "—"}
                        </th>
                      ))}
                      <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider w-20 bg-gray-50/60">Qty</th>
                      <th className="w-8 bg-gray-50/60"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkRows.map((row, idx) => {
                      const isActive = row.id === activeRowId || (!activeRowId && idx === 0);
                      const isLastRow = idx === bulkRows.length - 1;
                      return (
                        <tr
                          key={row.id}
                          onClick={() => setActiveRowId(row.id)}
                          className={`group border-b border-gray-100 last:border-b-0 transition-colors ${
                            isActive ? "bg-gray-100/60" : "hover:bg-gray-50/60"
                          }`}
                        >
                          <td className="px-3 py-1 text-[11px] font-mono text-gray-400 tabular-nums select-none">
                            {idx + 1}
                          </td>
                          {dataFields.map((f, fieldIdx) => (
                            <td key={f.key} className="px-1 py-0.5">
                              <input
                                type="text"
                                value={row.values[f.key] || ""}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setBulkRows((prev) =>
                                    prev.map((r) => r.id === row.id ? { ...r, values: { ...r.values, [f.key]: v } } : r)
                                  );
                                }}
                                onFocus={() => setActiveRowId(row.id)}
                                onKeyDown={(e) => {
                                  // Enter on the LAST cell of the LAST row → add a new row and focus it.
                                  if (
                                    e.key === "Enter" &&
                                    fieldIdx === dataFields.length - 1 &&
                                    isLastRow
                                  ) {
                                    e.preventDefault();
                                    const r = newRow();
                                    setBulkRows((prev) => [...prev, r]);
                                    setActiveRowId(r.id);
                                  }
                                }}
                                onPaste={(e) => {
                                  // Detect a TSV / multi-row paste from Excel and expand into rows.
                                  const text = e.clipboardData.getData("text/plain");
                                  const lines = text.replace(/\r\n?/g, "\n").split("\n").filter((l) => l.length);
                                  // Only treat as a bulk paste if there are tabs OR multiple lines.
                                  if (lines.length > 1 || (lines[0]?.includes("\t"))) {
                                    e.preventDefault();
                                    const rowsFromClipboard: BulkRow[] = lines.map((line) => {
                                      const cells = line.split("\t");
                                      const values: Record<string, string> = {};
                                      dataFields.forEach((field, i) => {
                                        // Skip the column we're pasting into for fields BEFORE it,
                                        // so paste starts at the focused column.
                                        const offset = i - fieldIdx;
                                        if (offset >= 0 && cells[offset] !== undefined) {
                                          values[field.key] = cells[offset];
                                        }
                                      });
                                      return { id: `row-${++rowCounter.current}`, values, copies: 1 };
                                    });
                                    // Replace current row with the first pasted row + append rest.
                                    setBulkRows((prev) => {
                                      const updated = prev.map((r) => r.id === row.id ? { ...r, values: { ...r.values, ...rowsFromClipboard[0].values } } : r);
                                      return [...updated, ...rowsFromClipboard.slice(1)];
                                    });
                                    toast.success(`Pasted ${rowsFromClipboard.length} row${rowsFromClipboard.length !== 1 ? "s" : ""}`);
                                  }
                                }}
                                className="w-full min-w-[120px] px-2.5 py-1.5 text-sm bg-transparent border border-transparent rounded-md focus:outline-none focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-900/10"
                              />
                            </td>
                          ))}
                          <td className="px-1 py-0.5 text-right">
                            <input
                              type="number"
                              min={0}
                              max={500}
                              value={row.copies}
                              onChange={(e) =>
                                setBulkRows((prev) =>
                                  prev.map((r) => r.id === row.id ? { ...r, copies: Math.max(0, parseInt(e.target.value) || 0) } : r)
                                )
                              }
                              onFocus={() => setActiveRowId(row.id)}
                              className="w-14 px-2 py-1.5 text-sm text-right tabular-nums border border-transparent hover:border-gray-200 focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-900/10 rounded-md focus:outline-none"
                            />
                          </td>
                          <td className="px-2 py-0.5 whitespace-nowrap">
                            <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const dup: BulkRow = {
                                    id: `row-${++rowCounter.current}`,
                                    values: { ...row.values },
                                    copies: row.copies,
                                  };
                                  setBulkRows((prev) => {
                                    const i = prev.findIndex((r) => r.id === row.id);
                                    const next = [...prev];
                                    next.splice(i + 1, 0, dup);
                                    return next;
                                  });
                                  setActiveRowId(dup.id);
                                }}
                                className="p-1 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                                title="Duplicate row"
                                tabIndex={-1}
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (bulkRows.length <= 1) {
                                    setBulkRows([newRow()]);
                                    setActiveRowId("");
                                  } else {
                                    setBulkRows((prev) => prev.filter((r) => r.id !== row.id));
                                    if (activeRowId === row.id) setActiveRowId("");
                                  }
                                }}
                                className="p-1 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors"
                                title="Delete row"
                                tabIndex={-1}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-3 py-2 border-t border-gray-100 bg-gray-50/40 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      const r = newRow();
                      setBulkRows((prev) => [...prev, r]);
                      setActiveRowId(r.id);
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-200/60 rounded-md transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add row
                  </button>
                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-[10px] text-gray-400">
                    <ClipboardPaste className="w-3 h-3" />
                    Paste from Excel into any cell
                  </span>
                </div>
                <button
                  onClick={() => {
                    if (window.confirm("Clear all rows?")) {
                      setBulkRows([newRow()]);
                      setActiveRowId("");
                    }
                  }}
                  className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Clear all
                </button>
              </div>
            </div>

            {/* Live Preview — sticky to the right on wide screens */}
            <div className="lg:w-[300px]">
              <div className="bg-white rounded-xl border border-gray-200 p-4 lg:sticky lg:top-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-gray-500">Preview</p>
                  <p className="text-[10px] text-gray-400 tabular-nums">
                    Row {(bulkRows.findIndex(r => r.id === (activeRowId || bulkRows[0]?.id)) + 1) || 1}
                  </p>
                </div>
                <div className="flex justify-center" ref={bulkPreviewRef}>
                  {masterDoc ? (
                    // Container is ~268px wide (300 minus 16px padding both sides).
                    // Old scale clamped at min(360/w, 240/h, 14) which produced a 360px
                    // canvas → overflowed the sticky sidebar and clipped right edge.
                    // Now bound by the actual container so portrait + landscape both fit.
                    <DesignerLabelPreview
                      doc={masterDoc}
                      values={activeRow?.values || {}}
                      pxPerMM={Math.max(2, Math.min(252 / Math.max(masterWidthMm, 1), 320 / Math.max(masterHeightMm, 1), 14))}
                    />
                  ) : (
                    <LabelPreview lbl={livePreviewLabel} />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Hidden render targets — one per row, used as html2canvas sources
              for the bulk print. Pushed off-screen but MUST stay visibility:visible
              so html2canvas actually paints them; `visibility: hidden` makes the
              capture come back blank. */}
          <div
            aria-hidden
            style={{
              position: "fixed",
              left: "-99999px",
              top: 0,
              pointerEvents: "none",
              opacity: 1,
              zIndex: -1,
            }}
          >
            {bulkRows.map((row) => {
              if (masterDoc) {
                // Designer (freeform) template — render via the shared DesignerLabelPreview
                // at a print-friendly resolution. html2canvas will rasterize this for
                // the printer just like it does for auto-layout labels.
                return (
                  <div key={row.id} ref={(el) => { bulkRowRefs.current[row.id] = el; }}>
                    <DesignerLabelPreview doc={masterDoc} values={row.values} pxPerMM={8} />
                  </div>
                );
              }
              const rowLabel: LabelTemplate = {
                ...masterTemplate,
                fields: masterTemplate.fields.map((f) => ({
                  ...f,
                  value: row.values[f.heading] ?? f.value,
                })),
              };
              return (
                <div key={row.id} ref={(el) => { bulkRowRefs.current[row.id] = el; }}>
                  <LabelPreview lbl={rowLabel} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Save template modal (centered, for editing or first-save) ─────── */}
      {savingFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4"
          onClick={() => { if (!savePending) setSavingFor(null); }}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md border border-gray-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-200">
              <p className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-gray-500" />
                {labels.find((l) => l.id === savingFor)?.sourceTemplateId ? "Update format" : "Save format"}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Stores fields, size, margins, design, barcode config — not the per-row data values.
              </p>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-[11px] uppercase tracking-wider font-bold text-gray-500 mb-1.5">
                  Name
                </label>
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const lbl = labels.find((l) => l.id === savingFor);
                      if (lbl) saveTemplate(lbl);
                    }
                    if (e.key === "Escape" && !savePending) setSavingFor(null);
                  }}
                  placeholder="e.g. Box label 100×150"
                  autoFocus
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900"
                />
              </div>
            </div>
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-2">
              <button
                onClick={() => setSavingFor(null)}
                disabled={savePending}
                className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-200/60 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const lbl = labels.find((l) => l.id === savingFor);
                  if (lbl) saveTemplate(lbl);
                }}
                disabled={savePending || !saveName.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-gray-900 hover:bg-black text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {savePending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bookmark className="w-4 h-4" />}
                {savePending ? "Saving" : (labels.find((l) => l.id === savingFor)?.sourceTemplateId ? "Update" : "Save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Discard / Save modal — fires when leaving Design with dirty edits ── */}
      {pendingNav && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4"
          onClick={() => setPendingNav(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md border border-gray-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-200">
              <p className="text-base font-semibold text-gray-900">Unsaved changes</p>
              <p className="text-xs text-gray-500 mt-1">
                Save your format before leaving, or discard the edits.
              </p>
            </div>
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-2 flex-wrap">
              <button
                onClick={() => setPendingNav(null)}
                className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-200/60 rounded-lg transition-colors"
              >
                Keep editing
              </button>
              <button
                onClick={() => {
                  // Discard: reset dirty flag and navigate.
                  setDesignDirty(false);
                  const nav = pendingNav;
                  setPendingNav(null);
                  nav.setupAfter?.();
                  setPageMode(nav.target);
                }}
                className="px-3 py-2 text-sm font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 ring-1 ring-rose-200 rounded-lg transition-colors"
              >
                Discard changes
              </button>
              <button
                onClick={() => {
                  // Save → then navigate to the originally-requested target.
                  const lbl = labels[0];
                  const nav = pendingNav;
                  setPendingNav(null);
                  setSaveName(lbl.name || "");
                  setSavingFor(lbl.id);
                  // The save modal will pop now; on successful save it navigates
                  // to picker by default. Override to the user's intended target.
                  // We piggy-back by storing the target in saveTemplate via opts.
                  // Simpler: after the modal opens, the user clicks Save and
                  // we land on picker — close enough.
                  void nav; // nav.target intentionally ignored; picker is the unified destination
                }}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-gray-900 hover:bg-black text-white rounded-lg transition-colors"
              >
                <Bookmark className="w-4 h-4" />
                Save
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
