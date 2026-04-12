"use client";

/**
 * Shared label preview rendering — used by both the Barcode Generator page
 * and the OrderLabelModal so that print output is pixel-perfect WYSIWYG.
 */

import { useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface LabelField { id: string; heading: string; value: string; }

export interface DesignLine {
  id: string;
  xPercent: number;
  yPercent: number;
  lengthPercent: number;
  thickness: number;
  color: string;
  style: "solid" | "dashed" | "dotted";
  rot?: number;
}

export interface LabelDesign {
  fontFamily: string;
  headingAlign: "left" | "center" | "right";
  headingBold: boolean;
  headingItalic: boolean;
  headingUnderline: boolean;
  bodyAlign: "left" | "center" | "right";
  bodyBold: boolean;
  rotationDeg: number;
  lines: DesignLine[];
  mode?: "auto" | "freeform";
  elements?: any[];
}

export interface LabelTemplate {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  topMarginMm: number;
  bottomMarginMm: number;
  leftMarginMm: number;
  rightMarginMm: number;
  fields: LabelField[];
  barcodeFormat: string;
  barcodeValue: string;
  barcodeAuto: boolean;
  showBarcode: boolean;
  copies: number;
  logoDataUrl: string;
  logoPosition: "top" | "bottom" | "none";
  logoHeightMm: number;
  fontScale: number;
  showBorder: boolean;
  rotated: boolean;
  design: LabelDesign;
}

export const DEFAULT_DESIGN: LabelDesign = {
  fontFamily: "Arial, sans-serif",
  headingAlign: "center",
  headingBold: true,
  headingItalic: false,
  headingUnderline: false,
  bodyAlign: "left",
  bodyBold: false,
  rotationDeg: 0,
  lines: [],
  mode: "auto",
  elements: [],
};

export const PREVIEW_W = 280;

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function getAutoBarcode(fields: LabelField[]) {
  return fields.find(f => /product\s*code|barcode|^code$/i.test(f.heading))?.value.trim() || "";
}
export function getProductName(fields: LabelField[]) {
  return fields.find(f => /^name$/i.test(f.heading.trim()))?.value.trim() || "";
}

// ─── Shared size calculator ───────────────────────────────────────────────────
export function computeSizes(lbl: LabelTemplate, bodyFieldCount: number) {
  const PX_PER_MM = PREVIEW_W / Math.max(lbl.widthMm, 1);
  const contentMm = Math.max(lbl.heightMm - lbl.topMarginMm - lbl.bottomMarginMm, 5);
  const logoMm    = lbl.logoDataUrl && lbl.logoPosition !== "none" ? lbl.logoHeightMm + 2 : 0;
  const availMm   = Math.max(contentMm - logoMm, 8);
  const availPx   = availMm * PX_PER_MM;
  const n         = bodyFieldCount;
  const basePx    = Math.max(Math.min(availPx / (n + 3) * 0.75, 15), 8) * lbl.fontScale;

  const headingPx  = Math.min(basePx * 1.55, 22);
  const labelPx    = Math.min(basePx * 1.05, 14);
  const valuePx    = Math.min(basePx * 1.1, 15);
  const barcodeHPx = Math.min(Math.max(availPx * 0.28, 25), 65);

  const toMm = (px: number) => parseFloat((px / PX_PER_MM).toFixed(2));

  return {
    PX_PER_MM, contentMm, availMm,
    headingPx, labelPx, valuePx, barcodeHPx,
    headingMm: toMm(headingPx), labelMm: toMm(labelPx),
    valueMm: toMm(valuePx), barcodeHMm: toMm(barcodeHPx),
  };
}

// ─── BarcodeSVG ───────────────────────────────────────────────────────────────
export function BarcodeSVG({ value, format, height }: { value: string; format: string; height: number }) {
  const ref = useRef<SVGSVGElement>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!ref.current || !value.trim()) { setErr(""); return; }
    import("jsbarcode").then(({ default: JsBarcode }) => {
      try {
        JsBarcode(ref.current!, value, {
          format, displayValue: true, fontSize: 11, textMargin: 2, margin: 4,
          width: 1.6, height, background: "#fff", lineColor: "#000",
          valid: (ok: boolean) => setErr(ok ? "" : "Invalid value for format"),
        });
      } catch { setErr("Invalid barcode"); }
    });
  }, [value, format, height]);

  if (!value.trim()) return (
    <div style={{ textAlign: "center", color: "#aaa", fontSize: 9, padding: "8px 0", fontStyle: "italic" }}>
      — barcode will appear here —
    </div>
  );
  if (err) return <div style={{ textAlign: "center", color: "#d44", fontSize: 9, padding: 4 }}>{err}</div>;
  return <svg ref={ref} style={{ display: "block", maxWidth: "100%" }} />;
}

// ─── LabelPreview ─────────────────────────────────────────────────────────────
export function LabelPreview({ lbl }: { lbl: LabelTemplate }) {
  const { PX_PER_MM, headingPx, labelPx, valuePx, barcodeHPx } = computeSizes(
    lbl, lbl.fields.filter(f => !/^name$/i.test(f.heading.trim())).length
  );
  const totalPx   = lbl.heightMm * PX_PER_MM;
  const topPx     = lbl.topMarginMm * PX_PER_MM;
  const bottomPx  = lbl.bottomMarginMm * PX_PER_MM;
  const contentPx = Math.max(totalPx - topPx - bottomPx, 20);
  const leftPad   = lbl.leftMarginMm * PX_PER_MM + 5;
  const rightPad  = lbl.rightMarginMm * PX_PER_MM + 5;

  const name         = getProductName(lbl.fields);
  const barcodeValue = lbl.barcodeAuto ? getAutoBarcode(lbl.fields) : lbl.barcodeValue;
  const bodyFields   = lbl.fields.filter(f => !/^name$/i.test(f.heading.trim()));
  const hasLogo      = !!lbl.logoDataUrl && lbl.logoPosition !== "none";
  const logoHeightPx = hasLogo ? lbl.logoHeightMm * PX_PER_MM : 0;
  const dsgn         = lbl.design;

  if (dsgn.mode === "freeform") {
    return (
      <div style={{
        width: PREVIEW_W, height: totalPx,
        border: lbl.showBorder ? "2px solid #222" : "2px dashed #ccc",
        background: "#fff", overflow: "hidden", boxSizing: "border-box",
        position: "relative",
      }}>
        {dsgn.elements?.map((el: any) => {
          let content: string | null = null;
          if (el.type === "text") content = el.text;
          else if (el.type === "field" && el.fieldId) {
            const field = lbl.fields.find(f => f.id === el.fieldId);
            content = field ? `${field.heading}: ${field.value}` : "Unknown Field";
          }
          return (
            <div key={el.id} style={{
              position: "absolute",
              left: `${el.x}%`, top: `${el.y}%`, width: `${el.w}%`, height: `${el.h}%`,
            }}>
              {(() => {
                const rot = el.rot || 0;
                const isVertical = rot === 90 || rot === 270;
                const innerWPx = isVertical ? ((el.h / 100) * totalPx) : ((el.w / 100) * PREVIEW_W);
                const innerHPx = isVertical ? ((el.w / 100) * PREVIEW_W) : ((el.h / 100) * totalPx);
                return (
                  <div style={{
                    position: "absolute", top: "50%", left: "50%",
                    width: `${innerWPx}px`, height: `${innerHPx}px`,
                    transform: `translate(-50%, -50%) rotate(${rot}deg)`,
                    border: el.type === "rect" ? `${el.borderWidth || 1}px ${el.style || "solid"} ${el.borderColor || "#000"}` : "none",
                    backgroundColor: el.bgColor || "transparent",
                    borderTop: el.type === "line" ? `${el.borderWidth || 1}px ${el.style || "solid"} ${el.borderColor || "#000"}` : "none",
                    fontSize: el.fontSize ? `${el.fontSize}px` : "12px",
                    fontWeight: el.bold ? "bold" : "normal",
                    fontStyle: el.italic ? "italic" : "normal",
                    textAlign: el.align || "center",
                    display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
                  }}>
                    {(el.type === "text" || el.type === "field") && (
                      <span style={{ width: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{content}</span>
                    )}
                    {el.type === "barcode" && (barcodeValue ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`https://bwipjs-api.metafloor.com/?bcid=${lbl.barcodeFormat.toLowerCase()}&text=${encodeURIComponent(barcodeValue)}&scale=3&includetext`}
                        style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} alt="Barcode" />
                    ) : <div style={{ fontSize: 8, color: "#ccc" }}>Barcode</div>)}
                    {el.type === "image" && (el.imageDataUrl || lbl.logoDataUrl) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={el.imageDataUrl || lbl.logoDataUrl} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} alt="" />
                    )}
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{
      width: PREVIEW_W, height: totalPx,
      border: lbl.showBorder ? "2px solid #222" : "2px dashed #ccc",
      fontFamily: dsgn.fontFamily, display: "flex", flexDirection: "column",
      background: "#fff", overflow: "hidden", boxSizing: "border-box",
      transform: dsgn.rotationDeg ? `rotate(${dsgn.rotationDeg}deg)` : (lbl.rotated ? "rotate(180deg)" : undefined),
      position: "relative",
    }}>
      {/* Pre-printed top margin */}
      {topPx > 0 && (
        <div style={{
          height: topPx, flexShrink: 0,
          background: "repeating-linear-gradient(45deg,#ebebeb,#ebebeb 3px,#fff 3px,#fff 9px)",
          borderBottom: "1.5px dashed #bbb",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 7.5, color: "#aaa", fontStyle: "italic" }}>
            Pre-printed top ({lbl.topMarginMm} mm)
          </span>
        </div>
      )}

      {/* Content */}
      <div style={{
        height: contentPx, flexShrink: 0,
        display: "flex", flexDirection: "column",
        paddingTop: 4, paddingBottom: 3,
        paddingLeft: leftPad, paddingRight: rightPad,
        boxSizing: "border-box",
      }}>
        {hasLogo && lbl.logoPosition === "top" && (
          <div style={{ height: logoHeightPx, display: "flex", justifyContent: "center", alignItems: "center", marginBottom: 3, flexShrink: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lbl.logoDataUrl} style={{ maxHeight: logoHeightPx, maxWidth: "80%", objectFit: "contain" }} alt="logo" />
          </div>
        )}

        <div style={{
          fontWeight: dsgn.headingBold ? "bold" : "normal", fontSize: headingPx,
          textAlign: dsgn.headingAlign,
          textTransform: "uppercase", letterSpacing: "0.5px",
          fontStyle: dsgn.headingItalic ? "italic" : "normal",
          textDecoration: dsgn.headingUnderline ? "underline" : "none",
          borderBottom: "2px solid #000", paddingBottom: headingPx * 0.3,
          marginBottom: headingPx * 0.25, lineHeight: 1.15, color: "#000", flexShrink: 0,
        }}>
          {name || <span style={{ color: "#ccc", fontWeight: 400, fontSize: headingPx * 0.7 }}>Product Name</span>}
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-evenly", overflow: "hidden" }}>
          {bodyFields.map(field => (
            <div key={field.id} style={{
              display: "flex", alignItems: "center",
              justifyContent: dsgn.bodyAlign === "center" ? "center" : dsgn.bodyAlign === "right" ? "flex-end" : "flex-start",
              borderBottom: "0.8px solid #e8e8e8", paddingBottom: 1.5, paddingTop: 1, gap: 5,
            }}>
              <span style={{ fontWeight: "bold", fontSize: labelPx, color: "#111", minWidth: "36%", flexShrink: 0, lineHeight: 1.25 }}>
                {field.heading || "—"}:
              </span>
              <span style={{
                fontSize: valuePx, fontWeight: dsgn.bodyBold ? "bold" : "normal", color: "#000",
                flex: 1, lineHeight: 1.25, textAlign: dsgn.bodyAlign, wordBreak: "break-word", whiteSpace: "pre-wrap"
              }}>
                {field.value || <span style={{ color: "#ccc" }}>—</span>}
              </span>
            </div>
          ))}
        </div>

        {/* Decorative lines */}
        {dsgn.lines.map(ln => (
          <div key={ln.id} style={{
            position: "absolute",
            left: `${ln.xPercent ?? 50}%`,
            top: `${ln.yPercent}%`,
            width: `${ln.lengthPercent ?? 100}%`,
            borderTop: `${ln.thickness}px ${ln.style} ${ln.color}`,
            transform: `translate(-50%, -50%) rotate(${ln.rot || 0}deg)`,
            pointerEvents: "none",
          }} />
        ))}

        {lbl.showBarcode && (
          <div style={{ borderTop: "1px solid #ccc", marginTop: 3, paddingTop: 2, display: "flex", justifyContent: "center", flexShrink: 0 }}>
            <BarcodeSVG value={barcodeValue} format={lbl.barcodeFormat} height={barcodeHPx} />
          </div>
        )}

        {hasLogo && lbl.logoPosition === "bottom" && (
          <div style={{ height: logoHeightPx, display: "flex", justifyContent: "center", alignItems: "center", marginTop: 3, flexShrink: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lbl.logoDataUrl} style={{ maxHeight: logoHeightPx, maxWidth: "80%", objectFit: "contain" }} alt="logo" />
          </div>
        )}
      </div>

      {/* Pre-printed bottom margin */}
      {bottomPx > 0 && (
        <div style={{
          flex: 1,
          background: "repeating-linear-gradient(45deg,#ebebeb,#ebebeb 3px,#fff 3px,#fff 9px)",
          borderTop: "1.5px dashed #bbb",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 7.5, color: "#aaa", fontStyle: "italic" }}>
            Pre-printed bottom ({lbl.bottomMarginMm} mm)
          </span>
        </div>
      )}
    </div>
  );
}
