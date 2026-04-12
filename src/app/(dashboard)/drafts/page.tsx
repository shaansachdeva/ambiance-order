"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileEdit, Trash2, ChevronRight, Clock, Package, FileText, Inbox } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

interface DraftEntry {
  savedAt?: string;
  discardedAt?: string;
  customerId?: string;
  items?: any[];
  remarks?: string;
  type?: "order" | "quotation";
}

function formatRelativeTime(dateStr?: string) {
  if (!dateStr) return "unknown time";
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function DraftCard({
  draft,
  type,
  category,
  continueUrl,
  onDiscard,
  onDelete,
}: {
  draft: DraftEntry;
  type: "saved" | "discarded";
  category: "order" | "quotation";
  continueUrl: string;
  onDiscard?: () => void;
  onDelete: () => void;
}) {
  const itemCount = draft.items?.filter((i: any) => i.productCategory)?.length || 0;
  const dateStr = type === "saved" ? draft.savedAt : draft.discardedAt;
  const Icon = category === "order" ? Package : FileText;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${category === "order" ? "bg-brand-50" : "bg-blue-50"}`}>
          <Icon className={`w-4 h-4 ${category === "order" ? "text-brand-500" : "text-blue-500"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900 capitalize">{category} Draft</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${type === "saved" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"}`}>
              {type === "saved" ? "Saved" : "Discarded"}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatRelativeTime(dateStr)}</span>
            {itemCount > 0 && <span>{itemCount} product{itemCount !== 1 ? "s" : ""}</span>}
            {draft.customerId && <span>Customer selected</span>}
          </div>
          {draft.remarks && (
            <p className="text-xs text-gray-500 mt-1 truncate">{draft.remarks}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {type === "saved" && (
            <Link
              href={continueUrl}
              className="flex items-center gap-1 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold rounded-lg"
            >
              Continue <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          )}
          {type === "saved" && onDiscard && (
            <button onClick={onDiscard} className="px-3 py-1.5 border border-gray-300 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50">
              Discard
            </button>
          )}
          <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DraftsPage() {
  const router = useRouter();
  const [orderDraft, setOrderDraft] = useState<DraftEntry | null>(null);
  const [quotationDraft, setQuotationDraft] = useState<DraftEntry | null>(null);
  const [discardedOrders, setDiscardedOrders] = useState<DraftEntry[]>([]);
  const [discardedQuotations, setDiscardedQuotations] = useState<DraftEntry[]>([]);
  const [activeTab, setActiveTab] = useState<"saved" | "discarded">("saved");

  useEffect(() => {
    try {
      const od = localStorage.getItem("order_draft");
      if (od) setOrderDraft(JSON.parse(od));
      const qd = localStorage.getItem("quotation_draft");
      if (qd) setQuotationDraft(JSON.parse(qd));
      const ddo = localStorage.getItem("discarded_drafts");
      if (ddo) setDiscardedOrders(JSON.parse(ddo));
      const ddq = localStorage.getItem("discarded_quotations");
      if (ddq) setDiscardedQuotations(JSON.parse(ddq));
    } catch {}
  }, []);

  const discardOrderDraft = () => {
    if (!orderDraft) return;
    const existing: DraftEntry[] = JSON.parse(localStorage.getItem("discarded_drafts") || "[]");
    existing.unshift({ ...orderDraft, discardedAt: new Date().toISOString(), type: "order" });
    localStorage.setItem("discarded_drafts", JSON.stringify(existing.slice(0, 10)));
    localStorage.removeItem("order_draft");
    setDiscardedOrders(existing.slice(0, 10));
    setOrderDraft(null);
    toast.success("Draft moved to discarded");
  };

  const discardQuotationDraft = () => {
    if (!quotationDraft) return;
    const existing: DraftEntry[] = JSON.parse(localStorage.getItem("discarded_quotations") || "[]");
    existing.unshift({ ...quotationDraft, discardedAt: new Date().toISOString(), type: "quotation" });
    localStorage.setItem("discarded_quotations", JSON.stringify(existing.slice(0, 10)));
    localStorage.removeItem("quotation_draft");
    setDiscardedQuotations(existing.slice(0, 10));
    setQuotationDraft(null);
    toast.success("Draft moved to discarded");
  };

  const deleteDiscardedOrder = (idx: number) => {
    const updated = discardedOrders.filter((_, i) => i !== idx);
    localStorage.setItem("discarded_drafts", JSON.stringify(updated));
    setDiscardedOrders(updated);
    toast.success("Removed");
  };

  const deleteDiscardedQuotation = (idx: number) => {
    const updated = discardedQuotations.filter((_, i) => i !== idx);
    localStorage.setItem("discarded_quotations", JSON.stringify(updated));
    setDiscardedQuotations(updated);
    toast.success("Removed");
  };

  const clearAllDiscarded = () => {
    if (!confirm("Clear all discarded drafts? This cannot be undone.")) return;
    localStorage.removeItem("discarded_drafts");
    localStorage.removeItem("discarded_quotations");
    setDiscardedOrders([]);
    setDiscardedQuotations([]);
    toast.success("All discarded drafts cleared");
  };

  const savedCount = (orderDraft ? 1 : 0) + (quotationDraft ? 1 : 0);
  const discardedCount = discardedOrders.length + discardedQuotations.length;

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-10">
      <Toaster position="top-right" />

      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <FileEdit className="w-5 h-5 text-brand-500" />
          Drafts
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Your saved and discarded form drafts</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab("saved")}
          className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${activeTab === "saved" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
        >
          Saved {savedCount > 0 && <span className="ml-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full">{savedCount}</span>}
        </button>
        <button
          onClick={() => setActiveTab("discarded")}
          className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${activeTab === "discarded" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
        >
          Discarded {discardedCount > 0 && <span className="ml-1 px-1.5 py-0.5 bg-gray-200 text-gray-600 text-[10px] font-bold rounded-full">{discardedCount}</span>}
        </button>
      </div>

      {/* Saved Tab */}
      {activeTab === "saved" && (
        <div className="space-y-3">
          {savedCount === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
              <Inbox className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No saved drafts.</p>
              <p className="text-xs text-gray-400 mt-1">When you start filling an order or quotation form and navigate away, it&apos;s automatically saved here.</p>
            </div>
          ) : (
            <>
              {orderDraft && (
                <DraftCard
                  draft={orderDraft}
                  type="saved"
                  category="order"
                  continueUrl="/orders/new"
                  onDiscard={discardOrderDraft}
                  onDelete={() => { localStorage.removeItem("order_draft"); setOrderDraft(null); toast.success("Draft deleted"); }}
                />
              )}
              {quotationDraft && (
                <DraftCard
                  draft={quotationDraft}
                  type="saved"
                  category="quotation"
                  continueUrl="/quotations/new"
                  onDiscard={discardQuotationDraft}
                  onDelete={() => { localStorage.removeItem("quotation_draft"); setQuotationDraft(null); toast.success("Draft deleted"); }}
                />
              )}
            </>
          )}
        </div>
      )}

      {/* Discarded Tab */}
      {activeTab === "discarded" && (
        <div className="space-y-3">
          {discardedCount === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
              <Inbox className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No discarded drafts.</p>
            </div>
          ) : (
            <>
              <div className="flex justify-end">
                <button onClick={clearAllDiscarded} className="text-xs text-red-500 hover:text-red-600 font-medium">
                  Clear all discarded
                </button>
              </div>
              {discardedOrders.map((d, i) => (
                <DraftCard
                  key={`do-${i}`}
                  draft={d}
                  type="discarded"
                  category="order"
                  continueUrl="/orders/new"
                  onDelete={() => deleteDiscardedOrder(i)}
                />
              ))}
              {discardedQuotations.map((d, i) => (
                <DraftCard
                  key={`dq-${i}`}
                  draft={d}
                  type="discarded"
                  category="quotation"
                  continueUrl="/quotations/new"
                  onDelete={() => deleteDiscardedQuotation(i)}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
