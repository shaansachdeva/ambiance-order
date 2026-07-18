"use client";

/* eslint-disable @next/next/no-img-element */

import {
  useCallback, useEffect, useMemo, useReducer, useRef, useState,
} from "react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import {
  Type, Barcode as BarcodeIcon, QrCode, Image as ImageIcon, Square as RectIcon,
  Circle as CircleIcon, Minus as LineIcon, Database, GripVertical, Eye, EyeOff,
  Lock, Unlock, Trash2, Plus, Save, Printer, Download, FilePlus, Bookmark,
  ZoomIn, ZoomOut, Maximize2, Undo2, Redo2, Grid3x3, Magnet, AlignLeft, AlignCenter,
  AlignRight, Bold, Italic, Underline as UnderlineIcon, RotateCw, ChevronDown,
  ArrowLeft, ChevronRight, Copy as CopyIcon, ClipboardPaste, Layers,
  Settings, X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import toast, { Toaster } from "react-hot-toast";
import { convertAutoLayoutToDesignerDoc } from "@/lib/autoLayoutToDesigner";

/* ─────────────────────────────────────────────────────────────────────────────
   TYPES — every canvas element shares a positional base; type-specific props
   ride on top. Keep one discriminated union so the reducer + renderers stay
   type-safe.
   ─────────────────────────────────────────────────────────────────────────── */

type ElementType =
  | "text" | "barcode" | "qr" | "image" | "rect" | "circle" | "line" | "dynamic";

interface ElementBase {
  id: string;
  type: ElementType;
  name: string;
  x: number; y: number;       // mm
  w: number; h: number;       // mm
  rotation: number;           // deg
  locked: boolean;
  visible: boolean;
  opacity: number;            // 0–1
}

interface TextElement extends ElementBase {
  type: "text";
  text: string;
  fontFamily: string;
  fontSize: number;           // pt
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color: string;
  bgColor: string;            // "" = transparent
  align: "left" | "center" | "right";
  /** Optional advanced typography — all undefined-safe so existing saved docs keep working. */
  vAlign?: "top" | "middle" | "bottom";
  lineHeight?: number;        // unitless multiplier (1.0 = default)
  letterSpacing?: number;     // px
  wrap?: boolean;             // default true; false → single-line shrink
  uppercase?: boolean;
}

interface BarcodeElement extends ElementBase {
  type: "barcode";
  format: string;             // CODE128 / CODE39 / EAN13 / EAN8 / UPC / ITF14 / pharmacode
  value: string;
  showText: boolean;
  barHeight: number;          // px
  barWidth: number;           // px (module width)
  fg: string;
  bg: string;
  quietZone: number;          // px
}

interface QRElement extends ElementBase {
  type: "qr";
  value: string;
  errorLevel: "L" | "M" | "Q" | "H";
  moduleSize: number;
  fg: string;
  bg: string;
}

interface ImageElement extends ElementBase {
  type: "image";
  src: string;                // dataURL
  fit: "fill" | "fit" | "stretch";
}

interface RectElement extends ElementBase {
  type: "rect";
  fill: string;
  borderColor: string;
  borderWidth: number;
  borderStyle: "solid" | "dashed" | "dotted";
  radius: number;
}

interface CircleElement extends ElementBase {
  type: "circle";
  fill: string;
  borderColor: string;
  borderWidth: number;
  borderStyle: "solid" | "dashed" | "dotted";
}

interface LineElement extends ElementBase {
  type: "line";
  color: string;
  strokeWidth: number;
  style: "solid" | "dashed" | "dotted";
}

interface DynamicElement extends ElementBase {
  type: "dynamic";
  fieldName: string;
  fallback: string;
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color: string;
  align: "left" | "center" | "right";
}

type AnyElement =
  | TextElement | BarcodeElement | QRElement | ImageElement
  | RectElement | CircleElement | LineElement | DynamicElement;

type Units = "mm" | "in" | "px";

interface LabelDoc {
  labelName: string;
  width: number;     // in `units`
  height: number;
  units: Units;
  orientation: "portrait" | "landscape";
  bg: string;
  dpi: number;
  bleed: number;
  elements: AnyElement[];
}

interface DesignerState extends LabelDoc {
  selectedIds: string[];
  zoom: number;      // 1 = 100%
  pan: { x: number; y: number };
  gridVisible: boolean;
  snap: boolean;
  history: LabelDoc[];
  historyIndex: number;
  clipboard: AnyElement[];
  openPopup: null | "new" | "barcode" | "data" | "export" | "print";
  rightTab: "properties" | "label";
}

/* ─────────────────────────────────────────────────────────────────────────────
   CONSTANTS / HELPERS
   ─────────────────────────────────────────────────────────────────────────── */

const MM_PER_IN = 25.4;
function toMM(v: number, u: Units) {
  if (u === "mm") return v;
  if (u === "in") return v * MM_PER_IN;
  return v * 0.2645833333; // 1px @ 96dpi → mm
}
function fromMM(mm: number, u: Units) {
  if (u === "mm") return mm;
  if (u === "in") return mm / MM_PER_IN;
  return mm / 0.2645833333;
}
const uid = (() => { let n = 0; return (p = "el") => `${p}-${++n}-${Date.now().toString(36)}`; })();

const FONT_FAMILIES = [
  "system-ui, sans-serif", "Arial, sans-serif", "Helvetica, sans-serif",
  "Georgia, serif", "Times New Roman, serif", "Courier New, monospace",
  "Verdana, sans-serif", "Tahoma, sans-serif", "Trebuchet MS, sans-serif",
];

const BARCODE_FORMATS = [
  "CODE128", "CODE39", "EAN13", "EAN8", "UPC", "ITF14", "pharmacode", "MSI",
];

const SIZE_PRESETS: { label: string; w: number; h: number; u: Units }[] = [
  { label: "Shipping 4×6\"", w: 4,    h: 6,   u: "in" },
  { label: "Product 2×1\"",  w: 2,    h: 1,   u: "in" },
  { label: "Jewelry 1.5×0.75\"", w: 1.5, h: 0.75, u: "in" },
  { label: "Badge 3×2\"",    w: 3,    h: 2,   u: "in" },
  { label: "Label 50×25mm",  w: 50,   h: 25,  u: "mm" },
  { label: "Label 100×50mm", w: 100,  h: 50,  u: "mm" },
];

function defaultDoc(): LabelDoc {
  return {
    labelName: "Untitled Label",
    width: 100, height: 50, units: "mm",
    orientation: "landscape",
    bg: "#ffffff", dpi: 203, bleed: 0,
    elements: [],
  };
}

function makeElement(type: ElementType, cx: number, cy: number): AnyElement {
  const base: ElementBase = {
    id: uid(type),
    type, name: type.charAt(0).toUpperCase() + type.slice(1),
    x: cx - 15, y: cy - 5,
    w: 30, h: 10,
    rotation: 0, locked: false, visible: true, opacity: 1,
  };
  switch (type) {
    case "text":
      return { ...base, type, text: "Sample Text", fontFamily: FONT_FAMILIES[0], fontSize: 12, bold: false, italic: false, underline: false, color: "#1F2937", bgColor: "", align: "left" };
    case "barcode":
      return { ...base, type, w: 50, h: 18, format: "CODE128", value: "1234567890", showText: true, barHeight: 50, barWidth: 2, fg: "#000000", bg: "#ffffff", quietZone: 10 };
    case "qr":
      return { ...base, type, w: 20, h: 20, value: "https://example.com", errorLevel: "M", moduleSize: 4, fg: "#000000", bg: "#ffffff" };
    case "image":
      return { ...base, type, w: 25, h: 25, src: "", fit: "fit" };
    case "rect":
      return { ...base, type, w: 30, h: 15, fill: "#E5E7EB", borderColor: "#1F2937", borderWidth: 1, borderStyle: "solid", radius: 0 };
    case "circle":
      return { ...base, type, w: 20, h: 20, fill: "#E5E7EB", borderColor: "#1F2937", borderWidth: 1, borderStyle: "solid" };
    case "line":
      return { ...base, type, w: 40, h: 0.5, color: "#1F2937", strokeWidth: 1, style: "solid" };
    case "dynamic":
      return { ...base, type, fieldName: "sku", fallback: "{{sku}}", fontFamily: FONT_FAMILIES[0], fontSize: 12, bold: false, italic: false, underline: false, color: "#1F2937", align: "left" };
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   REDUCER — central state. History snapshots happen on user-intent boundaries
   (add/delete/duplicate/property edit commit); transient drags don't pollute.
   ─────────────────────────────────────────────────────────────────────────── */

type Action =
  | { type: "ADD_ELEMENT"; element: AnyElement }
  | { type: "UPDATE_ELEMENT"; id: string; patch: Partial<AnyElement>; commit?: boolean }
  | { type: "UPDATE_ELEMENTS"; ids: string[]; patch: Partial<AnyElement>; commit?: boolean }
  | { type: "DELETE_SELECTED" }
  | { type: "SELECT"; ids: string[] }
  | { type: "SELECT_TOGGLE"; id: string }
  | { type: "DUPLICATE_SELECTED" }
  | { type: "BRING_FRONT" }
  | { type: "SEND_BACK" }
  | { type: "REORDER"; from: number; to: number }
  | { type: "ALIGN"; dir: "left"|"center"|"right"|"top"|"middle"|"bottom"|"dist-h"|"dist-v" }
  | { type: "TOGGLE_LOCK" }
  | { type: "SET_LABEL"; patch: Partial<LabelDoc> }
  | { type: "SET_ZOOM"; zoom: number }
  | { type: "SET_PAN"; pan: { x: number; y: number } }
  | { type: "TOGGLE_GRID" } | { type: "TOGGLE_SNAP" }
  | { type: "UNDO" } | { type: "REDO" }
  | { type: "COPY" } | { type: "CUT" } | { type: "PASTE" }
  | { type: "OPEN_POPUP"; popup: DesignerState["openPopup"] }
  | { type: "SET_RIGHT_TAB"; tab: DesignerState["rightTab"] }
  | { type: "LOAD_DOC"; doc: LabelDoc }
  | { type: "COMMIT" };

const HISTORY_LIMIT = 50;

function snap(state: DesignerState): DesignerState {
  const doc: LabelDoc = {
    labelName: state.labelName, width: state.width, height: state.height,
    units: state.units, orientation: state.orientation, bg: state.bg,
    dpi: state.dpi, bleed: state.bleed, elements: state.elements,
  };
  const history = state.history.slice(0, state.historyIndex + 1);
  history.push(doc);
  while (history.length > HISTORY_LIMIT) history.shift();
  return { ...state, history, historyIndex: history.length - 1 };
}

function reducer(state: DesignerState, action: Action): DesignerState {
  switch (action.type) {
    case "ADD_ELEMENT": {
      const next: DesignerState = { ...state, elements: [...state.elements, action.element], selectedIds: [action.element.id] };
      return snap(next);
    }
    case "UPDATE_ELEMENT": {
      const elements = state.elements.map(el => el.id === action.id ? ({ ...el, ...action.patch } as AnyElement) : el);
      const next = { ...state, elements };
      return action.commit ? snap(next) : next;
    }
    case "UPDATE_ELEMENTS": {
      const idSet = new Set(action.ids);
      const elements = state.elements.map(el => idSet.has(el.id) ? ({ ...el, ...action.patch } as AnyElement) : el);
      const next = { ...state, elements };
      return action.commit ? snap(next) : next;
    }
    case "DELETE_SELECTED": {
      if (!state.selectedIds.length) return state;
      const elements = state.elements.filter(el => !state.selectedIds.includes(el.id) || el.locked);
      return snap({ ...state, elements, selectedIds: [] });
    }
    case "SELECT": return { ...state, selectedIds: action.ids };
    case "SELECT_TOGGLE": {
      const has = state.selectedIds.includes(action.id);
      return { ...state, selectedIds: has ? state.selectedIds.filter(i => i !== action.id) : [...state.selectedIds, action.id] };
    }
    case "DUPLICATE_SELECTED": {
      if (!state.selectedIds.length) return state;
      const copies: AnyElement[] = state.elements
        .filter(el => state.selectedIds.includes(el.id))
        .map(el => ({ ...el, id: uid(el.type), x: el.x + 3, y: el.y + 3 }));
      return snap({ ...state, elements: [...state.elements, ...copies], selectedIds: copies.map(c => c.id) });
    }
    case "BRING_FRONT": {
      const sel = state.elements.filter(el => state.selectedIds.includes(el.id));
      const rest = state.elements.filter(el => !state.selectedIds.includes(el.id));
      return snap({ ...state, elements: [...rest, ...sel] });
    }
    case "SEND_BACK": {
      const sel = state.elements.filter(el => state.selectedIds.includes(el.id));
      const rest = state.elements.filter(el => !state.selectedIds.includes(el.id));
      return snap({ ...state, elements: [...sel, ...rest] });
    }
    case "REORDER": {
      const arr = [...state.elements];
      const [m] = arr.splice(action.from, 1);
      arr.splice(action.to, 0, m);
      return snap({ ...state, elements: arr });
    }
    case "ALIGN": {
      if (!state.selectedIds.length) return state;
      const sel = state.elements.filter(el => state.selectedIds.includes(el.id));
      if (sel.length === 0) return state;
      const widthMM  = toMM(state.width, state.units);
      const heightMM = toMM(state.height, state.units);
      const bboxL = Math.min(...sel.map(e => e.x));
      const bboxR = Math.max(...sel.map(e => e.x + e.w));
      const bboxT = Math.min(...sel.map(e => e.y));
      const bboxB = Math.max(...sel.map(e => e.y + e.h));

      // Distribute = equalize spacing between elements (needs 3+ items)
      // dist-h: sort by x, keep leftmost+rightmost fixed, evenly space horizontal gaps
      // dist-v: sort by y, keep topmost+bottommost fixed, evenly space vertical gaps
      if (action.dir === "dist-h" || action.dir === "dist-v") {
        if (sel.length < 3) return state;
        const axis = action.dir === "dist-h" ? "x" : "y";
        const sizeKey = action.dir === "dist-h" ? "w" : "h";
        const sorted = [...sel].sort((a, b) => a[axis] - b[axis]);
        const first = sorted[0], last = sorted[sorted.length - 1];
        const totalSpan = (last[axis] + last[sizeKey]) - first[axis];
        const totalSize = sorted.reduce((s, e) => s + e[sizeKey], 0);
        const gap = (totalSpan - totalSize) / (sorted.length - 1);
        let cursor = first[axis];
        const positions = new Map<string, number>();
        sorted.forEach((e) => { positions.set(e.id, cursor); cursor += e[sizeKey] + gap; });
        const newElems = state.elements.map(el => {
          if (!positions.has(el.id)) return el;
          return { ...el, [axis]: positions.get(el.id)! } as AnyElement;
        });
        return snap({ ...state, elements: newElems });
      }

      const newElems = state.elements.map(el => {
        if (!state.selectedIds.includes(el.id)) return el;
        let { x, y } = el;
        if (sel.length === 1) {
          if (action.dir === "left")    x = 0;
          if (action.dir === "right")   x = widthMM - el.w;
          if (action.dir === "center")  x = (widthMM - el.w) / 2;
          if (action.dir === "top")     y = 0;
          if (action.dir === "bottom")  y = heightMM - el.h;
          if (action.dir === "middle")  y = (heightMM - el.h) / 2;
        } else {
          if (action.dir === "left")   x = bboxL;
          if (action.dir === "right")  x = bboxR - el.w;
          if (action.dir === "center") x = (bboxL + bboxR) / 2 - el.w / 2;
          if (action.dir === "top")    y = bboxT;
          if (action.dir === "bottom") y = bboxB - el.h;
          if (action.dir === "middle") y = (bboxT + bboxB) / 2 - el.h / 2;
        }
        return { ...el, x, y } as AnyElement;
      });
      return snap({ ...state, elements: newElems });
    }
    case "TOGGLE_LOCK": {
      const elements = state.elements.map(el =>
        state.selectedIds.includes(el.id) ? ({ ...el, locked: !el.locked } as AnyElement) : el
      );
      return snap({ ...state, elements });
    }
    case "SET_LABEL": {
      const next = { ...state, ...action.patch };
      return snap(next);
    }
    case "SET_ZOOM":   return { ...state, zoom: Math.max(0.1, Math.min(8, action.zoom)) };
    case "SET_PAN":    return { ...state, pan: action.pan };
    case "TOGGLE_GRID": return { ...state, gridVisible: !state.gridVisible };
    case "TOGGLE_SNAP": return { ...state, snap: !state.snap };
    case "UNDO": {
      if (state.historyIndex <= 0) return state;
      const idx = state.historyIndex - 1;
      const doc = state.history[idx];
      return { ...state, ...doc, historyIndex: idx, selectedIds: [] };
    }
    case "REDO": {
      if (state.historyIndex >= state.history.length - 1) return state;
      const idx = state.historyIndex + 1;
      const doc = state.history[idx];
      return { ...state, ...doc, historyIndex: idx, selectedIds: [] };
    }
    case "COPY": {
      const sel = state.elements.filter(el => state.selectedIds.includes(el.id));
      return { ...state, clipboard: sel.map(s => ({ ...s })) };
    }
    case "CUT": {
      const sel = state.elements.filter(el => state.selectedIds.includes(el.id));
      const rest = state.elements.filter(el => !state.selectedIds.includes(el.id));
      return snap({ ...state, clipboard: sel.map(s => ({ ...s })), elements: rest, selectedIds: [] });
    }
    case "PASTE": {
      if (!state.clipboard.length) return state;
      const copies = state.clipboard.map(s => ({ ...s, id: uid(s.type), x: s.x + 3, y: s.y + 3 } as AnyElement));
      return snap({ ...state, elements: [...state.elements, ...copies], selectedIds: copies.map(c => c.id) });
    }
    case "OPEN_POPUP":   return { ...state, openPopup: action.popup };
    case "SET_RIGHT_TAB": return { ...state, rightTab: action.tab };
    case "LOAD_DOC":     return snap({ ...state, ...action.doc, selectedIds: [] });
    case "COMMIT":       return snap(state);
  }
}

function initialState(): DesignerState {
  const doc = defaultDoc();
  return {
    ...doc,
    selectedIds: [], zoom: 2.5,
    pan: { x: 0, y: 0 },
    gridVisible: true, snap: true,
    history: [doc], historyIndex: 0,
    clipboard: [],
    openPopup: null,
    rightTab: "properties",
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   ELEMENT RENDERERS — drawn inside an absolutely-positioned wrapper. Each
   uses mm units; the canvas wrapper handles zoom via CSS transform.
   ─────────────────────────────────────────────────────────────────────────── */

function BarcodeSVG({ el, scale }: { el: BarcodeElement; scale: number }) {
  const ref = useRef<SVGSVGElement | null>(null);
  useEffect(() => {
    if (!ref.current || !el.value) return;
    try {
      JsBarcode(ref.current, el.value, {
        format: el.format, displayValue: el.showText, height: el.barHeight,
        width: el.barWidth, lineColor: el.fg, background: el.bg,
        margin: 0, marginLeft: el.quietZone, marginRight: el.quietZone,
      });
    } catch {
      // invalid value for selected format — clear
      if (ref.current) ref.current.innerHTML = "";
    }
  }, [el.value, el.format, el.showText, el.barHeight, el.barWidth, el.fg, el.bg, el.quietZone, scale]);
  return <svg ref={ref} style={{ width: "100%", height: "100%", display: "block" }} />;
}

function QRRender({ el }: { el: QRElement }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    if (!el.value) { setSrc(""); return; }
    QRCode.toDataURL(el.value, {
      errorCorrectionLevel: el.errorLevel,
      color: { dark: el.fg, light: el.bg },
      margin: 1, scale: el.moduleSize,
    }).then(setSrc).catch(() => setSrc(""));
  }, [el.value, el.errorLevel, el.fg, el.bg, el.moduleSize]);
  if (!src) return null;
  return <img src={src} alt="QR" style={{ width: "100%", height: "100%", display: "block", imageRendering: "pixelated" }} />;
}

function ElementRenderer({ el, mmToPx }: { el: AnyElement; mmToPx: number }) {
  const common: React.CSSProperties = {
    width: "100%", height: "100%", display: "block",
    pointerEvents: "none", userSelect: "none",
  };
  switch (el.type) {
    case "text": {
      const vAlign = el.vAlign ?? "middle";
      const wrap = el.wrap !== false;
      const displayText = el.uppercase ? (el.text || "").toUpperCase() : el.text;
      return (
        <div style={{
          ...common,
          fontFamily: el.fontFamily,
          fontSize: el.fontSize * (mmToPx / (96 / 25.4)),
          fontWeight: el.bold ? 700 : 400,
          fontStyle: el.italic ? "italic" : "normal",
          textDecoration: el.underline ? "underline" : "none",
          color: el.color,
          background: el.bgColor || "transparent",
          textAlign: el.align,
          display: "flex",
          alignItems: vAlign === "top" ? "flex-start" : vAlign === "bottom" ? "flex-end" : "center",
          justifyContent: el.align === "center" ? "center" : el.align === "right" ? "flex-end" : "flex-start",
          overflow: "hidden",
          whiteSpace: wrap ? "pre-wrap" : "nowrap",
          wordBreak: wrap ? "break-word" : "normal",
          padding: "2px 4px", boxSizing: "border-box",
          lineHeight: el.lineHeight ?? 1.2,
          letterSpacing: el.letterSpacing ? `${el.letterSpacing}px` : undefined,
        }}>{displayText}</div>
      );
    }
    case "barcode":
      return <BarcodeSVG el={el} scale={mmToPx} />;
    case "qr":
      return <QRRender el={el} />;
    case "image":
      return el.src
        ? <img src={el.src} alt="" style={{ ...common, objectFit: el.fit === "fill" ? "cover" : el.fit === "stretch" ? "fill" : "contain" }} />
        : <div style={{ ...common, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF", fontSize: 10 }}>No image</div>;
    case "rect":
      return <div style={{ ...common, background: el.fill, border: `${el.borderWidth}px ${el.borderStyle} ${el.borderColor}`, borderRadius: el.radius, boxSizing: "border-box" }} />;
    case "circle":
      return <div style={{ ...common, background: el.fill, border: `${el.borderWidth}px ${el.borderStyle} ${el.borderColor}`, borderRadius: "50%", boxSizing: "border-box" }} />;
    case "line":
      return <div style={{ ...common, borderTop: `${Math.max(1, el.strokeWidth)}px ${el.style} ${el.color}`, height: 0, marginTop: "calc(50% - 0.5px)" }} />;
    case "dynamic":
      return (
        <div style={{
          ...common,
          fontFamily: el.fontFamily,
          fontSize: el.fontSize * (mmToPx / (96 / 25.4)),
          fontWeight: el.bold ? 700 : 400,
          fontStyle: "italic",
          textDecoration: el.underline ? "underline" : "none",
          color: "#6B7280",
          textAlign: el.align,
          display: "flex", alignItems: "center",
          justifyContent: el.align === "center" ? "center" : el.align === "right" ? "flex-end" : "flex-start",
          overflow: "hidden",
          padding: "2px 4px", boxSizing: "border-box",
          background: "#F9FAFB",
        }}>{`{{${el.fieldName}}}`}</div>
      );
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN COMPONENT
   ─────────────────────────────────────────────────────────────────────────── */

const ELEMENT_BUTTONS: { type: ElementType; icon: typeof Type; label: string }[] = [
  { type: "text",    icon: Type,         label: "Text" },
  { type: "barcode", icon: BarcodeIcon,  label: "Barcode" },
  { type: "qr",      icon: QrCode,       label: "QR Code" },
  { type: "image",   icon: ImageIcon,    label: "Image" },
  { type: "rect",    icon: RectIcon,     label: "Rectangle" },
  { type: "circle",  icon: CircleIcon,   label: "Circle" },
  { type: "line",    icon: LineIcon,     label: "Line" },
  { type: "dynamic", icon: Database,     label: "Dynamic" },
];

export default function DesignerPage() {
  // The Designer creates and edits label formats, which is admin-only work —
  // the format API rejects writes from anyone else, so bounce other roles back
  // to the Labels page rather than let them design something they can't save.
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  useEffect(() => {
    if (sessionStatus !== "authenticated") return;
    if ((session?.user as any)?.role !== "ADMIN") router.replace("/barcode");
  }, [sessionStatus, session, router]);

  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  const widthMM  = toMM(state.width, state.units);
  const heightMM = toMM(state.height, state.units);

  // Pixels-per-mm at current zoom. Base 3.78 px/mm = 96dpi screen.
  const PX_PER_MM = 3.78 * state.zoom;

  // ── Canvas refs & pointer handling ──────────────────────────────────────────
  const canvasWrapRef = useRef<HTMLDivElement | null>(null);
  const labelRef = useRef<HTMLDivElement | null>(null);

  const selected = state.elements.filter(e => state.selectedIds.includes(e.id));
  const single = selected.length === 1 ? selected[0] : null;

  /* Add element at canvas center (visible portion). */
  const addElement = useCallback((type: ElementType) => {
    const cx = widthMM / 2;
    const cy = heightMM / 2;
    dispatch({ type: "ADD_ELEMENT", element: makeElement(type, cx, cy) });
  }, [widthMM, heightMM]);

  /* Add a data-bound dynamic field — one-click insert from the Data Fields list */
  const addDataField = useCallback((key: string, label: string) => {
    const cx = widthMM / 2, cy = heightMM / 2;
    const el = makeElement("dynamic", cx, cy) as DynamicElement;
    el.fieldName = key;
    el.fallback = `{{${key}}}`;
    el.name = label;
    dispatch({ type: "ADD_ELEMENT", element: el });
  }, [widthMM, heightMM]);

  /* ── Keyboard shortcuts ────────────────────────────────────────────────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); dispatch({ type: "UNDO" }); return; }
      if (mod && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) { e.preventDefault(); dispatch({ type: "REDO" }); return; }
      if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); dispatch({ type: "DUPLICATE_SELECTED" }); return; }
      if (mod && e.key.toLowerCase() === "c") { dispatch({ type: "COPY" }); return; }
      if (mod && e.key.toLowerCase() === "x") { dispatch({ type: "CUT" }); return; }
      if (mod && e.key.toLowerCase() === "v") { dispatch({ type: "PASTE" }); return; }
      if (mod && e.key.toLowerCase() === "a") { e.preventDefault(); dispatch({ type: "SELECT", ids: state.elements.map(el => el.id) }); return; }
      if (e.key === "Delete" || e.key === "Backspace") { if (state.selectedIds.length) { e.preventDefault(); dispatch({ type: "DELETE_SELECTED" }); } return; }
      if (e.key === "Escape") { dispatch({ type: "SELECT", ids: [] }); return; }
      // Arrow nudge
      const step = e.shiftKey ? 1 : 0.1;
      const move = (dx: number, dy: number) => {
        if (!state.selectedIds.length) return;
        e.preventDefault();
        state.selectedIds.forEach(id => {
          const el = state.elements.find(x => x.id === id); if (!el) return;
          dispatch({ type: "UPDATE_ELEMENT", id, patch: { x: el.x + dx, y: el.y + dy } as Partial<AnyElement>, commit: false });
        });
        dispatch({ type: "COMMIT" });
      };
      if (e.key === "ArrowLeft")  move(-step, 0);
      if (e.key === "ArrowRight") move( step, 0);
      if (e.key === "ArrowUp")    move(0, -step);
      if (e.key === "ArrowDown")  move(0,  step);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.elements, state.selectedIds]);

  /* ── Wheel zoom ────────────────────────────────────────────────────────── */
  useEffect(() => {
    const el = canvasWrapRef.current; if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return; // require modifier so page scroll still works on plain wheel
      e.preventDefault();
      const dir = e.deltaY > 0 ? -0.1 : 0.1;
      dispatch({ type: "SET_ZOOM", zoom: Math.round((state.zoom + dir) * 100) / 100 });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [state.zoom]);

  /* ── Drag/resize handler ───────────────────────────────────────────────── */
  const dragRef = useRef<null | {
    kind: "move" | "resize"; handle?: string;
    startX: number; startY: number;
    origElems: AnyElement[];
    ids: string[];
  }>(null);

  const onPointerDownElement = (e: React.PointerEvent, elId: string) => {
    if (e.button !== 0) return;
    const el = state.elements.find(x => x.id === elId);
    if (!el || el.locked) return;
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    const already = state.selectedIds.includes(elId);
    let ids: string[];
    if (additive) {
      // Ctrl/Shift/Cmd-click: toggle this element in the selection
      ids = already ? state.selectedIds.filter(i => i !== elId) : [...state.selectedIds, elId];
    } else if (already) {
      // Plain click on an already-selected element: keep the whole group so the user can drag it
      ids = state.selectedIds;
    } else {
      // Plain click on a fresh element: select only it
      ids = [elId];
    }
    dispatch({ type: "SELECT", ids });
    if (ids.length > 0) {
      dragRef.current = {
        kind: "move",
        startX: e.clientX, startY: e.clientY,
        origElems: state.elements.filter(x => ids.includes(x.id)).map(x => ({ ...x })),
        ids,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    e.stopPropagation();
  };

  const onPointerDownHandle = (e: React.PointerEvent, elId: string, handle: string) => {
    const el = state.elements.find(x => x.id === elId);
    if (!el || el.locked) return;
    dragRef.current = {
      kind: "resize", handle,
      startX: e.clientX, startY: e.clientY,
      origElems: [{ ...el }],
      ids: [elId],
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    e.stopPropagation();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current; if (!d) return;
    let dxPx = e.clientX - d.startX;
    let dyPx = e.clientY - d.startY;
    // Shift = axis-lock. The dominant axis wins; the other is zeroed so the
    // selection slides along a perfectly straight horizontal or vertical track.
    if (e.shiftKey && d.kind === "move") {
      if (Math.abs(dxPx) >= Math.abs(dyPx)) dyPx = 0; else dxPx = 0;
    }
    const dxMM = dxPx / PX_PER_MM;
    const dyMM = dyPx / PX_PER_MM;
    if (d.kind === "move") {
      d.origElems.forEach(orig => {
        let nx = orig.x + dxMM;
        let ny = orig.y + dyMM;
        if (state.snap) {
          nx = Math.round(nx * 10) / 10;
          ny = Math.round(ny * 10) / 10;
        }
        dispatch({ type: "UPDATE_ELEMENT", id: orig.id, patch: { x: nx, y: ny } as Partial<AnyElement>, commit: false });
      });
    } else if (d.kind === "resize") {
      const o = d.origElems[0]; const h = d.handle!;
      let nx = o.x, ny = o.y, nw = o.w, nh = o.h;
      if (h.includes("e")) nw = Math.max(2, o.w + dxMM);
      if (h.includes("s")) nh = Math.max(1, o.h + dyMM);
      if (h.includes("w")) { nw = Math.max(2, o.w - dxMM); nx = o.x + (o.w - nw); }
      if (h.includes("n")) { nh = Math.max(1, o.h - dyMM); ny = o.y + (o.h - nh); }
      dispatch({ type: "UPDATE_ELEMENT", id: o.id, patch: { x: nx, y: ny, w: nw, h: nh } as Partial<AnyElement>, commit: false });
    }
  };

  const onPointerUp = (_e: React.PointerEvent) => {
    if (dragRef.current) { dragRef.current = null; dispatch({ type: "COMMIT" }); }
  };

  /* ── Right-click context menu ─────────────────────────────────────────── */
  const [ctx, setCtx] = useState<{ x: number; y: number; elId?: string } | null>(null);

  const onCanvasContext = (e: React.MouseEvent) => {
    e.preventDefault();
    const elId = (e.target as HTMLElement).closest("[data-elid]")?.getAttribute("data-elid") || undefined;
    if (elId && !state.selectedIds.includes(elId)) dispatch({ type: "SELECT", ids: [elId] });
    setCtx({ x: e.clientX, y: e.clientY, elId });
  };
  useEffect(() => {
    const close = () => setCtx(null);
    if (ctx) {
      window.addEventListener("click", close);
      return () => window.removeEventListener("click", close);
    }
  }, [ctx]);

  /* ── Canvas click → deselect (only when nothing was just marquee'd) ──── */
  const onCanvasBackgroundClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-elid]")) return;
    if (marqueeJustEnded.current) { marqueeJustEnded.current = false; return; }
    if (!(e.shiftKey || e.ctrlKey || e.metaKey)) {
      dispatch({ type: "SELECT", ids: [] });
    }
  };

  /* ── Marquee (drag-rectangle) selection on label background ──────────── */
  const marqueeJustEnded = useRef(false);
  const marqueeRef = useRef<null | { startX: number; startY: number; baseIds: string[] }>(null);
  const [marquee, setMarquee] = useState<null | { x: number; y: number; w: number; h: number }>(null);

  const onLabelBackgroundPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    // Ignore clicks that started on an element
    if ((e.target as HTMLElement).closest("[data-elid]")) return;
    const rect = labelRef.current?.getBoundingClientRect();
    if (!rect) return;
    marqueeRef.current = {
      startX: e.clientX - rect.left,
      startY: e.clientY - rect.top,
      baseIds: (e.shiftKey || e.ctrlKey || e.metaKey) ? [...state.selectedIds] : [],
    };
    setMarquee({ x: e.clientX - rect.left, y: e.clientY - rect.top, w: 0, h: 0 });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onLabelBackgroundPointerMove = (e: React.PointerEvent) => {
    if (!marqueeRef.current) return;
    const rect = labelRef.current?.getBoundingClientRect();
    if (!rect) return;
    const curX = e.clientX - rect.left;
    const curY = e.clientY - rect.top;
    const sx = marqueeRef.current.startX, sy = marqueeRef.current.startY;
    const x = Math.min(sx, curX), y = Math.min(sy, curY);
    const w = Math.abs(curX - sx), h = Math.abs(curY - sy);
    setMarquee({ x, y, w, h });
    // Live-select elements intersecting the rectangle (in mm)
    const x1 = x / PX_PER_MM, y1 = y / PX_PER_MM;
    const x2 = (x + w) / PX_PER_MM, y2 = (y + h) / PX_PER_MM;
    const hitIds = state.elements
      .filter(el => el.visible && !el.locked)
      .filter(el => !(el.x + el.w < x1 || el.x > x2 || el.y + el.h < y1 || el.y > y2))
      .map(el => el.id);
    const base = marqueeRef.current.baseIds;
    const merged = Array.from(new Set([...base, ...hitIds]));
    dispatch({ type: "SELECT", ids: merged });
  };
  const onLabelBackgroundPointerUp = () => {
    if (marqueeRef.current) {
      marqueeRef.current = null;
      setMarquee(null);
      marqueeJustEnded.current = true;
    }
  };

  /* ── New label apply (popup) ──────────────────────────────────────────── */
  const newLabel = (patch: Partial<LabelDoc>) => {
    dispatch({ type: "LOAD_DOC", doc: { ...defaultDoc(), ...patch } });
    dispatch({ type: "OPEN_POPUP", popup: null });
  };

  /* ── Save template flow — name modal + localStorage + server persistence ─ */
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [savingBusy, setSavingBusy] = useState(false);
  const [templatesPopupTab, setTemplatesPopupTab] = useState<"new" | "saved">("new");
  // When the user lands here via /barcode → "Update design", we hold the
  // existing template id so the next save PATCHes that record instead of
  // creating a new one.
  const [updateTarget, setUpdateTarget] = useState<{ id: string; name: string } | null>(null);
  const saveDoc = () => setSaveModalOpen(true);

  // Direct "Update {original name}" save — bypasses the rename modal entirely.
  const updateExisting = async () => {
    if (!updateTarget) return;
    setSavingBusy(true);
    const doc: LabelDoc = {
      labelName: updateTarget.name, width: state.width, height: state.height,
      units: state.units, orientation: state.orientation, bg: state.bg,
      dpi: state.dpi, bleed: state.bleed, elements: state.elements,
    };
    try {
      const r = await fetch(`/api/barcode-templates/${updateTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `[Designer] ${updateTarget.name}`,
          data: { __designer: true, doc },
        }),
      });
      if (!r.ok) {
        toast.error("Update failed");
        setSavingBusy(false);
        return;
      }
      toast.success(`Updated "${updateTarget.name}"`);
    } catch {
      toast.error("Update failed (network)");
      setSavingBusy(false);
      return;
    }
    setSavingBusy(false);
  };

  const persistTemplate = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) { toast.error("Enter a template name"); return; }
    setSavingBusy(true);
    const doc: LabelDoc = {
      labelName: trimmed, width: state.width, height: state.height,
      units: state.units, orientation: state.orientation, bg: state.bg,
      dpi: state.dpi, bleed: state.bleed, elements: state.elements,
    };
    // 1) Always write to localStorage first — fast, offline-safe, immediate.
    let didLocal = false;
    try {
      const raw = localStorage.getItem("designer:templates");
      const list: Array<{ name: string; savedAt: string; doc: LabelDoc }> = raw ? JSON.parse(raw) : [];
      const existing = list.findIndex(t => t.name === trimmed);
      const entry = { name: trimmed, savedAt: new Date().toISOString(), doc };
      if (existing >= 0) list[existing] = entry; else list.unshift(entry);
      localStorage.setItem("designer:templates", JSON.stringify(list.slice(0, 50)));
      didLocal = true;
    } catch (err) {
      console.error("designer save: localStorage failed", err);
    }
    // 2) Server persistence — PATCH existing record if we know its id (came
    // from /barcode → Update design), otherwise POST a new one.
    try {
      if (updateTarget && trimmed === updateTarget.name) {
        const r = await fetch(`/api/barcode-templates/${updateTarget.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: `[Designer] ${trimmed}`, data: { __designer: true, doc } }),
        });
        if (!r.ok) console.warn("designer save: server returned", r.status);
      } else {
        const r = await fetch("/api/barcode-templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: `[Designer] ${trimmed}`, data: { __designer: true, doc } }),
        });
        if (!r.ok) console.warn("designer save: server returned", r.status);
      }
    } catch (err) {
      console.warn("designer save: server unreachable", err);
    }
    if (state.labelName !== trimmed) dispatch({ type: "SET_LABEL", patch: { labelName: trimmed } });
    setSavingBusy(false);
    if (didLocal) {
      toast.success(`Saved "${trimmed}"`);
      setSaveModalOpen(false);
      // Auto-open Templates → Saved so the user can immediately see the entry.
      // Confirms the save visually rather than making them hunt for it.
      setTemplatesPopupTab("saved");
      dispatch({ type: "OPEN_POPUP", popup: "new" });
    } else {
      toast.error("Save failed (browser storage blocked?)");
    }
  };
  const loadTemplate = (doc: LabelDoc) => {
    dispatch({ type: "LOAD_DOC", doc });
    dispatch({ type: "OPEN_POPUP", popup: null });
  };
  const deleteTemplate = (name: string) => {
    try {
      const raw = localStorage.getItem("designer:templates");
      const list: Array<{ name: string; savedAt: string; doc: LabelDoc }> = raw ? JSON.parse(raw) : [];
      const next = list.filter(t => t.name !== name);
      localStorage.setItem("designer:templates", JSON.stringify(next));
      toast.success(`Deleted "${name}"`);
    } catch {}
  };
  const openTemplatesPopup = () => {
    setTemplatesPopupTab("saved");
    dispatch({ type: "OPEN_POPUP", popup: "new" });
  };

  /* ── Import from Auto Layout (?import=auto) ──────────────────────────── */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("import") !== "auto") return;
    try {
      const raw = sessionStorage.getItem("designer:import");
      if (!raw) return;
      const doc: LabelDoc = JSON.parse(raw);
      dispatch({ type: "LOAD_DOC", doc });
      sessionStorage.removeItem("designer:import");
      // If the caller also passed an update target, capture it so save → PATCH.
      const upId = sessionStorage.getItem("designer:updateId");
      const upName = sessionStorage.getItem("designer:updateName");
      if (upId) {
        setUpdateTarget({ id: upId, name: upName || doc.labelName || "Untitled Label" });
        sessionStorage.removeItem("designer:updateId");
        sessionStorage.removeItem("designer:updateName");
        toast.success("Editing existing design — Update to save");
      } else {
        toast.success("Imported template from Auto Layout");
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ───────────────────────── RENDER ──────────────────────────────────────────

  return (
    <div className="fixed inset-0 flex flex-col bg-white" style={{ fontFamily: "system-ui, sans-serif" }}>
      <Toaster position="top-center" toastOptions={{ duration: 1800 }} />

      {/* Top toolbar */}
      <Toolbar
        labelName={state.labelName}
        onRename={(v) => dispatch({ type: "SET_LABEL", patch: { labelName: v } })}
        zoom={state.zoom}
        onZoom={(z) => dispatch({ type: "SET_ZOOM", zoom: z })}
        onFit={() => {
          const wrap = canvasWrapRef.current;
          if (!wrap) return;
          const padding = 60;
          const fitZ = Math.min(
            (wrap.clientWidth - padding) / (widthMM * 3.78),
            (wrap.clientHeight - padding) / (heightMM * 3.78),
          );
          dispatch({ type: "SET_ZOOM", zoom: Math.max(0.2, Math.min(8, fitZ)) });
        }}
        canUndo={state.historyIndex > 0}
        canRedo={state.historyIndex < state.history.length - 1}
        onUndo={() => dispatch({ type: "UNDO" })}
        onRedo={() => dispatch({ type: "REDO" })}
        gridVisible={state.gridVisible}
        onToggleGrid={() => dispatch({ type: "TOGGLE_GRID" })}
        snap={state.snap}
        onToggleSnap={() => dispatch({ type: "TOGGLE_SNAP" })}
        onNew={() => dispatch({ type: "OPEN_POPUP", popup: "new" })}
        onSave={saveDoc}
        onUpdate={updateTarget ? updateExisting : undefined}
        updateName={updateTarget?.name}
        onTemplates={openTemplatesPopup}
        onPrintPreview={() => dispatch({ type: "OPEN_POPUP", popup: "print" })}
        onExport={() => dispatch({ type: "OPEN_POPUP", popup: "export" })}
        onDataSource={() => dispatch({ type: "OPEN_POPUP", popup: "data" })}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* LEFT SIDEBAR */}
        <LeftSidebar
          onAdd={addElement}
          onAddDataField={addDataField}
          elements={state.elements}
          selectedIds={state.selectedIds}
          onSelect={(id, additive) => {
            if (additive) dispatch({ type: "SELECT_TOGGLE", id });
            else dispatch({ type: "SELECT", ids: [id] });
          }}
          onToggleVisible={(id) => {
            const el = state.elements.find(e => e.id === id); if (!el) return;
            dispatch({ type: "UPDATE_ELEMENT", id, patch: { visible: !el.visible } as Partial<AnyElement>, commit: true });
          }}
          onToggleLock={(id) => {
            const el = state.elements.find(e => e.id === id); if (!el) return;
            dispatch({ type: "UPDATE_ELEMENT", id, patch: { locked: !el.locked } as Partial<AnyElement>, commit: true });
          }}
          onDelete={(id) => {
            dispatch({ type: "SELECT", ids: [id] });
            dispatch({ type: "DELETE_SELECTED" });
          }}
          onReorder={(from, to) => dispatch({ type: "REORDER", from, to })}
        />

        {/* CENTER CANVAS */}
        <div
          ref={canvasWrapRef}
          className="flex-1 relative overflow-auto bg-gray-100"
          onContextMenu={onCanvasContext}
          onClick={onCanvasBackgroundClick}
        >
          {/* Floating alignment toolbar — appears at top of canvas when any element(s) selected.
              onMouseDown stopPropagation prevents the background-click deselect handler
              from firing when the user clicks an alignment button. */}
          {state.selectedIds.length > 0 && (
            <div
              className="sticky top-0 z-30 flex items-center justify-center pt-3 pointer-events-none"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="pointer-events-auto bg-white shadow-lg border border-gray-200 rounded-lg px-2 py-1.5 flex items-center gap-0.5 text-gray-600">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-400 px-1.5 mr-1">Align</span>
                <AlignBtn title="Align Left — snap left edges to leftmost element"   onClick={() => dispatch({ type: "ALIGN", dir: "left" })}><AlignLeft className="w-3.5 h-3.5" /></AlignBtn>
                <AlignBtn title="Align Center — horizontally center on selection" onClick={() => dispatch({ type: "ALIGN", dir: "center" })}><AlignCenter className="w-3.5 h-3.5" /></AlignBtn>
                <AlignBtn title="Align Right — snap right edges to rightmost element"  onClick={() => dispatch({ type: "ALIGN", dir: "right" })}><AlignRight className="w-3.5 h-3.5" /></AlignBtn>
                <div className="w-px h-5 bg-gray-200 mx-1" />
                <AlignBtn title="Align Top — snap top edges to topmost element"    onClick={() => dispatch({ type: "ALIGN", dir: "top" })}><AlignLeft className="w-3.5 h-3.5 -rotate-90" /></AlignBtn>
                <AlignBtn title="Align Middle — vertically center on selection" onClick={() => dispatch({ type: "ALIGN", dir: "middle" })}><AlignCenter className="w-3.5 h-3.5 -rotate-90" /></AlignBtn>
                <AlignBtn title="Align Bottom — snap bottom edges to bottommost element" onClick={() => dispatch({ type: "ALIGN", dir: "bottom" })}><AlignRight className="w-3.5 h-3.5 -rotate-90" /></AlignBtn>
                {state.selectedIds.length >= 3 && (
                  <>
                    <div className="w-px h-5 bg-gray-200 mx-1" />
                    <AlignBtn
                      title="Distribute Horizontally — equalize horizontal spacing between elements"
                      onClick={() => dispatch({ type: "ALIGN", dir: "dist-h" })}
                    >
                      <span className="flex items-center gap-[2px] px-0.5">
                        <span className="w-[3px] h-3 bg-current rounded-sm" />
                        <span className="w-[3px] h-3 bg-current rounded-sm" />
                        <span className="w-[3px] h-3 bg-current rounded-sm" />
                      </span>
                    </AlignBtn>
                    <AlignBtn
                      title="Distribute Vertically — equalize vertical spacing between elements"
                      onClick={() => dispatch({ type: "ALIGN", dir: "dist-v" })}
                    >
                      <span className="flex flex-col items-center gap-[2px] py-0.5">
                        <span className="w-3 h-[3px] bg-current rounded-sm" />
                        <span className="w-3 h-[3px] bg-current rounded-sm" />
                        <span className="w-3 h-[3px] bg-current rounded-sm" />
                      </span>
                    </AlignBtn>
                  </>
                )}
                <div className="w-px h-5 bg-gray-200 mx-1" />
                <AlignBtn title="Bring to Front — move above all other elements" onClick={() => dispatch({ type: "BRING_FRONT" })}><Layers className="w-3.5 h-3.5" /></AlignBtn>
                <AlignBtn title="Send to Back — move below all other elements"   onClick={() => dispatch({ type: "SEND_BACK" })}><Layers className="w-3.5 h-3.5 opacity-50" /></AlignBtn>
                <div className="w-px h-5 bg-gray-200 mx-1" />
                <AlignBtn title="Duplicate selection (⌘D)" onClick={() => dispatch({ type: "DUPLICATE_SELECTED" })}><CopyIcon className="w-3.5 h-3.5" /></AlignBtn>
                <AlignBtn title="Lock / Unlock — prevent further editing"  onClick={() => dispatch({ type: "TOGGLE_LOCK" })}><Lock className="w-3.5 h-3.5" /></AlignBtn>
                <AlignBtn title="Delete selection (Del)"   onClick={() => dispatch({ type: "DELETE_SELECTED" })}><Trash2 className="w-3.5 h-3.5 text-rose-500" /></AlignBtn>
                <div className="w-px h-5 bg-gray-200 mx-1" />
                <span className="text-[10px] text-gray-400 px-1.5">{state.selectedIds.length} selected</span>
              </div>
            </div>
          )}

          {/* Workspace inner — centers the label */}
          <div className="min-h-full min-w-full flex items-center justify-center p-12 relative">
            {/* Top ruler */}
            <Ruler axis="x" lengthMM={widthMM} pxPerMM={PX_PER_MM} />
            {/* Left ruler */}
            <Ruler axis="y" lengthMM={heightMM} pxPerMM={PX_PER_MM} />

            {/* The label canvas */}
            <div
              ref={labelRef}
              data-label-canvas
              onPointerDown={onLabelBackgroundPointerDown}
              onPointerMove={(e) => { onPointerMove(e); onLabelBackgroundPointerMove(e); }}
              onPointerUp={(e) => { onPointerUp(e); onLabelBackgroundPointerUp(); }}
              style={{
                position: "relative",
                width: widthMM * PX_PER_MM,
                height: heightMM * PX_PER_MM,
                background: state.bg,
                boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 6px 24px rgba(0,0,0,0.08)",
                outline: "1px solid #D1D5DB",
              }}
            >
              {state.gridVisible && <GridOverlay pxPerMM={PX_PER_MM} widthMM={widthMM} heightMM={heightMM} />}

              {/* Marquee selection rectangle */}
              {marquee && (
                <div
                  style={{
                    position: "absolute",
                    left: marquee.x, top: marquee.y,
                    width: marquee.w, height: marquee.h,
                    background: "rgba(59,130,246,0.10)",
                    border: "1px solid #3B82F6",
                    pointerEvents: "none",
                    zIndex: 50,
                  }}
                />
              )}

              {state.elements.map((el) => {
                if (!el.visible) return null;
                const isSel = state.selectedIds.includes(el.id);
                return (
                  <div
                    key={el.id}
                    data-elid={el.id}
                    onPointerDown={(e) => onPointerDownElement(e, el.id)}
                    style={{
                      position: "absolute",
                      left: el.x * PX_PER_MM,
                      top:  el.y * PX_PER_MM,
                      width:  Math.max(2, el.w) * PX_PER_MM,
                      height: Math.max(0.5, el.h) * PX_PER_MM,
                      transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                      opacity: el.opacity,
                      outline: isSel ? "1.5px solid #3B82F6" : "none",
                      cursor: el.locked ? "not-allowed" : "move",
                      boxSizing: "border-box",
                    }}
                  >
                    <ElementRenderer el={el} mmToPx={PX_PER_MM} />
                    {isSel && !el.locked && (
                      <>
                        {(["nw","n","ne","e","se","s","sw","w"] as const).map(h => {
                          const pos: React.CSSProperties = {
                            position: "absolute", width: 8, height: 8,
                            background: "#fff", border: "1.5px solid #3B82F6",
                            borderRadius: 1, zIndex: 5,
                          };
                          if (h.includes("n")) pos.top = -4;
                          if (h.includes("s")) pos.bottom = -4;
                          if (h.includes("w")) pos.left = -4;
                          if (h.includes("e")) pos.right = -4;
                          if (h === "n" || h === "s") { pos.left = "50%"; pos.transform = "translateX(-50%)"; }
                          if (h === "e" || h === "w") { pos.top = "50%"; pos.transform = "translateY(-50%)"; }
                          const cursors: Record<string,string> = { n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize", ne: "nesw-resize", sw: "nesw-resize", nw: "nwse-resize", se: "nwse-resize" };
                          pos.cursor = cursors[h];
                          return (
                            <div
                              key={h}
                              onPointerDown={(e) => onPointerDownHandle(e, el.id, h)}
                              style={pos}
                            />
                          );
                        })}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {ctx && (
            <ContextMenu
              x={ctx.x} y={ctx.y}
              hasSelection={state.selectedIds.length > 0}
              hasClipboard={state.clipboard.length > 0}
              onAction={(a) => {
                setCtx(null);
                if (a === "cut")  dispatch({ type: "CUT" });
                if (a === "copy") dispatch({ type: "COPY" });
                if (a === "paste") dispatch({ type: "PASTE" });
                if (a === "duplicate") dispatch({ type: "DUPLICATE_SELECTED" });
                if (a === "delete") dispatch({ type: "DELETE_SELECTED" });
                if (a === "front") dispatch({ type: "BRING_FRONT" });
                if (a === "back") dispatch({ type: "SEND_BACK" });
                if (a === "lock") dispatch({ type: "TOGGLE_LOCK" });
                if (a.startsWith("align-")) dispatch({ type: "ALIGN", dir: a.replace("align-","") as any });
              }}
            />
          )}
        </div>

        {/* RIGHT SIDEBAR */}
        <RightSidebar
          state={state}
          single={single}
          onUpdateLabel={(patch) => dispatch({ type: "SET_LABEL", patch })}
          onUpdateSingle={(patch, commit = false) =>
            single && dispatch({ type: "UPDATE_ELEMENT", id: single.id, patch: patch as Partial<AnyElement>, commit })
          }
          onSetTab={(t) => dispatch({ type: "SET_RIGHT_TAB", tab: t })}
          onOpenBarcodePopup={() => dispatch({ type: "OPEN_POPUP", popup: "barcode" })}
        />
      </div>

      {/* POPUPS */}
      {state.openPopup === "new"     && <NewLabelPopup initialTab={templatesPopupTab} onClose={() => { dispatch({ type: "OPEN_POPUP", popup: null }); setTemplatesPopupTab("new"); }} onCreate={newLabel} onLoadTemplate={loadTemplate} onDeleteTemplate={deleteTemplate} />}
      {saveModalOpen && <SaveTemplatePopup currentName={state.labelName} busy={savingBusy} onClose={() => setSaveModalOpen(false)} onSave={persistTemplate} />}
      {state.openPopup === "barcode" && single?.type === "barcode" && (
        <BarcodePopup
          el={single}
          onClose={() => dispatch({ type: "OPEN_POPUP", popup: null })}
          onApply={(patch) => {
            dispatch({ type: "UPDATE_ELEMENT", id: single.id, patch: patch as Partial<AnyElement>, commit: true });
            dispatch({ type: "OPEN_POPUP", popup: null });
          }}
        />
      )}
      {state.openPopup === "export" && <ExportPopup state={state} onClose={() => dispatch({ type: "OPEN_POPUP", popup: null })} />}
      {state.openPopup === "print"  && <PrintPreviewPopup state={state} onClose={() => dispatch({ type: "OPEN_POPUP", popup: null })} />}
      {state.openPopup === "data"   && <DataSourcePopup onClose={() => dispatch({ type: "OPEN_POPUP", popup: null })} />}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   TOOLBAR
   ─────────────────────────────────────────────────────────────────────────── */

function AlignBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="p-1.5 rounded-md hover:bg-gray-100 active:bg-gray-200 text-gray-600 hover:text-gray-900 transition-colors"
    >
      {children}
    </button>
  );
}

function Toolbar(props: {
  labelName: string; onRename: (v: string) => void;
  zoom: number; onZoom: (z: number) => void; onFit: () => void;
  canUndo: boolean; canRedo: boolean; onUndo: () => void; onRedo: () => void;
  gridVisible: boolean; onToggleGrid: () => void;
  snap: boolean; onToggleSnap: () => void;
  onNew: () => void; onSave: () => void; onPrintPreview: () => void;
  onUpdate?: () => void; updateName?: string;
  onExport: () => void; onDataSource: () => void; onTemplates: () => void;
}) {
  return (
    <div className="h-12 border-b border-gray-200 bg-white flex items-center px-3 gap-1 flex-shrink-0">
      <Link href="/barcode" className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-md" title="Back to Barcode">
        <ArrowLeft className="w-4 h-4" />
      </Link>
      <div className="w-px h-6 bg-gray-200 mx-1" />
      <button onClick={props.onNew} className="px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-md flex items-center gap-1.5">
        <FilePlus className="w-3.5 h-3.5" /> New
      </button>
      {props.onUpdate && (
        <button
          onClick={props.onUpdate}
          title={`Save changes back to "${props.updateName}"`}
          className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md flex items-center gap-1.5"
        >
          <Save className="w-3.5 h-3.5" /> Update
        </button>
      )}
      <button
        onClick={props.onSave}
        className="px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-md flex items-center gap-1.5"
        title={props.onUpdate ? "Save as a new template instead" : "Save template"}
      >
        <Save className="w-3.5 h-3.5" /> {props.onUpdate ? "Save as new" : "Save"}
      </button>
      <button onClick={props.onTemplates} className="px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 rounded-md flex items-center gap-1.5" title="Browse and load saved templates">
        <Bookmark className="w-3.5 h-3.5" /> Templates
      </button>
      <button onClick={props.onExport} className="px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-md flex items-center gap-1.5">
        <Download className="w-3.5 h-3.5" /> Export <ChevronDown className="w-3 h-3" />
      </button>
      <button onClick={props.onPrintPreview} className="px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-md flex items-center gap-1.5">
        <Printer className="w-3.5 h-3.5" /> Print Preview
      </button>
      <button onClick={props.onDataSource} className="px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-md flex items-center gap-1.5">
        <Database className="w-3.5 h-3.5" /> Data Source
      </button>

      <div className="flex-1 flex items-center justify-center">
        <input
          value={props.labelName}
          onChange={(e) => props.onRename(e.target.value)}
          className="text-sm font-medium text-gray-800 bg-transparent border border-transparent focus:border-gray-300 focus:outline-none rounded-md px-2 py-1 text-center min-w-[160px] hover:bg-gray-50"
        />
      </div>

      <div className="flex items-center gap-1">
        <button onClick={() => props.onZoom(props.zoom - 0.1)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md" title="Zoom out"><ZoomOut className="w-4 h-4" /></button>
        <span className="text-xs font-mono text-gray-600 w-12 text-center">{Math.round(props.zoom * 100)}%</span>
        <button onClick={() => props.onZoom(props.zoom + 0.1)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md" title="Zoom in"><ZoomIn className="w-4 h-4" /></button>
        <button onClick={props.onFit} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md" title="Fit to screen"><Maximize2 className="w-4 h-4" /></button>
        <div className="w-px h-6 bg-gray-200 mx-1" />
        <button disabled={!props.canUndo} onClick={props.onUndo} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md disabled:opacity-30" title="Undo (⌘Z)"><Undo2 className="w-4 h-4" /></button>
        <button disabled={!props.canRedo} onClick={props.onRedo} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md disabled:opacity-30" title="Redo (⌘Y)"><Redo2 className="w-4 h-4" /></button>
        <div className="w-px h-6 bg-gray-200 mx-1" />
        <button onClick={props.onToggleGrid} className={`p-1.5 rounded-md ${props.gridVisible ? "bg-blue-50 text-blue-600" : "text-gray-500 hover:bg-gray-100"}`} title="Toggle grid"><Grid3x3 className="w-4 h-4" /></button>
        <button onClick={props.onToggleSnap} className={`p-1.5 rounded-md ${props.snap ? "bg-blue-50 text-blue-600" : "text-gray-500 hover:bg-gray-100"}`} title="Toggle snap"><Magnet className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   LEFT SIDEBAR  (Elements + Layers)
   ─────────────────────────────────────────────────────────────────────────── */

/* Common product-data fields — one-click insert as a Dynamic element.
   These mirror the fields users typically have on a barcode label so the user
   doesn't have to type variable names by hand. */
const DATA_FIELDS: { key: string; label: string }[] = [
  { key: "productName",   label: "Product Name" },
  { key: "productCode",   label: "Product Code" },
  { key: "specification", label: "Specification" },
  { key: "length",        label: "Length" },
  { key: "width",         label: "Width" },
  { key: "mrp",           label: "MRP" },
  { key: "batch",         label: "Batch No." },
  { key: "mfgDate",       label: "Mfg Date" },
  { key: "expDate",       label: "Exp Date" },
  { key: "barcode",       label: "Barcode" },
];

function LeftSidebar(props: {
  onAdd: (t: ElementType) => void;
  onAddDataField: (key: string, label: string) => void;
  elements: AnyElement[];
  selectedIds: string[];
  onSelect: (id: string, additive: boolean) => void;
  onToggleVisible: (id: string) => void;
  onToggleLock: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (from: number, to: number) => void;
}) {
  const [drag, setDrag] = useState<number | null>(null);
  const [dataOpen, setDataOpen] = useState(true);
  return (
    <aside className="w-[240px] flex-shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col overflow-hidden">
      {/* All three sections share one scroll context so nothing gets clipped */}
      <div className="flex-1 overflow-y-auto">
      <div className="p-3 border-b border-gray-200">
        <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Elements</h3>
        <div className="grid grid-cols-2 gap-1.5">
          {ELEMENT_BUTTONS.map(({ type, icon: Icon, label }) => (
            <button
              key={type}
              onClick={() => props.onAdd(type)}
              className="flex flex-col items-center gap-1 py-2.5 bg-white border border-gray-200 rounded-md text-gray-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
            >
              <Icon className="w-4 h-4" />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Product Data Fields — one-click insert as bound dynamic field */}
      <div className="p-3 border-b border-gray-200">
        <button onClick={() => setDataOpen(o => !o)} className="w-full flex items-center justify-between mb-2">
          <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Data Fields</h3>
          <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${dataOpen ? "" : "-rotate-90"}`} />
        </button>
        {dataOpen && (
          <div className="space-y-1">
            {DATA_FIELDS.map(df => (
              <button
                key={df.key}
                onClick={() => props.onAddDataField(df.key, df.label)}
                className="w-full flex items-center gap-2 px-2 py-1.5 bg-white border border-gray-200 rounded-md hover:border-blue-400 hover:bg-blue-50 text-left transition-colors"
                title={`Insert {{${df.key}}}`}
              >
                <Database className="w-3 h-3 text-blue-500 flex-shrink-0" />
                <span className="text-[11px] text-gray-700 truncate">{df.label}</span>
                <span className="ml-auto text-[9px] font-mono text-gray-400">{`{{${df.key}}}`}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Layers</h3>
          <span className="text-[10px] text-gray-400">{props.elements.length}</span>
        </div>
        {props.elements.length === 0 && (
          <p className="text-[11px] text-gray-400 text-center py-6">Add elements above to see them here.</p>
        )}
        <ul className="space-y-1">
          {/* Render in reverse so top of stack is at the top of the list (Photoshop-like) */}
          {[...props.elements].reverse().map((el, revIdx) => {
            const idx = props.elements.length - 1 - revIdx;
            const selected = props.selectedIds.includes(el.id);
            const Icon = ELEMENT_BUTTONS.find(b => b.type === el.type)?.icon || Type;
            return (
              <li
                key={el.id}
                draggable
                onDragStart={() => setDrag(idx)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (drag !== null && drag !== idx) props.onReorder(drag, idx); setDrag(null); }}
                onClick={(e) => props.onSelect(el.id, e.shiftKey || e.ctrlKey || e.metaKey)}
                className={`flex items-center gap-1 px-1.5 py-1.5 rounded-md cursor-pointer text-xs ${
                  selected ? "bg-blue-50 ring-1 ring-blue-200" : "hover:bg-white"
                }`}
              >
                <GripVertical className="w-3 h-3 text-gray-300 flex-shrink-0" />
                <Icon className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                <span className="flex-1 truncate text-gray-700">{el.name}</span>
                <button onClick={(e) => { e.stopPropagation(); props.onToggleVisible(el.id); }} className="p-0.5 text-gray-400 hover:text-gray-700" title="Toggle visibility">
                  {el.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                </button>
                <button onClick={(e) => { e.stopPropagation(); props.onToggleLock(el.id); }} className="p-0.5 text-gray-400 hover:text-gray-700" title="Toggle lock">
                  {el.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                </button>
                <button onClick={(e) => { e.stopPropagation(); props.onDelete(el.id); }} className="p-0.5 text-gray-400 hover:text-rose-600" title="Delete">
                  <Trash2 className="w-3 h-3" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      </div>
    </aside>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   RIGHT SIDEBAR  (Properties + Label Setup)
   ─────────────────────────────────────────────────────────────────────────── */

function RightSidebar(props: {
  state: DesignerState;
  single: AnyElement | null;
  onUpdateLabel: (patch: Partial<LabelDoc>) => void;
  onUpdateSingle: (patch: Partial<AnyElement>, commit?: boolean) => void;
  onSetTab: (t: "properties" | "label") => void;
  onOpenBarcodePopup: () => void;
}) {
  const { rightTab } = props.state;
  return (
    <aside className="w-[280px] flex-shrink-0 border-l border-gray-200 bg-gray-50 flex flex-col">
      <div className="flex border-b border-gray-200 bg-white">
        {(["properties","label"] as const).map(t => (
          <button
            key={t}
            onClick={() => props.onSetTab(t)}
            className={`flex-1 py-2.5 text-xs font-medium border-b-2 -mb-px ${
              rightTab === t ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {t === "properties" ? "Properties" : "Label Setup"}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {rightTab === "properties"
          ? <PropertiesPanel single={props.single} onUpdate={props.onUpdateSingle} onOpenBarcodePopup={props.onOpenBarcodePopup} />
          : <LabelSetupPanel state={props.state} onUpdate={props.onUpdateLabel} />
        }
      </div>
    </aside>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-400 block mb-1">{label}</span>
      {children}
    </label>
  );
}

function NumInput(props: { value: number; onChange: (v: number) => void; onCommit?: () => void; step?: number; min?: number; max?: number; suffix?: string }) {
  return (
    <div className="relative">
      <input
        type="number"
        value={Number.isFinite(props.value) ? Number(props.value.toFixed(2)) : 0}
        step={props.step ?? 1}
        min={props.min}
        max={props.max}
        onChange={(e) => props.onChange(parseFloat(e.target.value) || 0)}
        onBlur={props.onCommit}
        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {props.suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none">{props.suffix}</span>}
    </div>
  );
}

function TextInput(props: { value: string; onChange: (v: string) => void; placeholder?: string; onCommit?: () => void }) {
  return (
    <input
      type="text"
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      onBlur={props.onCommit}
      placeholder={props.placeholder}
      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  );
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <input type="color" value={value || "#ffffff"} onChange={(e) => onChange(e.target.value)} className="w-7 h-7 rounded border border-gray-300 cursor-pointer p-0" />
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded-md font-mono bg-white" />
    </div>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`w-full px-2 py-1.5 rounded-md text-xs font-medium border ${on ? "bg-blue-50 border-blue-300 text-blue-700" : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"}`}
    >{label}</button>
  );
}

function PropertiesPanel({ single, onUpdate, onOpenBarcodePopup }: {
  single: AnyElement | null;
  onUpdate: (patch: Partial<AnyElement>, commit?: boolean) => void;
  onOpenBarcodePopup: () => void;
}) {
  if (!single) {
    return <p className="text-xs text-gray-400 text-center py-10">Select an element to edit its properties.</p>;
  }
  const e = single;

  /* Shared geometry block (X / Y / W / H / Rot / Opacity) — at the bottom of every element type */
  const Geometry = (
    <div className="pt-3 border-t border-gray-200 space-y-2">
      <h4 className="text-[10px] uppercase tracking-wider font-semibold text-gray-400">Geometry</h4>
      <div className="grid grid-cols-2 gap-2">
        <Field label="X (mm)"><NumInput value={e.x} onChange={(v) => onUpdate({ x: v }, true)} step={0.5} /></Field>
        <Field label="Y (mm)"><NumInput value={e.y} onChange={(v) => onUpdate({ y: v }, true)} step={0.5} /></Field>
        <Field label="W (mm)"><NumInput value={e.w} onChange={(v) => onUpdate({ w: v }, true)} step={0.5} min={1} /></Field>
        <Field label="H (mm)"><NumInput value={e.h} onChange={(v) => onUpdate({ h: v }, true)} step={0.5} min={0.5} /></Field>
        <Field label="Rotation"><NumInput value={e.rotation} onChange={(v) => onUpdate({ rotation: v }, true)} step={5} suffix="°" /></Field>
        <Field label="Opacity">
          <input type="range" min={0} max={100} value={Math.round(e.opacity * 100)} onChange={(ev) => onUpdate({ opacity: parseInt(ev.target.value) / 100 }, false)} onMouseUp={() => onUpdate({}, true)} className="w-full" />
        </Field>
      </div>
      <Field label="Name"><TextInput value={e.name} onChange={(v) => onUpdate({ name: v }, true)} /></Field>
    </div>
  );

  if (e.type === "text") {
    return (
      <>
        <Field label="Content">
          <textarea value={e.text} rows={3} onChange={(ev) => onUpdate({ text: ev.target.value } as Partial<TextElement>, false)} onBlur={() => onUpdate({}, true)}
            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </Field>
        <Field label="Font">
          <select value={e.fontFamily} onChange={(ev) => onUpdate({ fontFamily: ev.target.value } as Partial<TextElement>, true)} className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md bg-white">
            {FONT_FAMILIES.map(f => <option key={f} value={f}>{f.split(",")[0]}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Size"><NumInput value={e.fontSize} onChange={(v) => onUpdate({ fontSize: v } as Partial<TextElement>, true)} step={1} min={4} suffix="pt" /></Field>
          <Field label="Style">
            <div className="flex gap-1">
              <Toggle on={e.bold} onChange={(v) => onUpdate({ bold: v } as Partial<TextElement>, true)} label="B" />
              <Toggle on={e.italic} onChange={(v) => onUpdate({ italic: v } as Partial<TextElement>, true)} label="I" />
              <Toggle on={e.underline} onChange={(v) => onUpdate({ underline: v } as Partial<TextElement>, true)} label="U" />
            </div>
          </Field>
        </div>
        <Field label="Text Color"><ColorInput value={e.color} onChange={(v) => onUpdate({ color: v } as Partial<TextElement>, true)} /></Field>
        <Field label="Background"><ColorInput value={e.bgColor} onChange={(v) => onUpdate({ bgColor: v } as Partial<TextElement>, true)} /></Field>
        <Field label="Alignment">
          <div className="flex gap-1">
            {(["left","center","right"] as const).map(a => (
              <button key={a} onClick={() => onUpdate({ align: a } as Partial<TextElement>, true)}
                className={`flex-1 py-1.5 rounded-md border text-gray-600 ${e.align === a ? "bg-blue-50 border-blue-300 text-blue-700" : "bg-white border-gray-300 hover:bg-gray-50"}`}>
                {a === "left" ? <AlignLeft className="w-3.5 h-3.5 mx-auto" /> : a === "center" ? <AlignCenter className="w-3.5 h-3.5 mx-auto" /> : <AlignRight className="w-3.5 h-3.5 mx-auto" />}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Vertical alignment">
          <div className="flex gap-1">
            {(["top","middle","bottom"] as const).map(v => (
              <button
                key={v}
                onClick={() => onUpdate({ vAlign: v } as Partial<TextElement>, true)}
                className={`flex-1 py-1.5 rounded-md border text-xs font-medium capitalize ${
                  (e.vAlign ?? "middle") === v
                    ? "bg-blue-50 border-blue-300 text-blue-700"
                    : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Line height">
            <NumInput value={e.lineHeight ?? 1.2} onChange={(v) => onUpdate({ lineHeight: v } as Partial<TextElement>, true)} step={0.1} min={0.6} />
          </Field>
          <Field label="Letter spacing">
            <NumInput value={e.letterSpacing ?? 0} onChange={(v) => onUpdate({ letterSpacing: v } as Partial<TextElement>, true)} step={0.5} suffix="px" />
          </Field>
        </div>
        <Field label="Options">
          <div className="flex gap-1">
            <Toggle on={e.wrap !== false} onChange={(v) => onUpdate({ wrap: v } as Partial<TextElement>, true)} label="Wrap" />
            <Toggle on={!!e.uppercase} onChange={(v) => onUpdate({ uppercase: v } as Partial<TextElement>, true)} label="UPPER" />
          </div>
        </Field>
        {Geometry}
      </>
    );
  }

  if (e.type === "barcode") {
    return (
      <>
        <Field label="Type">
          <select value={e.format} onChange={(ev) => onUpdate({ format: ev.target.value } as Partial<BarcodeElement>, true)} className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md bg-white">
            {BARCODE_FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </Field>
        <Field label="Data"><TextInput value={e.value} onChange={(v) => onUpdate({ value: v } as Partial<BarcodeElement>, false)} onCommit={() => onUpdate({}, true)} /></Field>
        <Field label="Show human-readable">
          <Toggle on={e.showText} onChange={(v) => onUpdate({ showText: v } as Partial<BarcodeElement>, true)} label={e.showText ? "On" : "Off"} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Bar height"><NumInput value={e.barHeight} onChange={(v) => onUpdate({ barHeight: v } as Partial<BarcodeElement>, true)} step={2} min={8} /></Field>
          <Field label="Bar width"><NumInput value={e.barWidth} onChange={(v) => onUpdate({ barWidth: v } as Partial<BarcodeElement>, true)} step={0.5} min={1} /></Field>
        </div>
        <Field label="Bar color"><ColorInput value={e.fg} onChange={(v) => onUpdate({ fg: v } as Partial<BarcodeElement>, true)} /></Field>
        <Field label="Background"><ColorInput value={e.bg} onChange={(v) => onUpdate({ bg: v } as Partial<BarcodeElement>, true)} /></Field>
        <Field label="Quiet zone"><NumInput value={e.quietZone} onChange={(v) => onUpdate({ quietZone: v } as Partial<BarcodeElement>, true)} step={2} min={0} /></Field>
        <button onClick={onOpenBarcodePopup} className="w-full mt-1 py-1.5 text-xs font-medium text-blue-700 bg-white border border-blue-200 rounded-md hover:bg-blue-50">
          Advanced settings
        </button>
        {Geometry}
      </>
    );
  }

  if (e.type === "qr") {
    return (
      <>
        <Field label="Data">
          <textarea value={e.value} rows={2} onChange={(ev) => onUpdate({ value: ev.target.value } as Partial<QRElement>, false)} onBlur={() => onUpdate({}, true)}
            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </Field>
        <Field label="Error correction">
          <div className="flex gap-1">
            {(["L","M","Q","H"] as const).map(lv => (
              <button key={lv} onClick={() => onUpdate({ errorLevel: lv } as Partial<QRElement>, true)}
                className={`flex-1 py-1.5 text-xs rounded-md border ${e.errorLevel === lv ? "bg-blue-50 border-blue-300 text-blue-700" : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                {lv}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Module size"><NumInput value={e.moduleSize} onChange={(v) => onUpdate({ moduleSize: v } as Partial<QRElement>, true)} step={1} min={1} max={20} /></Field>
        <Field label="Foreground"><ColorInput value={e.fg} onChange={(v) => onUpdate({ fg: v } as Partial<QRElement>, true)} /></Field>
        <Field label="Background"><ColorInput value={e.bg} onChange={(v) => onUpdate({ bg: v } as Partial<QRElement>, true)} /></Field>
        {Geometry}
      </>
    );
  }

  if (e.type === "rect" || e.type === "circle") {
    const isRect = e.type === "rect";
    return (
      <>
        <Field label="Fill"><ColorInput value={e.fill} onChange={(v) => onUpdate({ fill: v } as any, true)} /></Field>
        <Field label="Border color"><ColorInput value={e.borderColor} onChange={(v) => onUpdate({ borderColor: v } as any, true)} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Border width"><NumInput value={e.borderWidth} onChange={(v) => onUpdate({ borderWidth: v } as any, true)} step={0.5} min={0} suffix="px" /></Field>
          <Field label="Border style">
            <select value={e.borderStyle} onChange={(ev) => onUpdate({ borderStyle: ev.target.value as any } as any, true)} className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md bg-white">
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
            </select>
          </Field>
        </div>
        {isRect && (
          <Field label="Corner radius"><NumInput value={(e as RectElement).radius} onChange={(v) => onUpdate({ radius: v } as Partial<RectElement>, true)} step={1} min={0} suffix="px" /></Field>
        )}
        {Geometry}
      </>
    );
  }

  if (e.type === "image") {
    return (
      <>
        <Field label="Source">
          <label className="block w-full px-2 py-3 text-center text-xs border-2 border-dashed border-gray-300 rounded-md cursor-pointer hover:border-blue-400 hover:bg-blue-50 text-gray-500">
            Click to upload
            <input type="file" accept="image/*" className="hidden"
              onChange={(ev) => {
                const f = ev.target.files?.[0]; if (!f) return;
                const r = new FileReader();
                r.onload = () => onUpdate({ src: String(r.result) } as Partial<ImageElement>, true);
                r.readAsDataURL(f);
              }} />
          </label>
        </Field>
        <Field label="Fit mode">
          <div className="flex gap-1">
            {(["fit","fill","stretch"] as const).map(m => (
              <button key={m} onClick={() => onUpdate({ fit: m } as Partial<ImageElement>, true)}
                className={`flex-1 py-1.5 text-xs rounded-md border capitalize ${e.fit === m ? "bg-blue-50 border-blue-300 text-blue-700" : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"}`}>{m}</button>
            ))}
          </div>
        </Field>
        {Geometry}
      </>
    );
  }

  if (e.type === "line") {
    return (
      <>
        <Field label="Color"><ColorInput value={e.color} onChange={(v) => onUpdate({ color: v } as Partial<LineElement>, true)} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Width"><NumInput value={e.strokeWidth} onChange={(v) => onUpdate({ strokeWidth: v } as Partial<LineElement>, true)} step={0.5} min={0.5} suffix="px" /></Field>
          <Field label="Style">
            <select value={e.style} onChange={(ev) => onUpdate({ style: ev.target.value as any } as Partial<LineElement>, true)} className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md bg-white">
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
            </select>
          </Field>
        </div>
        {Geometry}
      </>
    );
  }

  if (e.type === "dynamic") {
    return (
      <>
        <Field label="Field name"><TextInput value={e.fieldName} onChange={(v) => onUpdate({ fieldName: v } as Partial<DynamicElement>, true)} placeholder="e.g. sku" /></Field>
        <Field label="Fallback value"><TextInput value={e.fallback} onChange={(v) => onUpdate({ fallback: v } as Partial<DynamicElement>, true)} /></Field>
        <Field label="Font">
          <select value={e.fontFamily} onChange={(ev) => onUpdate({ fontFamily: ev.target.value } as Partial<DynamicElement>, true)} className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md bg-white">
            {FONT_FAMILIES.map(f => <option key={f} value={f}>{f.split(",")[0]}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Size"><NumInput value={e.fontSize} onChange={(v) => onUpdate({ fontSize: v } as Partial<DynamicElement>, true)} step={1} min={4} suffix="pt" /></Field>
          <Field label="Style">
            <div className="flex gap-1">
              <Toggle on={e.bold} onChange={(v) => onUpdate({ bold: v } as Partial<DynamicElement>, true)} label="B" />
              <Toggle on={e.italic} onChange={(v) => onUpdate({ italic: v } as Partial<DynamicElement>, true)} label="I" />
            </div>
          </Field>
        </div>
        <p className="text-[10px] text-gray-500 leading-snug bg-blue-50 border border-blue-100 rounded-md p-2">
          This field will be replaced by CSV data at print time.
        </p>
        {Geometry}
      </>
    );
  }

  return null;
}

function LabelSetupPanel({ state, onUpdate }: { state: DesignerState; onUpdate: (patch: Partial<LabelDoc>) => void }) {
  const [local, setLocal] = useState({ width: state.width, height: state.height, units: state.units, orientation: state.orientation, bg: state.bg, dpi: state.dpi, bleed: state.bleed });
  useEffect(() => { setLocal({ width: state.width, height: state.height, units: state.units, orientation: state.orientation, bg: state.bg, dpi: state.dpi, bleed: state.bleed }); }, [state.width, state.height, state.units, state.orientation, state.bg, state.dpi, state.bleed]);
  return (
    <>
      <Field label="Label name"><TextInput value={state.labelName} onChange={(v) => onUpdate({ labelName: v })} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Width"><NumInput value={local.width} onChange={(v) => setLocal(s => ({ ...s, width: v }))} step={0.5} min={1} suffix={local.units} /></Field>
        <Field label="Height"><NumInput value={local.height} onChange={(v) => setLocal(s => ({ ...s, height: v }))} step={0.5} min={1} suffix={local.units} /></Field>
      </div>
      <Field label="Units">
        <div className="flex gap-1">
          {(["mm","in","px"] as Units[]).map(u => (
            <button key={u} onClick={() => setLocal(s => ({ ...s, units: u }))}
              className={`flex-1 py-1.5 text-xs rounded-md border ${local.units === u ? "bg-blue-50 border-blue-300 text-blue-700" : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"}`}>{u}</button>
          ))}
        </div>
      </Field>
      <Field label="Orientation">
        <div className="flex gap-1">
          {(["portrait","landscape"] as const).map(o => (
            <button key={o} onClick={() => setLocal(s => ({ ...s, orientation: o }))}
              className={`flex-1 py-1.5 text-xs rounded-md border capitalize ${local.orientation === o ? "bg-blue-50 border-blue-300 text-blue-700" : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"}`}>{o}</button>
          ))}
        </div>
      </Field>
      <Field label="Background"><ColorInput value={local.bg} onChange={(v) => setLocal(s => ({ ...s, bg: v }))} /></Field>
      <Field label="DPI">
        <select value={local.dpi} onChange={(e) => setLocal(s => ({ ...s, dpi: parseInt(e.target.value) }))} className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md bg-white">
          {[72,96,150,203,300,600].map(d => <option key={d} value={d}>{d} DPI</option>)}
        </select>
      </Field>
      <Field label="Bleed margin"><NumInput value={local.bleed} onChange={(v) => setLocal(s => ({ ...s, bleed: v }))} step={0.5} min={0} suffix={local.units} /></Field>
      <button onClick={() => onUpdate(local)} className="w-full py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md">
        Apply Changes
      </button>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   RULER + GRID
   ─────────────────────────────────────────────────────────────────────────── */

function Ruler({ axis, lengthMM, pxPerMM }: { axis: "x" | "y"; lengthMM: number; pxPerMM: number }) {
  const lengthPx = lengthMM * pxPerMM;
  const ticks: number[] = [];
  const stepMM = pxPerMM > 20 ? 1 : pxPerMM > 8 ? 5 : 10;
  for (let i = 0; i <= lengthMM; i += stepMM) ticks.push(i);
  if (axis === "x") {
    return (
      <div style={{ position: "absolute", top: 28, left: "50%", transform: "translateX(-50%)", height: 16, width: lengthPx, marginTop: -16, color: "#9CA3AF", fontSize: 9 }}>
        {ticks.map(t => (
          <div key={t} style={{ position: "absolute", left: t * pxPerMM, top: 0, height: 16, borderLeft: "1px solid #D1D5DB", paddingLeft: 2 }}>
            {t % (stepMM * 5) === 0 && t > 0 && <span>{t}</span>}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div style={{ position: "absolute", left: 28, top: "50%", transform: "translateY(-50%)", width: 16, height: lengthPx, marginLeft: -16, color: "#9CA3AF", fontSize: 9 }}>
      {ticks.map(t => (
        <div key={t} style={{ position: "absolute", top: t * pxPerMM, left: 0, width: 16, borderTop: "1px solid #D1D5DB", paddingTop: 1, textAlign: "right", paddingRight: 2 }}>
          {t % (stepMM * 5) === 0 && t > 0 && <span>{t}</span>}
        </div>
      ))}
    </div>
  );
}

function GridOverlay({ pxPerMM, widthMM, heightMM }: { pxPerMM: number; widthMM: number; heightMM: number }) {
  const dotEvery = pxPerMM > 15 ? 1 : pxPerMM > 6 ? 5 : 10;
  const size = dotEvery * pxPerMM;
  return (
    <div
      style={{
        position: "absolute", inset: 0,
        backgroundImage: `radial-gradient(rgba(0,0,0,0.10) 1px, transparent 1px)`,
        backgroundSize: `${size}px ${size}px`,
        pointerEvents: "none",
      }}
    />
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   CONTEXT MENU
   ─────────────────────────────────────────────────────────────────────────── */

function ContextMenu({ x, y, hasSelection, hasClipboard, onAction }: {
  x: number; y: number; hasSelection: boolean; hasClipboard: boolean;
  onAction: (a: string) => void;
}) {
  const [alignOpen, setAlignOpen] = useState(false);
  const Item = ({ label, action, disabled, kbd }: { label: string; action: string; disabled?: boolean; kbd?: string }) => (
    <button disabled={disabled} onClick={() => onAction(action)}
      className="w-full px-3 py-1.5 text-left text-xs hover:bg-blue-50 hover:text-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-between">
      <span>{label}</span>
      {kbd && <span className="text-[10px] text-gray-400 font-mono">{kbd}</span>}
    </button>
  );
  const Sep = () => <div className="my-1 h-px bg-gray-200" />;
  return (
    <div
      style={{ position: "fixed", top: y, left: x, zIndex: 100 }}
      className="bg-white shadow-xl border border-gray-200 rounded-md py-1 min-w-[180px]"
      onClick={(e) => e.stopPropagation()}
    >
      <Item label="Cut"   action="cut"   disabled={!hasSelection} kbd="⌘X" />
      <Item label="Copy"  action="copy"  disabled={!hasSelection} kbd="⌘C" />
      <Item label="Paste" action="paste" disabled={!hasClipboard} kbd="⌘V" />
      <Item label="Duplicate" action="duplicate" disabled={!hasSelection} kbd="⌘D" />
      <Sep />
      <Item label="Delete" action="delete" disabled={!hasSelection} kbd="Del" />
      <Sep />
      <Item label="Bring to Front" action="front" disabled={!hasSelection} />
      <Item label="Send to Back"   action="back"  disabled={!hasSelection} />
      <Sep />
      <button onMouseEnter={() => setAlignOpen(true)} onMouseLeave={() => setAlignOpen(false)}
        className="relative w-full px-3 py-1.5 text-left text-xs hover:bg-blue-50 hover:text-blue-700 flex items-center justify-between">
        Align <ChevronRight className="w-3 h-3" />
        {alignOpen && (
          <div className="absolute left-full top-0 -ml-1 bg-white shadow-xl border border-gray-200 rounded-md py-1 min-w-[160px]">
            {[["Left","align-left"],["Center","align-center"],["Right","align-right"],["Top","align-top"],["Middle","align-middle"],["Bottom","align-bottom"],["Distribute H","align-dist-h"],["Distribute V","align-dist-v"]].map(([l, a]) => (
              <Item key={a} label={l} action={a} disabled={!hasSelection} />
            ))}
          </div>
        )}
      </button>
      <Sep />
      <Item label="Lock / Unlock" action="lock" disabled={!hasSelection} />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   POPUPS
   ─────────────────────────────────────────────────────────────────────────── */

function PopupShell({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className={`bg-white rounded-xl shadow-2xl ${wide ? "w-[860px]" : "w-[480px]"} max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700 rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function NewLabelPopup({ onClose, onCreate, onLoadTemplate, onDeleteTemplate, initialTab }: {
  onClose: () => void;
  onCreate: (patch: Partial<LabelDoc>) => void;
  onLoadTemplate?: (doc: LabelDoc) => void;
  onDeleteTemplate?: (name: string) => void;
  initialTab?: "new" | "saved" | "import";
}) {
  const [name, setName] = useState("Untitled Label");
  const [w, setW] = useState(100);
  const [h, setH] = useState(50);
  const [units, setUnits] = useState<Units>("mm");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("landscape");
  const [tab, setTab] = useState<"new" | "saved" | "import">(initialTab ?? "new");
  const [saved, setSaved] = useState<Array<{ name: string; savedAt: string; doc: LabelDoc; source: "local" | "server" }>>([]);
  const [autoLayoutTemplates, setAutoLayoutTemplates] = useState<Array<{ id: string; name: string; raw: any }>>([]);
  useEffect(() => {
    // Source of truth is the server so the same login on a different device
    // sees the same templates. localStorage was previously displayed alongside,
    // which made saved-on-PC templates invisible from a phone (and vice versa).
    //
    // To migrate older users without losing data: if there's anything in
    // localStorage that isn't on the server yet, POST it up once, then trust
    // the server list. Survives offline use too — if the API call fails we
    // fall back to localStorage so the user still sees something.
    let cancelled = false;
    (async () => {
      let serverRows: any[] = [];
      try {
        const r = await fetch("/api/barcode-templates", { cache: "no-store" });
        if (r.ok) serverRows = await r.json();
      } catch { /* offline */ }

      const serverDesigner: Array<{ name: string; savedAt: string; doc: LabelDoc; source: "server" }> = [];
      const serverNames = new Set<string>();
      for (const row of serverRows) {
        try {
          const parsed = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
          if (parsed && parsed.__designer && parsed.doc) {
            const cleanName = row.name.replace(/^\[Designer\]\s*/, "");
            serverNames.add(cleanName);
            serverDesigner.push({
              name: cleanName,
              savedAt: row.updatedAt || row.createdAt || new Date().toISOString(),
              doc: parsed.doc,
              source: "server",
            });
          }
        } catch {}
      }

      // One-time migration of local-only templates → push them up so this and
      // every other device starts seeing them.
      const localRaw = (() => {
        try { return localStorage.getItem("designer:templates"); } catch { return null; }
      })();
      const local: Array<{ name: string; savedAt: string; doc: LabelDoc }> = (() => {
        try { return localRaw ? JSON.parse(localRaw) : []; } catch { return []; }
      })();
      const localOnly = local.filter((t) => t && t.name && !serverNames.has(t.name));
      if (localOnly.length > 0) {
        await Promise.all(localOnly.map((t) =>
          fetch("/api/barcode-templates", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: `[Designer] ${t.name}`, data: { __designer: true, doc: t.doc } }),
          }).then((r) => r.ok ? r.json() : null).catch(() => null)
        )).then((created) => {
          for (let i = 0; i < created.length; i++) {
            if (!created[i]) continue;
            serverDesigner.push({
              name: localOnly[i].name,
              savedAt: localOnly[i].savedAt || new Date().toISOString(),
              doc: localOnly[i].doc,
              source: "server",
            });
            serverNames.add(localOnly[i].name);
          }
        });
      }

      if (cancelled) return;
      // Fallback: if the server fetch failed AND we have nothing migrated,
      // show local entries so the user can still open them offline.
      const display = serverDesigner.length > 0
        ? serverDesigner
        : local.map((t) => ({ ...t, source: "local" as const }));
      setSaved(display.sort((a, b) => (b.savedAt || "").localeCompare(a.savedAt || "")));

      // Auto-Layout templates: everything else with a fields array.
      const autoRows: Array<{ id: string; name: string; raw: any }> = [];
      for (const row of serverRows as any[]) {
        try {
          const parsed = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
          if (parsed && !parsed.__designer && Array.isArray(parsed.fields)) {
            autoRows.push({ id: row.id, name: row.name, raw: { ...parsed, name: row.name } });
          }
        } catch {}
      }
      setAutoLayoutTemplates(autoRows);
    })();
    return () => { cancelled = true; };
  }, []);
  return (
    <PopupShell title={tab === "new" ? "New Label" : tab === "saved" ? "Open Template" : "Import from Auto Layout"} onClose={onClose}>
      <div className="flex border-b border-gray-200 px-5 pt-3 gap-1">
        {(["new", "saved", "import"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs font-medium border-b-2 -mb-px ${tab === t ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-800"}`}>
            {t === "new" ? "New" : t === "saved" ? `Saved (${saved.length})` : `Import (${autoLayoutTemplates.length})`}
          </button>
        ))}
      </div>
      {tab === "saved" ? (
        <div className="p-5">
          {saved.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-10">No saved templates yet. Design a label and click <span className="font-semibold text-gray-700">Save</span> in the toolbar.</p>
          ) : (
            <ul className="space-y-1.5 max-h-[420px] overflow-y-auto">
              {saved.map(t => (
                <li key={t.name + t.source} className="flex items-center justify-between gap-2 px-3 py-2 border border-gray-200 rounded-md hover:bg-blue-50 hover:border-blue-300">
                  <button onClick={() => onLoadTemplate?.(t.doc)} className="flex-1 text-left">
                    <div className="text-xs font-medium text-gray-800 flex items-center gap-1.5">
                      {t.name}
                      <span className={`text-[9px] font-mono px-1 py-0 rounded ${t.source === "server" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {t.source === "server" ? "synced" : "local"}
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-500">{t.doc.width}×{t.doc.height} {t.doc.units} · {t.doc.elements.length} elements · {new Date(t.savedAt).toLocaleString()}</div>
                  </button>
                  <button onClick={() => { onDeleteTemplate?.(t.name); setSaved(s => s.filter(x => x.name !== t.name)); }}
                    className="p-1 text-gray-400 hover:text-rose-600" title="Delete local copy">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : tab === "import" ? (
        <div className="p-5">
          <p className="text-[11px] text-gray-500 bg-blue-50 border border-blue-100 rounded-md p-2.5 mb-3">
            Pick an Auto Layout template and we&apos;ll rebuild it on the Designer canvas — fonts, margins, lines, footer and shapes are preserved exactly so you can fine-tune with cursor tools.
          </p>
          {autoLayoutTemplates.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-10">
              No Auto Layout templates found. Create one in <a href="/barcode" className="text-blue-600 underline">Barcode</a> first.
            </p>
          ) : (
            <ul className="space-y-1.5 max-h-[420px] overflow-y-auto">
              {autoLayoutTemplates.map(t => {
                const r = t.raw;
                return (
                  <li key={t.id} className="flex items-center justify-between gap-2 px-3 py-2 border border-gray-200 rounded-md hover:bg-blue-50 hover:border-blue-300">
                    <button
                      onClick={() => {
                        try {
                          const doc = convertAutoLayoutToDesignerDoc(r);
                          onLoadTemplate?.(doc);
                        } catch (err) {
                          console.error("Auto-Layout import failed", err);
                          toast.error("Import failed");
                        }
                      }}
                      className="flex-1 text-left"
                    >
                      <div className="text-xs font-medium text-gray-800">{t.name}</div>
                      <div className="text-[10px] text-gray-500">
                        {r.widthMm}×{r.heightMm} mm · {r.fields?.length ?? 0} fields
                        {r.showBarcode ? " · barcode" : ""}
                        {r.logoDataUrl && r.logoPosition !== "none" ? " · logo" : ""}
                      </div>
                    </button>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">auto layout</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : (<></>)}
      {tab === "new" && (<>
      <div className="p-5 space-y-3">
        <Field label="Label name"><TextInput value={name} onChange={setName} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Width"><NumInput value={w} onChange={setW} step={1} min={1} suffix={units} /></Field>
          <Field label="Height"><NumInput value={h} onChange={setH} step={1} min={1} suffix={units} /></Field>
        </div>
        <Field label="Units">
          <div className="flex gap-1">
            {(["mm","in","px"] as Units[]).map(u => (
              <button key={u} onClick={() => setUnits(u)} className={`flex-1 py-1.5 text-xs rounded-md border ${units === u ? "bg-blue-50 border-blue-300 text-blue-700" : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"}`}>{u}</button>
            ))}
          </div>
        </Field>
        <Field label="Orientation">
          <div className="flex gap-1">
            {(["portrait","landscape"] as const).map(o => (
              <button key={o} onClick={() => setOrientation(o)} className={`flex-1 py-1.5 text-xs rounded-md border capitalize ${orientation === o ? "bg-blue-50 border-blue-300 text-blue-700" : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"}`}>{o}</button>
            ))}
          </div>
        </Field>
        <div>
          <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-400 block mb-2">Presets</span>
          <div className="grid grid-cols-2 gap-2">
            {SIZE_PRESETS.map(p => (
              <button key={p.label} onClick={() => { setW(p.w); setH(p.h); setUnits(p.u); }}
                className="px-3 py-2 text-left border border-gray-300 rounded-md hover:border-blue-400 hover:bg-blue-50">
                <div className="text-xs font-medium text-gray-800">{p.label}</div>
                <div className="text-[10px] text-gray-500">{p.w} × {p.h} {p.u}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
        <button onClick={() => onCreate({ labelName: name, width: w, height: h, units, orientation })} className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md">Create Label</button>
      </div>
      </>)}
    </PopupShell>
  );
}

function SaveTemplatePopup({ currentName, busy, onClose, onSave }: { currentName: string; busy?: boolean; onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState(currentName);
  const [existing, setExisting] = useState<string[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("designer:templates");
      const list: Array<{ name: string }> = raw ? JSON.parse(raw) : [];
      setExisting(list.map(t => t.name));
    } catch {}
  }, []);
  const willOverwrite = existing.includes(name.trim());
  return (
    <PopupShell title="Save Template" onClose={onClose}>
      <div className="p-5 space-y-3">
        <Field label="Template name">
          <TextInput value={name} onChange={setName} placeholder="My Product Label" />
        </Field>
        {willOverwrite && (
          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
            A template named <span className="font-semibold">{name.trim()}</span> already exists — saving will overwrite it.
          </p>
        )}
        <p className="text-[11px] text-gray-500 leading-snug">
          Templates are stored on this device and listed under <span className="font-medium">New → Saved</span>.
        </p>
      </div>
      <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
        <button
          disabled={busy}
          onClick={() => onSave(name)}
          className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-60 disabled:cursor-wait"
        >
          {busy ? "Saving…" : willOverwrite ? "Overwrite" : "Save Template"}
        </button>
      </div>
    </PopupShell>
  );
}

function BarcodePopup({ el, onClose, onApply }: { el: BarcodeElement; onClose: () => void; onApply: (patch: Partial<BarcodeElement>) => void }) {
  const [local, setLocal] = useState<BarcodeElement>({ ...el });
  return (
    <PopupShell title="Barcode Settings" onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-0">
        <div className="p-5 space-y-3 border-r border-gray-200">
          <Field label="Type">
            <select value={local.format} onChange={(e) => setLocal({ ...local, format: e.target.value })} className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md bg-white">
              {BARCODE_FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </Field>
          <Field label="Data"><TextInput value={local.value} onChange={(v) => setLocal({ ...local, value: v })} /></Field>
          <Field label="Human-readable text">
            <Toggle on={local.showText} onChange={(v) => setLocal({ ...local, showText: v })} label={local.showText ? "On" : "Off"} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Bar height"><NumInput value={local.barHeight} onChange={(v) => setLocal({ ...local, barHeight: v })} step={2} min={8} /></Field>
            <Field label="Module width"><NumInput value={local.barWidth} onChange={(v) => setLocal({ ...local, barWidth: v })} step={0.5} min={1} /></Field>
          </div>
          <Field label="Bar color"><ColorInput value={local.fg} onChange={(v) => setLocal({ ...local, fg: v })} /></Field>
          <Field label="Background"><ColorInput value={local.bg} onChange={(v) => setLocal({ ...local, bg: v })} /></Field>
          <Field label="Quiet zone"><NumInput value={local.quietZone} onChange={(v) => setLocal({ ...local, quietZone: v })} step={2} min={0} /></Field>
        </div>
        <div className="p-5 bg-gray-50 flex items-center justify-center">
          <div style={{ width: 280, height: 110, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <BarcodeSVG el={local} scale={1} />
          </div>
        </div>
      </div>
      <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
        <button onClick={() => onApply(local)} className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md">Apply</button>
      </div>
    </PopupShell>
  );
}

function ExportPopup({ state, onClose }: { state: DesignerState; onClose: () => void }) {
  const [fmt, setFmt] = useState<"png" | "pdf" | "svg">("png");
  return (
    <PopupShell title="Export Label" onClose={onClose} wide>
      <div className="p-5 space-y-4">
        <div>
          <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-400 block mb-2">Format</span>
          <div className="grid grid-cols-3 gap-3">
            {(["png","pdf","svg"] as const).map(f => (
              <button key={f} onClick={() => setFmt(f)}
                className={`px-3 py-6 border rounded-lg text-center ${fmt === f ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"}`}>
                <div className="text-base font-semibold text-gray-800 uppercase">{f}</div>
                <div className="text-[10px] text-gray-500 mt-1">
                  {f === "png" && "Raster image"}
                  {f === "pdf" && "Document"}
                  {f === "svg" && "Vector"}
                </div>
              </button>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-gray-500 bg-amber-50 border border-amber-200 rounded-md p-2.5">
          Export pipeline coming soon. For now, use Print Preview → your browser&apos;s print-to-PDF.
        </p>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center justify-center">
          <div style={{ width: state.width * 3 * (state.units === "in" ? MM_PER_IN : 1), height: state.height * 3 * (state.units === "in" ? MM_PER_IN : 1), background: state.bg, border: "1px solid #D1D5DB", maxWidth: 400, maxHeight: 200 }}>
            <span className="text-[10px] text-gray-400 m-2 inline-block">{state.labelName} preview</span>
          </div>
        </div>
      </div>
      <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
        <button onClick={() => { toast(`Export to ${fmt.toUpperCase()} not yet implemented`); }} className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md">Export</button>
      </div>
    </PopupShell>
  );
}

function PrintPreviewPopup({ state, onClose }: { state: DesignerState; onClose: () => void }) {
  const PX = 3.78;
  return (
    <PopupShell title="Print Preview" onClose={onClose} wide>
      <div className="p-5">
        <div className="bg-gray-100 border border-gray-200 rounded-lg p-8 flex items-center justify-center">
          <div style={{
            position: "relative",
            width: toMM(state.width, state.units) * PX,
            height: toMM(state.height, state.units) * PX,
            background: state.bg,
            boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
            outline: "1px solid #D1D5DB",
          }}>
            {state.elements.filter(e => e.visible).map(el => (
              <div key={el.id} style={{
                position: "absolute",
                left: el.x * PX, top: el.y * PX,
                width: el.w * PX, height: el.h * PX,
                transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                opacity: el.opacity,
              }}>
                <ElementRenderer el={el} mmToPx={PX} />
              </div>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-gray-500 text-center mt-3">Use your browser&apos;s print dialog (⌘P) to print this preview.</p>
      </div>
      <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Close</button>
        <button onClick={() => window.print()} className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md">Print</button>
      </div>
    </PopupShell>
  );
}

function DataSourcePopup({ onClose }: { onClose: () => void }) {
  return (
    <PopupShell title="Connect Data Source" onClose={onClose} wide>
      <div className="p-5 space-y-4">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-10 text-center text-sm text-gray-500">
          CSV / JSON data binding will be added in a follow-up release.
          <p className="text-[11px] text-gray-400 mt-2">Add Dynamic Field elements now; mappings will be enabled when this connects.</p>
        </div>
      </div>
      <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Close</button>
      </div>
    </PopupShell>
  );
}
