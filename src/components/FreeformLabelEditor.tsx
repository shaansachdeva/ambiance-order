"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Rnd } from "react-rnd";
import { Type, Image as ImageIcon, Barcode, Square, Minus, AlignLeft, AlignCenter, AlignRight, Bold, Italic, Type as TypeIcon, RotateCcw, RotateCw } from "lucide-react";

export type CanvasElementType = "text" | "field" | "barcode" | "image" | "rect" | "line";

export interface CanvasElement {
  id: string;
  type: CanvasElementType;
  x: number; // percentage
  y: number; // percentage
  w: number; // percentage
  h: number; // percentage
  rot: number; // degrees
  
  // Specifics
  text?: string;
  fieldId?: string; // Links to LabelField.id
  fontSize?: number; // relative scale 0-100? Or just px / mm
  bold?: boolean;
  italic?: boolean;
  align?: "left" | "center" | "right";
  
  // Box/Line
  borderWidth?: number;
  borderColor?: string;
  bgColor?: string;
  style?: "solid" | "dashed" | "dotted";
  
  // Image
  imageDataUrl?: string;
}

export function FreeformLabelEditor({ 
  lbl, 
  update 
}: { 
  lbl: any; 
  update: (id: string, patch: any) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  // Initialize freeform layout if empty
  const elements: CanvasElement[] = lbl.design.elements || [];

  const updateElement = (id: string, patch: Partial<CanvasElement>) => {
    const updated = elements.map(e => e.id === id ? { ...e, ...patch } : e);
    update(lbl.id, { design: { ...lbl.design, elements: updated } });
  };
  
  const addElement = (el: Partial<CanvasElement>) => {
    const newEl: CanvasElement = {
      id: `el-${Date.now()}`,
      type: "text",
      x: 10, y: 10, w: 30, h: 10, rot: 0,
      ...el
    } as CanvasElement;
    update(lbl.id, { design: { ...lbl.design, elements: [...elements, newEl] } });
    setSelectedId(newEl.id);
  };

  const removeElement = (id: string) => {
    const updated = elements.filter(e => e.id !== id);
    update(lbl.id, { design: { ...lbl.design, elements: updated } });
    if (selectedId === id) setSelectedId(null);
  };

  const duplicateElement = (id: string) => {
    const el = elements.find(e => e.id === id);
    if (!el) return;
    const newEl: CanvasElement = { ...el, id: `el-${Date.now()}`, x: el.x + 2, y: el.y + 2 };
    update(lbl.id, { design: { ...lbl.design, elements: [...elements, newEl] } });
    setSelectedId(newEl.id);
  };

  const applyRotation = (id: string, rotDeg: number) => {
    const el = elements.find(e => e.id === id);
    if (!el) return;
    const newRot = (rotDeg + 360) % 360;
    const oldIsVertical = (el.rot === 90 || el.rot === 270);
    const newIsVertical = (newRot === 90 || newRot === 270);
    
    if (oldIsVertical !== newIsVertical) {
      const PREVIEW_W = 280;
      const totalPx = lbl.heightMm * (PREVIEW_W / Math.max(lbl.widthMm, 1));
      const wPx = (el.w / 100) * PREVIEW_W;
      const hPx = (el.h / 100) * totalPx;
      const newWPercent = (hPx / PREVIEW_W) * 100;
      const newHPercent = (wPx / totalPx) * 100;
      updateElement(id, { rot: newRot, w: newWPercent, h: newHPercent });
    } else {
      updateElement(id, { rot: newRot });
    }
  };

  // Convert mm to pixels for the editor canvas (fixed width 280 for preview)
  const PREVIEW_W = 280;
  const PX_PER_MM = PREVIEW_W / Math.max(lbl.widthMm, 1);
  const totalPx   = lbl.heightMm * PX_PER_MM;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') return;
      if (!selectedId) return;
      const el = elements.find(ev => ev.id === selectedId);
      if (!el) return;
      
      const STEP = e.shiftKey ? 2 : 0.5;
      
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          updateElement(selectedId, { y: Math.max(0, el.y - STEP) });
          break;
        case 'ArrowDown':
          e.preventDefault();
          updateElement(selectedId, { y: Math.min(100 - el.h, el.y + STEP) });
          break;
        case 'ArrowLeft':
          e.preventDefault();
          updateElement(selectedId, { x: Math.max(0, el.x - STEP) });
          break;
        case 'ArrowRight':
          e.preventDefault();
          updateElement(selectedId, { x: Math.min(100 - el.w, el.x + STEP) });
          break;
        case 'Delete':
          e.preventDefault();
          removeElement(selectedId);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, elements]);

  const getElementValue = (el: CanvasElement) => {
    if (el.type === "field" && el.fieldId) {
      const field = lbl.fields.find((f: any) => f.id === el.fieldId);
      return field ? `${field.heading}: ${field.value}` : "Unknown Field";
    }
    if (el.type === "text") return el.text || "Static Text";
    if (el.type === "barcode") return lbl.barcodeValue || "123456789";
    return "";
  };

  return (
    <div className="flex flex-col gap-4">
      {/* TOOLBAR */}
      <div className="flex gap-2 p-2 bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <button onClick={() => addElement({ type: "text", text: "New Text" })} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-50 hover:bg-gray-100 rounded border border-gray-200">
          <TypeIcon className="w-3.5 h-3.5"/> Text
        </button>
        <button onClick={() => addElement({ type: "field" })} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-50 hover:bg-gray-100 rounded border border-gray-200">
          <AlignLeft className="w-3.5 h-3.5"/> Data Field
        </button>
        <button onClick={() => addElement({ type: "barcode", w: 60, h: 20 })} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-50 hover:bg-gray-100 rounded border border-gray-200">
          <Barcode className="w-3.5 h-3.5"/> Barcode
        </button>
        <button onClick={() => addElement({ type: "rect", w: 40, h: 20, borderWidth: 2, borderColor: "#000000", bgColor: "transparent" })} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-50 hover:bg-gray-100 rounded border border-gray-200">
          <Square className="w-3.5 h-3.5"/> Box
        </button>
        <button onClick={() => addElement({ type: "line", w: 40, h: 2, borderWidth: 2, borderColor: "#000000" })} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-50 hover:bg-gray-100 rounded border border-gray-200">
          <Minus className="w-3.5 h-3.5"/> Line
        </button>
        <button onClick={() => addElement({ type: "image", w: 30, h: 20 })} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-50 hover:bg-gray-100 rounded border border-gray-200">
          <ImageIcon className="w-3.5 h-3.5"/> Image
        </button>
      </div>

      <div className="flex gap-6 items-start">
        {/* CANVAS */}
        <div 
          className="relative bg-white border-2 border-gray-200 shadow-sm overflow-hidden"
          style={{ width: PREVIEW_W, height: totalPx }}
          onClick={() => setSelectedId(null)}
        >
          {elements.map((el) => {
            const isSelected = selectedId === el.id;
            return (
              <Rnd
                key={el.id}
                size={{ width: (el.w / 100) * PREVIEW_W, height: (el.h / 100) * totalPx }}
                position={{ x: (el.x / 100) * PREVIEW_W, y: (el.y / 100) * totalPx }}
                onDrag={(e, d) => {
                  if (typeof d.x !== 'number' || isNaN(d.x)) return;
                  updateElement(el.id, { 
                    x: Math.round((d.x / PREVIEW_W) * 1000) / 10, 
                    y: Math.round((d.y / totalPx) * 1000) / 10 
                  });
                }}
                onResize={(e, direction, ref, delta, position) => {
                  if (!ref) return;
                  updateElement(el.id, {
                    w: Math.round((ref.offsetWidth / PREVIEW_W) * 1000) / 10,
                    h: Math.round((ref.offsetHeight / totalPx) * 1000) / 10,
                    x: Math.round((position.x / PREVIEW_W) * 1000) / 10,
                    y: Math.round((position.y / totalPx) * 1000) / 10
                  });
                }}
                onMouseDownCapture={() => setSelectedId(el.id)}
                onClick={(e: any) => { e.stopPropagation(); setSelectedId(el.id); }}
                className="absolute z-0"
              >
                {(() => {
                  const rot = el.rot || 0;
                  const isVertical = rot === 90 || rot === 270;
                  const innerWPx = isVertical ? ((el.h / 100) * totalPx) : ((el.w / 100) * PREVIEW_W);
                  const innerHPx = isVertical ? ((el.w / 100) * PREVIEW_W) : ((el.h / 100) * totalPx);
                  
                  return (
                    <div className={`absolute top-1/2 left-1/2 flex flex-col items-center justify-center pointer-events-none transition-transform ${isSelected ? "ring-2 ring-brand-500 shadow-md z-10" : "hover:ring-1 hover:ring-brand-300"}`} style={{
                      width: `${innerWPx}px`,
                      height: `${innerHPx}px`,
                      transform: `translate(-50%, -50%) rotate(${rot}deg)`,
                      border: el.type === 'rect' ? `${el.borderWidth || 1}px ${el.style || 'solid'} ${el.borderColor || '#000'}` : 'none',
                      backgroundColor: el.bgColor || 'transparent',
                      borderTop: el.type === 'line' ? `${el.borderWidth || 1}px ${el.style || 'solid'} ${el.borderColor || '#000'}` : 'none',
                      fontSize: el.fontSize ? `${el.fontSize}px` : '12px',
                      fontWeight: el.bold ? 'bold' : 'normal',
                      fontStyle: el.italic ? 'italic' : 'normal',
                      textAlign: el.align || 'center',
                    }}>
                      {(el.type === "text" || el.type === "field") && <span className="w-full truncate">{getElementValue(el)}</span>}
                      {el.type === "barcode" && <div className="w-full h-full bg-gray-200 border border-gray-300 flex items-center justify-center text-[10px] text-gray-500">Barcode Area</div>}
                      {el.type === "image" && (el.imageDataUrl ? 
                        <img src={el.imageDataUrl} className="w-full h-full object-contain pointer-events-none" alt="Custom" /> : 
                        <div className="w-full h-full bg-gray-100 flex items-center justify-center border border-gray-200 text-gray-400 text-[10px] text-center p-1">Upload Image in Props</div>
                      )}
                    </div>
                  );
                })()}
              </Rnd>
            );
          })}
        </div>

        {/* PROPERTIES PANEL */}
        <div className="flex-1 max-w-sm bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2">Properties</h3>
          
          {!selectedId ? (
            <p className="text-xs text-gray-400 italic">Select an element to edit</p>
          ) : (
            (() => {
              const el = elements.find(e => e.id === selectedId);
              if (!el) return null;

              return (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium bg-gray-200 text-gray-600 px-2 py-0.5 rounded capitalize">{el.type}</span>
                    <button onClick={() => removeElement(el.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                  </div>

                  {el.type === "field" && (
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">Data Field</label>
                      <select 
                        value={el.fieldId || ""} 
                        onChange={e => updateElement(el.id, { fieldId: e.target.value })}
                        className="w-full px-2 py-1.5 text-xs rounded border border-gray-300"
                      >
                        <option value="">-- Select Field --</option>
                        {lbl.fields.map((f: any) => (
                          <option key={f.id} value={f.id}>{f.heading || "Unnamed field"}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {el.type === "text" && (
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">Text content</label>
                      <input 
                        type="text" 
                        value={el.text || ""} 
                        onChange={e => updateElement(el.id, { text: e.target.value })}
                        className="w-full px-2 py-1.5 text-xs rounded border border-gray-300"
                      />
                    </div>
                  )}

                  {el.type === "image" && (
                    <div>
                      <div className="flex justify-between mb-1 items-end">
                        <label className="block text-[10px] text-gray-500">Upload Image</label>
                        {el.imageDataUrl && (
                          <button onClick={() => updateElement(el.id, { imageDataUrl: undefined })} className="text-[10px] text-red-500 hover:text-red-700">Clear Image</button>
                        )}
                      </div>
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const rd = new FileReader();
                            rd.onload = ev => updateElement(el.id, { imageDataUrl: ev.target?.result as string });
                            rd.readAsDataURL(file);
                          }
                        }}
                        className="w-full px-2 py-1.5 text-xs rounded border border-gray-300"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-2">Orientation & Rotation</label>
                    <div className="flex bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden p-0.5">
                      <button onClick={() => applyRotation(el.id, 0)} className={`flex-1 py-1.5 text-xs text-center rounded-md ${el.rot === 0 || !el.rot ? 'bg-brand-500 text-white font-medium shadow' : 'text-gray-600 hover:bg-gray-100'}`}>0°</button>
                      <button onClick={() => applyRotation(el.id, 90)} className={`flex-1 py-1.5 text-xs text-center rounded-md ${el.rot === 90 ? 'bg-brand-500 text-white font-medium shadow' : 'text-gray-600 hover:bg-gray-100'}`}>90°</button>
                      <button onClick={() => applyRotation(el.id, 180)} className={`flex-1 py-1.5 text-xs text-center rounded-md ${el.rot === 180 ? 'bg-brand-500 text-white font-medium shadow' : 'text-gray-600 hover:bg-gray-100'}`}>180°</button>
                      <button onClick={() => applyRotation(el.id, 270)} className={`flex-1 py-1.5 text-xs text-center rounded-md ${el.rot === 270 ? 'bg-brand-500 text-white font-medium shadow' : 'text-gray-600 hover:bg-gray-100'}`}>270°</button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pb-2 border-b border-gray-200">
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">X Pos (%)</label>
                      <input type="number" step="0.1" value={el.x} onChange={e => updateElement(el.id, { x: parseFloat(e.target.value) || 0 })} className="w-full px-2 py-1.5 text-xs rounded border border-gray-300 bg-white" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">Y Pos (%)</label>
                      <input type="number" step="0.1" value={el.y} onChange={e => updateElement(el.id, { y: parseFloat(e.target.value) || 0 })} className="w-full px-2 py-1.5 text-xs rounded border border-gray-300 bg-white" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">Width (%)</label>
                      <input type="number" step="0.1" value={el.w} onChange={e => updateElement(el.id, { w: parseFloat(e.target.value) || 0 })} className="w-full px-2 py-1.5 text-xs rounded border border-gray-300 bg-white" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">Height (%)</label>
                      <input type="number" step="0.1" value={el.h} onChange={e => updateElement(el.id, { h: parseFloat(e.target.value) || 0 })} className="w-full px-2 py-1.5 text-xs rounded border border-gray-300 bg-white" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">Font Size</label>
                    <input 
                      type="number" 
                      value={el.fontSize || 12} 
                      onChange={e => updateElement(el.id, { fontSize: parseInt(e.target.value) || 12 })}
                      className="w-full px-2 py-1.5 text-xs rounded border border-gray-300"
                    />
                  </div>

                  {(el.type === "text" || el.type === "field") && (
                    <div className="flex gap-2">
                      <button onClick={() => updateElement(el.id, { bold: !el.bold })} className={`p-1.5 rounded border ${el.bold ? 'bg-brand-500 text-white' : 'bg-white text-gray-600'}`}><Bold className="w-3.5 h-3.5"/></button>
                      <button onClick={() => updateElement(el.id, { italic: !el.italic })} className={`p-1.5 rounded border ${el.italic ? 'bg-brand-500 text-white' : 'bg-white text-gray-600'}`}><Italic className="w-3.5 h-3.5"/></button>
                      <button onClick={() => updateElement(el.id, { align: "left" })} className={`p-1.5 rounded border ${el.align === 'left' ? 'bg-gray-200' : 'bg-white'}`}><AlignLeft className="w-3.5 h-3.5"/></button>
                      <button onClick={() => updateElement(el.id, { align: "center" })} className={`p-1.5 rounded border ${el.align === 'center' ? 'bg-gray-200' : 'bg-white'}`}><AlignCenter className="w-3.5 h-3.5"/></button>
                      <button onClick={() => updateElement(el.id, { align: "right" })} className={`p-1.5 rounded border ${el.align === 'right' ? 'bg-gray-200' : 'bg-white'}`}><AlignRight className="w-3.5 h-3.5"/></button>
                    </div>
                  )}

                  {(el.type === "rect" || el.type === "line") && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">Thickness</label>
                        <input type="number" value={el.borderWidth || 1} onChange={e => updateElement(el.id, { borderWidth: parseInt(e.target.value) || 1 })} className="w-full px-2 py-1 text-xs border rounded"/>
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">Color</label>
                        <input type="color" value={el.borderColor || "#000000"} onChange={e => updateElement(el.id, { borderColor: e.target.value })} className="w-full h-8 px-1 py-1 border rounded"/>
                      </div>
                    </div>
                  )}

                  <hr className="my-4 border-gray-200" />
                  
                  <div className="flex flex-col gap-2">
                    <button onClick={() => duplicateElement(el.id)} className="w-full flex justify-center items-center gap-2 py-2 text-xs font-semibold text-brand-600 bg-brand-50 hover:bg-brand-100 rounded-lg border border-brand-200 transition-colors">
                      Duplicate Element
                    </button>
                    <button onClick={() => removeElement(el.id)} className="w-full flex justify-center items-center gap-2 py-2 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-colors">
                      Delete Element
                    </button>
                  </div>
                </div>
              );
            })()
          )}
        </div>
      </div>
    </div>
  );
}
