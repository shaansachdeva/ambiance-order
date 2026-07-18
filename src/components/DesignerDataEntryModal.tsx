"use client";

import { useMemo, useRef, useState } from "react";
import { X, Printer, Plus, Trash2 } from "lucide-react";
import {
  DesignerLabelPreview, collectFieldNames, toMM,
  type LabelDoc,
} from "./DesignerLabelPreview";

/* Modal that lets users fill in a saved designer template's placeholders
   ({{name}} variables and dynamic fields) and print the rendered label.

   Multi-row mode: each row in `rows` produces one printed label so users can
   batch-print a sheet of differently-filled labels from the same template. */

export function DesignerDataEntryModal({
  templateName,
  doc,
  onClose,
}: {
  templateName: string;
  doc: LabelDoc;
  onClose: () => void;
}) {
  const fields = useMemo(() => collectFieldNames(doc), [doc]);
  const [rows, setRows] = useState<Record<string, string>[]>([{}]);
  const [activeRow, setActiveRow] = useState(0);
  const previewWrapRef = useRef<HTMLDivElement | null>(null);

  const widthMM  = toMM(doc.width,  doc.units);
  const heightMM = toMM(doc.height, doc.units);
  // Scale preview so it comfortably fits the right column even for small labels.
  const previewPx = Math.min(360 / Math.max(widthMM, 1), 240 / Math.max(heightMM, 1), 14);
  const PX_PER_MM = Math.max(previewPx, 2);

  const setCell = (rowIdx: number, key: string, value: string) => {
    setRows((prev) => prev.map((r, i) => i === rowIdx ? { ...r, [key]: value } : r));
  };
  const addRow = () => { setRows((p) => [...p, {}]); setActiveRow(rows.length); };
  const delRow = (i: number) => {
    if (rows.length === 1) { setRows([{}]); return; }
    setRows((p) => p.filter((_, idx) => idx !== i));
    setActiveRow(Math.min(activeRow, rows.length - 2));
  };

  const handlePrint = () => {
    // Build a print-only iframe so the rest of the dashboard stays untouched.
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);
    const win = iframe.contentWindow!;
    const docHtml = win.document;

    // Render each row as its own page via @page CSS.
    const PX = 3.78; // print resolution-independent: mm → CSS px
    const rowHtml = rows.map((row, idx) => {
      const elements = doc.elements.filter((e) => e.visible);
      const w = widthMM * PX, h = heightMM * PX;
      const pieces = elements.map((el) => {
        const left = el.x * PX, top = el.y * PX;
        const elW = Math.max(2, el.w) * PX, elH = Math.max(0.5, el.h) * PX;
        const rot = el.rotation ? `transform: rotate(${el.rotation}deg);` : "";
        const op = el.opacity !== 1 ? `opacity: ${el.opacity};` : "";
        const wrap = (inner: string) =>
          `<div style="position:absolute;left:${left}px;top:${top}px;width:${elW}px;height:${elH}px;${rot}${op}box-sizing:border-box">${inner}</div>`;
        const substitute = (s: string) => s.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => row[k] ?? `{{${k}}}`);
        switch (el.type) {
          case "text": {
            const text = substitute(el.text)
              .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            const justify = el.align === "center" ? "center" : el.align === "right" ? "flex-end" : "flex-start";
            return wrap(`<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:${justify};font-family:${el.fontFamily};font-size:${el.fontSize}pt;font-weight:${el.bold ? 700 : 400};font-style:${el.italic ? "italic" : "normal"};text-decoration:${el.underline ? "underline" : "none"};color:${el.color};background:${el.bgColor || "transparent"};padding:2px 4px;box-sizing:border-box;overflow:hidden;white-space:pre-wrap;word-break:break-word;text-align:${el.align};">${text}</div>`);
          }
          case "dynamic": {
            const v = row[el.fieldName];
            const display = v && v !== "" ? v : (el.fallback || "");
            const safe = display.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            const justify = el.align === "center" ? "center" : el.align === "right" ? "flex-end" : "flex-start";
            return wrap(`<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:${justify};font-family:${el.fontFamily};font-size:${el.fontSize}pt;font-weight:${el.bold ? 700 : 400};color:${el.color};padding:2px 4px;box-sizing:border-box;overflow:hidden;text-align:${el.align};">${safe}</div>`);
          }
          case "rect":
            return wrap(`<div style="width:100%;height:100%;background:${el.fill};border:${el.borderWidth}px ${el.borderStyle} ${el.borderColor};border-radius:${el.radius}px;box-sizing:border-box"></div>`);
          case "circle":
            return wrap(`<div style="width:100%;height:100%;background:${el.fill};border:${el.borderWidth}px ${el.borderStyle} ${el.borderColor};border-radius:50%;box-sizing:border-box"></div>`);
          case "line":
            return wrap(`<div style="width:100%;border-top:${Math.max(1, el.strokeWidth)}px ${el.style} ${el.color};margin-top:calc(50% - 0.5px)"></div>`);
          case "image":
            return el.src ? wrap(`<img src="${el.src}" style="width:100%;height:100%;object-fit:${el.fit === "fill" ? "cover" : el.fit === "stretch" ? "fill" : "contain"}" />`) : "";
          case "barcode":
          case "qr":
            // Barcode/QR rendering in the print iframe is non-trivial without re-running
            // the libraries server-side. For now, render a placeholder; users seeing this
            // gap should print via the screen preview (browser will print whatever DOM
            // is currently in the modal).
            return wrap(`<div style="width:100%;height:100%;background:#fff;border:1px dashed #999;display:flex;align-items:center;justify-content:center;font-size:9px;color:#999">[${el.type}: ${substitute(el.value)}]</div>`);
        }
        return "";
      }).join("");
      return `<div class="page" style="position:relative;width:${w}px;height:${h}px;background:${doc.bg || "#fff"};${idx < rows.length - 1 ? "page-break-after:always;" : ""}">${pieces}</div>`;
    }).join("");

    docHtml.open();
    docHtml.write(`<!doctype html><html><head><title>${templateName}</title>
      <style>
        @page { size: ${widthMM}mm ${heightMM}mm; margin: 0; }
        html, body { margin: 0; padding: 0; }
        .page { box-sizing: border-box; }
      </style>
    </head><body>${rowHtml}</body></html>`);
    docHtml.close();

    iframe.onload = () => {
      win.focus();
      win.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    };
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-[920px] max-w-full max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{templateName}</h2>
            <p className="text-[11px] text-gray-500">{doc.width}×{doc.height} {doc.units} · {fields.length} field{fields.length === 1 ? "" : "s"} · {rows.length} row{rows.length === 1 ? "" : "s"}</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700 rounded"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* LEFT: data entry */}
          <div className="flex-1 overflow-y-auto p-5 border-r border-gray-200 bg-gray-50">
            {fields.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-10">
                This template has no placeholder fields. Use the preview on the right and click Print to use it.
              </p>
            ) : (
              <>
                {/* Row tabs */}
                <div className="flex items-center gap-1 mb-3 overflow-x-auto">
                  {rows.map((_, i) => (
                    <button key={i} onClick={() => setActiveRow(i)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md border ${activeRow === i ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300 hover:bg-blue-50"}`}>
                      Row {i + 1}
                    </button>
                  ))}
                  <button onClick={addRow} className="px-2 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 rounded-md flex items-center gap-1" title="Add a new row (prints as an additional label)">
                    <Plus className="w-3.5 h-3.5" /> Row
                  </button>
                  {rows.length > 1 && (
                    <button onClick={() => delRow(activeRow)} className="ml-auto px-2 py-1.5 text-xs text-rose-500 hover:bg-rose-50 rounded-md flex items-center gap-1" title="Remove this row">
                      <Trash2 className="w-3.5 h-3.5" /> Remove row
                    </button>
                  )}
                </div>
                {/* Field inputs */}
                <div className="space-y-3">
                  {fields.map((f) => (
                    <label key={f.key} className="block">
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 flex items-center gap-2">
                        {f.label}
                        <code className="font-mono text-[9px] text-gray-400">{`{{${f.key}}}`}</code>
                      </span>
                      <input
                        type="text"
                        value={rows[activeRow]?.[f.key] ?? ""}
                        onChange={(e) => setCell(activeRow, f.key, e.target.value)}
                        placeholder={f.label}
                        className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* RIGHT: preview */}
          <div className="w-[440px] flex-shrink-0 overflow-y-auto bg-gray-100 p-5 flex flex-col items-center">
            <div ref={previewWrapRef}>
              <DesignerLabelPreview doc={doc} values={rows[activeRow] || {}} pxPerMM={PX_PER_MM} />
            </div>
            <p className="text-[10px] text-gray-500 mt-3 text-center">
              Showing Row {activeRow + 1}. Edit fields on the left and the preview updates instantly.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-between">
          <p className="text-[11px] text-gray-500">
            Tip: add more rows to print multiple labels with different values in one go.
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
            <button onClick={handlePrint} className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md flex items-center gap-1.5">
              <Printer className="w-3.5 h-3.5" /> Print {rows.length} label{rows.length === 1 ? "" : "s"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
