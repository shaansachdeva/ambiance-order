"use client";

/**
 * Shared label preview rendering — used by both the Barcode Generator page
 * and the OrderLabelModal so that print output is pixel-perfect WYSIWYG.
 */

import { useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface LabelField {
  id: string;
  heading: string;
  value: string;
  /** Render this row with an emphasis background + bolder heading. */
  highlight?: boolean;
  /** Bold the value text on this row. */
  bold?: boolean;
  /** Hide this row entirely from the preview/print (but keep it in the template). */
  hidden?: boolean;
  /** Per-field font scale multiplier (1 = inherit). */
  scale?: number;
  /** When true, this field is positioned freely via x/y/w/h instead of flowing
   *  in the auto-layout text area. */
  freePos?: boolean;
  /** Free-position: percentages relative to the label canvas. */
  posX?: number;
  posY?: number;
  posW?: number;
  posH?: number;
  /** Per-field rotation in degrees (0/90/180/270). */
  posRot?: number;
  /** When true, the value is rendered on a new line below the heading
   *  (instead of inline with a colon separator). */
  stackLines?: boolean;
  /** Per-field text alignment override (free-positioned only).
   *  Overrides the label's global bodyAlign. */
  textAlign?: "left" | "center" | "right";
}

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
  /** How many labels are placed side-by-side on the physical media roll (default 1). */
  labelsAcross?: number;
  /** Horizontal gap (mm) between adjacent labels when labelsAcross > 1. */
  labelGapMm?: number;
  /** Barcode size multiplier (auto layout) — 1 = default ~28% of available height. */
  barcodeHeightScale?: number;
  /** Barcode width multiplier — narrows/widens the bars. */
  barcodeWidthScale?: number;

  /** When true, the barcode is positioned freely (X/Y/W/H/Rotation) instead
   *  of the default centered-at-bottom auto placement. */
  barcodeFree?: boolean;
  /** Free-position: percentage from left (0-100). */
  barcodeX?: number;
  /** Free-position: percentage from top (0-100). */
  barcodeY?: number;
  /** Free-position: width as percentage of label (10-100). */
  barcodeW?: number;
  /** Free-position: height as percentage of label (5-60). */
  barcodeH?: number;
  /** Free-position: rotation in degrees (0/90/180/270). */
  barcodeRot?: number;

  /** Extra space (in mm) reserved at the BOTTOM of the auto-layout text area —
   *  use this to push fields up when you've placed a free-positioned barcode
   *  in the lower part of the label. */
  contentBottomReserveMm?: number;
  /** Extra space (in mm) reserved at the TOP of the auto-layout text area. */
  contentTopReserveMm?: number;
  /** Whether to show the divider line under the product name (default true). */
  productNameDivider?: boolean;
  /** Extra space (in mm) between the product name and the first field below it. */
  productNameGapMm?: number;
  /** When this label was loaded from a saved template, the original template id so
   *  Save can PATCH the existing record instead of duplicating. */
  sourceTemplateId?: string;

  /** Optional "Manufactured by" footer block (address + email) rendered just above
   *  the bottom margin. Empty values hide the corresponding line. */
  manufacturedBy?: string;
  manufacturedAddress?: string;
  manufacturedEmail?: string;
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
function mfgLineCountVisual(lbl: LabelTemplate): number {
  return [lbl.manufacturedBy, lbl.manufacturedAddress, lbl.manufacturedEmail]
    .filter((s) => s && s.trim()).length;
}
export function getAutoBarcode(fields: LabelField[]) {
  return fields.find(f => /product\s*code|barcode|^code$/i.test(f.heading))?.value.trim() || "";
}
export function getProductName(fields: LabelField[]) {
  return fields.find(f => /^name$/i.test(f.heading.trim()))?.value.trim() || "";
}

// ─── Shared size calculator ───────────────────────────────────────────────────
export function computeSizes(lbl: LabelTemplate, bodyFieldCount: number) {
  const PX_PER_MM = PREVIEW_W / Math.max(lbl.widthMm, 1);
  // User-reservable space at top + bottom — push the auto-layout text area
  // out of the way of free-positioned barcode / images.
  const reservedTopMm    = lbl.contentTopReserveMm ?? 0;
  const reservedBottomMm = lbl.contentBottomReserveMm ?? 0;
  const contentMm = Math.max(
    lbl.heightMm - lbl.topMarginMm - lbl.bottomMarginMm - reservedTopMm - reservedBottomMm,
    5
  );
  const logoMm    = lbl.logoDataUrl && lbl.logoPosition !== "none" ? lbl.logoHeightMm + 2 : 0;
  // Auto-reserve a thin strip at the bottom of the content area for the
  // "Manufactured by" footer so the auto-layout body never overlaps it.
  const mfgLines = [lbl.manufacturedBy, lbl.manufacturedAddress, lbl.manufacturedEmail]
    .filter((s) => s && s.trim()).length;
  // Address can wrap to a 2nd visual line — assume it does to be safe.
  const mfgLineCount = mfgLines + (lbl.manufacturedAddress && lbl.manufacturedAddress.trim().length > 30 ? 1 : 0);
  const mfgMm     = mfgLineCount > 0 ? Math.min(mfgLineCount * 2.0 + 0.5, 8) : 0;
  const availMm   = Math.max(contentMm - logoMm - mfgMm, 8);
  const availPx   = availMm * PX_PER_MM;
  const n         = bodyFieldCount;
  const basePx    = Math.max(Math.min(availPx / (n + 3) * 0.75, 15), 8) * lbl.fontScale;

  const headingPx  = Math.min(basePx * 1.55, 22);
  const labelPx    = Math.min(basePx * 1.05, 14);
  const valuePx    = Math.min(basePx * 1.1, 15);
  const barcodeScale = lbl.barcodeHeightScale ?? 1;
  // Width 28% default × user scale, but always at least 12px (any barcode shorter
  // becomes unscannable) and at most ~90% of the available height.
  const barcodeHPx = Math.min(
    Math.max(availPx * 0.28 * barcodeScale, 12),
    availPx * 0.9
  );

  const toMm = (px: number) => parseFloat((px / PX_PER_MM).toFixed(2));

  return {
    PX_PER_MM, contentMm, availMm, basePx, mfgMm,
    headingPx, labelPx, valuePx, barcodeHPx,
    headingMm: toMm(headingPx), labelMm: toMm(labelPx),
    valueMm: toMm(valuePx), barcodeHMm: toMm(barcodeHPx),
  };
}

// ─── BarcodeSVG ───────────────────────────────────────────────────────────────
// Handles both 1D barcodes (via jsbarcode) and QR (via qrcode). The `format`
// values come from the FORMATS list in barcode/page.tsx — "QRCODE" routes to QR.
export function BarcodeSVG({ value, format, height, widthScale }: { value: string; format: string; height: number; widthScale?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  const [err, setErr] = useState("");
  const [qrSvg, setQrSvg] = useState<string>("");

  const isQR = format === "QRCODE";

  useEffect(() => {
    if (!value.trim()) { setErr(""); setQrSvg(""); return; }

    if (isQR) {
      // QR code path — render to SVG string, drop into dangerouslySetInnerHTML.
      import("qrcode").then((mod) => {
        // `qrcode` exposes `toString` returning an SVG string.
        const toString = (mod as any).toString || (mod as any).default?.toString;
        toString(value, { type: "svg", margin: 1, errorCorrectionLevel: "M" })
          .then((svg: string) => {
            // Force the SVG to fill its container so size scales with label.
            const sized = svg.replace(/<svg([^>]*)>/, (_: string, attrs: string) => {
              const cleaned = attrs
                .replace(/\swidth=("|')[^"']*\1/g, "")
                .replace(/\sheight=("|')[^"']*\1/g, "");
              return `<svg${cleaned} style="display:block;width:auto;height:${height}px;max-width:100%">`;
            });
            setQrSvg(sized);
            setErr("");
          })
          .catch(() => setErr("Invalid QR value"));
      });
      return;
    }

    // 1D barcode path (existing behavior)
    if (!ref.current) return;
    import("jsbarcode").then(({ default: JsBarcode }) => {
      try {
        JsBarcode(ref.current!, value, {
          format,
          displayValue: true, fontSize: 11, textMargin: 2, margin: 4,
          // Per-bar width × user-specified width scale (default 1).
          width: 1.6 * (widthScale ?? 1),
          height,
          background: "#fff", lineColor: "#000",
          valid: (ok: boolean) => setErr(ok ? "" : "Invalid value for format"),
        });
      } catch { setErr("Invalid barcode"); }
    });
  }, [value, format, height, isQR]);

  if (!value.trim()) return (
    <div style={{ textAlign: "center", color: "#aaa", fontSize: 9, padding: "8px 0", fontStyle: "italic" }}>
      — barcode will appear here —
    </div>
  );
  if (err) return <div style={{ textAlign: "center", color: "#d44", fontSize: 9, padding: 4 }}>{err}</div>;

  if (isQR) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 2 }}>
        <div dangerouslySetInnerHTML={{ __html: qrSvg }} />
      </div>
    );
  }
  return <svg ref={ref} style={{ display: "block", maxWidth: "100%" }} />;
}

// ─── LabelPreview ─────────────────────────────────────────────────────────────
export function LabelPreview({ lbl }: { lbl: LabelTemplate }) {
  const { PX_PER_MM, headingPx, labelPx, valuePx, barcodeHPx, basePx, mfgMm } = computeSizes(
    lbl, lbl.fields.filter(f => !/^name$/i.test(f.heading.trim())).length
  );
  const totalPx   = lbl.heightMm * PX_PER_MM;
  const topPx     = lbl.topMarginMm * PX_PER_MM;
  const bottomPx  = lbl.bottomMarginMm * PX_PER_MM;
  const contentPx = Math.max(totalPx - topPx - bottomPx, 20);
  const reservedTopMm    = lbl.contentTopReserveMm ?? 0;
  const reservedBottomMm = lbl.contentBottomReserveMm ?? 0;
  const leftPad   = lbl.leftMarginMm * PX_PER_MM + 5;
  const rightPad  = lbl.rightMarginMm * PX_PER_MM + 5;

  const name         = getProductName(lbl.fields);
  const barcodeValue = lbl.barcodeAuto ? getAutoBarcode(lbl.fields) : lbl.barcodeValue;
  // Auto-layout body excludes Name, hidden fields, AND free-positioned ones
  // (those render separately as absolute overlays).
  const bodyFields   = lbl.fields.filter(f => !/^name$/i.test(f.heading.trim()) && !f.hidden && !f.freePos);
  const freeFields   = lbl.fields.filter(f => f.freePos && !f.hidden);
  const hasLogo      = !!lbl.logoDataUrl && lbl.logoPosition !== "none";
  const logoHeightPx = hasLogo ? lbl.logoHeightMm * PX_PER_MM : 0;
  const dsgn         = lbl.design;

  // Freeform mode removed — Auto Layout is the only rendering path now.

  return (
    <div data-label-root style={{
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
        paddingTop: 4 + reservedTopMm * PX_PER_MM,
        paddingBottom: 3 + reservedBottomMm * PX_PER_MM,
        paddingLeft: leftPad, paddingRight: rightPad,
        boxSizing: "border-box",
      }}>
        {hasLogo && lbl.logoPosition === "top" && (
          <div data-imp="logo" data-logo-src={lbl.logoDataUrl} style={{ height: logoHeightPx, display: "flex", justifyContent: "center", alignItems: "center", marginBottom: 3, flexShrink: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lbl.logoDataUrl} style={{ maxHeight: logoHeightPx, maxWidth: "80%", objectFit: "contain" }} alt="logo" />
          </div>
        )}

        <div data-imp="heading" style={{
          fontWeight: dsgn.headingBold ? "bold" : "normal", fontSize: headingPx,
          textAlign: dsgn.headingAlign,
          textTransform: "uppercase", letterSpacing: "0.5px",
          fontStyle: dsgn.headingItalic ? "italic" : "normal",
          textDecoration: dsgn.headingUnderline ? "underline" : "none",
          borderBottom: (lbl.productNameDivider ?? true) ? "2px solid #000" : "none",
          paddingBottom: (lbl.productNameDivider ?? true) ? headingPx * 0.3 : 0,
          // Extra user-controlled gap below product name (in mm) + the default tiny breath.
          marginBottom: headingPx * 0.25 + (lbl.productNameGapMm ?? 0) * PX_PER_MM,
          lineHeight: 1.15, color: "#000", flexShrink: 0,
        }}>
          {name || <span style={{ color: "#ccc", fontWeight: 400, fontSize: headingPx * 0.7 }}>Product Name</span>}
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-evenly", overflow: "hidden" }}>
          {bodyFields.filter((f) => !f.hidden).map(field => {
            const fScale  = field.scale && field.scale > 0 ? field.scale : 1;
            const fSize   = valuePx * fScale;
            const hSize   = labelPx * fScale;
            const hl      = !!field.highlight;
            return (
              <div key={field.id} data-imp="field-row" data-field-heading={field.heading} data-field-value={field.value} style={{
                display: "flex", alignItems: "center",
                justifyContent: dsgn.bodyAlign === "center" ? "center" : dsgn.bodyAlign === "right" ? "flex-end" : "flex-start",
                borderBottom: "0.8px solid #e8e8e8",
                paddingBottom: 1.5, paddingTop: 1, gap: 5,
                background: hl ? "#fff8c2" : "transparent",
                borderRadius: hl ? 3 : 0,
                paddingLeft: hl ? 4 : 0,
                paddingRight: hl ? 4 : 0,
              }}>
                <span style={{
                  fontWeight: hl ? 900 : "bold",
                  fontSize: hSize,
                  color: "#111",
                  minWidth: "36%", flexShrink: 0, lineHeight: 1.25,
                }}>
                  {field.heading || "—"}:
                </span>
                <span style={{
                  fontSize: fSize,
                  fontWeight: field.bold || dsgn.bodyBold || hl ? "bold" : "normal",
                  color: "#000",
                  flex: 1, lineHeight: 1.25,
                  textAlign: dsgn.bodyAlign,
                  wordBreak: "break-word", whiteSpace: "pre-wrap",
                }}>
                  {field.value || <span style={{ color: "#ccc" }}>—</span>}
                </span>
              </div>
            );
          })}
        </div>

        {/* Decorative lines */}
        {dsgn.lines.map(ln => (
          <div key={ln.id} data-imp="deco-line" data-line-color={ln.color} data-line-thickness={ln.thickness} data-line-style={ln.style} style={{
            position: "absolute",
            left: `${ln.xPercent ?? 50}%`,
            top: `${ln.yPercent}%`,
            width: `${ln.lengthPercent ?? 100}%`,
            borderTop: `${ln.thickness}px ${ln.style} ${ln.color}`,
            transform: `translate(-50%, -50%) rotate(${ln.rot || 0}deg)`,
            pointerEvents: "none",
          }} />
        ))}

        {/* Default centered-at-bottom barcode — only when free positioning is OFF */}
        {lbl.showBarcode && !lbl.barcodeFree && (
          <div data-imp="barcode" data-barcode-value={barcodeValue} data-barcode-format={lbl.barcodeFormat} style={{
            borderTop: "1px solid #ccc",
            marginTop: 3,
            paddingTop: 2,
            display: "flex",
            justifyContent: "center",
            flexShrink: 0,
            width: `${(lbl.barcodeWidthScale ?? 1) * 100}%`,
            alignSelf: "center",
          }}>
            <BarcodeSVG
              value={barcodeValue}
              format={lbl.barcodeFormat}
              height={barcodeHPx}
            />
          </div>
        )}

        {hasLogo && lbl.logoPosition === "bottom" && (
          <div data-imp="logo" data-logo-src={lbl.logoDataUrl} style={{ height: logoHeightPx, display: "flex", justifyContent: "center", alignItems: "center", marginTop: 3, flexShrink: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lbl.logoDataUrl} style={{ maxHeight: logoHeightPx, maxWidth: "80%", objectFit: "contain" }} alt="logo" />
          </div>
        )}

        {/* "Manufactured by" footer — absolute strip pinned to the bottom of the
            content area. computeSizes reserves vertical space (mfgMm) so the
            auto-layout body never overlaps this block. */}
        {(lbl.manufacturedBy?.trim() || lbl.manufacturedAddress?.trim() || lbl.manufacturedEmail?.trim()) && (
          <div data-imp="mfg-footer" style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: bottomPx,
            height: mfgMm * PX_PER_MM,
            padding: "0.5px 4px 0",
            fontSize: Math.max(mfgMm * PX_PER_MM / Math.max(mfgLineCountVisual(lbl), 1) * 0.78, 5.5),
            lineHeight: 1.05,
            color: "#000",
            textAlign: "center",
            fontFamily: dsgn.fontFamily,
            borderTop: "0.5px solid #000",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 0,
            overflow: "hidden",
            background: "#fff",
            zIndex: 2,
          }}>
            {lbl.manufacturedBy?.trim() && (
              <div style={{ fontWeight: "bold", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                Mfg by: {lbl.manufacturedBy.trim()}
              </div>
            )}
            {lbl.manufacturedAddress?.trim() && (
              <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {lbl.manufacturedAddress.trim().replace(/\s*\n\s*/g, ", ")}
              </div>
            )}
            {lbl.manufacturedEmail?.trim() && (
              <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {lbl.manufacturedEmail.trim()}
              </div>
            )}
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

      {/* Free-position FIELDS — absolute overlays. The INSIDE uses the EXACT
          same heading + value treatment as the Auto Layout body row, so the
          formatting stays identical no matter where you place the field.
          Auto-layout reference (lines ~395-403 of this file):
            heading: font-weight bold, color #111, fontSize labelPx
            value:   fontWeight = field.bold || dsgn.bodyBold ? bold : normal
                     color #000, fontSize valuePx, alignment from dsgn.bodyAlign */}
      {freeFields.map((f) => {
        // Y = literal top %.
        // Alignment chooses WHICH edge of the (zoomed) text is the anchor.
        // X then positions THAT anchor along the canvas (0 = left border,
        // 100 = right border). Moving the slider right always moves the
        // text right, regardless of alignment.
        const x     = Math.max(0, Math.min(f.posX ?? (
          (f.textAlign || dsgn.bodyAlign) === "right" ? 100 :
          (f.textAlign || dsgn.bodyAlign) === "center" ? 50 : 0
        ), 100));
        const y     = Math.max(0, Math.min(f.posY ?? 30, 100));
        const rot   = f.posRot ?? 0;
        const zoom  = f.scale && f.scale > 0 ? f.scale : 1;
        const stack       = f.stackLines === true;
        // Font size = baseline (matches Auto Layout font ratio) × zoom multiplier.
        // Auto Layout body uses ~basePx*1.1 ≈ 13px at standard scale; we reuse
        // that as our 100% reference so the free field matches inline rows.
        const refFont     = 13;
        const baseFont    = refFont * zoom;
        const headingFont = baseFont * 0.95;
        const valueFont   = baseFont;
        const hasValue    = !!(f.value && f.value.trim());

        // Inherit body-bold and per-field bold the same way Auto Layout does.
        const valueBold = f.bold || dsgn.bodyBold;
        const headingBold = true; // headings always bold in Auto Layout — keep parity
        // Per-field text alignment override, falls back to label-wide bodyAlign.
        const fAlign = f.textAlign || dsgn.bodyAlign;

        return (
          <div key={f.id} style={{
            position: "absolute",
            // Alignment selects the text's anchor edge; X positions that anchor
            // along the canvas (0 = left, 100 = right):
            //   left   → anchor is LEFT edge → use `left: X%`
            //   right  → anchor is RIGHT edge → use `right: (100−X)%`
            //   center → anchor is CENTER → `left: X% + translateX(-50%)`
            left:  fAlign === "right" ? "auto" : `${x}%`,
            right: fAlign === "right" ? `${100 - x}%` : "auto",
            top: `${y}%`,
            // Keep the text within the canvas regardless of X position.
            maxWidth: "100%",
            transform: [
              fAlign === "center" ? "translateX(-50%)" : "",
              rot ? `rotate(${rot}deg)` : "",
            ].filter(Boolean).join(" ") || undefined,
            transformOrigin: "center top",
            // Inline-flex auto-sizes the box to content. When content is wider
            // than maxWidth it wraps instead of overflowing.
            display: "inline-flex",
            alignItems: "center",
            overflow: "hidden",
            pointerEvents: "none",
            background: f.highlight ? "#fff8c2" : "transparent",
            borderRadius: f.highlight ? 3 : 0,
          }}>
            <div style={{
              display: "flex",
              flexWrap: stack ? "nowrap" : "wrap",
              flexDirection: stack ? "column" : "row",
              alignItems: stack ? (
                fAlign === "center" ? "center"
                : fAlign === "right" ? "flex-end"
                : "flex-start"
              ) : "baseline",
              justifyContent:
                fAlign === "center" ? "center"
                : fAlign === "right" ? "flex-end"
                : "flex-start",
              gap: stack ? 1 : 5,
              fontFamily: dsgn.fontFamily,
              lineHeight: 1.2,
              textAlign: fAlign,
              minWidth: 0,
            }}>
              <span style={{
                fontSize: headingFont,
                fontWeight: headingBold ? "bold" : "normal",
                color: "#111",
                whiteSpace: "nowrap",
                lineHeight: 1.15,
                flexShrink: 0,
              }}>
                {f.heading || "—"}{!stack && ":"}
              </span>
              <span style={{
                fontSize: valueFont,
                fontWeight: valueBold ? "bold" : "normal",
                color: "#000",
                // Allow wrap so long values fold onto a new line instead of
                // forcing the field to overflow its maxWidth.
                whiteSpace: "normal",
                wordBreak: "break-word",
                lineHeight: 1.15,
                minWidth: 0,
              }}>
                {hasValue ? f.value : <span style={{ color: "#ccc" }}>—</span>}
              </span>
            </div>
          </div>
        );
      })}

      {/* Free-position barcode — absolute overlay across the whole label box.
          Active when lbl.barcodeFree is true. Defaults: centered, 80% wide. */}
      {lbl.showBarcode && lbl.barcodeFree && (() => {
        const w   = lbl.barcodeW ?? 80;
        const h   = lbl.barcodeH ?? 20;
        // Border-to-border interpolation: X=0 flush left, X=100 flush right.
        const rawX = lbl.barcodeX ?? 10;
        const rawY = lbl.barcodeY ?? 60;
        const availX = Math.max(0, 100 - w);
        const availY = Math.max(0, 100 - h);
        const x   = (Math.max(0, Math.min(rawX, 100)) / 100) * availX;
        const y   = (Math.max(0, Math.min(rawY, 100)) / 100) * availY;
        const rot = lbl.barcodeRot ?? 0;
        const widthPx  = (w / 100) * PREVIEW_W;
        const heightPx = (h / 100) * totalPx;
        return (
          <div style={{
            position: "absolute",
            left: `${x}%`,
            top: `${y}%`,
            width: `${w}%`,
            height: `${h}%`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: rot ? `rotate(${rot}deg)` : undefined,
            transformOrigin: "center center",
            overflow: "hidden",
            pointerEvents: "none",
          }}>
            <div style={{ width: widthPx, height: heightPx, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BarcodeSVG
                value={barcodeValue}
                format={lbl.barcodeFormat}
                height={heightPx * 0.85}
              />
            </div>
          </div>
        );
      })()}
    </div>
  );
}
