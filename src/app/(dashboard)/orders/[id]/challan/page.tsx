"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getProductCategoryLabel, getStatusLabel, formatDate } from "@/lib/utils";
import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";

export default function ChallanPage() {
  const { id } = useParams();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
  const orderTotal = orderItems.reduce((s: number, i: any) => s + (i.amount || 0), 0);

  return (
    <div className="max-w-2xl mx-auto">
      {/* Screen-only controls */}
      <div className="flex items-center gap-3 mb-4 print:hidden">
        <Link
          href={`/orders/${id}`}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <h1 className="text-lg font-bold text-gray-900">Challan / Delivery Slip</h1>
        <button
          onClick={() => window.print()}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600"
        >
          <Printer className="w-4 h-4" />
          Print
        </button>
      </div>

      {/* Challan content */}
      <div className="bg-white border border-gray-300 rounded-lg p-6 print:border-black print:rounded-none print:p-8 print:shadow-none">
        {/* Header */}
        <div className="text-center border-b-2 border-gray-800 pb-4 mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Ambiance Printing & Packaging</h1>
          <p className="text-sm text-gray-600 mt-1">Delivery Challan</p>
        </div>

        {/* Order Info */}
        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div>
            <p><span className="font-semibold">Challan No:</span> {order.challanNumber || "___________"}</p>
            <p><span className="font-semibold">Order ID:</span> {formattedId}</p>
            <p><span className="font-semibold">Date:</span> {formatDate(new Date())}</p>
          </div>
          <div className="text-right">
            <p><span className="font-semibold">Status:</span> {getStatusLabel(order.status)}</p>
            <p><span className="font-semibold">Order Date:</span> {formatDate(order.createdAt)}</p>
            {order.deliveryDeadline && (
              <p><span className="font-semibold">Deadline:</span> {formatDate(order.deliveryDeadline)}</p>
            )}
          </div>
        </div>

        {/* Customer Info */}
        {order.customer && (
          <div className="bg-gray-50 rounded-lg p-3 mb-6 text-sm print:bg-white print:border print:border-gray-300">
            <p className="font-semibold text-gray-900">Party: {order.customer.partyName}</p>
            {order.customer.location && (
              <p className="text-gray-600">Location: {order.customer.location}</p>
            )}
          </div>
        )}

        {/* Items Table */}
        <table className="w-full text-sm border-collapse mb-6">
          <thead>
            <tr className="border-b-2 border-gray-800">
              <th className="text-left py-2 font-semibold">#</th>
              <th className="text-left py-2 font-semibold">Product</th>
              <th className="text-left py-2 font-semibold">Details</th>
              <th className="text-right py-2 font-semibold">Rate</th>
              <th className="text-right py-2 font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {orderItems.length > 0 ? (
              orderItems.map((item: any, idx: number) => {
                const itemDetails =
                  typeof item.productDetails === "string"
                    ? JSON.parse(item.productDetails)
                    : item.productDetails;
                const detailStr = Object.entries(itemDetails)
                  .filter(([, v]) => v)
                  .map(([k, v]) => `${k.replace(/([A-Z])/g, " $1").trim()}: ${v}`)
                  .join(", ");
                return (
                  <tr key={item.id} className="border-b border-gray-200">
                    <td className="py-2">{idx + 1}</td>
                    <td className="py-2 font-medium">{getProductCategoryLabel(item.productCategory)}</td>
                    <td className="py-2 text-gray-600 text-xs">{detailStr}</td>
                    <td className="py-2 text-right">{item.rate ? `Rs. ${item.rate}` : "-"}</td>
                    <td className="py-2 text-right">{item.amount ? `Rs. ${item.amount.toLocaleString("en-IN")}` : "-"}</td>
                  </tr>
                );
              })
            ) : (
              <tr className="border-b border-gray-200">
                <td className="py-2">1</td>
                <td className="py-2 font-medium">{getProductCategoryLabel(order.productCategory)}</td>
                <td className="py-2 text-gray-600 text-xs">
                  {(() => {
                    const d = typeof order.productDetails === "string" ? JSON.parse(order.productDetails) : order.productDetails;
                    return Object.entries(d)
                      .filter(([, v]) => v)
                      .map(([k, v]) => `${k.replace(/([A-Z])/g, " $1").trim()}: ${v}`)
                      .join(", ");
                  })()}
                </td>
                <td className="py-2 text-right">-</td>
                <td className="py-2 text-right">-</td>
              </tr>
            )}
          </tbody>
          {orderTotal > 0 && (
            <tfoot>
              <tr className="border-t-2 border-gray-800">
                <td colSpan={4} className="py-2 text-right font-bold">Total:</td>
                <td className="py-2 text-right font-bold">Rs. {orderTotal.toLocaleString("en-IN")}</td>
              </tr>
            </tfoot>
          )}
        </table>

        {/* Jumbo Code & Remarks */}
        {order.jumboCode && (
          <p className="text-sm mb-2"><span className="font-semibold">Jumbo Code:</span> {order.jumboCode}</p>
        )}
        {order.remarks && (
          <p className="text-sm mb-4"><span className="font-semibold">Remarks:</span> {order.remarks}</p>
        )}

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-8 mt-12 pt-4 text-sm">
          <div className="text-center">
            <div className="border-t border-gray-400 pt-2">
              <p className="font-semibold">Prepared By</p>
            </div>
          </div>
          <div className="text-center">
            <div className="border-t border-gray-400 pt-2">
              <p className="font-semibold">Received By</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
