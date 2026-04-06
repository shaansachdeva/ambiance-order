"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, Loader2, Printer } from "lucide-react";
import { formatDate, getProductCategoryLabel } from "@/lib/utils";
import toast, { Toaster } from "react-hot-toast";

const QUANTITY_KEY: Record<string, string> = {
  BOPP_TAPE:           "boxes",
  BOPP_JUMBO:          "quantity",
  THERMAL_ROLL:        "boxes",
  BARCODE_LABEL:       "quantity",
  COMPUTER_STATIONERY: "packets",
};

function extractQuantity(category: string, details: Record<string, string>) {
  const key = QUANTITY_KEY[category] || "";
  return key ? (details[key] || "") : "";
}

const HEADER_BG = "linear-gradient(135deg, #0d2b1a 0%, #1a5233 100%)";
const ACCENT     = "#1a5233";
const ACCENT_MID = "#2d7a4f";

export default function OrderSharePage() {
  const { id } = useParams();
  const [order, setOrder]       = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [logoSrc, setLogoSrc]   = useState<string>("/ambiance-logo.png");
  const [activeAction, setActiveAction] = useState<"download" | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

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

    // logoSrc is already a base64 data URL (set on mount), so html2canvas
    // renders it instantly with no network requests — no more infinite hang
    const canvas = await html2canvas(formRef.current, {
      scale: 2,
      useCORS: false,        // not needed — no external URLs in the DOM
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      removeContainer: true,
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf     = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW   = pdf.internal.pageSize.getWidth();
    const pageH   = pdf.internal.pageSize.getHeight();
    const imgH    = (canvas.height * pageW) / canvas.width;

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
    "28px",
    "1fr",
    "1.8fr",
    "60px",
    ...(hasRate ? ["90px"] : []),
    ...(hasGst  ? ["56px"] : []),
  ];
  const gridCols = colDefs.join(" ");

  return (
    <div className="max-w-2xl mx-auto pb-12">
      <Toaster position="top-center" />
      <style>{`
        @media print {
          @page { size: A5; margin: 8mm; }
          body * { visibility: hidden; }
          #order-form-print, #order-form-print * { visibility: visible; }
          #order-form-print { position: fixed; top: 0; left: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Controls */}
      <div className="flex items-center gap-2 mb-5 flex-wrap no-print">
        <Link href={`/orders/${id}`} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
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

      {/* ORDER FORM — captured to PDF */}
      <div id="order-form-print" ref={formRef} style={{ fontFamily: "'Helvetica Neue', Arial, sans-serif", color: "#111", background: "#fff" }}>

        {/* HEADER */}
        <div style={{ background: HEADER_BG, padding: "20px 24px", color: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>

            <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
              {/* logoSrc is base64 by the time PDF is generated — no CORS, no hang */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoSrc}
                alt="Ambiance"
                style={{ height: 44, width: "auto", objectFit: "contain", flexShrink: 0 }}
              />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.2 }}>
                  Ambiance Printing &amp; Packaging
                </div>
                <div style={{ fontSize: 9.5, opacity: 0.78, marginTop: 4, lineHeight: 1.55 }}>
                  Mandebar Road, Vill. Kheri Rangran<br />
                  Yamunanagar, Haryana (India) 135001
                </div>
                <div style={{ fontSize: 9, opacity: 0.68, marginTop: 2 }}>
                  info@pakzy3s.com &nbsp;·&nbsp; ambianceynr@gmail.com
                </div>
              </div>
            </div>

            <div style={{ flexShrink: 0, textAlign: "center",
              background: "rgba(255,255,255,0.14)",
              border: "1px solid rgba(255,255,255,0.35)",
              borderRadius: 10, padding: "10px 20px",
            }}>
              <div style={{ fontSize: 8.5, fontWeight: 600, opacity: 0.72, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 4 }}>
                Order ID
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.4px", lineHeight: 1 }}>
                {formattedId}
              </div>
            </div>
          </div>
        </div>

        {/* BODY */}
        <div style={{ padding: "22px 24px" }}>

          {/* Meta strip */}
          <div style={{ display: "flex", flexWrap: "wrap", marginBottom: 20, border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
            {([
              { label: "ORDER DATE",  value: formatDate(order.createdAt) },
              order.deliveryDeadline  ? { label: "DELIVERY BY", value: formatDate(order.deliveryDeadline) } : null,
              order.customer?.partyName ? { label: "PARTY",    value: order.customer.partyName } : null,
              order.customer?.location  ? { label: "LOCATION", value: order.customer.location }  : null,
            ] as any[]).filter(Boolean).map((cell: any, i: number) => (
              <div key={i} style={{
                flex: "1 1 40%", padding: "10px 14px",
                background: i % 2 === 0 ? "#f9fafb" : "#fff",
                borderRight: "1px solid #e5e7eb",
                borderBottom: "1px solid #e5e7eb",
              }}>
                <div style={{ fontSize: 8, fontWeight: 600, color: "#6b7280", letterSpacing: 0.8, marginBottom: 2, textTransform: "uppercase" }}>
                  {cell.label}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>{cell.value}</div>
              </div>
            ))}
          </div>

          {/* Table header */}
          <div style={{
            display: "grid", gridTemplateColumns: gridCols, gap: "0 8px",
            background: ACCENT, color: "#fff",
            padding: "9px 14px", borderRadius: "8px 8px 0 0",
            fontSize: 9.5, fontWeight: 600,
            textTransform: "uppercase" as const, letterSpacing: 0.5,
          }}>
            <div>#</div>
            <div>Product</div>
            <div>Specifications</div>
            <div style={{ textAlign: "center" }}>Qty</div>
            {hasRate && <div style={{ textAlign: "right" }}>Price</div>}
            {hasGst  && <div style={{ textAlign: "right" }}>GST %</div>}
          </div>

          {/* Table rows */}
          {(orderItems.length > 0 ? orderItems : [{ _legacy: true }]).map((item: any, idx: number) => {
            const isLegacy = item._legacy;
            const category = isLegacy ? order.productCategory : item.productCategory;
            const d: Record<string, string> = isLegacy
              ? (typeof order.productDetails === "string" ? JSON.parse(order.productDetails) : order.productDetails || {})
              : (typeof item.productDetails === "string" ? JSON.parse(item.productDetails) : item.productDetails || {});

            const qty  = extractQuantity(category, d);
            const qKey = QUANTITY_KEY[category] || "";
            const specPairs = Object.entries(d)
              .filter(([k, v]) => v && k !== qKey)
              .map(([k, v]) => {
                const lbl = k.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase());
                return `${lbl}: ${v}`;
              });

            return (
              <div key={item.id || "legacy"} style={{
                display: "grid", gridTemplateColumns: gridCols, gap: "0 8px",
                padding: "11px 14px",
                background: idx % 2 === 0 ? "#f9fafb" : "#fff",
                borderBottom: "1px solid #e5e7eb",
                borderLeft: "1px solid #e5e7eb",
                borderRight: "1px solid #e5e7eb",
                alignItems: "start",
              }}>
                <div style={{
                  width: 19, height: 19, borderRadius: "50%",
                  background: ACCENT_MID, color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 9, fontWeight: 700,
                }}>{idx + 1}</div>

                <div style={{ fontSize: 11.5, fontWeight: 600, color: ACCENT, paddingTop: 1 }}>
                  {getProductCategoryLabel(category)}
                </div>

                <div style={{ fontSize: 10, color: "#374151", lineHeight: 1.75 }}>
                  {specPairs.map((spec, si) => (
                    <span key={si}>
                      {si > 0 && <span style={{ color: "#d1d5db", margin: "0 4px" }}>|</span>}
                      {spec}
                    </span>
                  ))}
                </div>

                <div style={{ fontSize: 11.5, fontWeight: 600, textAlign: "center", color: "#111827", paddingTop: 1 }}>
                  {qty || "—"}
                </div>

                {hasRate && (
                  <div style={{ fontSize: 11.5, fontWeight: 600, textAlign: "right", color: ACCENT, paddingTop: 1 }}>
                    {item.rate ? `₹${Number(item.rate).toLocaleString("en-IN")}` : "—"}
                  </div>
                )}
                {hasGst && (
                  <div style={{ fontSize: 11.5, fontWeight: 600, textAlign: "right", color: "#374151", paddingTop: 1 }}>
                    {item.gst ? `${item.gst}%` : "—"}
                  </div>
                )}
              </div>
            );
          })}

          <div style={{ height: 5, background: "#f9fafb", border: "1px solid #e5e7eb", borderTop: "none", borderRadius: "0 0 8px 8px", marginBottom: 20 }} />

          {/* Remarks */}
          {order.remarks && (
            <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: "10px 14px", marginBottom: 20 }}>
              <div style={{ fontSize: 8.5, fontWeight: 600, color: "#92400e", textTransform: "uppercase" as const, letterSpacing: 0.7, marginBottom: 3 }}>
                Remarks / Notes
              </div>
              <div style={{ fontSize: 12, color: "#78350f" }}>{order.remarks}</div>
            </div>
          )}

          {order.createdBy && (
            <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 20 }}>
              Order placed by <strong style={{ color: "#6b7280" }}>{order.createdBy.name}</strong> on {formatDate(order.createdAt)}
            </div>
          )}

          {/* Footer */}
          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
            <div style={{ fontSize: 9, color: "#9ca3af" }}>
              Ambiance Printing &amp; Packaging · Yamunanagar, Haryana 135001
            </div>
            <div style={{ fontSize: 9, color: "#9ca3af" }}>
              info@pakzy3s.com · ambianceynr@gmail.com
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
