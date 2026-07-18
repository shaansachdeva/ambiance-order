"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Download, Loader2, Printer } from "lucide-react";
import { formatDate, getProductCategoryLabel, safeParseJSON, extractQuantity as extractQty } from "@/lib/utils";
import toast, { Toaster } from "react-hot-toast";

// Quantity detection now lives in lib/utils so it works for built-ins AND custom products.
function extractQuantity(category: string, details: Record<string, string>) {
  return extractQty(category, details).value;
}
function extractQuantityKey(category: string, details: Record<string, string>) {
  return extractQty(category, details).key;
}

const ACCENT      = "#16a34a";   // brand green (matches Tailwind brand-500)
const ACCENT_DARK = "#15803d";
const TEXT_MUTED  = "#6b7280";
const TEXT_DIM    = "#9ca3af";
const BORDER      = "#e5e7eb";
const BG_SOFT     = "#f9fafb";

export default function OrderSharePage() {
  const { id } = useParams();
  const router = useRouter();
  const [order, setOrder]       = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [logoSrc, setLogoSrc]   = useState<string>("/ambiance-logo.png");
  const [activeAction, setActiveAction] = useState<"download" | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [previewHeight, setPreviewHeight] = useState<number | null>(null);

  // Scale the A4 preview to fit narrow screens. The captured element stays
  // at 210mm so the generated PDF is unaffected.
  useEffect(() => {
    const A4_PX = 793.7; // 210mm @ 96 dpi
    const recalc = () => {
      if (!stageRef.current || !formRef.current) return;
      const stageW = stageRef.current.offsetWidth;
      const scale = Math.min(1, stageW / A4_PX);
      setPreviewScale(scale);
      setPreviewHeight(formRef.current.scrollHeight * scale);
    };
    recalc();
    const ro = new ResizeObserver(recalc);
    if (stageRef.current) ro.observe(stageRef.current);
    if (formRef.current) ro.observe(formRef.current);
    window.addEventListener("resize", recalc);
    return () => { ro.disconnect(); window.removeEventListener("resize", recalc); };
  }, [order]);

  // Preload logo as base64 on mount so html2canvas never makes an HTTP request for it
  useEffect(() => {
    fetch("/ambiance-logo.png")
      .then((r) => r.blob())
      .then((blob) => {
        const reader = new FileReader();
        reader.onloadend = () => setLogoSrc(reader.result as string);
        reader.readAsDataURL(blob);
      })
      .catch(() => { /* keep original src, pdf will render without logo if needed */ });
  }, []);

  useEffect(() => {
    fetch(`/api/orders/${id}`)
      .then((r) => r.json())
      .then((d) => { setOrder(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  const buildPDFBlob = async (): Promise<{ blob: Blob; filename: string } | null> => {
    if (!formRef.current || !order) return null;
    const html2canvas = (await import("html2canvas")).default;
    const { jsPDF }   = await import("jspdf");

    // Capture a DEEP CLONE in an off-screen sandbox instead of the live node.
    // The previous approach (toggling the on-screen form's transform / parent
    // clip) still leaked layout quirks from the mobile preview into the PDF
    // — flex baselines + the scaled parent shifted text downward. Cloning the
    // form into a dedicated fixed-width host removes every external influence:
    // the clone has no scaling, no viewport-dependent CSS, no scrolled
    // ancestors. html2canvas then sees exactly the A4 layout the PDF needs.
    const PX_PER_MM = 96 / 25.4;           // 3.7795… — CSS px per mm at 96 dpi
    const A4_WIDTH_PX  = Math.round(210 * PX_PER_MM); // 794
    const A4_HEIGHT_PX = Math.round(297 * PX_PER_MM); // 1123

    const sandbox = document.createElement("div");
    sandbox.style.cssText = [
      "position: fixed",
      "top: 0",
      // Off-screen but still in the layout tree so html2canvas can measure it.
      "left: -10000px",
      `width: ${A4_WIDTH_PX}px`,
      "background: #ffffff",
      "pointer-events: none",
      "z-index: -1",
    ].join(";");

    const clone = formRef.current.cloneNode(true) as HTMLDivElement;
    // Strip every layout-affecting style we set for the on-screen preview so
    // the clone renders at its natural A4 dimensions.
    clone.style.transform = "none";
    clone.style.transformOrigin = "top left";
    clone.style.width = "210mm";
    clone.style.minHeight = "297mm";
    clone.style.margin = "0";
    clone.style.boxShadow = "none";

    sandbox.appendChild(clone);
    document.body.appendChild(sandbox);
    // Two animation frames give the cloned subtree time to fully paint at the
    // new width before html2canvas measures — one frame for layout, one for
    // images/fonts to flush.
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    await new Promise((r) => requestAnimationFrame(() => r(null)));

    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: false,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      removeContainer: true,
      scrollX: 0,
      scrollY: 0,
      windowWidth: A4_WIDTH_PX,
      // Snap to whole A4 pages so the captured strip lines up exactly with
      // the printed pages — partial pages were leaving a gap at the bottom
      // and pushing the next page's content downward.
      windowHeight: Math.max(clone.scrollHeight, A4_HEIGHT_PX),
    });

    document.body.removeChild(sandbox);

    // Now turn the captured PNG into A4 pages. Pixel → mm conversion uses the
    // canvas's actual ratio so the height we hand to addImage matches reality.
    const pdf   = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();   // 210
    const pageH = pdf.internal.pageSize.getHeight();  // 297
    const imgH  = (canvas.height * pageW) / canvas.width;
    const imgData = canvas.toDataURL("image/png");

    let yPos = 0, remaining = imgH;
    while (remaining > 0) {
      if (yPos > 0) pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, -yPos, pageW, imgH);
      yPos += pageH;
      remaining -= pageH;
    }

    const fId =
      typeof order.orderId === "number"
        ? `ORD-${String(order.orderId).padStart(4, "0")}`
        : order.orderId;
    return { blob: pdf.output("blob"), filename: `${fId}-order-form.pdf` };
  };

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement("a");
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

const handleDownload = async () => {
    setActiveAction("download");
    try {
      const result = await buildPDFBlob();
      if (result) {
        triggerDownload(result.blob, result.filename);
        toast.success("PDF downloaded");
      } else {
        toast.error("Could not generate PDF");
      }
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to generate PDF");
    } finally {
      setActiveAction(null);
    }
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
    </div>
  );
  if (!order) return <p className="text-center text-gray-500 py-12">Order not found.</p>;

  const formattedId =
    typeof order.orderId === "number"
      ? `ORD-${String(order.orderId).padStart(4, "0")}`
      : order.orderId;

  const orderItems = order.items || [];
  const hasRate    = orderItems.some((i: any) => i.rate);
  const hasGst     = orderItems.some((i: any) => i.gst);
  const isGenerating = activeAction !== null;

  const colDefs = [
    "32px",
    "1.1fr",
    "1.9fr",
    "64px",
    ...(hasRate ? ["90px"] : []),
    ...(hasGst  ? ["56px"] : []),
  ];
  const gridCols = colDefs.join(" ");

  // Compute total if rates exist (subtotal · gst · grand total)
  let subtotal = 0, gstTotal = 0;
  if (hasRate) {
    for (const item of orderItems) {
      const d = safeParseJSON(item.productDetails);
      const qty = parseFloat(extractQuantity(item.productCategory, d) || "0") || 0;
      const rate = parseFloat(item.rate || 0) || 0;
      const lineTotal = qty * rate;
      subtotal += lineTotal;
      if (item.gst) gstTotal += lineTotal * (parseFloat(item.gst) / 100);
    }
  }
  const grandTotal = subtotal + gstTotal;
  const fmtINR = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="max-w-[820px] mx-auto pb-12 px-3 sm:px-0">
      <Toaster position="top-center" />
      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          body * { visibility: hidden; }
          #order-form-print, #order-form-print * { visibility: visible; }
          #order-form-print { position: fixed; top: 0; left: 0; width: 210mm !important; box-shadow: none !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Controls */}
      <div className="flex items-center gap-2 mb-5 flex-wrap no-print">
        {/* Use router.back() instead of a Link to /orders/[id] — a Link calls
            router.push and adds a new history entry, which combined with the
            detail page's back arrow (also router.back) created an infinite
            bounce between detail and share. router.back pops correctly. */}
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined" && window.history.length > 1) {
              router.back();
            } else {
              router.push(`/orders/${id}`);
            }
          }}
          className="p-2 hover:bg-gray-100 rounded-lg"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 mr-auto">Order Form</h1>

<button onClick={handleDownload} disabled={isGenerating}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-800 hover:bg-gray-900 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60">
          {activeAction === "download" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Download PDF
        </button>

        <button onClick={() => window.print()} disabled={isGenerating}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-xl transition-colors disabled:opacity-60">
          <Printer className="w-4 h-4" />
          Print A5
        </button>
      </div>

      {isGenerating && (
        <p className="no-print text-center text-sm text-gray-400 mb-3 animate-pulse">Generating PDF…</p>
      )}

      {/* ORDER FORM — captured to PDF (constrained to A4 width so the on-screen
          preview matches the PDF and the print version 1:1). The outer stage
          scales the preview down to viewport width on mobile while the inner
          stays at exactly 210mm so PDF capture is unaffected. */}
      <div
        ref={stageRef}
        className="pdf-stage"
        style={{
          width: "100%",
          maxWidth: "210mm",
          margin: "0 auto",
          height: previewHeight ?? undefined,
          overflow: "hidden",
          position: "relative",
        }}
      >
      <div
        id="order-form-print"
        ref={formRef}
        style={{
          fontFamily: "'Helvetica Neue', 'Inter', Arial, sans-serif",
          color: "#111827",
          background: "#fff",
          fontFeatureSettings: "'tnum' 1, 'lnum' 1",
          width: "210mm",
          minHeight: "297mm",
          margin: "0",
          transform: `scale(${previewScale})`,
          transformOrigin: "top left",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
        }}
      >
        {/* Top accent strip */}
        <div style={{ height: 6, background: ACCENT }} />

        {/* HEADER */}
        <div style={{ padding: "28px 32px 24px", borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 32 }}>
            {/* Company block */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flex: "1 1 0", minWidth: 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoSrc}
                alt="Ambiance"
                style={{ height: 56, width: "auto", objectFit: "contain", flexShrink: 0, marginTop: 2 }}
              />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.15, letterSpacing: "-0.3px", color: "#0f172a" }}>
                  Ambiance Printing &amp; Packaging
                </div>
                <div style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 6, lineHeight: 1.55 }}>
                  Mandebar Road, Vill. Kheri Rangran<br />
                  Yamunanagar, Haryana (India) 135001
                </div>
                <div style={{ fontSize: 9.5, color: TEXT_DIM, marginTop: 3, lineHeight: 1.4 }}>
                  info@pakzy3s.com &nbsp;·&nbsp; ambianceynr@gmail.com
                </div>
              </div>
            </div>

            {/* Doc badge */}
            <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "flex-start", paddingTop: 2 }}>
              <div style={{
                display: "inline-block", padding: "4px 10px",
                background: BG_SOFT, color: ACCENT_DARK,
                fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
                borderRadius: 4, textTransform: "uppercase" as const,
                border: `1px solid ${BORDER}`,
                lineHeight: 1.2,
              }}>
                Order Form
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.7px", color: "#0f172a", marginTop: 8, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                {formattedId}
              </div>
              <div style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 6, lineHeight: 1.2 }}>
                {formatDate(order.createdAt)}
              </div>
            </div>
          </div>
        </div>

        {/* BODY */}
        <div style={{ padding: "24px 32px" }}>

          {/* Bill To + meta — two equal-height columns separated by a hairline */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24,
            paddingBottom: 18, borderBottom: `1px solid ${BORDER}`,
          }}>
            <div>
              <div style={{ fontSize: 8.5, fontWeight: 700, color: TEXT_MUTED, letterSpacing: 1.2, marginBottom: 6, textTransform: "uppercase" as const }}>
                Bill To
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", lineHeight: 1.3 }}>
                {order.customer?.partyName || "—"}
              </div>
              {order.customer?.location && (
                <div style={{ fontSize: 10.5, color: TEXT_MUTED, marginTop: 4, lineHeight: 1.4 }}>
                  {order.customer.location}
                </div>
              )}
            </div>
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "max-content 1fr", columnGap: 16, rowGap: 6, alignItems: "baseline" }}>
                {order.deliveryDeadline && (
                  <>
                    <div style={{ fontSize: 8.5, fontWeight: 700, color: TEXT_MUTED, letterSpacing: 1.2, textTransform: "uppercase" as const }}>
                      Delivery By
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", textAlign: "right" }}>
                      {formatDate(order.deliveryDeadline)}
                    </div>
                  </>
                )}
                {order.priority === "URGENT" && (
                  <>
                    <div style={{ fontSize: 8.5, fontWeight: 700, color: TEXT_MUTED, letterSpacing: 1.2, textTransform: "uppercase" as const }}>
                      Priority
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", textAlign: "right" }}>
                      URGENT
                    </div>
                  </>
                )}
                {order.createdBy && (
                  <>
                    <div style={{ fontSize: 8.5, fontWeight: 700, color: TEXT_MUTED, letterSpacing: 1.2, textTransform: "uppercase" as const }}>
                      Placed By
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#374151", textAlign: "right" }}>
                      {order.createdBy.name}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Items table */}
          <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden" }}>
            {/* Header */}
            <div style={{
              display: "grid", gridTemplateColumns: gridCols, gap: "0 10px",
              background: BG_SOFT, color: "#374151",
              padding: "10px 16px",
              fontSize: 9, fontWeight: 700,
              textTransform: "uppercase" as const, letterSpacing: 0.8,
              borderBottom: `1px solid ${BORDER}`,
            }}>
              <div style={{ width: "100%" }}>#</div>
              <div style={{ width: "100%" }}>Product</div>
              <div style={{ width: "100%" }}>Specifications</div>
              <div style={{ textAlign: "center", width: "100%" }}>Qty</div>
              {hasRate && <div style={{ textAlign: "right", width: "100%" }}>Rate</div>}
              {hasGst  && <div style={{ textAlign: "right", width: "100%" }}>GST</div>}
            </div>

            {/* Rows */}
            {(orderItems.length > 0 ? orderItems : [{ _legacy: true }]).map((item: any, idx: number, arr: any[]) => {
              const isLegacy = item._legacy;
              const category = isLegacy ? order.productCategory : item.productCategory;
              const d: Record<string, string> = isLegacy
                ? safeParseJSON(order.productDetails)
                : safeParseJSON(item.productDetails);

              const qty  = extractQuantity(category, d);
              const qKey = extractQuantityKey(category, d);
              const specPairs = Object.entries(d)
                .filter(([k, v]) => v && k !== qKey)
                .map(([k, v]) => {
                  const lbl = k.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase());
                  return `${lbl}: ${v}`;
                });

              return (
                <div key={item.id || "legacy"} style={{
                  display: "grid", gridTemplateColumns: gridCols, gap: "0 10px",
                  padding: "13px 16px",
                  borderBottom: idx === arr.length - 1 ? "none" : `1px solid ${BORDER}`,
                  alignItems: "start",
                  background: "#fff",
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: TEXT_MUTED, paddingTop: 1 }}>
                    {String(idx + 1).padStart(2, "0")}
                  </div>

                  <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", paddingTop: 1, lineHeight: 1.3 }}>
                    {getProductCategoryLabel(category)}
                  </div>

                  <div style={{ fontSize: 10, color: "#4b5563", lineHeight: 1.6 }}>
                    {specPairs.length > 0 ? specPairs.map((spec, si) => (
                      <span key={si}>
                        {si > 0 && <span style={{ color: "#d1d5db", margin: "0 6px" }}>·</span>}
                        {spec}
                      </span>
                    )) : <span style={{ color: TEXT_DIM }}>No specifications</span>}
                  </div>

                  <div style={{ fontSize: 12, fontWeight: 700, textAlign: "center", color: "#0f172a", paddingTop: 1, width: "100%" }}>
                    {qty || "—"}
                  </div>

                  {hasRate && (
                    <div style={{ fontSize: 11.5, fontWeight: 700, textAlign: "right", color: "#0f172a", paddingTop: 1, width: "100%" }}>
                      {item.rate ? fmtINR(Number(item.rate)) : "—"}
                    </div>
                  )}
                  {hasGst && (
                    <div style={{ fontSize: 11.5, fontWeight: 600, textAlign: "right", color: "#374151", paddingTop: 1, width: "100%" }}>
                      {item.gst ? `${item.gst}%` : "—"}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Totals (only when prices are set) */}
          {hasRate && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <div style={{ minWidth: 240, fontSize: 11 }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", color: TEXT_MUTED }}>
                  <span>Subtotal</span>
                  <span style={{ color: "#0f172a", fontWeight: 600 }}>{fmtINR(subtotal)}</span>
                </div>
                {hasGst && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", color: TEXT_MUTED }}>
                    <span>GST</span>
                    <span style={{ color: "#0f172a", fontWeight: 600 }}>{fmtINR(gstTotal)}</span>
                  </div>
                )}
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  padding: "10px 14px", marginTop: 4,
                  background: ACCENT, color: "#fff",
                  borderRadius: 6, fontSize: 13, fontWeight: 700,
                }}>
                  <span>Total</span>
                  <span>{fmtINR(grandTotal)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Remarks */}
          {order.remarks && (
            <div style={{
              marginTop: 24,
              padding: "12px 16px",
              background: BG_SOFT,
              borderLeft: `3px solid ${ACCENT}`,
              borderRadius: "0 6px 6px 0",
            }}>
              <div style={{ fontSize: 8.5, fontWeight: 700, color: ACCENT_DARK, textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 4 }}>
                Notes
              </div>
              <div style={{ fontSize: 11, color: "#374151", lineHeight: 1.55 }}>{order.remarks}</div>
            </div>
          )}

          {/* Footer */}
          <div style={{ marginTop: 32, paddingTop: 14, borderTop: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: 9, color: TEXT_DIM }}>
              Ambiance Printing &amp; Packaging · Yamunanagar, Haryana 135001
            </div>
            <div style={{ fontSize: 9, color: TEXT_DIM }}>
              info@pakzy3s.com · ambianceynr@gmail.com
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
