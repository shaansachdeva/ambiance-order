"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Barcode, Plus, Trash2, Printer, ChevronDown, ChevronUp,
  X, Bookmark, BookmarkCheck, Image as ImageIcon, RotateCcw,
  Palette, Type, Minus, Square, RotateCw, Move, AlignLeft, AlignCenter, AlignRight,
  Bold, Italic, Underline, SeparatorHorizontal, Pencil, Copy,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import { FreeformLabelEditor } from "@/components/FreeformLabelEditor";
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
}

const STORAGE_KEY = "ambiance_label_tpl_v5";

// ─── Presets ──────────────────────────────────────────────────────────────────
const FIELD_PRESETS: Record<string, { heading: string }[]> = {
  bopp_tape: [
    { heading: "Name" }, { heading: "Type" }, { heading: "Specification" },
    { heading: "Rolls / Box" }, { heading: "Product Code" }, { heading: "Batch Number" },
  ],
  bopp_jumbo: [
    { heading: "Name" }, { heading: "Type" }, { heading: "Core Size" },
    { heading: "Width" }, { heading: "Product Code" }, { heading: "Batch Number" },
  ],
  thermal_roll: [
    { heading: "Name" }, { heading: "Size" }, { heading: "GSM" },
    { heading: "Rolls / Box" }, { heading: "Product Code" }, { heading: "Batch Number" },
  ],
  barcode_label: [
    { heading: "Name" }, { heading: "Size" }, { heading: "Labels / Roll" },
    { heading: "Rolls / Box" }, { heading: "Product Code" }, { heading: "Batch Number" },
  ],
  custom: [{ heading: "Field 1" }, { heading: "Field 2" }, { heading: "Field 3" }],
};

const BUILTIN_PRESETS = [
  { id: "bopp_tape",     label: "BOPP Tape Box",    widthMm: 100, heightMm: 150 },
  { id: "bopp_jumbo",    label: "BOPP Jumbo Roll",   widthMm: 100, heightMm: 150 },
  { id: "thermal_roll",  label: "Thermal Roll Box",  widthMm: 100, heightMm: 150 },
  { id: "barcode_label", label: "Barcode Label Box", widthMm: 100, heightMm: 150 },
];

let _ctr = 0;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fieldsFromHeadings(hs: { heading: string }[], seed: string): LabelField[] {
  return hs.map((h, i) => ({ id: `f-${seed}-${i}`, heading: h.heading, value: "" }));
}

function makeLabel(typeId = "bopp_tape", saved?: SavedTemplate): LabelTemplate {
  const cid = `lbl-${++_ctr}`;
  if (saved) {
    return {
      id: cid, name: saved.name,
      widthMm: saved.widthMm, heightMm: saved.heightMm,
      topMarginMm: saved.topMarginMm, bottomMarginMm: saved.bottomMarginMm,
      leftMarginMm: saved.leftMarginMm ?? 0, rightMarginMm: saved.rightMarginMm ?? 0,
      fields: saved.fields.map((f, i) => ({ id: `f-${cid}-${i}`, heading: f.heading, value: "" })),
      barcodeFormat: saved.barcodeFormat, barcodeValue: "", barcodeAuto: true,
      showBarcode: saved.showBarcode ?? true, copies: 1,
      logoDataUrl: saved.logoDataUrl ?? "", logoPosition: saved.logoPosition ?? "none",
      logoHeightMm: saved.logoHeightMm ?? 10, fontScale: saved.fontScale ?? 1,
      showBorder: saved.showBorder ?? true, rotated: saved.rotated ?? false,
      design: saved.design ? { ...DEFAULT_DESIGN, ...saved.design } : { ...DEFAULT_DESIGN },
    };
  }
  const preset = BUILTIN_PRESETS.find(p => p.id === typeId);
  return {
    id: cid, name: preset?.label || "Custom",
    widthMm: preset?.widthMm ?? 100, heightMm: preset?.heightMm ?? 150,
    topMarginMm: 30, bottomMarginMm: 15, leftMarginMm: 0, rightMarginMm: 0,
    fields: fieldsFromHeadings(FIELD_PRESETS[typeId] ?? FIELD_PRESETS.custom, cid),
    barcodeFormat: "CODE128", barcodeValue: "", barcodeAuto: true,
    showBarcode: true, copies: 1, logoDataUrl: "", logoPosition: "none",
    logoHeightMm: 10, fontScale: 1, showBorder: true, rotated: false,
    design: { ...DEFAULT_DESIGN },
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

  const sectionCls = "bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-3";
  const labelCls   = "text-xs font-semibold text-gray-700 flex items-center gap-1.5";
  const btnCls     = (active: boolean) =>
    `p-1.5 rounded-lg border transition-colors ${active ? "bg-brand-500 border-brand-500 text-white" : "bg-white border-gray-300 text-gray-500 hover:border-brand-400"}`;

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
  const [labels, setLabels]     = useState<LabelTemplate[]>([makeLabel("bopp_tape")]);
  const [expanded, setExpanded] = useState<string>(labels[0].id);
  const [printing, setPrinting] = useState(false);
  const [labelPrinterMode, setLabelPrinterMode] = useState(true);
  const [savedTemplates, setSavedTemplates]     = useState<SavedTemplate[]>([]);
  const [savingFor, setSavingFor]               = useState<string | null>(null);
  const [saveName, setSaveName]                 = useState("");
  const [activeTabs, setActiveTabs]             = useState<Record<string,"data"|"design">>({});
  const getTab = (id: string) => activeTabs[id] ?? "data";
  const setTab = (id: string, tab: "data"|"design") => setActiveTabs(p => ({ ...p, [id]: tab }));
  const previewRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    try { const r = localStorage.getItem(STORAGE_KEY); if (r) setSavedTemplates(JSON.parse(r)); } catch {}
  }, []);

  function persistSaved(next: SavedTemplate[]) {
    setSavedTemplates(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  }

  // ── Mutations ────────────────────────────────────────────────────────────────
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
    setLabels(prev => prev.map(l =>
      l.id !== lblId ? l : {
        ...l, name: preset.label, widthMm: preset.widthMm, heightMm: preset.heightMm,
        topMarginMm: 30, bottomMarginMm: 15, leftMarginMm: 0, rightMarginMm: 0,
        fields: fieldsFromHeadings(FIELD_PRESETS[typeId], lblId + typeId),
        barcodeValue: "", barcodeAuto: true,
      }
    ));
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
      }
    ));
  };

  const saveTemplate = (lbl: LabelTemplate) => {
    const name = saveName.trim();
    if (!name) { toast.error("Enter a template name"); return; }
    persistSaved([...savedTemplates, {
      id: `tpl-${Date.now()}`, name,
      widthMm: lbl.widthMm, heightMm: lbl.heightMm,
      topMarginMm: lbl.topMarginMm, bottomMarginMm: lbl.bottomMarginMm,
      leftMarginMm: lbl.leftMarginMm, rightMarginMm: lbl.rightMarginMm,
      fields: lbl.fields.map(f => ({ heading: f.heading })),
      barcodeFormat: lbl.barcodeFormat, showBarcode: lbl.showBarcode,
      logoPosition: lbl.logoPosition, logoHeightMm: lbl.logoHeightMm,
      fontScale: lbl.fontScale, showBorder: lbl.showBorder, rotated: lbl.rotated,
      design: { ...lbl.design },
      logoDataUrl: lbl.logoDataUrl || undefined, // save logo if present
    }]);
    setSavingFor(null); setSaveName("");
    toast.success(`Template "${name}" saved`);
  };

  const handleLogoUpload = (lblId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      update(lblId, { logoDataUrl: e.target?.result as string });
      toast.success("Logo uploaded");
    };
    reader.readAsDataURL(file);
  };

  // ── Print (html2canvas WYSIWYG) ──────────────────────────────────────────────
  // Captures the preview div as a high-res image so print = preview exactly.
  // All design customizations (fonts, rotation, lines, boxes) are preserved.
  const handlePrint = useCallback(async () => {
    const valid = labels.filter(l => l.fields.some(f => f.value.trim()) && l.copies > 0);
    if (!valid.length) { toast.error("Fill in at least one label with copies > 0"); return; }
    setPrinting(true);

    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const images: { dataUrl: string; widthMm: number; heightMm: number; copies: number }[] = [];

      for (const lbl of valid) {
        const el = previewRefs.current[lbl.id];
        if (!el) continue;

        const canvas = await html2canvas(el, {
          scale: 3,
          backgroundColor: "#ffffff",
          useCORS: true,
          logging: false,
        });

        images.push({
          dataUrl: canvas.toDataURL("image/png"),
          widthMm: lbl.widthMm,
          heightMm: lbl.heightMm,
          copies: lbl.copies,
        });
      }

      if (!images.length) { toast.error("Could not capture any labels"); setPrinting(false); return; }

      const win = window.open("", "_blank", "width=900,height=700");
      if (!win) { toast.error("Popup blocked — allow popups"); setPrinting(false); return; }

      const p = images[0];
      const pageCss = labelPrinterMode
        ? `@page{size:${p.widthMm}mm ${p.heightMm}mm;margin:0;}
           body{margin:0;padding:0;}`
        : `@page{margin:5mm;size:A4;}
           body{margin:0;padding:5mm;display:flex;flex-wrap:wrap;gap:3mm;align-content:flex-start;}`;

      const itemsHtml = images.flatMap(img =>
        Array.from({ length: img.copies }, () =>
          `<div class="lbl" style="width:${img.widthMm}mm;height:${img.heightMm}mm;">
            <img src="${img.dataUrl}" />
          </div>`
        )
      ).join("\n");

      win.document.write(`<!DOCTYPE html><html><head><title>Labels</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
html,body{background:#fff;margin:0;padding:0;}
.lbl{page-break-after:always;page-break-inside:avoid;overflow:hidden;}
.lbl img{width:100%;height:100%;object-fit:fill;display:block;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
@media print{${pageCss}}
</style></head><body>
${itemsHtml}
<script>
(function(){
  var imgs = Array.prototype.slice.call(document.images);
  Promise.all(imgs.map(function(i){
    if (i.complete && i.naturalWidth > 0) return Promise.resolve();
    return new Promise(function(res){ i.onload = res; i.onerror = res; });
  })).then(function(){
    window.focus();
    try { window.print(); } catch(e){ document.title = 'Print error: ' + e.message; }
    window.onafterprint = function(){ window.close(); };
  });
})();
${"<"}/script>
</body></html>`);
      win.document.close();
    } catch (err) {
      console.error("Print error:", err);
      toast.error("Print failed: " + (err instanceof Error ? err.message : String(err)));
    }
    setPrinting(false);
  }, [labels, labelPrinterMode]);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Barcode className="w-5 h-5 text-brand-500" />
            Label & Barcode Generator
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Preview matches Zebra print exactly · set browser scale to 100% when printing
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
            <input type="checkbox" checked={labelPrinterMode}
              onChange={e => setLabelPrinterMode(e.target.checked)}
              className="w-4 h-4 accent-brand-500" />
            <span className="text-xs font-medium text-gray-700">Zebra / Label Printer</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${labelPrinterMode ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
              {labelPrinterMode ? "ON" : "A4"}
            </span>
          </label>
          <button onClick={handlePrint} disabled={printing}
            className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50">
            <Printer className="w-4 h-4" />
            {printing ? "Preparing…" : `Print All (${labels.reduce((s, l) => s + l.copies, 0)})`}
          </button>
        </div>
      </div>

      {/* Template row */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-gray-400 font-medium">New label:</span>
          <button
            onClick={() => { const l = makeLabel("custom"); setLabels(p => [...p, l]); setExpanded(l.id); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-dashed border-gray-300 rounded-lg hover:border-brand-400 hover:text-brand-600 transition-colors">
            <Plus className="w-3.5 h-3.5" />Blank Label
          </button>
        </div>
        {savedTemplates.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-gray-400 font-medium">Templates:</span>
            {savedTemplates.map(tpl => (
              <div key={tpl.id} className="flex items-center bg-purple-50 border border-purple-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => { const l = makeLabel("custom", tpl); setLabels(p => [...p, l]); setExpanded(l.id); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100 transition-colors">
                  <BookmarkCheck className="w-3.5 h-3.5" />{tpl.name}
                  <span className="text-purple-400 ml-1">{tpl.widthMm}×{tpl.heightMm}</span>
                </button>
                {/* Edit template */}
                <button
                  onClick={() => {
                    const l = makeLabel("custom", tpl);
                    setLabels(p => [...p, { ...l, name: tpl.name + " (edit)" }]);
                    setExpanded(l.id);
                    // Remove old template so user saves a fresh version
                    persistSaved(savedTemplates.filter(t => t.id !== tpl.id));
                    toast("Template loaded for editing — save it when done.", { icon: "✏️" });
                  }}
                  title="Edit template"
                  className="px-1.5 py-1.5 text-purple-300 hover:text-brand-500 hover:bg-brand-50 transition-colors border-l border-purple-200">
                  <Pencil className="w-3 h-3" />
                </button>
                {/* Duplicate template */}
                <button
                  onClick={() => {
                    const dup: SavedTemplate = { ...tpl, id: `tpl-${Date.now()}`, name: tpl.name + " (copy)" };
                    persistSaved([...savedTemplates, dup]);
                    toast.success(`"${dup.name}" created`);
                  }}
                  title="Duplicate template"
                  className="px-1.5 py-1.5 text-purple-300 hover:text-green-600 hover:bg-green-50 transition-colors border-l border-purple-200">
                  <Copy className="w-3 h-3" />
                </button>
                {/* Delete template */}
                <button onClick={() => { persistSaved(savedTemplates.filter(t => t.id !== tpl.id)); toast.success("Deleted"); }}
                  title="Delete template"
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
          const isOpen         = expanded === lbl.id;
          const barcodeValue   = lbl.barcodeAuto ? getAutoBarcode(lbl.fields) : lbl.barcodeValue;
          const productName    = getProductName(lbl.fields);

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
                    {barcodeValue && <> · <span className="font-mono">{barcodeValue}</span></>}
                  </span>
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={e => {
                    e.stopPropagation();
                    if (labels.length === 1) { toast.error("Need at least one label"); return; }
                    setLabels(p => p.filter(l => l.id !== lbl.id));
                  }} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>
              </div>

              {isOpen && (
                <div className="p-4">
                  {/* Tab switcher */}
                  <div className="flex border-b border-gray-200 mb-4">
                    {(["data","design"] as const).map(tab => (
                      <button key={tab} onClick={() => setTab(lbl.id, tab)}
                        className={`px-4 py-2 text-xs font-semibold transition-colors border-b-2 -mb-px capitalize flex items-center gap-1.5 ${
                          getTab(lbl.id) === tab
                            ? "border-brand-500 text-brand-600"
                            : "border-transparent text-gray-400 hover:text-gray-600"
                        }`}>
                        {tab === "data" ? <Barcode className="w-3.5 h-3.5" /> : <Palette className="w-3.5 h-3.5" />}
                        {tab === "data" ? "Data" : "Design"}
                      </button>
                    ))}
                  </div>

                  {getTab(lbl.id) === "data" && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* ── Left: Config ── */}
                    <div className="space-y-4">

                      {/* Label size */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-2">Label Size</label>
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
                        <input type="range" min={60} max={150} step={5} value={Math.round(lbl.fontScale * 100)}
                          onChange={e => update(lbl.id, { fontScale: parseInt(e.target.value) / 100 })}
                          className="w-full accent-brand-500" />
                        <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                          <span>60%</span><span>100% (auto)</span><span>150%</span>
                        </div>
                      </div>

                      {/* Apply preset */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Apply Preset</label>
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
                          <label className="text-xs font-semibold text-gray-600">
                            Label Fields
                            <span className="text-gray-400 font-normal ml-1">— "Name" = product heading</span>
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
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <label className="text-xs font-semibold text-gray-600">Barcode</label>
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                              <input type="checkbox" checked={lbl.showBarcode}
                                onChange={e => update(lbl.id, { showBarcode: e.target.checked })}
                                className="w-3.5 h-3.5 accent-brand-500" />
                              Show
                            </label>
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
                        </div>
                        {lbl.showBarcode && (
                          <div className="flex gap-2">
                            <input type="text" value={barcodeValue}
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
                        )}
                      </div>

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

                      {/* Appearance + Copies */}
                      <div className="flex items-center gap-4 flex-wrap">
                        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                          <input type="checkbox" checked={lbl.showBorder}
                            onChange={e => update(lbl.id, { showBorder: e.target.checked })}
                            className="w-3.5 h-3.5 accent-brand-500" />
                          Show border
                        </label>
                        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                          <input type="checkbox" checked={lbl.rotated}
                            onChange={e => update(lbl.id, { rotated: e.target.checked })}
                            className="w-3.5 h-3.5 accent-brand-500" />
                          Rotate 180°
                          <span className="text-gray-400 font-normal">(if printing upside down)</span>
                        </label>
                      </div>

                      <div className="flex items-end gap-3">
                        <div className="w-32">
                          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Copies</label>
                          <input type="number" min={0} max={500} value={lbl.copies}
                            onChange={e => update(lbl.id, { copies: Math.max(0, parseInt(e.target.value) || 0) })}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
                        </div>
                        <button
                          onClick={() => { setSavingFor(lbl.id); setSaveName(productName || lbl.name); }}
                          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-purple-300 text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors">
                          <Bookmark className="w-3.5 h-3.5" />
                          Save as Template
                        </button>
                      </div>

                      {savingFor === lbl.id && (
                        <div className="border border-purple-200 rounded-xl bg-purple-50 p-3 space-y-2">
                          <p className="text-xs font-semibold text-purple-800">Save as reusable template</p>
                          <p className="text-[10px] text-purple-600">Saves field headings, size, margins, and settings — not values or logo image.</p>
                          <div className="flex gap-2">
                            <input type="text" value={saveName}
                              onChange={e => setSaveName(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter") saveTemplate(lbl); if (e.key === "Escape") setSavingFor(null); }}
                              placeholder="Template name"
                              autoFocus
                              className="flex-1 px-2.5 py-1.5 text-xs border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white" />
                            <button onClick={() => saveTemplate(lbl)}
                              className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium">
                              Save
                            </button>
                            <button onClick={() => setSavingFor(null)}
                              className="px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── Right: Preview ── */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold text-gray-500">Live Preview</p>
                        <p className="text-[10px] text-gray-400">
                          Content: {Math.max(lbl.heightMm - lbl.topMarginMm - lbl.bottomMarginMm, 0)} mm
                          {(lbl.leftMarginMm > 0 || lbl.rightMarginMm > 0) && ` · L${lbl.leftMarginMm}/R${lbl.rightMarginMm} mm padding`}
                          {lbl.fontScale !== 1 && ` · ${Math.round(lbl.fontScale * 100)}% font`}
                        </p>
                      </div>
                      <div className="flex justify-center bg-gray-50 rounded-xl p-4 border border-gray-100">
                        <div ref={el => { previewRefs.current[lbl.id] = el; }}>
                          <LabelPreview lbl={lbl} />
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-400 text-center mt-2">
                        Hatched = pre-printed area &nbsp;·&nbsp; Print output matches this preview exactly
                      </p>
                    </div>

                  </div>
                  )}

                  {getTab(lbl.id) === "design" && (
                    <div className="space-y-4">
                      {/* Mode Toggle */}
                      <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <div>
                          <p className="text-sm font-semibold text-gray-800">Design Mode</p>
                          <p className="text-[10px] text-gray-500">Auto Layout automatically aligns fields. Freeform allows moving elements individually.</p>
                        </div>
                        <div className="flex bg-gray-200 p-1 rounded-lg">
                          <button onClick={() => update(lbl.id, { design: { ...lbl.design, mode: "auto" } })} className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${lbl.design.mode !== "freeform" ? "bg-white shadow-sm text-gray-800" : "text-gray-500 hover:text-gray-700"}`}>Auto Layout</button>
                          <button onClick={() => update(lbl.id, { design: { ...lbl.design, mode: "freeform" } })} className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${lbl.design.mode === "freeform" ? "bg-white shadow-sm text-brand-600" : "text-gray-500 hover:text-gray-700"}`}>Freeform Canvas</button>
                        </div>
                      </div>

                      {lbl.design.mode === "freeform" ? (
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 relative">
                          <div ref={el => { if (!previewRefs.current[lbl.id]) previewRefs.current[lbl.id] = el; }} className="absolute opacity-0 pointer-events-none -z-50" style={{ top: -9999, left: -9999 }}>
                            <LabelPreview lbl={lbl} />
                          </div>
                          <FreeformLabelEditor lbl={lbl} update={update} />
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <DesignTab lbl={lbl} onUpdate={(patch) => update(lbl.id, patch)} />
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-xs font-semibold text-gray-500">Live Preview</p>
                              <p className="text-[10px] text-gray-400">Changes apply instantly</p>
                            </div>
                            <div className="flex justify-center bg-gray-50 rounded-xl p-4 border border-gray-100">
                              <div ref={el => { if (!previewRefs.current[lbl.id]) previewRefs.current[lbl.id] = el; }}>
                                <LabelPreview lbl={lbl} />
                              </div>
                            </div>
                            <p className="text-[10px] text-gray-400 text-center mt-2">
                              Rotation, fonts, lines &amp; boxes shown in preview
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

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
