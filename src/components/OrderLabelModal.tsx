"use client";

import { useEffect, useRef, useState } from "react";
import { X, Printer, Tag, AlertCircle } from "lucide-react";
import {
  LabelPreview, DEFAULT_DESIGN,
  type LabelTemplate, type LabelField,
} from "@/components/LabelPreviewRenderer";

/* ── Barcode template from localStorage (ambiance_label_tpl_v5) ── */
const STORAGE_KEY = "ambiance_label_tpl_v5";

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
  logoPosition: string;
  logoHeightMm: number;
  fontScale: number;
  showBorder: boolean;
  rotated: boolean;
  logoDataUrl?: string;
  design?: Record<string, any>;
}

/* ── Auto-generate product code from BOPP tape details ──
   Format: {CoreCode}-{TypeCode}-{SizeMm}{Micron}{Length}
   e.g. PKZ-TP-4840100 = PAKZY3S core, transparent, 48mm, 40mic, 100m ── */
const CORE_CODES: [string, string][] = [
  ["wonder moti", "WONM"],
  ["wonder", "WON"],
  ["pakzy", "PKZ"],
  ["pakzy3s", "PKZ"],
];
const TYPE_CODES: [string, string][] = [
  ["transparent", "TP"],
  ["brown", "BR"],
  ["black", "BLK"],
  ["blue", "BL"],
  ["green", "GR"],
  ["yellow", "YL"],
  ["red", "RD"],
  ["milky", "ML"],
  ["printed", "PRE"],
];

function generateProductCode(d: Record<string, string>): string {
  const coreLower = (d.core || "").toLowerCase().trim();
  const typeLower = (d.type || "").toLowerCase().trim();

  let coreCode = "";
  for (const [key, code] of CORE_CODES) {
    if (coreLower.includes(key)) { coreCode = code; break; }
  }

  let typeCode = "";
  for (const [key, code] of TYPE_CODES) {
    if (typeLower.includes(key)) { typeCode = code; break; }
  }

  const sizePart = d.sizeMm || "";
  const micronPart = d.micron || "";
  const lengthPart = d.length || "";
  const numericPart = `${sizePart}${micronPart}${lengthPart}`;

  const parts = [coreCode, typeCode, numericPart].filter(Boolean);
  return parts.length ? parts.join("-") : `BOPP-${numericPart}`;
}

/* ── Auto-fill order data into template fields by heading keyword ── */
function mapOrderToFields(
  templateFields: { heading: string }[],
  orderDetails: Record<string, string>,
): Record<string, string> {
  const d = orderDetails;
  const productCode = d.productCode || generateProductCode(d);
  const result: Record<string, string> = {};

  for (const { heading } of templateFields) {
    const h = heading.toLowerCase().replace(/[^a-z0-9]/g, "");
    let value = "";

    if (h === "name" || h === "productname") {
      value = "BOPP TAPE";
    } else if (h === "type") {
      value = d.type || "";
    } else if (h === "specification" || h === "spec") {
      const sizeMm = d.sizeMm ? `${d.sizeMm}mm` : "";
      const micron = d.micron ? `${d.micron} Micron` : "";
      value = [sizeMm, micron].filter(Boolean).join(" x ");
    } else if (h === "length") {
      value = d.length ? `${d.length}m` : "";
    } else if (h === "rollsbox" || h === "rollsperbox" || h === "rolls") {
      value = d.rollsPerBox || d.rolls || "";
    } else if (h === "productcode" || h === "code" || h === "barcode") {
      value = productCode;
    } else if (h === "batchnumber" || h === "batch") {
      value = d.batchNumber || "";
    } else if (h === "sizeinches" || h === "sizein") {
      value = d.sizeInches ? `${d.sizeInches}"` : "";
    } else if (h === "sizemm" || h === "size" || h === "width") {
      value = d.sizeMm ? `${d.sizeMm}mm` : "";
    } else if (h === "micron" || h === "thickness") {
      value = d.micron ? `${d.micron} Micron` : "";
    } else if (h === "core") {
      value = d.core || "";
    } else if (h === "boxes" || h === "quantity" || h === "qty") {
      value = d.boxes || d.quantity || "";
    }

    result[heading] = value;
  }

  return result;
}

/* ── Get all BOPP_TAPE items from order ── */
function getBoppItems(order: any): { index: number; label: string; details: Record<string, string> }[] {
  const items: { index: number; label: string; details: Record<string, string> }[] = [];
  const orderItems = order?.items || [];
  orderItems.forEach((item: any, idx: number) => {
    if (item.productCategory === "BOPP_TAPE") {
      let d: Record<string, string> = {};
      try { d = typeof item.productDetails === "string" ? JSON.parse(item.productDetails) : item.productDetails || {}; } catch {}
      const parts: string[] = [];
      if (d.sizeMm) parts.push(`${d.sizeMm}mm`);
      if (d.micron) parts.push(`${d.micron}mic`);
      if (d.length) parts.push(`${d.length}m`);
      items.push({ index: idx, label: parts.length ? parts.join(" · ") : `Item ${idx + 1}`, details: d });
    }
  });
  return items;
}

/* ── Convert SavedTemplate + filled fields into a LabelTemplate for preview ── */
function buildLabelTemplate(tpl: SavedTemplate, filledFields: { heading: string; value: string }[]): LabelTemplate {
  return {
    id: "modal-preview",
    name: tpl.name,
    widthMm: tpl.widthMm,
    heightMm: tpl.heightMm,
    topMarginMm: tpl.topMarginMm,
    bottomMarginMm: tpl.bottomMarginMm,
    leftMarginMm: tpl.leftMarginMm ?? 0,
    rightMarginMm: tpl.rightMarginMm ?? 0,
    fields: filledFields.map((f, i): LabelField => ({ id: `f-${i}`, heading: f.heading, value: f.value })),
    barcodeFormat: tpl.barcodeFormat || "CODE128",
    barcodeValue: "",
    barcodeAuto: true,
    showBarcode: tpl.showBarcode ?? true,
    copies: 1,
    logoDataUrl: tpl.logoDataUrl || "",
    logoPosition: (tpl.logoPosition as "top" | "bottom" | "none") || "none",
    logoHeightMm: tpl.logoHeightMm ?? 10,
    fontScale: tpl.fontScale ?? 1,
    showBorder: tpl.showBorder !== false,
    rotated: tpl.rotated ?? false,
    design: { ...DEFAULT_DESIGN, ...(tpl.design || {}) },
  };
}

interface Props {
  order: any;
  onClose: () => void;
}

export default function OrderLabelModal({ order, onClose }: Props) {
  const boppItems = getBoppItems(order);
  const [selectedItemIdx, setSelectedItemIdx] = useState(boppItems[0]?.index ?? 0);

  const details = (() => {
    if (boppItems.length === 0) return {};
    const chosen = boppItems.find((b) => b.index === selectedItemIdx);
    return chosen ? chosen.details : boppItems[0].details;
  })();

  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [selectedTplId, setSelectedTplId] = useState<string>("");
  const [fields, setFields] = useState<{ heading: string; value: string }[]>([]);
  const [labelCount, setLabelCount] = useState(1);
  const [printing, setPrinting] = useState(false);

  const previewRef = useRef<HTMLDivElement>(null);

  /* Load templates from localStorage */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const tpls: SavedTemplate[] = JSON.parse(raw);
        setTemplates(tpls);
        if (tpls.length > 0) setSelectedTplId(tpls[0].id);
      }
    } catch {}
  }, []);

  /* Set default label count to number of boxes */
  useEffect(() => {
    const boxes = parseInt(details.boxes || "") || 1;
    setLabelCount(Math.max(1, boxes));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItemIdx]);

  /* When template or selected item changes, re-map order data to fields */
  useEffect(() => {
    const tpl = templates.find((t) => t.id === selectedTplId);
    if (!tpl) { setFields([]); return; }
    const mapped = mapOrderToFields(tpl.fields, details);
    setFields(tpl.fields.map((f) => ({ heading: f.heading, value: mapped[f.heading] ?? "" })));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTplId, templates, selectedItemIdx]);

  const updateField = (heading: string, value: string) =>
    setFields((prev) => prev.map((f) => f.heading === heading ? { ...f, value } : f));

  const selectedTpl = templates.find((t) => t.id === selectedTplId);
  const previewLbl = selectedTpl ? buildLabelTemplate(selectedTpl, fields) : null;

  /* ── Print using html2canvas (WYSIWYG — same as Barcode Generator) ── */
  const handlePrint = async () => {
    if (!selectedTpl || !previewRef.current || labelCount <= 0) return;
    setPrinting(true);
    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const canvas = await html2canvas(previewRef.current, {
        scale: 3,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
      });
      const dataUrl = canvas.toDataURL("image/png");
      const { widthMm, heightMm } = selectedTpl;

      const win = window.open("", "_blank", "width=820,height=600");
      if (!win) { alert("Please allow popups to print labels."); return; }

      const labelHtml = Array(labelCount).fill(
        `<div class="lbl"><img src="${dataUrl}" /></div>`
      ).join("\n");

      win.document.write(`<!DOCTYPE html><html><head><title>Labels</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  @page{size:${widthMm}mm ${heightMm}mm;margin:0;}
  html,body{background:#fff;margin:0;padding:0;}
  .lbl{width:${widthMm}mm;height:${heightMm}mm;page-break-after:always;page-break-inside:avoid;overflow:hidden;}
  .lbl img{width:100%;height:100%;object-fit:fill;display:block;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
</style></head><body>
${labelHtml}
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
<\/script>
</body></html>`);
      win.document.close();
    } catch (err) {
      console.error("Print error:", err);
      alert("Print failed: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setPrinting(false);
    }
  };

  /* ── Render ── */
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Tag className="w-4 h-4 text-brand-500" /> Print Product Label
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-5">

          {templates.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <AlertCircle className="w-10 h-10 text-gray-300" />
              <p className="text-sm font-medium text-gray-700">No label templates saved yet</p>
              <p className="text-xs text-gray-400">
                Go to <strong>Barcode Generator</strong>, design a label, and save it as a template. Then come back here to print.
              </p>
              <button onClick={onClose}
                className="mt-2 px-4 py-2 text-sm text-brand-600 border border-brand-200 rounded-lg hover:bg-brand-50">
                Close
              </button>
            </div>
          ) : (
            <>
              {/* BOPP item selector — only when multiple BOPP_TAPE items */}
              {boppItems.length > 1 && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Select Tape Item</label>
                  <div className="flex flex-wrap gap-2">
                    {boppItems.map((b) => (
                      <button
                        key={b.index}
                        type="button"
                        onClick={() => setSelectedItemIdx(b.index)}
                        className={`px-3 py-1.5 text-sm rounded-lg border-2 font-medium transition-all ${
                          selectedItemIdx === b.index
                            ? "border-brand-500 bg-brand-50 text-brand-700"
                            : "border-gray-200 text-gray-600 hover:border-gray-300"
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Template picker */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Choose Template</label>
                <div className="flex flex-wrap gap-2">
                  {templates.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => setSelectedTplId(tpl.id)}
                      className={`px-3 py-1.5 text-sm rounded-lg border-2 font-medium transition-all ${
                        selectedTplId === tpl.id
                          ? "border-brand-500 bg-brand-50 text-brand-700"
                          : "border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      {tpl.name}
                    </button>
                  ))}
                </div>
                {selectedTpl && (
                  <p className="text-[11px] text-gray-400 mt-1.5">
                    {selectedTpl.widthMm}×{selectedTpl.heightMm}mm · {selectedTpl.fields.length} fields · {selectedTpl.barcodeFormat}
                  </p>
                )}
              </div>

              {/* Editable fields */}
              {fields.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Label Fields</label>
                  <div className="space-y-2">
                    {fields.map(({ heading, value }) => (
                      <div key={heading} className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 w-28 shrink-0">{heading}</span>
                        <input
                          type="text"
                          value={value}
                          onChange={(e) => updateField(heading, e.target.value)}
                          className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Label preview — rendered via LabelPreview (exact WYSIWYG) */}
              {previewLbl && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Label Preview</label>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex justify-center overflow-x-auto">
                    <div ref={previewRef}>
                      <LabelPreview lbl={previewLbl} />
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400 text-center mt-1.5">Print output will match this preview exactly</p>
                </div>
              )}

              {/* Label count */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Number of Labels
                </label>
                <input type="number" min={1} value={labelCount}
                  onChange={(e) => setLabelCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
                <p className="text-[11px] text-gray-400 mt-1">Default = boxes ordered</p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {templates.length > 0 && (
          <div className="px-5 pb-5 flex gap-3">
            <button onClick={handlePrint} disabled={printing || labelCount <= 0 || !selectedTpl}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50">
              {printing
                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Printer className="w-4 h-4" />}
              {printing ? "Preparing…" : `Print ${labelCount} Label${labelCount !== 1 ? "s" : ""}`}
            </button>
            <button onClick={onClose}
              className="px-5 py-2.5 border border-gray-300 text-gray-700 text-sm rounded-xl hover:bg-gray-50 transition-colors">
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
