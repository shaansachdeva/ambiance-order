"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import toast, { Toaster } from "react-hot-toast";
import {
  Building2, Phone, Mail, Calendar, User as UserIcon,
  History, Send, ArrowLeft, Loader2, IndianRupee, Camera, MapPin,
  Package, MessageSquare, Pencil, AlertTriangle, ExternalLink, ClipboardList,
  Sparkles, Clock,
} from "lucide-react";
import { format } from "date-fns";
import { useSession } from "next-auth/react";
import { getProductCategoryLabel } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface LeadUser { name: string }
interface LeadFollowUp {
  id: string;
  notes: string;
  createdAt: string;
  user: LeadUser;
}
interface LeadContact {
  id: string;
  name: string;
  designation: string | null;
  phone: string | null;
  email: string | null;
  isPrimary: boolean;
}
interface LeadItem {
  id: string;
  productCategory: string;
  productDetails: string;
  rate: number | null;
}

interface Lead {
  id: string;
  companyName: string;
  location: string | null;
  remarks: string | null;
  status: string;
  closeReason: string | null;
  nextFollowUp: string | null;
  salesPerson: LeadUser;
  followUps: LeadFollowUp[];
  contacts: LeadContact[];
  items: LeadItem[];
  createdAt: string;
  visitPhoto: string | null;
  visitLatitude: number | null;
  visitLongitude: number | null;
}

export default function LeadDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { data: session } = useSession();
  const { t } = useLanguage();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);

  // Dialogs & Form states
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [nextFollowUpDate, setNextFollowUpDate] = useState("");
  const [savingFollowUp, setSavingFollowUp] = useState(false);

  const [status, setStatus] = useState("");
  const [closeReason, setCloseReason] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    fetchLead();
  }, [id]);

  const fetchLead = async () => {
    try {
      const res = await fetch(`/api/leads/${id}`);
      if (res.ok) {
        const data = await res.json();
        setLead(data);
        setStatus(data.status);
      } else {
        toast.error("Failed to load lead");
        router.push("/leads");
      }
    } catch {
      toast.error("Error loading lead");
    } finally {
      setLoading(false);
    }
  };

  const handleAddFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpNotes.trim()) return;

    setSavingFollowUp(true);
    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: 'FOLLOW_UP',
          notes: followUpNotes,
          nextFollowUp: nextFollowUpDate || null
        }),
      });

      if (res.ok) {
        toast.success("Follow-up added");
        setFollowUpNotes("");
        setNextFollowUpDate("");
        fetchLead();
      } else {
        toast.error("Failed to add follow-up");
      }
    } catch {
      toast.error("Error adding follow-up");
    } finally {
      setSavingFollowUp(false);
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === 'CLOSED_LOST' && !closeReason.trim()) {
      toast.error("Please provide a reason for closing the lead");
      return;
    }

    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: 'UPDATE_STATUS',
          status,
          closeReason: status === 'CLOSED_LOST' ? closeReason : null
        }),
      });

      if (res.ok) {
        toast.success("Status updated");
        if (status === 'CONVERTED') {
          toast.success("Lead converted! Review and confirm the order details.");
          router.push(`/orders/new?partyName=${encodeURIComponent(lead?.companyName || '')}&leadId=${id}`);
        } else {
          fetchLead();
        }
      } else {
        toast.error("Failed to update status");
      }
    } catch {
      toast.error("Error updating status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="h-24 bg-white rounded-2xl border border-gray-200/80 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-48 bg-white rounded-2xl border border-gray-200/80 animate-pulse md:col-span-1" />
          <div className="h-48 bg-white rounded-2xl border border-gray-200/80 animate-pulse md:col-span-2" />
        </div>
      </div>
    );
  }

  if (!lead) return null;

  // Status badge style (matches leads list)
  const STATUS_STYLE: Record<string, { badge: string; accent: string; dot: string }> = {
    NEW:         { badge: "bg-blue-50 text-blue-700 ring-blue-100",       accent: "bg-blue-400",    dot: "bg-blue-500" },
    FOLLOW_UP:   { badge: "bg-amber-50 text-amber-700 ring-amber-100",    accent: "bg-amber-400",   dot: "bg-amber-500" },
    CONVERTED:   { badge: "bg-emerald-50 text-emerald-700 ring-emerald-100", accent: "bg-emerald-400", dot: "bg-emerald-500" },
    CLOSED_LOST: { badge: "bg-rose-50 text-rose-700 ring-rose-100",       accent: "bg-rose-400",    dot: "bg-rose-500" },
  };
  const sty = STATUS_STYLE[lead.status] || { badge: "bg-gray-50 text-gray-700 ring-gray-100", accent: "bg-gray-300", dot: "bg-gray-400" };

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const followUpDate = lead.nextFollowUp ? new Date(lead.nextFollowUp) : null;
  if (followUpDate) followUpDate.setHours(0, 0, 0, 0);
  const isFollowUpOverdue = followUpDate && followUpDate < today && lead.status !== "CONVERTED" && lead.status !== "CLOSED_LOST";
  const isFollowUpToday = followUpDate && followUpDate.getTime() === today.getTime();
  const isClosed = lead.status === "CONVERTED" || lead.status === "CLOSED_LOST";
  const primaryContact = lead.contacts.find((c) => c.isPrimary) || lead.contacts[0];

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-24 md:pb-6">
      <Toaster position="top-right" />

      {/* ── Header card ──────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200/80 overflow-hidden">
        {/* Status accent bar */}
        <div className={`h-1 ${sty.accent}`} />
        <div className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <Link
              href="/leads"
              className="p-2 -ml-1 hover:bg-gray-100 rounded-xl transition-colors active:scale-95 flex-shrink-0"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">{lead.companyName}</h1>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg ring-1 text-[10px] font-bold ${sty.badge}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${sty.dot}`} />
                  {lead.status.replace("_", " ")}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                {lead.location && (
                  <span className="flex items-center gap-1 font-medium text-gray-700">
                    <MapPin className="w-3.5 h-3.5 text-gray-400" />
                    {lead.location}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <UserIcon className="w-3.5 h-3.5 text-gray-400" />
                  {lead.salesPerson.name}
                </span>
                <span className="flex items-center gap-1 text-gray-400">
                  <Calendar className="w-3.5 h-3.5" />
                  {format(new Date(lead.createdAt), "MMM d, yyyy")}
                </span>
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex flex-wrap gap-1.5 mt-3 -mb-1">
            {primaryContact?.phone && (
              <a
                href={`tel:${primaryContact.phone}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-all active:scale-[0.97]"
              >
                <Phone className="w-3.5 h-3.5" />
                Call
              </a>
            )}
            {primaryContact?.email && (
              <a
                href={`mailto:${primaryContact.email}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-xl text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-all active:scale-[0.97]"
              >
                <Mail className="w-3.5 h-3.5" />
                Email
              </a>
            )}
            {!isClosed && (
              <Link
                href={`/orders/new?partyName=${encodeURIComponent(lead.companyName)}&leadId=${lead.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 border border-brand-200 rounded-xl text-xs font-semibold text-brand-700 hover:bg-brand-100 transition-all active:scale-[0.97]"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Convert to Order
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── Status banners ──────────────────────────────────── */}
      {isFollowUpOverdue && (
        <div className="bg-gradient-to-r from-rose-50 to-rose-50/40 border border-rose-200 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-100 ring-1 ring-rose-200 flex items-center justify-center flex-shrink-0 animate-pulse">
            <AlertTriangle className="w-4 h-4 text-rose-700" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-rose-900">Follow-up Overdue</p>
            <p className="text-xs text-rose-700/90 mt-0.5">
              Was due {format(new Date(lead.nextFollowUp!), "MMM d, yyyy")} — {Math.ceil((today.getTime() - followUpDate!.getTime()) / (1000 * 60 * 60 * 24))} day(s) ago.
            </p>
          </div>
        </div>
      )}
      {isFollowUpToday && (
        <div className="bg-gradient-to-r from-amber-50 to-amber-50/40 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 ring-1 ring-amber-200 flex items-center justify-center flex-shrink-0">
            <Clock className="w-4 h-4 text-amber-700" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-900">Follow up today</p>
            <p className="text-xs text-amber-700/90 mt-0.5">Reach out before end of day.</p>
          </div>
        </div>
      )}
      {lead.status === "CLOSED_LOST" && lead.closeReason && (
        <div className="bg-gradient-to-r from-rose-50 to-rose-50/40 border border-rose-200 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-100 ring-1 ring-rose-200 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-4 h-4 text-rose-700" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-rose-900">{t("leads.reasonForLoss")}</p>
            <p className="text-xs text-rose-700/90 mt-0.5">{lead.closeReason}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* ── Left column ──────────────────────────────────── */}
        <div className="md:col-span-1 space-y-4">

          {/* Visit Proof */}
          {(lead.visitPhoto || lead.visitLatitude) && (
            <div className="bg-white rounded-2xl border border-gray-200/80 p-4 sm:p-5 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center">
                  <Camera className="w-4 h-4 text-brand-600" />
                </div>
                <h2 className="text-sm font-bold text-gray-900">Visit Proof</h2>
              </div>
              {lead.visitPhoto && (
                <img
                  src={lead.visitPhoto}
                  alt="Visit photo"
                  className="w-full rounded-xl ring-1 ring-gray-200 object-cover max-h-48"
                />
              )}
              <div className="flex flex-col gap-1.5 text-xs text-gray-600">
                {lead.visitLatitude && lead.visitLongitude && (
                  <a
                    href={`https://www.google.com/maps?q=${lead.visitLatitude},${lead.visitLongitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-brand-700 font-semibold hover:text-brand-800"
                  >
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                    {lead.visitLatitude.toFixed(5)}, {lead.visitLongitude.toFixed(5)}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                <div className="flex items-center gap-1.5 text-gray-500">
                  <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <span>Entered: {format(new Date(lead.createdAt), "dd MMM yyyy, h:mm a")}</span>
                </div>
              </div>
            </div>
          )}

          {/* Schedule */}
          {lead.nextFollowUp && !isClosed && (
            <div className="bg-white rounded-2xl border border-gray-200/80 p-4 sm:p-5">
              <div className="flex items-center gap-2.5 mb-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ring-1 ${
                  isFollowUpOverdue ? "bg-rose-50 ring-rose-100" : isFollowUpToday ? "bg-amber-50 ring-amber-100" : "bg-brand-50 ring-brand-100"
                }`}>
                  <Calendar className={`w-4 h-4 ${
                    isFollowUpOverdue ? "text-rose-600" : isFollowUpToday ? "text-amber-600" : "text-brand-600"
                  }`} />
                </div>
                <h2 className="text-sm font-bold text-gray-900">{t("leads.nextFollowUp")}</h2>
              </div>
              <p className={`text-base font-semibold ${
                isFollowUpOverdue ? "text-rose-700" : isFollowUpToday ? "text-amber-700" : "text-gray-900"
              }`}>
                {format(new Date(lead.nextFollowUp), "PPP")}
              </p>
            </div>
          )}

          {/* Change Status */}
          <div className="bg-white rounded-2xl border border-gray-200/80 p-4 sm:p-5">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-xl bg-gray-50 ring-1 ring-gray-200 flex items-center justify-center">
                <Pencil className="w-4 h-4 text-gray-600" />
              </div>
              <h2 className="text-sm font-bold text-gray-900">{t("leads.changeStatus")}</h2>
            </div>
            <form onSubmit={handleUpdateStatus} className="space-y-3">
              <div>
                <label className="block text-[11px] uppercase tracking-wide font-semibold text-gray-500 mb-1.5">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 bg-white transition-all"
                >
                  <option value="NEW">{t("leads.statusNew")}</option>
                  <option value="FOLLOW_UP">{t("leads.statusFollowUp")}</option>
                  <option value="CONVERTED">{t("leads.statusConverted")}</option>
                  <option value="CLOSED_LOST">{t("leads.statusClosedLost")}</option>
                </select>
              </div>
              {status === "CLOSED_LOST" && (
                <div>
                  <label className="block text-[11px] uppercase tracking-wide font-semibold text-gray-500 mb-1.5">{t("leads.reasonForClosing")}</label>
                  <textarea
                    value={closeReason}
                    onChange={(e) => setCloseReason(e.target.value)}
                    required
                    placeholder="E.g., Price too high, went to competitor..."
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 resize-none placeholder:text-gray-400 transition-all"
                    rows={3}
                  />
                </div>
              )}
              <button
                type="submit"
                disabled={updatingStatus || (status === lead.status && (!closeReason || status !== "CLOSED_LOST"))}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl disabled:opacity-50 active:scale-[0.97] transition-all shadow-sm hover:shadow"
              >
                {updatingStatus
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> {t("leads.updatingStatus")}</>
                  : status === "CONVERTED" ? <><Sparkles className="w-4 h-4" /> {t("leads.convertToOrder")}</>
                  : t("leads.updateStatus")}
              </button>
            </form>
          </div>
        </div>

        {/* ── Right column ─────────────────────────────────── */}
        <div className="md:col-span-2 space-y-4">

          {/* Contacts */}
          <div className="bg-white rounded-2xl border border-gray-200/80 p-4 sm:p-5">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-xl bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center">
                <UserIcon className="w-4 h-4 text-brand-600" />
              </div>
              <h2 className="text-sm font-bold text-gray-900">
                {t("leads.contactPersons")}
                <span className="text-gray-400 font-medium ml-1.5">({lead.contacts.length})</span>
              </h2>
            </div>
            {lead.contacts.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">{t("leads.noContacts")}</p>
            ) : (
              <div className="space-y-2">
                {lead.contacts.map((contact) => (
                  <div key={contact.id} className="bg-gray-50/70 ring-1 ring-gray-200/80 rounded-xl p-3 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900 truncate">{contact.name}</p>
                        {contact.isPrimary && (
                          <span className="inline-flex items-center px-1.5 py-0.5 bg-brand-100 text-brand-700 ring-1 ring-brand-200 text-[10px] font-bold rounded-md">
                            PRIMARY
                          </span>
                        )}
                      </div>
                      {contact.designation && <p className="text-[11px] text-gray-500 mt-0.5">{contact.designation}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      {contact.phone && (
                        <a href={`tel:${contact.phone}`} className="inline-flex items-center gap-1 text-xs text-gray-700 hover:text-brand-700 font-medium">
                          <Phone className="w-3 h-3" />
                          {contact.phone}
                        </a>
                      )}
                      {contact.email && (
                        <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-1 text-xs text-gray-700 hover:text-brand-700 font-medium truncate">
                          <Mail className="w-3 h-3" />
                          {contact.email}
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Requested Products */}
          <div className="bg-white rounded-2xl border border-gray-200/80 p-4 sm:p-5">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-xl bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center">
                <Package className="w-4 h-4 text-brand-600" />
              </div>
              <h2 className="text-sm font-bold text-gray-900">
                {t("leads.requestedProducts")}
                <span className="text-gray-400 font-medium ml-1.5">({lead.items.length})</span>
              </h2>
            </div>
            {lead.items.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">{t("leads.noProducts")}</p>
            ) : (
              <div className="space-y-2">
                {lead.items.map((item, idx) => {
                  let detailsObj: any = {};
                  try { detailsObj = JSON.parse(item.productDetails); } catch {}
                  return (
                    <div key={item.id} className="rounded-xl border border-gray-200/80 overflow-hidden">
                      <div className="px-4 py-2.5 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200/80 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-6 h-6 rounded-lg bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center ring-1 ring-brand-200 flex-shrink-0">
                            {idx + 1}
                          </span>
                          <span className="text-sm font-semibold text-gray-900 truncate">
                            {getProductCategoryLabel(item.productCategory)}
                          </span>
                        </div>
                        {item.rate != null && (
                          <span className="inline-flex items-center gap-0.5 text-xs font-bold text-brand-700 flex-shrink-0">
                            <IndianRupee className="w-3 h-3" />
                            {item.rate}
                          </span>
                        )}
                      </div>
                      {Object.keys(detailsObj).length > 0 && (
                        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2.5">
                          {Object.entries(detailsObj).filter(([, v]) => v).map(([k, v]) => {
                            const label = k.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase());
                            return (
                              <div key={k} className="min-w-0">
                                <span className="block text-[10px] uppercase tracking-wide font-semibold text-gray-500">{label}</span>
                                <span className="text-sm text-gray-900 font-medium truncate block">{String(v)}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {lead.remarks && (
              <div className="mt-4 pt-4 border-t border-gray-200/70">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <ClipboardList className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-[11px] uppercase tracking-wide font-semibold text-gray-500">{t("leads.remarksNotes")}</span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{lead.remarks}</p>
              </div>
            )}
          </div>

          {/* Follow-up history */}
          <div className="bg-white rounded-2xl border border-gray-200/80 p-4 sm:p-5">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-xl bg-gray-50 ring-1 ring-gray-200 flex items-center justify-center">
                <History className="w-4 h-4 text-gray-600" />
              </div>
              <h2 className="text-sm font-bold text-gray-900">
                {t("leads.followUpHistory")}
                <span className="text-gray-400 font-medium ml-1.5">({lead.followUps.length})</span>
              </h2>
            </div>

            {/* Add follow-up form */}
            {!isClosed && (
              <form onSubmit={handleAddFollowUp} className="bg-gray-50/70 ring-1 ring-gray-200/80 rounded-xl p-3 space-y-2.5 mb-4">
                <div className="flex items-start gap-2">
                  <div className="w-7 h-7 rounded-lg bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <MessageSquare className="w-3.5 h-3.5 text-brand-600" />
                  </div>
                  <textarea
                    value={followUpNotes}
                    onChange={(e) => setFollowUpNotes(e.target.value)}
                    placeholder={t("leads.followUpNotes")}
                    required
                    rows={2}
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 bg-white resize-none placeholder:text-gray-400 transition-all"
                  />
                </div>
                <div className="flex items-end gap-2 ml-9">
                  <div className="flex-1">
                    <label className="text-[10px] uppercase tracking-wide font-semibold text-gray-500 mb-1 block">{t("leads.setNextFollowUp")}</label>
                    <input
                      type="date"
                      value={nextFollowUpDate}
                      onChange={(e) => setNextFollowUpDate(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={savingFollowUp || !followUpNotes.trim()}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow active:scale-[0.97] disabled:opacity-50 transition-all"
                  >
                    {savingFollowUp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    {t("leads.saveNote")}
                  </button>
                </div>
              </form>
            )}

            {lead.followUps.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6 ring-1 ring-dashed ring-gray-200 rounded-xl">{t("leads.noFollowUps")}</p>
            ) : (
              <div className="relative pl-5 ml-1 space-y-3 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-px before:bg-gray-200">
                {lead.followUps.map((fu) => (
                  <div key={fu.id} className="relative">
                    <div className="absolute -left-[19px] top-3 w-2 h-2 rounded-full bg-brand-500 ring-4 ring-white" />
                    <div className="bg-gray-50/70 ring-1 ring-gray-200/80 rounded-xl px-3 py-2.5">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-semibold text-gray-900">{fu.user.name}</span>
                        <span className="text-[10px] text-gray-400 ml-auto">
                          {format(new Date(fu.createdAt), "MMM d, yyyy · h:mm a")}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{fu.notes}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
