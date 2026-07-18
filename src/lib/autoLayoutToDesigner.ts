/* Convert an Auto-Layout label (the /barcode page's data model) into a
   Designer LabelDoc (the /designer page's data model), preserving:
   - canvas size + margins
   - font sizes (derived from the same computeSizes math the renderer uses)
   - heading + divider + body rows
   - barcode (auto-centered or free-positioned)
   - logo (top/bottom)
   - manufactured-by footer (single condensed line block)
   - decorative lines from design.lines
   - free-positioned per-field overrides
   so the user can pick up the same label in the Designer and tune individual
   pieces with cursor tools without losing the original look. */

import { computeSizes, type LabelTemplate, type LabelField } from "@/components/LabelPreviewRenderer";
import type { AnyElement, LabelDoc, TextElement, BarcodeElement, LineElement, ImageElement } from "@/components/DesignerLabelPreview";

const PX_TO_PT = 0.75; // 1pt = 1.333px @ 96dpi
let _idCtr = 0;
const uid = (p = "el") => `${p}-${++_idCtr}-${Date.now().toString(36)}`;

function pxToPt(px: number) { return Math.max(4, Math.round(px * PX_TO_PT * 10) / 10); }

/* Read either a SavedTemplate (`fields: Array<{heading, value?}>`) or a
   LabelTemplate (with id + value strings). We only need names/values/flags. */
type AutoLayoutInput = Partial<LabelTemplate> & {
  name?: string;
  widthMm: number; heightMm: number;
  fields: LabelField[];
};

export function convertAutoLayoutToDesignerDoc(input: AutoLayoutInput): LabelDoc {
  // Fill in missing defaults so computeSizes can run uniformly.
  const lbl: LabelTemplate = {
    id: "x", name: input.name ?? "Imported",
    widthMm: input.widthMm, heightMm: input.heightMm,
    topMarginMm: input.topMarginMm ?? 0,
    bottomMarginMm: input.bottomMarginMm ?? 0,
    leftMarginMm: input.leftMarginMm ?? 0,
    rightMarginMm: input.rightMarginMm ?? 0,
    fields: input.fields ?? [],
    barcodeFormat: input.barcodeFormat ?? "CODE128",
    barcodeValue: input.barcodeValue ?? "",
    barcodeAuto: input.barcodeAuto ?? true,
    showBarcode: input.showBarcode ?? true,
    copies: input.copies ?? 1,
    logoDataUrl: input.logoDataUrl ?? "",
    logoPosition: input.logoPosition ?? "none",
    logoHeightMm: input.logoHeightMm ?? 0,
    fontScale: input.fontScale ?? 1,
    showBorder: input.showBorder ?? true,
    rotated: input.rotated ?? false,
    design: input.design ?? { fontFamily: "Arial, sans-serif", headingAlign: "center", headingBold: true, headingItalic: false, headingUnderline: false, bodyAlign: "left", bodyBold: false, rotationDeg: 0, lines: [], mode: "auto", elements: [] },
    labelsAcross: input.labelsAcross ?? 1,
    labelGapMm: input.labelGapMm ?? 0,
    barcodeHeightScale: input.barcodeHeightScale ?? 1,
    barcodeWidthScale: input.barcodeWidthScale ?? 1,
    barcodeFree: input.barcodeFree ?? false,
    barcodeX: input.barcodeX, barcodeY: input.barcodeY,
    barcodeW: input.barcodeW, barcodeH: input.barcodeH, barcodeRot: input.barcodeRot,
    contentTopReserveMm: input.contentTopReserveMm ?? 0,
    contentBottomReserveMm: input.contentBottomReserveMm ?? 0,
    productNameDivider: input.productNameDivider ?? true,
    productNameGapMm: input.productNameGapMm ?? 0,
    manufacturedBy: input.manufacturedBy,
    manufacturedAddress: input.manufacturedAddress,
    manufacturedEmail: input.manufacturedEmail,
  };

  const W = Math.max(lbl.widthMm, 5);
  const H = Math.max(lbl.heightMm, 5);
  const L = lbl.leftMarginMm, R = lbl.rightMarginMm;
  const T = lbl.topMarginMm,  B = lbl.bottomMarginMm;
  const innerW = Math.max(W - L - R, 1);

  const elements: AnyElement[] = [];

  const productName = lbl.fields.find(f => /^name$/i.test(f.heading.trim()))?.value?.trim() || "";
  const visibleFields = lbl.fields.filter(f => !f.hidden && !/^name$/i.test(f.heading.trim()));
  const bodyFields = visibleFields.filter(f => !f.freePos);
  const freeFields = visibleFields.filter(f => f.freePos);

  const sizes = computeSizes(lbl, bodyFields.length);
  const headingMm = sizes.headingMm;
  const labelMm   = sizes.labelMm;
  const valueMm   = sizes.valueMm;
  const barcodeMm = sizes.barcodeHMm;
  const PX_PER_MM = sizes.PX_PER_MM;

  // Logo (top)
  let cursorY = T + (lbl.contentTopReserveMm ?? 0);
  if (lbl.logoDataUrl && lbl.logoPosition === "top") {
    elements.push(<ImageElement>{
      id: uid("logo"), type: "image", name: "Logo",
      x: L, y: cursorY, w: innerW, h: lbl.logoHeightMm,
      rotation: 0, locked: false, visible: true, opacity: 1,
      src: lbl.logoDataUrl, fit: "fit",
    });
    cursorY += lbl.logoHeightMm + 2;
  }

  // Product name heading (+ optional divider)
  if (productName) {
    const headingHeight = headingMm * 1.2;
    elements.push(<TextElement>{
      id: uid("name"), type: "text", name: "Product Name",
      x: L, y: cursorY, w: innerW, h: headingHeight,
      rotation: 0, locked: false, visible: true, opacity: 1,
      text: productName,
      fontFamily: lbl.design.fontFamily,
      fontSize: pxToPt(sizes.headingPx),
      bold: lbl.design.headingBold,
      italic: lbl.design.headingItalic,
      underline: lbl.design.headingUnderline,
      color: "#111111", bgColor: "",
      align: lbl.design.headingAlign,
    });
    cursorY += headingHeight + headingMm * 0.25;
    if (lbl.productNameDivider ?? true) {
      elements.push(<LineElement>{
        id: uid("div"), type: "line", name: "Heading divider",
        x: L, y: cursorY, w: innerW, h: 0.3,
        rotation: 0, locked: false, visible: true, opacity: 1,
        color: "#000000", strokeWidth: 1, style: "solid",
      });
      cursorY += 0.6;
    }
    cursorY += (lbl.productNameGapMm ?? 0);
  }

  // Mfg-by reserved strip at the bottom
  const mfgMm = sizes.mfgMm;
  const mfgY = H - B - mfgMm;

  // Logo (bottom)
  let logoBottomMm = 0;
  if (lbl.logoDataUrl && lbl.logoPosition === "bottom") {
    logoBottomMm = lbl.logoHeightMm + 2;
  }

  // Barcode placement
  if (lbl.showBarcode) {
    if (lbl.barcodeFree) {
      // Free-positioned: same interpolation as LabelPreviewRenderer (rawX/rawY)
      const w   = lbl.barcodeW ?? 80;
      const h   = lbl.barcodeH ?? 20;
      const rawX = lbl.barcodeX ?? 10;
      const rawY = lbl.barcodeY ?? 60;
      const availX = Math.max(0, 100 - w);
      const availY = Math.max(0, 100 - h);
      const xPct = (Math.max(0, Math.min(rawX, 100)) / 100) * availX;
      const yPct = (Math.max(0, Math.min(rawY, 100)) / 100) * availY;
      const bcW = (w / 100) * W;
      const bcH = (h / 100) * H;
      elements.push(<BarcodeElement>{
        id: uid("bc"), type: "barcode", name: "Barcode",
        x: (xPct / 100) * W, y: (yPct / 100) * H, w: bcW, h: bcH,
        rotation: lbl.barcodeRot ?? 0,
        locked: false, visible: true, opacity: 1,
        format: lbl.barcodeFormat === "QRCODE" ? "CODE128" : lbl.barcodeFormat,
        value: lbl.barcodeAuto
          ? (lbl.fields.find(f => /product\s*code|barcode|^code$/i.test(f.heading))?.value?.trim() || "")
          : lbl.barcodeValue,
        showText: true, barHeight: bcH * 3,
        barWidth: 1.5 * (lbl.barcodeWidthScale ?? 1),
        fg: "#000000", bg: "#ffffff", quietZone: 4,
      });
    } else {
      // Auto-centered in the lower band
      const bcW = innerW * 0.85;
      const bcX = L + (innerW - bcW) / 2;
      const bcY = H - B - mfgMm - logoBottomMm - barcodeMm;
      elements.push(<BarcodeElement>{
        id: uid("bc"), type: "barcode", name: "Barcode",
        x: bcX, y: bcY, w: bcW, h: barcodeMm,
        rotation: 0, locked: false, visible: true, opacity: 1,
        format: lbl.barcodeFormat === "QRCODE" ? "CODE128" : lbl.barcodeFormat,
        value: lbl.barcodeAuto
          ? (lbl.fields.find(f => /product\s*code|barcode|^code$/i.test(f.heading))?.value?.trim() || "")
          : lbl.barcodeValue,
        showText: true, barHeight: barcodeMm * 3,
        barWidth: 1.5 * (lbl.barcodeWidthScale ?? 1),
        fg: "#000000", bg: "#ffffff", quietZone: 4,
      });
    }
  }

  // Body band — area between cursorY and the barcode/logo/mfg block
  const barcodeBandStart = lbl.barcodeFree || !lbl.showBarcode
    ? H - B - mfgMm - logoBottomMm
    : H - B - mfgMm - logoBottomMm - barcodeMm - 0.5;
  const bodyTop = cursorY;
  const bodyBottom = barcodeBandStart;
  const bodySpan = Math.max(bodyBottom - bodyTop, 2);

  if (bodyFields.length > 0) {
    const rowH = bodySpan / bodyFields.length;
    bodyFields.forEach((f, i) => {
      const value = f.value?.trim() || "";
      const heading = (f.heading || "").trim();
      const display = heading ? (value ? `${heading}: ${value}` : `${heading}:`) : value;
      elements.push(<TextElement>{
        id: uid("f"), type: "text", name: heading || `Field ${i + 1}`,
        x: L, y: bodyTop + i * rowH, w: innerW, h: rowH,
        rotation: 0, locked: false, visible: true, opacity: 1,
        text: display,
        fontFamily: lbl.design.fontFamily,
        fontSize: pxToPt(sizes.valuePx),
        bold: f.bold ?? lbl.design.bodyBold,
        italic: false, underline: false,
        color: "#000000",
        bgColor: f.highlight ? "#fff8c2" : "",
        align: f.textAlign || lbl.design.bodyAlign,
      });
    });
  }

  // Free-positioned per-field overrides
  freeFields.forEach((f) => {
    const value = f.value?.trim() || "";
    const heading = (f.heading || "").trim();
    const display = heading ? (value ? `${heading}: ${value}` : heading) : value;
    const zoom = f.scale && f.scale > 0 ? f.scale : 1;
    const pt = pxToPt(13 * zoom); // matches LabelPreviewRenderer's refFont = 13
    const yPct = Math.max(0, Math.min(f.posY ?? 30, 100));
    // Estimate width based on text length × pt — clamp to label width
    const approxW = Math.min(W, Math.max(20, display.length * pt * 0.18));
    const align = f.textAlign || lbl.design.bodyAlign;
    let x = 0;
    if (align === "left")   x = 0;
    if (align === "center") x = (W - approxW) / 2;
    if (align === "right")  x = W - approxW;
    elements.push(<TextElement>{
      id: uid("ff"), type: "text", name: `Free: ${heading || "field"}`,
      x, y: (yPct / 100) * H,
      w: approxW, h: pt * 0.5,
      rotation: f.posRot ?? 0,
      locked: false, visible: true, opacity: 1,
      text: display,
      fontFamily: lbl.design.fontFamily,
      fontSize: pt,
      bold: f.bold ?? lbl.design.bodyBold,
      italic: false, underline: false,
      color: "#000000",
      bgColor: f.highlight ? "#fff8c2" : "",
      align,
    });
  });

  // Decorative lines from design.lines
  for (const ln of lbl.design.lines || []) {
    const lengthMm = (ln.lengthPercent / 100) * W;
    const xMm = (ln.xPercent / 100) * W - lengthMm / 2;
    const yMm = (ln.yPercent / 100) * H;
    elements.push(<LineElement>{
      id: uid("ln"), type: "line", name: "Line",
      x: xMm, y: yMm, w: lengthMm, h: Math.max(0.2, ln.thickness / PX_PER_MM),
      rotation: 0, locked: false, visible: true, opacity: 1,
      color: ln.color || "#000000",
      strokeWidth: ln.thickness,
      style: (ln.style as LineElement["style"]) || "solid",
    });
  }

  // Manufactured-by footer (collapsed into one centered line block)
  const mfgParts = [
    lbl.manufacturedBy?.trim() ? `Mfg by: ${lbl.manufacturedBy.trim()}` : "",
    lbl.manufacturedAddress?.trim()?.replace(/\s*\n\s*/g, ", "),
    lbl.manufacturedEmail?.trim(),
  ].filter(Boolean);
  if (mfgParts.length > 0 && mfgMm > 0) {
    elements.push(<TextElement>{
      id: uid("mfg"), type: "text", name: "Mfg footer",
      x: L, y: mfgY, w: innerW, h: mfgMm,
      rotation: 0, locked: false, visible: true, opacity: 1,
      text: mfgParts.join(" · "),
      fontFamily: lbl.design.fontFamily,
      fontSize: pxToPt(Math.max(sizes.basePx * 0.6, 6.5)),
      bold: false, italic: false, underline: false,
      color: "#000000", bgColor: "",
      align: "center",
    });
  }

  return {
    labelName: productName || lbl.name || "Imported Label",
    width: W, height: H, units: "mm",
    orientation: W >= H ? "landscape" : "portrait",
    bg: "#ffffff", dpi: 203, bleed: 0,
    elements,
  };
}
