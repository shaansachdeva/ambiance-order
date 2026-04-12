"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { formatDate, getProductCategoryLabel, safeParseJSON } from "@/lib/utils";
import type { UserRole } from "@/types";
import toast, { Toaster } from "react-hot-toast";
import { ArrowLeft, Download, Loader2, Printer, Pencil, CheckCircle, XCircle, Clock, Send, FileText } from "lucide-react";

const HEADER_BG = "linear-gradient(135deg, #0d2b1a 0%, #1a5233 100%)";
const ACCENT    = "#1a5233";

const QUANTITY_KEY: Record<string, string> = {
  BOPP_TAPE: "boxes", BOPP_JUMBO: "quantity",
  THERMAL_ROLL: "boxes", BARCODE_LABEL: "quantity", COMPUTER_STATIONERY: "packets",
};

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

    const canvas = await html2canvas(formRef.current, {
      scale: 2, useCORS: false, allowTaint: true,
      backgroundColor: "#ffffff", logging: false, removeContainer: true,
    });

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
  const colDefs = ["28px", "1fr", "1.8fr", "60px", ...(hasRate ? ["90px"] : []), ...(hasGst ? ["56px"] : [])];
  const gridCols = colDefs.join(" ");
  const isGenerating = activeAction !== null;

  return (
    <div className="max-w-2xl mx-auto pb-12">
      <Toaster position="top-center" />
      <style>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          body * { visibility: hidden; }
          #quotation-print, #quotation-print * { visibility: visible; }
          #quotation-print { position: fixed; top: 0; left: 0; width: 100%; }
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

      {/* QUOTATION FORM — captured to PDF */}
      <div id="quotation-print" ref={formRef} style={{ fontFamily: "'Helvetica Neue', Arial, sans-serif", color: "#111", background: "#fff" }}>

        {/* HEADER */}
        <div style={{ background: HEADER_BG, padding: "20px 24px", color: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoSrc} alt="Ambiance" style={{ height: 44, width: "auto", objectFit: "contain", flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.2 }}>Ambiance Printing &amp; Packaging</div>
                <div style={{ fontSize: 9.5, opacity: 0.78, marginTop: 4, lineHeight: 1.55 }}>
                  Mandebar Road, Vill. Kheri Rangran<br />Yamunanagar, Haryana (India) 135001
                </div>
                <div style={{ fontSize: 9, opacity: 0.68, marginTop: 2 }}>info@pakzy3s.com &nbsp;·&nbsp; ambianceynr@gmail.com</div>
              </div>
            </div>
            <div style={{ flexShrink: 0, textAlign: "center", background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.35)", borderRadius: 10, padding: "10px 20px" }}>
              <div style={{ fontSize: 8.5, fontWeight: 600, opacity: 0.72, textTransform: "uppercase" as const, letterSpacing: 1.2, marginBottom: 4 }}>QUOTATION</div>
              <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.4px", lineHeight: 1 }}>{quotation.quotationId}</div>
            </div>
          </div>
        </div>

        {/* BODY */}
        <div style={{ padding: "22px 24px" }}>
          {/* Meta strip */}
          <div style={{ display: "flex", flexWrap: "wrap", marginBottom: 20, border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
            {([
              { label: "DATE",       value: formatDate(quotation.createdAt) },
              quotation.validUntil ? { label: "VALID UNTIL", value: formatDate(quotation.validUntil) } : null,
              quotation.customer?.partyName ? { label: "PARTY",    value: quotation.customer.partyName } : null,
              quotation.customer?.location  ? { label: "LOCATION", value: quotation.customer.location  } : null,
            ] as any[]).filter(Boolean).map((cell: any, i: number) => (
              <div key={i} style={{ flex: "1 1 40%", padding: "10px 14px", background: i % 2 === 0 ? "#f9fafb" : "#fff", borderRight: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb" }}>
                <div style={{ fontSize: 8, fontWeight: 600, color: "#6b7280", letterSpacing: 0.8, marginBottom: 2, textTransform: "uppercase" as const }}>{cell.label}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>{cell.value}</div>
              </div>
            ))}
          </div>

          {/* Table header */}
          <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: "0 8px", background: ACCENT, color: "#fff", padding: "9px 14px", borderRadius: "8px 8px 0 0", fontSize: 9.5, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>
            <div style={{ width: "100%" }}>#</div><div style={{ width: "100%" }}>Product</div><div style={{ width: "100%" }}>Specifications</div><div style={{ textAlign: "center", width: "100%" }}>Qty</div>
            {hasRate && <div style={{ textAlign: "right", width: "100%" }}>Price</div>}
            {hasGst  && <div style={{ textAlign: "right", width: "100%" }}>GST %</div>}
          </div>

          {/* Table rows */}
          {(quotation.items || []).map((item: any, idx: number) => {
            const d: Record<string, string> = safeParseJSON(item.productDetails);
            const qKey = QUANTITY_KEY[item.productCategory] || "";
            const qty = qKey ? (d[qKey] || "") : "";
            const specPairs = Object.entries(d).filter(([k, v]) => v && k !== qKey).map(([k, v]) => {
              const lbl = k.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
              return `${lbl}: ${v}`;
            });
            return (
              <div key={item.id} style={{ display: "grid", gridTemplateColumns: gridCols, gap: "0 8px", padding: "11px 14px", background: idx % 2 === 0 ? "#f9fafb" : "#fff", borderBottom: "1px solid #e5e7eb", borderLeft: "1px solid #e5e7eb", borderRight: "1px solid #e5e7eb" }}>
                <div style={{ fontSize: 11, color: "#6b7280", alignSelf: "start", paddingTop: 1 }}>{idx + 1}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#1f2937", alignSelf: "start" }}>{getProductCategoryLabel(item.productCategory)}</div>
                <div style={{ fontSize: 9.5, color: "#4b5563", lineHeight: 1.5 }}>{specPairs.join(" · ")}</div>
                <div style={{ fontSize: 11, fontWeight: 600, textAlign: "center", alignSelf: "start", width: "100%" }}>{qty}</div>
                {hasRate && <div style={{ fontSize: 11, fontWeight: 600, textAlign: "right", color: "#1f2937", width: "100%" }}>{item.rate ? `₹${item.rate}` : "—"}</div>}
                {hasGst  && <div style={{ fontSize: 11, textAlign: "right", color: "#6b7280", width: "100%" }}>{item.gst ? `${item.gst}%` : "—"}</div>}
              </div>
            );
          })}

          {/* Footer */}
          {(quotation.remarks || quotation.termsAndCond) && (
            <div style={{ marginTop: 16, padding: "12px 14px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "0 0 8px 8px" }}>
              {quotation.remarks && (
                <div style={{ marginBottom: quotation.termsAndCond ? 8 : 0 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" as const, letterSpacing: 0.8 }}>Remarks: </span>
                  <span style={{ fontSize: 10, color: "#374151" }}>{quotation.remarks}</span>
                </div>
              )}
              {quotation.termsAndCond && (
                <div>
                  <span style={{ fontSize: 9, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" as const, letterSpacing: 0.8 }}>Terms &amp; Conditions: </span>
                  <span style={{ fontSize: 10, color: "#374151" }}>{quotation.termsAndCond}</span>
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: 20, fontSize: 9, color: "#9ca3af", textAlign: "center" as const }}>
            This is a computer-generated quotation. For queries, contact us at ambianceynr@gmail.com
          </div>
        </div>
      </div>
    </div>
  );
}
