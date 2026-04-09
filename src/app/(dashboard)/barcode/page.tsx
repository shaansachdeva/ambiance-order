"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Barcode, Plus, Trash2, Printer, ChevronDown, ChevronUp,
  X, Bookmark, BookmarkCheck, FolderOpen,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

// ─── Barcode formats ──────────────────────────────────────────────────────────
const FORMATS = [
  { value: "CODE128", label: "CODE 128 (Universal)" },
  { value: "CODE39",  label: "CODE 39" },
  { value: "EAN13",   label: "EAN-13 (13 digits)" },
  { value: "EAN8",    label: "EAN-8 (8 digits)" },
  { value: "UPC",     label: "UPC-A (12 digits)" },
  { value: "ITF14",   label: "ITF-14 (14 digits)" },
];

// ─── Types ────────────────────────────────────────────────────────────────────
interface LabelField { id: string; heading: string; value: string; }

interface LabelTemplate {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  topMarginMm: number;
  bottomMarginMm: number;
  fields: LabelField[];
  barcodeFormat: string;
  barcodeValue: string;
  barcodeAuto: boolean;
  copies: number;
}

// Saved template (no values, just structure + sizes)
interface SavedTemplate {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  topMarginMm: number;
  bottomMarginMm: number;
  fields: { heading: string }[];   // headings only, no values
  barcodeFormat: string;
}

const STORAGE_KEY = "ambiance_saved_label_templates";

// ─── Built-in field presets ───────────────────────────────────────────────────
const FIELD_PRESETS: Record<string, { heading: string }[]> = {
  bopp_tape: [
    { heading: "Name" },
    { heading: "Type" },
    { heading: "Specification" },
    { heading: "Rolls / Box" },
    { heading: "Product Code" },
    { heading: "Batch Number" },
  ],
  bopp_jumbo: [
    { heading: "Name" },
    { heading: "Type" },
    { heading: "Core Size" },
    { heading: "Width" },
    { heading: "Product Code" },
    { heading: "Batch Number" },
  ],
  thermal_roll: [
    { heading: "Name" },
    { heading: "Size" },
    { heading: "GSM" },
    { heading: "Rolls / Box" },
    { heading: "Product Code" },
    { heading: "Batch Number" },
  ],
  barcode_label: [
    { heading: "Name" },
    { heading: "Size" },
    { heading: "Labels / Roll" },
    { heading: "Rolls / Box" },
    { heading: "Product Code" },
    { heading: "Batch Number" },
  ],
  custom: [
    { heading: "Field 1" },
    { heading: "Field 2" },
    { heading: "Field 3" },
  ],
};

const BUILTIN_PRESETS = [
  { id: "bopp_tape",     label: "BOPP Tape Box",    widthMm: 100, heightMm: 150 },
  { id: "bopp_jumbo",    label: "BOPP Jumbo Roll",   widthMm: 100, heightMm: 150 },
  { id: "thermal_roll",  label: "Thermal Roll Box",  widthMm: 100, heightMm: 150 },
  { id: "barcode_label", label: "Barcode Label Box", widthMm: 100, heightMm: 150 },
];

const DEFAULT_TOP    = 30;
const DEFAULT_BOTTOM = 15;

let _ctr = 0;

function fieldsFromHeadings(headings: { heading: string }[], seed: string): LabelField[] {
  return headings.map((h, i) => ({ id: `f-${seed}-${i}`, heading: h.heading, value: "" }));
}

function makeLabel(typeId = "bopp_tape", saved?: SavedTemplate): LabelTemplate {
  const cid = `lbl-${++_ctr}`;
  if (saved) {
    return {
      id: cid,
      name: saved.name,
      widthMm: saved.widthMm,
      heightMm: saved.heightMm,
      topMarginMm: saved.topMarginMm,
      bottomMarginMm: saved.bottomMarginMm,
      fields: saved.fields.map((f, i) => ({ id: `f-${cid}-${i}`, heading: f.heading, value: "" })),
      barcodeFormat: saved.barcodeFormat,
      barcodeValue: "",
      barcodeAuto: true,
      copies: 1,
    };
  }
  const preset = BUILTIN_PRESETS.find(p => p.id === typeId);
  const headings = FIELD_PRESETS[typeId] || FIELD_PRESETS.custom;
  return {
    id: cid,
    name: preset?.label || "Custom",
    widthMm: preset?.widthMm ?? 100,
    heightMm: preset?.heightMm ?? 150,
    topMarginMm: DEFAULT_TOP,
    bottomMarginMm: DEFAULT_BOTTOM,
    fields: fieldsFromHeadings(headings, cid),
    barcodeFormat: "CODE128",
    barcodeValue: "",
    barcodeAuto: true,
    copies: 1,
  };
}

function getAutoBarcode(fields: LabelField[]) {
  return fields.find(f => /product\s*code|barcode|^code$/i.test(f.heading))?.value.trim() || "";
}

function getProductName(fields: LabelField[]) {
  return fields.find(f => /^name$/i.test(f.heading.trim()))?.value.trim() || "";
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ─── Barcode SVG (preview) ────────────────────────────────────────────────────
function BarcodeSVG({ value, format, height = 50 }: { value: string; format: string; height?: number }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!svgRef.current || !value.trim()) { setErr(""); return; }
    import("jsbarcode").then(({ default: JsBarcode }) => {
      try {
        JsBarcode(svgRef.current!, value, {
          format, displayValue: true,
          fontSize: 11, textMargin: 2, margin: 4,
          width: 1.6, height,
          background: "#fff", lineColor: "#000",
          valid: (ok: boolean) => setErr(ok ? "" : "Invalid value for this format"),
        });
      } catch { setErr("Invalid barcode"); }
    });
  }, [value, format, height]);

  if (!value.trim()) return (
    <div style={{ textAlign: "center", color: "#aaa", fontSize: 9, padding: "8px 0", fontStyle: "italic" }}>
      — barcode will appear here —
    </div>
  );
  if (err) return (
    <div style={{ textAlign: "center", color: "#d44", fontSize: 9, padding: "4px" }}>{err}</div>
  );
  return <svg ref={svgRef} style={{ display: "block", maxWidth: "100%" }} />;
}

// ─── Label Preview ────────────────────────────────────────────────────────────
function LabelPreview({ lbl }: { lbl: LabelTemplate }) {
  const PX_PER_MM  = 280 / Math.max(lbl.widthMm, 1);
  const totalPx    = lbl.heightMm * PX_PER_MM;
  const topPx      = lbl.topMarginMm * PX_PER_MM;
  const bottomPx   = lbl.bottomMarginMm * PX_PER_MM;
  const contentPx  = Math.max(totalPx - topPx - bottomPx, 20);

  const productName      = getProductName(lbl.fields);
  const effectiveBarcode = lbl.barcodeAuto ? getAutoBarcode(lbl.fields) : lbl.barcodeValue;
  const bodyFields       = lbl.fields.filter(f => !/^name$/i.test(f.heading.trim()));

  // Dynamic font sizes: scale with content area
  const basePx      = Math.max(Math.min(contentPx / (bodyFields.length + 3) * 0.75, 15), 9);
  const headingPx   = Math.min(basePx * 1.55, 20);
  const labelPx     = Math.min(basePx * 1.05, 13.5);
  const valuePx     = Math.min(basePx * 1.1, 14);
  const barcodeH    = Math.min(Math.max(contentPx * 0.28, 30), 60);

  return (
    <div style={{
      width: 280, height: totalPx,
      border: "2px solid #222",
      fontFamily: "Arial, sans-serif",
      display: "flex", flexDirection: "column",
      background: "#fff", overflow: "hidden", boxSizing: "border-box",
    }}>
      {/* Pre-printed top */}
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

      {/* Content area */}
      <div style={{
        height: contentPx, flexShrink: 0,
        display: "flex", flexDirection: "column",
        padding: "5px 7px 4px", boxSizing: "border-box",
      }}>
        {/* Product name heading */}
        <div style={{
          fontWeight: 900, fontSize: headingPx,
          textAlign: "center", textTransform: "uppercase",
          letterSpacing: "0.5px",
          borderBottom: "2px solid #000",
          paddingBottom: headingPx * 0.3,
          marginBottom: headingPx * 0.25,
          lineHeight: 1.15,
          color: "#000", flexShrink: 0,
        }}>
          {productName || <span style={{ color: "#ccc", fontWeight: 400, fontSize: headingPx * 0.7 }}>Product Name</span>}
        </div>

        {/* Fields — evenly spaced */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-evenly" }}>
          {bodyFields.map(field => (
            <div key={field.id} style={{
              display: "flex", alignItems: "center",
              borderBottom: "0.8px solid #e0e0e0",
              paddingBottom: 2, paddingTop: 1, gap: 6,
            }}>
              <span style={{
                fontWeight: "bold", fontSize: labelPx,
                color: "#111", minWidth: "35%", flexShrink: 0, lineHeight: 1.3,
              }}>
                {field.heading || "—"}:
              </span>
              <span style={{
                fontSize: valuePx, fontWeight: 600,
                color: "#000", flex: 1, lineHeight: 1.3,
              }}>
                {field.value || <span style={{ color: "#ccc" }}>—</span>}
              </span>
            </div>
          ))}
        </div>

        {/* Barcode */}
        <div style={{
          borderTop: "1px solid #ccc", marginTop: 4, paddingTop: 3,
          display: "flex", justifyContent: "center", flexShrink: 0,
        }}>
          <BarcodeSVG value={effectiveBarcode} format={lbl.barcodeFormat} height={barcodeH} />
        </div>
      </div>

      {/* Pre-printed bottom */}
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

// ─── Main page ────────────────────────────────────────────────────────────────
export default function BarcodePage() {
  const [labels, setLabels]     = useState<LabelTemplate[]>([makeLabel("bopp_tape")]);
  const [expanded, setExpanded] = useState<string>(labels[0].id);
  const [printing, setPrinting] = useState(false);
  const [labelPrinterMode, setLabelPrinterMode] = useState(true); // default ON for label printers

  // Saved templates (localStorage)
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [showSaved, setShowSaved]           = useState(false);
  // Save-as-template modal
  const [savingFor, setSavingFor]           = useState<string | null>(null); // label id
  const [saveName, setSaveName]             = useState("");

  // Load saved templates from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSavedTemplates(JSON.parse(raw));
    } catch {}
  }, []);

  function persistSaved(next: SavedTemplate[]) {
    setSavedTemplates(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  }

  // ── Label mutations ──────────────────────────────────────────────────────────
  const update = (id: string, patch: Partial<LabelTemplate>) =>
    setLabels(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));

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
    setLabels(prev => prev.map(l => {
      if (l.id !== lblId) return l;
      if (l.fields.length <= 1) { toast.error("Need at least 1 field"); return l; }
      return { ...l, fields: l.fields.filter(f => f.id !== fieldId) };
    }));

  const applyBuiltin = (lblId: string, typeId: string) => {
    const preset = BUILTIN_PRESETS.find(p => p.id === typeId)!;
    const fields = fieldsFromHeadings(FIELD_PRESETS[typeId], lblId + typeId);
    setLabels(prev => prev.map(l =>
      l.id !== lblId ? l : {
        ...l, name: preset.label,
        widthMm: preset.widthMm, heightMm: preset.heightMm,
        topMarginMm: DEFAULT_TOP, bottomMarginMm: DEFAULT_BOTTOM,
        fields, barcodeValue: "", barcodeAuto: true,
      }
    ));
  };

  const applySaved = (lblId: string, saved: SavedTemplate) => {
    const fields = saved.fields.map((f, i) => ({ id: `f-${lblId}-s${i}`, heading: f.heading, value: "" }));
    setLabels(prev => prev.map(l =>
      l.id !== lblId ? l : {
        ...l, name: saved.name,
        widthMm: saved.widthMm, heightMm: saved.heightMm,
        topMarginMm: saved.topMarginMm, bottomMarginMm: saved.bottomMarginMm,
        fields, barcodeFormat: saved.barcodeFormat,
        barcodeValue: "", barcodeAuto: true,
      }
    ));
  };

  // Save current label as a template
  const saveTemplate = (lbl: LabelTemplate) => {
    const name = saveName.trim();
    if (!name) { toast.error("Enter a template name"); return; }
    const tpl: SavedTemplate = {
      id: `tpl-${Date.now()}`,
      name,
      widthMm: lbl.widthMm,
      heightMm: lbl.heightMm,
      topMarginMm: lbl.topMarginMm,
      bottomMarginMm: lbl.bottomMarginMm,
      fields: lbl.fields.map(f => ({ heading: f.heading })),
      barcodeFormat: lbl.barcodeFormat,
    };
    persistSaved([...savedTemplates, tpl]);
    setSavingFor(null);
    setSaveName("");
    toast.success(`Template "${name}" saved`);
  };

  const deleteSavedTemplate = (id: string) => {
    persistSaved(savedTemplates.filter(t => t.id !== id));
    toast.success("Template deleted");
  };

  // ── Print ─────────────────────────────────────────────────────────────────────
  const handlePrint = useCallback(async () => {
    const valid = labels.filter(l => l.fields.some(f => f.value.trim()));
    if (!valid.length) { toast.error("Fill in at least one label"); return; }
    setPrinting(true);
    const { default: JsBarcode } = await import("jsbarcode");
    const items: string[] = [];

    for (const lbl of valid) {
      const bc         = lbl.barcodeAuto ? getAutoBarcode(lbl.fields) : lbl.barcodeValue;
      const name       = getProductName(lbl.fields);
      const bodyFields = lbl.fields.filter(f => !/^name$/i.test(f.heading.trim()));
      let barcodeHtml  = "";

      if (bc) {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        try {
          JsBarcode(svg, bc, {
            format: lbl.barcodeFormat, displayValue: true,
            fontSize: 9, textMargin: 1, margin: 3, width: 1.4, height: 38,
            background: "#fff", lineColor: "#000",
          });
          barcodeHtml = svg.outerHTML;
        } catch {}
      }

      const fieldsHtml = bodyFields.map(f => `
        <tr>
          <td class="fh">${esc(f.heading)}:</td>
          <td class="fv">${esc(f.value) || "&nbsp;"}</td>
        </tr>
      `).join("");

      const contentH = lbl.heightMm - lbl.topMarginMm - lbl.bottomMarginMm;

      for (let c = 0; c < lbl.copies; c++) {
        items.push(`
          <div class="label" style="width:${lbl.widthMm}mm;height:${lbl.heightMm}mm;">
            <div style="height:${lbl.topMarginMm}mm;flex-shrink:0;"></div>
            <div class="content" style="height:${contentH}mm;">
              <div class="pname">${esc(name) || "&nbsp;"}</div>
              <table class="fields"><tbody>${fieldsHtml}</tbody></table>
              ${barcodeHtml ? `<div class="bcwrap">${barcodeHtml}</div>` : ""}
            </div>
            <div style="height:${lbl.bottomMarginMm}mm;flex-shrink:0;"></div>
          </div>
        `);
      }
    }

    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { toast.error("Popup blocked — allow popups"); setPrinting(false); return; }

    // Determine page setup — label printer uses exact label size, A4 mode packs multiple labels
    // For label printer mode: each label gets its own page, @page size = label dimensions
    // We group by size so we can emit named @page rules
    const primaryLbl = valid[0];
    const pageW = primaryLbl.widthMm;
    const pageH = primaryLbl.heightMm;

    const labelPrinterCSS = labelPrinterMode
      ? `@page{size:${pageW}mm ${pageH}mm;margin:0mm;}
         body{margin:0;padding:0;}
         .page{display:block;padding:0;gap:0;}
         .label{page-break-after:always;border:none !important;}`
      : `@page{margin:4mm;size:A4;}
         .page{gap:3mm;padding:5mm;}`;

    win.document.write(`<!DOCTYPE html><html><head><title>Labels</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:Arial,sans-serif;background:#fff;}
.page{display:flex;flex-wrap:wrap;gap:4mm;padding:6mm;}
.label{display:flex;flex-direction:column;border:0.4mm solid #000;page-break-inside:avoid;overflow:hidden;background:#fff;}
.content{flex-shrink:0;display:flex;flex-direction:column;padding:2.5mm 3.5mm;border-top:0.3mm dashed #999;border-bottom:0.3mm dashed #999;}
.pname{font-size:13pt;font-weight:900;text-align:center;text-transform:uppercase;letter-spacing:0.4mm;border-bottom:0.5mm solid #000;padding-bottom:1.5mm;margin-bottom:2mm;line-height:1.2;}
.fields{width:100%;border-collapse:collapse;flex:1;}
.fields tr{border-bottom:0.25mm solid #ddd;}
.fh{font-size:9.5pt;font-weight:bold;color:#000;white-space:nowrap;padding:1mm 2mm 1mm 0;width:30mm;vertical-align:middle;}
.fv{font-size:10.5pt;font-weight:600;color:#000;padding:1mm 0;vertical-align:middle;}
.bcwrap{display:flex;justify-content:center;padding-top:1.5mm;margin-top:auto;border-top:0.2mm solid #ccc;}
.bcwrap svg{max-width:100%;display:block;}
@media print{body{margin:0;}${labelPrinterCSS}}
</style></head><body>
<div class="page">${items.join("")}</div>
<script>window.onload=function(){window.print();window.onafterprint=function(){window.close();};};</script>
</body></html>`);
    win.document.close();
    setPrinting(false);
  }, [labels, labelPrinterMode]);

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Barcode className="w-5 h-5 text-brand-500" />
            Label & Barcode Generator
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            100×150 mm labels · top 30 mm + bottom 15 mm pre-printed · content fills middle 105 mm
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Label printer mode toggle */}
          <label className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
            <input
              type="checkbox"
              checked={labelPrinterMode}
              onChange={e => setLabelPrinterMode(e.target.checked)}
              className="w-4 h-4 accent-brand-500"
            />
            <span className="text-xs font-medium text-gray-700">Label Printer</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${labelPrinterMode ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
              {labelPrinterMode ? "ON" : "OFF"}
            </span>
          </label>
          <button onClick={handlePrint} disabled={printing}
            className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50">
            <Printer className="w-4 h-4" />
            {printing ? "Preparing..." : `Print All (${labels.reduce((s, l) => s + l.copies, 0)})`}
          </button>
        </div>
      </div>

      {/* Preset buttons row */}
      <div className="space-y-2">
        {/* Built-in presets */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-gray-400 font-medium">Built-in:</span>
          {BUILTIN_PRESETS.map(pt => (
            <button key={pt.id}
              onClick={() => { const l = makeLabel(pt.id); setLabels(p => [...p, l]); setExpanded(l.id); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-lg hover:border-brand-400 hover:text-brand-600 transition-colors">
              <Plus className="w-3.5 h-3.5" />{pt.label}
            </button>
          ))}
          {/* Custom */}
          <button
            onClick={() => { const l = makeLabel("custom"); setLabels(p => [...p, l]); setExpanded(l.id); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-dashed border-gray-300 rounded-lg hover:border-brand-400 hover:text-brand-600 transition-colors">
            <Plus className="w-3.5 h-3.5" />Custom
          </button>
        </div>

        {/* Saved templates */}
        {savedTemplates.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-gray-400 font-medium">Saved:</span>
            {savedTemplates.map(tpl => (
              <div key={tpl.id} className="flex items-center gap-0 bg-purple-50 border border-purple-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => { const l = makeLabel("custom", tpl); setLabels(p => [...p, l]); setExpanded(l.id); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100 transition-colors">
                  <BookmarkCheck className="w-3.5 h-3.5" />{tpl.name}
                  <span className="text-purple-400 ml-1">{tpl.widthMm}×{tpl.heightMm}</span>
                </button>
                <button
                  onClick={() => deleteSavedTemplate(tpl.id)}
                  className="px-1.5 py-1.5 text-purple-300 hover:text-red-500 hover:bg-red-50 transition-colors border-l border-purple-200">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Labels */}
      <div className="space-y-4">
        {labels.map((lbl, idx) => {
          const isOpen           = expanded === lbl.id;
          const effectiveBarcode = lbl.barcodeAuto ? getAutoBarcode(lbl.fields) : lbl.barcodeValue;
          const productName      = getProductName(lbl.fields);

          return (
            <div key={lbl.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {/* Accordion header */}
              <div
                className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100 cursor-pointer"
                onClick={() => setExpanded(isOpen ? "" : lbl.id)}>
                <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-xs flex items-center justify-center font-bold">{idx + 1}</span>
                  {productName || lbl.name}
                  <span className="text-xs font-normal text-gray-400">
                    {lbl.widthMm}×{lbl.heightMm} mm · {lbl.copies} {lbl.copies === 1 ? "copy" : "copies"}
                    {effectiveBarcode && <> · <span className="font-mono">{effectiveBarcode}</span></>}
                  </span>
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={e => { e.stopPropagation(); if (labels.length === 1) { toast.error("Need at least one label"); return; } setLabels(p => p.filter(l => l.id !== lbl.id)); }}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>
              </div>

              {isOpen && (
                <div className="p-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* ── Left: Config ── */}
                    <div className="space-y-4">

                      {/* Size + margins */}
                      <div className="grid grid-cols-4 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1.5">Width (mm)</label>
                          <input type="number" min={0}
                            value={lbl.widthMm}
                            onChange={e => update(lbl.id, { widthMm: parseInt(e.target.value) || 0 })}
                            className="w-full px-2.5 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1.5">Height (mm)</label>
                          <input type="number" min={0}
                            value={lbl.heightMm}
                            onChange={e => update(lbl.id, { heightMm: parseInt(e.target.value) || 0 })}
                            className="w-full px-2.5 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1.5">Top (mm)</label>
                          <input type="number" min={0}
                            value={lbl.topMarginMm}
                            onChange={e => update(lbl.id, { topMarginMm: parseInt(e.target.value) || 0 })}
                            className="w-full px-2.5 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1.5">Bottom (mm)</label>
                          <input type="number" min={0}
                            value={lbl.bottomMarginMm}
                            onChange={e => update(lbl.id, { bottomMarginMm: parseInt(e.target.value) || 0 })}
                            className="w-full px-2.5 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
                        </div>
                      </div>

                      {/* Apply preset */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">Apply a preset template</label>
                        <div className="flex gap-2 flex-wrap">
                          {BUILTIN_PRESETS.map(p => (
                            <button key={p.id} onClick={() => applyBuiltin(lbl.id, p.id)}
                              className="px-2.5 py-1 text-xs border border-gray-200 rounded-lg hover:border-brand-400 hover:text-brand-600 transition-colors">
                              {p.label}
                            </button>
                          ))}
                          {savedTemplates.map(st => (
                            <button key={st.id} onClick={() => applySaved(lbl.id, st)}
                              className="px-2.5 py-1 text-xs border border-purple-200 text-purple-600 rounded-lg hover:bg-purple-50 transition-colors flex items-center gap-1">
                              <BookmarkCheck className="w-3 h-3" />{st.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Fields */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-medium text-gray-600">
                            Label Fields
                            <span className="text-gray-400 font-normal ml-1">— "Name" field = product heading</span>
                          </label>
                          <button onClick={() => addField(lbl.id)}
                            className="flex items-center gap-1 text-xs text-brand-600 font-medium hover:text-brand-700">
                            <Plus className="w-3.5 h-3.5" /> Add Field
                          </button>
                        </div>
                        <div className="space-y-1.5">
                          {lbl.fields.map((field, fi) => (
                            <div key={field.id} className="flex items-center gap-2">
                              <span className="text-xs text-gray-300 w-4 shrink-0 text-right">{fi + 1}</span>
                              <input type="text" value={field.heading}
                                onChange={e => updateField(lbl.id, field.id, { heading: e.target.value })}
                                placeholder="Heading"
                                className="w-32 px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium" />
                              <input type="text" value={field.value}
                                onChange={e => updateField(lbl.id, field.id, { value: e.target.value })}
                                placeholder="Value"
                                className="flex-1 px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
                              <button onClick={() => removeField(lbl.id, field.id)}
                                className="p-1 text-gray-300 hover:text-red-500 transition-colors shrink-0">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Barcode */}
                      <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-medium text-gray-600">Barcode</label>
                          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                            <input type="checkbox" checked={lbl.barcodeAuto}
                              onChange={e => update(lbl.id, {
                                barcodeAuto: e.target.checked,
                                barcodeValue: e.target.checked ? getAutoBarcode(lbl.fields) : lbl.barcodeValue,
                              })}
                              className="w-3.5 h-3.5 accent-brand-500" />
                            Auto from Product Code
                          </label>
                        </div>
                        <div className="flex gap-2">
                          <input type="text" value={effectiveBarcode}
                            disabled={lbl.barcodeAuto}
                            onChange={e => update(lbl.id, { barcodeValue: e.target.value })}
                            placeholder={lbl.barcodeAuto ? "Auto from Product Code field" : "Enter barcode value"}
                            className="flex-1 px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-100 disabled:text-gray-400 font-mono" />
                          <select value={lbl.barcodeFormat}
                            onChange={e => update(lbl.id, { barcodeFormat: e.target.value })}
                            className="w-36 px-2 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                            {FORMATS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                          </select>
                        </div>
                      </div>

                      {/* Copies + Save template */}
                      <div className="flex items-end gap-3">
                        <div className="w-32">
                          <label className="block text-xs font-medium text-gray-600 mb-1.5">Copies</label>
                          <input type="number" min={1} max={500} value={lbl.copies}
                            onChange={e => update(lbl.id, { copies: Math.max(1, parseInt(e.target.value) || 1) })}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
                        </div>
                        <button
                          onClick={() => { setSavingFor(lbl.id); setSaveName(productName || lbl.name); }}
                          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-purple-300 text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors">
                          <Bookmark className="w-3.5 h-3.5" />
                          Save as Template
                        </button>
                      </div>

                      {/* Save template modal (inline) */}
                      {savingFor === lbl.id && (
                        <div className="border border-purple-200 rounded-xl bg-purple-50 p-3 space-y-2">
                          <p className="text-xs font-semibold text-purple-800">Save as reusable template</p>
                          <p className="text-[10px] text-purple-600">This saves the field headings, size, and margins — not the values.</p>
                          <div className="flex gap-2">
                            <input type="text" value={saveName}
                              onChange={e => setSaveName(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter") saveTemplate(lbl); if (e.key === "Escape") setSavingFor(null); }}
                              placeholder="Template name (e.g. BOPP 48mm 72rolls)"
                              autoFocus
                              className="flex-1 px-2.5 py-1.5 text-xs border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white" />
                            <button onClick={() => saveTemplate(lbl)}
                              className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium">
                              Save
                            </button>
                            <button onClick={() => setSavingFor(null)}
                              className="px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-700">
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── Right: Preview ── */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-medium text-gray-500">Live Preview</p>
                        <p className="text-[10px] text-gray-400">
                          Content: {Math.max(lbl.heightMm - lbl.topMarginMm - lbl.bottomMarginMm, 0)} mm tall
                        </p>
                      </div>
                      <div className="flex justify-center bg-gray-50 rounded-xl p-4 border border-gray-100 overflow-auto">
                        <LabelPreview lbl={lbl} />
                      </div>
                      <p className="text-[10px] text-gray-400 text-center mt-2">
                        Hatched = pre-printed area (top {lbl.topMarginMm} mm + bottom {lbl.bottomMarginMm} mm)
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add custom */}
      <button
        onClick={() => { const l = makeLabel("custom"); setLabels(p => [...p, l]); setExpanded(l.id); }}
        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm font-medium text-gray-500 hover:border-brand-400 hover:text-brand-600 transition-colors">
        <Plus className="w-4 h-4" />Add Custom Label
      </button>
    </div>
  );
}
