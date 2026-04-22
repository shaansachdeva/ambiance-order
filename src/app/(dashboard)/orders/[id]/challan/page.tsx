"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { formatDate, safeParseJSON } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";

const COMPANY = {
  name: "Ambiance Printing & Packaging",
  address: "Mandebar Road, Vill. Kheri Rangran, Opposite Bharat Gas Godown, Yamunanagar, Haryana (INDIA) 135001",
  email: "info@pakzy3s.com | ambianceynr@gmail.com",
};

/** Returns a human-readable quantity string for a given item */
function getItemQuantity(productCategory: string, details: Record<string, any>): string {
  switch (productCategory) {
    case "BOPP_TAPE": {
      const boxes = details.boxes ? `${details.boxes} Boxes` : "";
      const rolls = details.extraRolls ? `${details.extraRolls} Rolls` : "";
      return [boxes, rolls].filter(Boolean).join(" ") || "-";
    }
    case "BOPP_JUMBO":
      return details.quantity ? `${details.quantity} Rolls` : "-";
    case "THERMAL_ROLL":
      return details.boxes ? `${details.boxes} Boxes` : "-";
    case "BARCODE_LABEL":
      return details.quantity ? `${details.quantity} Rolls` : "-";
    case "COMPUTER_STATIONERY":
      return details.packets ? `${details.packets} Packets` : "-";
    default:
      return details.quantity || details.boxes || details.packets || "-";
  }
}

export default function ChallanPage() {
  const { id } = useParams();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { t, tStatus, tProduct } = useLanguage();

  useEffect(() => {
    fetch(`/api/orders/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setOrder(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="h-48 bg-gray-200 rounded-xl animate-pulse" />;
  }

  if (!order) {
    return <p className="text-center text-gray-500 py-12">Order not found.</p>;
  }

  const formattedId =
    typeof order.orderId === "number"
      ? `ORD-${String(order.orderId).padStart(4, "0")}`
      : order.orderId;

  const orderItems = order.items || [];

  return (
    <>
      <style>{`
        @media print {
          @page { size: A5; margin: 8mm; }
          body * { visibility: hidden; }
          #challan-print, #challan-print * { visibility: visible; }
          #challan-print { position: fixed; top: 0; left: 0; width: 100%; font-size: 10px; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="max-w-xl mx-auto">
        {/* Screen-only controls */}
        <div className="flex items-center gap-3 mb-4 no-print">
          <Link
            href={`/orders/${id}`}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <h1 className="text-lg font-bold text-gray-900">{t("challan.title")}</h1>
          <button
            onClick={() => window.print()}
            className="ml-auto flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-black"
          >
            <Printer className="w-4 h-4" />
            Print (A5)
          </button>
        </div>

        {/* Challan Document — A5 proportioned */}
        <div
          id="challan-print"
          className="bg-white border-2 border-black rounded-lg p-5 font-sans text-xs"
        >
          {/* Company Header */}
          <div className="border-b-2 border-black pb-3 mb-3">
            <div className="flex items-start gap-2 flex-wrap">
              <div className="flex-1 min-w-0">
                <h1 className="text-sm font-extrabold text-black tracking-tight uppercase leading-tight">
                  {COMPANY.name}
                </h1>
                <p className="text-gray-700 mt-0.5 leading-snug text-[10px]">{COMPANY.address}</p>
                <p className="text-gray-700 mt-0.5 text-[10px]">Email: {COMPANY.email}</p>
              </div>
              <div className="shrink-0">
                <p className="text-xs font-bold text-black uppercase tracking-wide border border-black px-2 py-1 whitespace-nowrap">
                  Delivery Challan
                </p>
              </div>
            </div>
          </div>

          {/* Challan & Order Details */}
          <div className="grid grid-cols-2 gap-0 mb-3 border border-gray-500 divide-x divide-gray-400 text-xs">
            <div className="p-2 space-y-0.5">
              <p><span className="font-semibold">Challan No.:</span> {order.challanNumber || "___________"}</p>
              <p><span className="font-semibold">Order ID:</span> {formattedId}</p>
              <p><span className="font-semibold">Date:</span> {formatDate(new Date())}</p>
            </div>
            <div className="p-2 space-y-0.5">
              <p><span className="font-semibold">Order Date:</span> {formatDate(order.createdAt)}</p>
              {order.deliveryDeadline && (
                <p><span className="font-semibold">Deliver By:</span> {formatDate(order.deliveryDeadline)}</p>
              )}
              <p><span className="font-semibold">Status:</span> {tStatus(order.status)}</p>
            </div>
          </div>

          {/* Consignee */}
          {order.customer && (
            <div className="mb-3 border border-gray-500 p-2">
              <p className="text-[9px] font-bold text-black uppercase tracking-wide mb-0.5">Consignee / Buyer</p>
              <p className="font-semibold text-black text-sm leading-tight">{order.customer.partyName}</p>
              {order.customer.location && (
                <p className="text-gray-600 mt-0.5">{order.customer.location}</p>
              )}
            </div>
          )}

          {/* Items Table */}
          <div className="overflow-x-auto mb-3">
          <table className="w-full border-collapse text-xs" style={{ minWidth: 320 }}>
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-500 px-1.5 py-1 text-left font-bold text-black w-6">#</th>
                <th className="border border-gray-500 px-1.5 py-1 text-left font-bold text-black">Product</th>
                <th className="border border-gray-500 px-1.5 py-1 text-left font-bold text-black">Specifications</th>
                <th className="border border-gray-500 px-1.5 py-1 text-center font-bold text-black w-20">Qty</th>
              </tr>
            </thead>
            <tbody>
              {orderItems.length > 0 ? (
                orderItems.map((item: any, idx: number) => {
                  const itemDetails = safeParseJSON(item.productDetails);
                  // Build spec string, excluding boxes/quantity/extraRolls (shown in Qty column)
                  const skipKeys = new Set(["boxes", "quantity", "packets", "extraRolls", "jumboCode"]);
                  const specStr = Object.entries(itemDetails)
                    .filter(([k, v]) => v && !skipKeys.has(k))
                    .map(([k, v]) => `${k.replace(/([A-Z])/g, " $1").trim()}: ${v}`)
                    .join(" | ");
                  const qty = getItemQuantity(item.productCategory, itemDetails);
                  return (
                    <tr key={item.id}>
                      <td className="border border-gray-400 px-1.5 py-1.5 text-center text-gray-700">{idx + 1}</td>
                      <td className="border border-gray-400 px-1.5 py-1.5 font-semibold text-black">{tProduct(item.productCategory)}</td>
                      <td className="border border-gray-400 px-1.5 py-1.5 text-gray-600">{specStr || "-"}</td>
                      <td className="border border-gray-400 px-1.5 py-1.5 text-center text-black font-medium">{qty}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="border border-gray-400 px-1.5 py-1.5 text-center text-gray-700">1</td>
                  <td className="border border-gray-400 px-1.5 py-1.5 font-semibold text-black">
                    {tProduct(order.productCategory)}
                  </td>
                  <td className="border border-gray-400 px-1.5 py-1.5 text-gray-600">
                    {(() => {
                      const d = safeParseJSON(order.productDetails);
                      const skipKeys = new Set(["boxes", "quantity", "packets", "extraRolls", "jumboCode"]);
                      return Object.entries(d)
                        .filter(([k, v]) => v && !skipKeys.has(k))
                        .map(([k, v]) => `${k.replace(/([A-Z])/g, " $1").trim()}: ${v}`)
                        .join(" | ");
                    })()}
                  </td>
                  <td className="border border-gray-400 px-1.5 py-1.5 text-center text-black font-medium">
                    {getItemQuantity(order.productCategory, safeParseJSON(order.productDetails))}
                  </td>
                </tr>
              )}
              {/* Filler rows */}
              {Array.from({ length: Math.max(0, 3 - (orderItems.length || 1)) }).map((_, i) => (
                <tr key={`empty-${i}`}>
                  <td className="border border-gray-400 px-1.5 py-3">&nbsp;</td>
                  <td className="border border-gray-400 px-1.5 py-3">&nbsp;</td>
                  <td className="border border-gray-400 px-1.5 py-3">&nbsp;</td>
                  <td className="border border-gray-400 px-1.5 py-3">&nbsp;</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          {/* Jumbo Code & Remarks */}
          {(order.jumboCode || order.remarks) && (
            <div className="mb-3 border border-gray-400 p-2 space-y-0.5 text-xs">
              {order.jumboCode && (
                <p><span className="font-semibold">Jumbo Code:</span> {order.jumboCode}</p>
              )}
              {order.remarks && (
                <p><span className="font-semibold">Remarks:</span> {order.remarks}</p>
              )}
            </div>
          )}

          {/* Declaration */}
          <div className="mb-4 border border-gray-400 p-2 text-[9px] text-gray-600 leading-snug">
            <p className="font-semibold text-black mb-0.5">Declaration:</p>
            <p>
              We hereby certify that the goods described in this challan are being sent for
              the purpose of supply/delivery and no financial transaction is involved at this
              stage. All particulars mentioned are true and correct to the best of our knowledge.
            </p>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-6 text-xs">
            <div className="text-center">
              <div className="h-10" />
              <div className="border-t border-black pt-1">
                <p className="font-semibold text-black">Authorised Signatory</p>
                <p className="text-gray-500 text-[9px]">{COMPANY.name}</p>
              </div>
            </div>
            <div className="text-center">
              <div className="h-10" />
              <div className="border-t border-black pt-1">
                <p className="font-semibold text-black">Receiver&apos;s Signature</p>
                <p className="text-gray-500 text-[9px]">Name &amp; Date</p>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-gray-200 text-center text-[8px] text-gray-400">
            Computer generated document
          </div>
        </div>
      </div>
    </>
  );
}
