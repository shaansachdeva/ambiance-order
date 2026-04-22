"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import toast, { Toaster } from "react-hot-toast";
import {
  Building2, Phone, Mail, Calendar, User as UserIcon,
  History, Send, ArrowLeft, Loader2, IndianRupee, Camera, MapPin
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
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-brand-500" /></div>;
  }

  if (!lead) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="flex items-center gap-4 justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/leads" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{lead.companyName}</h1>
            {lead.location && (
              <p className="text-sm text-gray-600 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                {lead.location}
              </p>
            )}
            <p className="text-sm text-gray-500 flex items-center gap-2 flex-wrap">
              <span>{t("leads.salesRep")} <span className="font-medium text-gray-700">{lead.salesPerson.name}</span></span>
              <span className="text-gray-300">•</span>
              <span className="flex items-center gap-1 text-gray-500">
                <Calendar className="w-3.5 h-3.5" />
                {format(new Date(lead.createdAt), "dd MMM yyyy, h:mm a")}
              </span>
            </p>
          </div>
        </div>
        <div>
          <span className="px-3 py-1 rounded-full text-sm font-semibold bg-gray-100 text-gray-800">
            {lead.status.replace("_", " ")}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Info & Status */}
        <div className="md:col-span-1 space-y-6">
          {/* Visit Proof Card */}
          {(lead.visitPhoto || lead.visitLatitude) && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
              <h2 className="font-semibold text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2">
                <Camera className="w-4 h-4 text-brand-500" />
                Visit Proof
              </h2>
              {lead.visitPhoto && (
                <img
                  src={lead.visitPhoto}
                  alt="Visit photo"
                  className="w-full rounded-lg border border-gray-200 object-cover max-h-48"
                />
              )}
              <div className="flex flex-col gap-1.5 text-xs text-gray-600">
                {lead.visitLatitude && lead.visitLongitude && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                    <a
                      href={`https://www.google.com/maps?q=${lead.visitLatitude},${lead.visitLongitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-600 underline hover:text-brand-700"
                    >
                      {lead.visitLatitude.toFixed(5)}, {lead.visitLongitude.toFixed(5)}
                    </a>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span>Entered: {format(new Date(lead.createdAt), "dd MMM yyyy, h:mm a")}</span>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
            <h2 className="font-semibold text-gray-900 border-b border-gray-100 pb-2">{t("leads.statusSchedule")}</h2>
            
            {lead.nextFollowUp && lead.status !== 'CONVERTED' && lead.status !== 'CLOSED_LOST' && (
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-brand-500 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">{t("leads.nextFollowUp")}</p>
                  <p className="text-sm font-medium text-gray-900">{format(new Date(lead.nextFollowUp), "PPP")}</p>
                </div>
              </div>
            )}
            
            {lead.closeReason && lead.status === 'CLOSED_LOST' && (
              <div className="mt-3 p-3 bg-red-50 text-red-800 rounded-lg text-sm border border-red-100">
                <p className="font-semibold mb-1">{t("leads.reasonForLoss")}</p>
                <p>{lead.closeReason}</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
            <h2 className="font-semibold text-gray-900 border-b border-gray-100 pb-2">{t("leads.changeStatus")}</h2>
            <form onSubmit={handleUpdateStatus} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                <select 
                  value={status} 
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="NEW">{t("leads.statusNew")}</option>
                  <option value="FOLLOW_UP">{t("leads.statusFollowUp")}</option>
                  <option value="CONVERTED">{t("leads.statusConverted")}</option>
                  <option value="CLOSED_LOST">{t("leads.statusClosedLost")}</option>
                </select>
              </div>

              {status === 'CLOSED_LOST' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{t("leads.reasonForClosing")}</label>
                  <textarea 
                    value={closeReason}
                    onChange={(e) => setCloseReason(e.target.value)}
                    required
                    placeholder="E.g., Price too high, went to competitor..."
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                    rows={3}
                  />
                </div>
              )}

              <button 
                type="submit" 
                disabled={status === lead.status && (!closeReason || status !== 'CLOSED_LOST')}
                className="w-full py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
               >
                {updatingStatus ? t("leads.updatingStatus") : status === 'CONVERTED' ? t("leads.convertToOrder") : t("leads.updateStatus")}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Requirements & Follow-ups */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
            <h2 className="font-semibold text-gray-900 border-b border-gray-100 pb-2">{t("leads.contactPersons")}</h2>
             {lead.contacts.length === 0 ? (
               <p className="text-gray-500 text-sm">{t("leads.noContacts")}</p>
             ) : (
               <div className="space-y-3">
                 {lead.contacts.map((contact) => (
                   <div key={contact.id} className="p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-start justify-between">
                     <div>
                       <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                         <UserIcon className="w-4 h-4 text-gray-400" />
                         {contact.name}
                       </p>
                       {contact.designation && <p className="text-xs text-gray-500 mt-0.5 ml-5.5">{contact.designation}</p>}
                     </div>
                     <div className="text-right text-xs text-gray-600">
                       {contact.phone && <a href={`tel:${contact.phone}`} className="block hover:text-brand-600">{contact.phone}</a>}
                       {contact.email && <a href={`mailto:${contact.email}`} className="block hover:text-brand-600 mt-0.5">{contact.email}</a>}
                     </div>
                   </div>
                 ))}
               </div>
             )}
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
            <h2 className="font-semibold text-gray-900 border-b border-gray-100 pb-2">{t("leads.requestedProducts")}</h2>
            {lead.items.length === 0 ? (
              <p className="text-gray-500 text-sm">{t("leads.noProducts")}</p>
            ) : (
              <div className="space-y-3">
                {lead.items.map((item, idx) => {
                  let detailsObj: any = {};
                  try { detailsObj = JSON.parse(item.productDetails); } catch(e){}
                  return (
                    <div key={item.id} className="p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                      <div className="flex items-center justify-between font-semibold text-gray-900 h-6">
                        <span className="text-sm">{idx + 1}. {getProductCategoryLabel(item.productCategory)}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-2 grid grid-cols-2 gap-y-1">
                        {Object.entries(detailsObj).map(([k, v]) => (
                          <div key={k}><span className="font-medium">{k}:</span> {String(v)}</div>
                        ))}
                      </div>
                      {item.rate && <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100">{t("leads.rateRequested")} ₹{item.rate}</div>}
                    </div>
                  );
                })}
              </div>
            )}
            
            {lead.remarks && (
              <div className="mt-4 pt-4 border-t border-gray-100 space-y-1">
                <span className="text-xs font-semibold text-gray-500 uppercase">{t("leads.remarksNotes")}</span>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{lead.remarks}</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-5">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
              <History className="w-5 h-5 text-gray-400" />
              <h2 className="font-semibold text-gray-900">{t("leads.followUpHistory")}</h2>
            </div>

            {/* Add Follow Up Form */}
            {lead.status !== 'CONVERTED' && lead.status !== 'CLOSED_LOST' && (
              <form onSubmit={handleAddFollowUp} className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
                <textarea
                  value={followUpNotes}
                  onChange={(e) => setFollowUpNotes(e.target.value)}
                  placeholder={t("leads.followUpNotes")}
                  required
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block">{t("leads.setNextFollowUp")}</label>
                    <input 
                      type="date" 
                      value={nextFollowUpDate}
                      onChange={(e) => setNextFollowUpDate(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" 
                    />
                  </div>
                  <button 
                    type="submit"
                    disabled={savingFollowUp || !followUpNotes.trim()}
                    className="self-end px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    {t("leads.saveNote")}
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-4">
              {lead.followUps.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4 border border-dashed border-gray-200 rounded-lg">{t("leads.noFollowUps")}</p>
              ) : (
                <div className="relative border-l-2 border-gray-200 ml-3 space-y-6">
                  {lead.followUps.map((fu) => (
                    <div key={fu.id} className="relative pl-6">
                      <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-brand-500 ring-4 ring-white" />
                      <div className="bg-white border border-gray-100 rounded-lg p-3 shadow-sm">
                        <div className="flex justify-between items-start mb-1 text-xs text-gray-500">
                          <span className="font-medium text-gray-900">{fu.user.name}</span>
                          <span>{format(new Date(fu.createdAt), "MMM d, yyyy h:mm a")}</span>
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
    </div>
  );
}
