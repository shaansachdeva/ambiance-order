"use client";

/* Shared rendering for Bartender-style designer templates. Used both by the
   /designer page (via that page's own copy) and by /barcode's data-entry flow
   to render saved templates with user-filled placeholder values. */

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";

// ─── Types (mirror of designer/page.tsx — keep in sync if you change either) ─

export type ElementType =
  | "text" | "barcode" | "qr" | "image" | "rect" | "circle" | "line" | "dynamic";

export interface ElementBase {
  id: string;
  type: ElementType;
  name: string;
  x: number; y: number;
  w: number; h: number;
  rotation: number;
  locked: boolean;
  visible: boolean;
  opacity: number;
}

export interface TextElement extends ElementBase {
  type: "text";
  text: string;
  fontFamily: string;
  fontSize: number;
  bold: boolean; italic: boolean; underline: boolean;
  color: string; bgColor: string;
  align: "left" | "center" | "right";
  /** Optional advanced typography (added later — undefined-safe for old docs). */
  vAlign?: "top" | "middle" | "bottom";
  lineHeight?: number;
  letterSpacing?: number;
  wrap?: boolean;
  uppercase?: boolean;
}
export interface BarcodeElement extends ElementBase {
  type: "barcode";
  format: string; value: string;
  showText: boolean;
  barHeight: number; barWidth: number;
  fg: string; bg: string;
  quietZone: number;
}
export interface QRElement extends ElementBase {
  type: "qr"; value: string;
  errorLevel: "L" | "M" | "Q" | "H";
  moduleSize: number; fg: string; bg: string;
}
export interface ImageElement extends ElementBase {
  type: "image"; src: string;
  fit: "fill" | "fit" | "stretch";
}
export interface RectElement extends ElementBase {
  type: "rect"; fill: string;
  borderColor: string; borderWidth: number;
  borderStyle: "solid" | "dashed" | "dotted";
  radius: number;
}
export interface CircleElement extends ElementBase {
  type: "circle"; fill: string;
  borderColor: string; borderWidth: number;
  borderStyle: "solid" | "dashed" | "dotted";
}
export interface LineElement extends ElementBase {
  type: "line"; color: string;
  strokeWidth: number;
  style: "solid" | "dashed" | "dotted";
}
export interface DynamicElement extends ElementBase {
  type: "dynamic";
  fieldName: string; fallback: string;
  fontFamily: string; fontSize: number;
  bold: boolean; italic: boolean; underline: boolean;
  color: string;
  align: "left" | "center" | "right";
}

export type AnyElement =
  | TextElement | BarcodeElement | QRElement | ImageElement
  | RectElement | CircleElement | LineElement | DynamicElement;

export type Units = "mm" | "in" | "px";

export interface LabelDoc {
  labelName: string;
  width: number;
  height: number;
  units: Units;
  orientation: "portrait" | "landscape";
  bg: string;
  dpi: number;
  bleed: number;
  elements: AnyElement[];
}

const MM_PER_IN = 25.4;
export function toMM(v: number, u: Units) {
  if (u === "mm") return v;
  if (u === "in") return v * MM_PER_IN;
  return v * 0.2645833333;
}

// ─── Substitution: {{name}} placeholders → values from `vars` ────────────────

export function substituteVars(text: string, vars: Record<string, string>) {
  if (!text) return text;
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) => {
    const v = vars[key];
    return v == null || v === "" ? `{{${key}}}` : v;
  });
}

/** Collect every unique data-binding variable referenced anywhere in the doc.
 *  Dynamic elements contribute their fieldName; text/barcode/qr values are
 *  scanned for {{...}} placeholders so user-edited text can also bind. */
export function collectFieldNames(doc: LabelDoc): Array<{ key: string; label: string }> {
  const map = new Map<string, string>();
  const scan = (s: string | undefined) => {
    if (!s) return;
    const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s)) !== null) {
      const k = m[1];
      if (!map.has(k)) map.set(k, prettyLabel(k));
    }
  };
  for (const el of doc.elements) {
    if (el.type === "dynamic") {
      if (!map.has(el.fieldName)) map.set(el.fieldName, el.name || prettyLabel(el.fieldName));
    } else if (el.type === "text") {
      scan(el.text);
    } else if (el.type === "barcode") {
      scan(el.value);
    } else if (el.type === "qr") {
      scan(el.value);
    }
  }
  return Array.from(map.entries()).map(([key, label]) => ({ key, label }));
}

function prettyLabel(key: string) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Element renderers ──────────────────────────────────────────────────────

function BarcodeSVG({ el }: { el: BarcodeElement }) {
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
      if (ref.current) ref.current.innerHTML = "";
    }
  }, [el.value, el.format, el.showText, el.barHeight, el.barWidth, el.fg, el.bg, el.quietZone]);
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

function ElementRenderer({ el, mmToPx, vars }: { el: AnyElement; mmToPx: number; vars: Record<string, string> }) {
  const common: React.CSSProperties = {
    width: "100%", height: "100%", display: "block",
    pointerEvents: "none", userSelect: "none",
  };
  switch (el.type) {
    case "text": {
      const vAlign = el.vAlign ?? "middle";
      const wrap = el.wrap !== false;
      const rendered = substituteVars(el.text, vars);
      const displayText = el.uppercase ? rendered.toUpperCase() : rendered;
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
    case "barcode": {
      const value = substituteVars(el.value, vars);
      return <BarcodeSVG el={{ ...el, value }} />;
    }
    case "qr": {
      const value = substituteVars(el.value, vars);
      return <QRRender el={{ ...el, value }} />;
    }
    case "image":
      return el.src
        ? <img src={el.src} alt="" style={{ ...common, objectFit: el.fit === "fill" ? "cover" : el.fit === "stretch" ? "fill" : "contain" }} />
        : <div style={{ ...common, background: "#F3F4F6" }} />;
    case "rect":
      return <div style={{ ...common, background: el.fill, border: `${el.borderWidth}px ${el.borderStyle} ${el.borderColor}`, borderRadius: el.radius, boxSizing: "border-box" }} />;
    case "circle":
      return <div style={{ ...common, background: el.fill, border: `${el.borderWidth}px ${el.borderStyle} ${el.borderColor}`, borderRadius: "50%", boxSizing: "border-box" }} />;
    case "line":
      return <div style={{ ...common, borderTop: `${Math.max(1, el.strokeWidth)}px ${el.style} ${el.color}`, height: 0, marginTop: "calc(50% - 0.5px)" }} />;
    case "dynamic": {
      const v = vars[el.fieldName];
      const display = v && v !== "" ? v : (el.fallback || `{{${el.fieldName}}}`);
      return (
        <div style={{
          ...common,
          fontFamily: el.fontFamily,
          fontSize: el.fontSize * (mmToPx / (96 / 25.4)),
          fontWeight: el.bold ? 700 : 400,
          fontStyle: el.italic ? "italic" : "normal",
          textDecoration: el.underline ? "underline" : "none",
          color: el.color,
          textAlign: el.align,
          display: "flex", alignItems: "center",
          justifyContent: el.align === "center" ? "center" : el.align === "right" ? "flex-end" : "flex-start",
          overflow: "hidden",
          padding: "2px 4px", boxSizing: "border-box",
          background: v ? "transparent" : "rgba(229,231,235,0.4)",
        }}>{display}</div>
      );
    }
  }
}

// ─── Main preview component ─────────────────────────────────────────────────

export function DesignerLabelPreview({
  doc,
  values = {},
  pxPerMM = 3.78,
  className,
}: {
  doc: LabelDoc;
  values?: Record<string, string>;
  pxPerMM?: number;
  className?: string;
}) {
  const widthMM = toMM(doc.width, doc.units);
  const heightMM = toMM(doc.height, doc.units);
  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: widthMM * pxPerMM,
        height: heightMM * pxPerMM,
        background: doc.bg || "#fff",
        outline: "1px solid #D1D5DB",
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {doc.elements.filter((e) => e.visible).map((el) => (
        <div key={el.id} style={{
          position: "absolute",
          left: el.x * pxPerMM,
          top: el.y * pxPerMM,
          width: Math.max(2, el.w) * pxPerMM,
          height: Math.max(0.5, el.h) * pxPerMM,
          transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
          opacity: el.opacity,
        }}>
          <ElementRenderer el={el} mmToPx={pxPerMM} vars={values} />
        </div>
      ))}
    </div>
  );
}
