"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { formatDate, getProductCategoryLabel, safeParseJSON, extractQuantity } from "@/lib/utils";
import type { UserRole } from "@/types";
import toast, { Toaster } from "react-hot-toast";
import { ArrowLeft, Download, Loader2, Printer, Pencil, CheckCircle, XCircle, Clock, Send, FileText } from "lucide-react";

const ACCENT      = "#16a34a";   // brand green
const ACCENT_DARK = "#15803d";
const TEXT_MUTED  = "#6b7280";
const TEXT_DIM    = "#9ca3af";
const BORDER      = "#e5e7eb";
const BG_SOFT     = "#f9fafb";

// Quantity detection now lives in lib/utils so it works for built-ins AND custom products.

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  DRAFT:    { label: "Draft",    color: "bg-gray-100 text-gray-700",   icon: <FileText className="w-3.5 h-3.5" /> },
  SENT:     { label: "Sent",     color: "bg-blue-100 text-blue-800",   icon: <Send className="w-3.5 h-3.5" /> },
  ACCEPTED: { label: "Accepted", color: "bg-green-100 text-green-800", icon: <CheckCircle className="w-3.5 h-3.5" /> },
  REJECTED: { label: "Rejected", color: "bg-red-100 text-red-800",     icon: <XCircle className="w-3.5 h-3.5" /> },
  EXPIRED:  { label: "Expired",  color: "bg-orange-100 text-orange-800", icon: <Clock className="w-3.5 h-3.5" /> },
};

export default function QuotationDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const [quotation, setQuotation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeAction, setActiveAction] = useState<"download" | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [logoSrc, setLogoSrc] = useState("/ambiance-logo.png");
  const formRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [previewHeight, setPreviewHeight] = useState<number | null>(null);

  useEffect(() => {
    const A4_PX = 793.7;
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
  }, [quotation]);

  const userRole = ((session?.user as any)?.role || "SALES") as UserRole;
  const canEdit = ["ADMIN", "SALES", "ACCOUNTANT"].includes(userRole);

  useEffect(() => {
    fetch("/ambiance-logo.png").then((r) => r.blob()).then((blob) => {
      const reader = new FileReader();
      reader.onloadend = () => setLogoSrc(reader.result as string);
      reader.readAsDataURL(blob);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`/api/quotations/${id}`)
      .then((r) => r.json())
      .then((d) => { setQuotation(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  const handleStatusUpdate = async (newStatus: string) => {
    setUpdatingStatus(newStatus);
    const res = await fetch(`/api/quotations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      const d = await res.json();
      setQuotation(d);
      toast.success(`Status updated to ${STATUS_CONFIG[newStatus]?.label}`);
    } else {
      toast.error("Failed to update status");
    }
    setUpdatingStatus(null);
  };

  const buildPDFBlob = async (): Promise<{ blob: Blob; filename: string } | null> => {
    if (!formRef.current || !quotation) return null;
    const html2canvas = (await import("html2canvas")).default;
    const { jsPDF } = await import("jspdf");

    const prevTransform = formRef.current.style.transform;
    formRef.current.style.transform = "none";

    const canvas = await html2canvas(formRef.current, {
      scale: 2, useCORS: false, allowTaint: true,
      backgroundColor: "#ffffff", logging: false, removeContainer: true,
    });

    if (formRef.current) formRef.current.style.transform = prevTransform;

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgH = (canvas.height * pageW) / canvas.width;

    let yPos = 0, remaining = imgH;
    while (remaining > 0) {
      if (yPos > 0) pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, yPos === 0 ? 0 : -yPos, pageW, imgH);
      yPos += pageH; remaining -= pageH;
    }

    return { blob: pdf.output("blob"), filename: `${quotation.quotationId}-quotation.pdf` };
  };

  const handleDownload = async () => {
    setActiveAction("download");
    try {
      const result = await buildPDFBlob();
      if (result) {
        const url = URL.createObjectURL(result.blob);
        const a = document.createElement("a");
        a.href = url; a.download = result.filename;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
        toast.success("PDF downloaded");
      }
    } catch { toast.error("Failed to generate PDF"); }
    finally { setActiveAction(null); }
  };

  if (loading || sessionStatus === "loading") {
    return <div className="space-y-3 max-w-2xl mx-auto">{[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-xl animate-pulse" />)}</div>;
  }
  if (!quotation || quotation.error) {
    return <div className="text-center py-12"><p className="text-gray-500">Quotation not found.</p><Link href="/quotations" className="text-brand-500 text-sm mt-2 inline-block">Back to Quotations</Link></div>;
  }

  const st = STATUS_CONFIG[quotation.status] || STATUS_CONFIG.DRAFT;
  const hasRate = (quotation.items || []).some((i: any) => i.rate);
  const hasGst  = (quotation.items || []).some((i: any) => i.gst);
  const colDefs = ["32px", "1.1fr", "1.9fr", "64px", ...(hasRate ? ["90px"] : []), ...(hasGst ? ["56px"] : [])];
  const gridCols = colDefs.join(" ");
  const isGenerating = activeAction !== null;

  // Totals
  let subtotal = 0, gstTotal = 0;
  if (hasRate) {
    for (const item of (quotation.items || [])) {
      const d = safeParseJSON(item.productDetails);
      const qty = parseFloat(extractQuantity(item.productCategory, d).value || "0") || 0;
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
          #quotation-print, #quotation-print * { visibility: visible; }
          #quotation-print { position: fixed; top: 0; left: 0; width: 210mm !important; box-shadow: none !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Controls */}
      <div className="flex items-center gap-2 mb-5 flex-wrap no-print">
        <Link href="/quotations" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <h1 className="text-lg font-bold text-gray-900 mr-auto">{quotation.quotationId}</h1>

        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${st.color}`}>
          {st.icon}{st.label}
        </span>

        {canEdit && (
          <Link
            href={`/quotations/${id}/edit`}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-brand-50 border border-brand-200 hover:bg-brand-100 text-brand-700 text-sm font-semibold rounded-xl transition-colors"
          >
            <Pencil className="w-4 h-4" />
            Edit
          </Link>
        )}

        <button onClick={handleDownload} disabled={isGenerating}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-800 hover:bg-gray-900 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60">
          {activeAction === "download" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Download PDF
        </button>

        <button onClick={() => window.print()} disabled={isGenerating}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-xl transition-colors disabled:opacity-60">
          <Printer className="w-4 h-4" />
          Print
        </button>
      </div>

      {/* Status update buttons */}
      {canEdit && (
        <div className="no-print bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">Update Status</p>
          <div className="flex flex-wrap gap-2">
            {[
              { status: "SENT",     label: "Mark Sent",     style: "border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-600 hover:text-white hover:border-blue-600" },
              { status: "ACCEPTED", label: "Mark Accepted", style: "border-green-300 text-green-700 bg-green-50 hover:bg-green-600 hover:text-white hover:border-green-600" },
              { status: "REJECTED", label: "Mark Rejected", style: "border-red-300 text-red-700 bg-red-50 hover:bg-red-500 hover:text-white hover:border-red-500" },
              { status: "EXPIRED",  label: "Mark Expired",  style: "border-orange-300 text-orange-700 bg-orange-50 hover:bg-orange-500 hover:text-white hover:border-orange-500" },
              { status: "DRAFT",    label: "Revert to Draft", style: "border-gray-300 text-gray-700 bg-gray-50 hover:bg-gray-600 hover:text-white hover:border-gray-600" },
            ].filter((b) => b.status !== quotation.status).map((btn) => (
              <button
                key={btn.status}
                onClick={() => handleStatusUpdate(btn.status)}
                disabled={updatingStatus !== null}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border-2 transition-all disabled:opacity-40 ${btn.style}`}
              >
                {updatingStatus === btn.status ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {isGenerating && <p className="no-print text-center text-sm text-gray-400 mb-3 animate-pulse">Generating PDF…</p>}

      {/* QUOTATION FORM — captured to PDF (A4-shaped on-screen preview, scaled
          to fit narrow viewports without affecting the captured size) */}
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
        id="quotation-print"
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
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flex: "1 1 0", minWidth: 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoSrc} alt="Ambiance" style={{ height: 56, width: "auto", objectFit: "contain", flexShrink: 0, marginTop: 2 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.15, letterSpacing: "-0.3px", color: "#0f172a" }}>
                  Ambiance Printing &amp; Packaging
                </div>
                <div style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 6, lineHeight: 1.55 }}>
                  Mandebar Road, Vill. Kheri Rangran<br />Yamunanagar, Haryana (India) 135001
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
                Quotation
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.7px", color: "#0f172a", marginTop: 8, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                {quotation.quotationId}
              </div>
              <div style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 6, lineHeight: 1.2 }}>
                {formatDate(quotation.createdAt)}
              </div>
            </div>
          </div>
        </div>

        {/* BODY */}
        <div style={{ padding: "24px 32px" }}>

          {/* Quotation For + Validity */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24,
            paddingBottom: 18, borderBottom: `1px solid ${BORDER}`,
          }}>
            <div>
              <div style={{ fontSize: 8.5, fontWeight: 700, color: TEXT_MUTED, letterSpacing: 1.2, marginBottom: 6, textTransform: "uppercase" as const }}>
                Quotation For
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", lineHeight: 1.3 }}>
                {quotation.customer?.partyName || "—"}
              </div>
              {quotation.customer?.location && (
                <div style={{ fontSize: 10.5, color: TEXT_MUTED, marginTop: 4, lineHeight: 1.4 }}>
                  {quotation.customer.location}
                </div>
              )}
            </div>
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "max-content 1fr", columnGap: 16, rowGap: 6, alignItems: "baseline" }}>
                {quotation.validUntil && (
                  <>
                    <div style={{ fontSize: 8.5, fontWeight: 700, color: TEXT_MUTED, letterSpacing: 1.2, textTransform: "uppercase" as const }}>
                      Valid Until
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", textAlign: "right" }}>
                      {formatDate(quotation.validUntil)}
                    </div>
                  </>
                )}
                <div style={{ fontSize: 8.5, fontWeight: 700, color: TEXT_MUTED, letterSpacing: 1.2, textTransform: "uppercase" as const }}>
                  Status
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT_DARK, textAlign: "right" }}>
                  {st.label.toUpperCase()}
                </div>
              </div>
            </div>
          </div>

          {/* Items table */}
          <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden" }}>
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

            {(quotation.items || []).map((item: any, idx: number, arr: any[]) => {
              const d: Record<string, string> = safeParseJSON(item.productDetails);
              const { value: qty, key: qKey } = extractQuantity(item.productCategory, d);
              const specPairs = Object.entries(d).filter(([k, v]) => v && k !== qKey).map(([k, v]) => {
                const lbl = k.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
                return `${lbl}: ${v}`;
              });
              return (
                <div key={item.id} style={{
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
                    {getProductCategoryLabel(item.productCategory)}
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

          {/* Totals */}
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
          {quotation.remarks && (
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
              <div style={{ fontSize: 11, color: "#374151", lineHeight: 1.55 }}>{quotation.remarks}</div>
            </div>
          )}

          {/* Terms */}
          {quotation.termsAndCond && (
            <div style={{ marginTop: 16, padding: "12px 16px", border: `1px solid ${BORDER}`, borderRadius: 6 }}>
              <div style={{ fontSize: 8.5, fontWeight: 700, color: TEXT_MUTED, textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 6 }}>
                Terms &amp; Conditions
              </div>
              <div style={{ fontSize: 10, color: "#374151", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{quotation.termsAndCond}</div>
            </div>
          )}

          {/* Footer */}
          <div style={{ marginTop: 32, paddingTop: 14, borderTop: `1px solid ${BORDER}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
              <div style={{ fontSize: 9, color: TEXT_DIM }}>
                Ambiance Printing &amp; Packaging · Yamunanagar, Haryana 135001
              </div>
              <div style={{ fontSize: 9, color: TEXT_DIM }}>
                info@pakzy3s.com · ambianceynr@gmail.com
              </div>
            </div>
            <div style={{ fontSize: 8.5, color: TEXT_DIM, textAlign: "center" }}>
              This is a computer-generated quotation. Subject to availability. Prices in INR.
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
