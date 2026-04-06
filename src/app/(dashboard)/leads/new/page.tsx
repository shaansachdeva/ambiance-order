"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import { Target, ArrowLeft, Loader2, Plus, Trash2, IndianRupee, ChevronDown, ChevronUp, Camera, MapPin, CheckCircle2, AlertCircle, X } from "lucide-react";
import Link from "next/link";
import ProductForm from "@/components/ProductForm";
import { PRODUCT_CATEGORIES, ProductCategory } from "@/types";
import { useLanguage } from "@/contexts/LanguageContext";

interface LeadItemData {
  id: string; // client-side key
  productCategory: ProductCategory | "";
  productDetails: Record<string, string>;
  rate: string;
  gst: string;
  expanded: boolean;
}

interface LeadContactData {
  id: string;
  name: string;
  designation: string;
  phone: string;
  email: string;
  isPrimary: boolean;
}

let itemCounter = 0;
function newItem(): LeadItemData {
  return {
    id: `item-${++itemCounter}`,
    productCategory: "",
    productDetails: {},
    rate: "",
    gst: "",
    expanded: true,
  };
}

let contactCounter = 0;
function newContact(): LeadContactData {
  return {
    id: `contact-${++contactCounter}`,
    name: "",
    designation: "",
    phone: "",
    email: "",
    isPrimary: contactCounter === 1,
  };
}

export default function NewLeadPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [submitting, setSubmitting] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [remarks, setRemarks] = useState("");
  const [nextFollowUp, setNextFollowUp] = useState("");
  const [contacts, setContacts] = useState<LeadContactData[]>([newContact()]);
  const [items, setItems] = useState<LeadItemData[]>([newItem()]);

  // Visit proof state
  const [visitPhoto, setVisitPhoto] = useState<File | null>(null);
  const [visitPhotoPreview, setVisitPhotoPreview] = useState<string | null>(null);
  const [visitLocation, setVisitLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "requesting" | "granted" | "denied">("idle");
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Auto-request location when page loads
  useEffect(() => {
    if ("geolocation" in navigator) {
      setLocationStatus("requesting");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setVisitLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLocationStatus("granted");
        },
        () => {
          setLocationStatus("denied");
        },
        { timeout: 10000, maximumAge: 60000 }
      );
    } else {
      setLocationStatus("denied");
    }
  }, []);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVisitPhoto(file);
    const reader = new FileReader();
    reader.onloadend = () => setVisitPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const updateItem = (id: string, updates: Partial<LeadItemData>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const removeItem = (id: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const addItem = () => {
    setItems((prev) => {
      const collapsed = prev.map((item) => ({ ...item, expanded: false }));
      return [...collapsed, newItem()];
    });
  };

  const updateContact = (id: string, updates: Partial<LeadContactData>) => {
    setContacts((prev) =>
      prev.map((contact) => (contact.id === id ? { ...contact, ...updates } : contact))
    );
  };

  const removeContact = (id: string) => {
    if (contacts.length <= 1) return;
    setContacts((prev) => prev.filter((contact) => contact.id !== id));
  };

  const addContact = () => {
    setContacts((prev) => [...prev, newContact()]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName) {
      toast.error("Company name is required");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          remarks,
          nextFollowUp,
          visitLatitude: visitLocation?.lat ?? null,
          visitLongitude: visitLocation?.lng ?? null,
          contacts: contacts.map(c => ({
            name: c.name,
            designation: c.designation,
            phone: c.phone,
            email: c.email,
            isPrimary: c.isPrimary
          })).filter(c => c.name),
          items: items.map(i => ({
            productCategory: i.productCategory,
            productDetails: i.productDetails,
            rate: i.rate,
            gst: i.gst
          })).filter(i => i.productCategory)
        }),
      });
      const data = await res.json();

      if (res.ok) {
        // Upload visit photo if provided
        if (visitPhoto) {
          const formData = new FormData();
          formData.append("photo", visitPhoto);
          await fetch(`/api/leads/${data.id}/photo`, { method: "POST", body: formData });
        }
        toast.success("Lead created successfully");
        router.push(`/leads/${data.id}`);
      } else {
        toast.error(data.error || "Failed to create lead");
        setSubmitting(false);
      }
    } catch {
      toast.error("Something went wrong");
      setSubmitting(false);
    }
  };



  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      <Toaster position="top-right" />
      
      <div className="flex items-center gap-4">
        <Link 
          href="/leads"
          className="p-2 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Target className="w-5 h-5 text-brand-500" />
            {t("leads.createTitle")}
          </h1>
          <p className="text-sm text-gray-500">{t("leads.createDesc")}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Basic Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">{t("leads.basicInfo")}</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("leads.companyName")}</label>
            <input
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="e.g. Acme Corp"
            />
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">{t("leads.contactPersons")}</label>
            {contacts.map((contact, idx) => (
              <div key={contact.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 p-4 bg-gray-50 border border-gray-200 rounded-lg relative">
                {contacts.length > 1 && (
                  <button 
                    type="button" 
                    onClick={() => removeContact(contact.id)}
                    className="absolute top-2 right-2 text-red-400 hover:text-red-600 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <div className="md:col-span-3">
                  <input
                    type="text"
                    value={contact.name}
                    onChange={(e) => updateContact(contact.id, { name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                    placeholder="Name"
                  />
                </div>
                <div className="md:col-span-3">
                  <input
                    type="text"
                    value={contact.designation}
                    onChange={(e) => updateContact(contact.id, { designation: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                    placeholder="Designation"
                  />
                </div>
                <div className="md:col-span-3">
                  <input
                    type="tel"
                    value={contact.phone}
                    onChange={(e) => updateContact(contact.id, { phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                    placeholder="Phone"
                  />
                </div>
                <div className="md:col-span-3">
                  <input
                    type="email"
                    value={contact.email}
                    onChange={(e) => updateContact(contact.id, { email: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                    placeholder="Email"
                  />
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addContact}
              className="text-sm font-medium text-brand-600 hover:text-brand-700 flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> {t("leads.addContact")}
            </button>
          </div>
        </div>

        {/* Visit Proof */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <Camera className="w-5 h-5 text-brand-500" />
            Visit Proof
          </h2>
          <p className="text-xs text-gray-500 -mt-2">
            Take a photo at the client&apos;s location. Your GPS location and visit time will be recorded automatically.
          </p>

          {/* Location Status */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
            locationStatus === "granted"
              ? "bg-green-50 text-green-700"
              : locationStatus === "denied"
              ? "bg-red-50 text-red-600"
              : "bg-gray-50 text-gray-500"
          }`}>
            <MapPin className="w-4 h-4 shrink-0" />
            {locationStatus === "requesting" && <span>Getting your location...</span>}
            {locationStatus === "granted" && visitLocation && (
              <span>
                <span className="font-medium">Location captured</span>{" "}
                <span className="text-xs opacity-70">
                  ({visitLocation.lat.toFixed(5)}, {visitLocation.lng.toFixed(5)})
                </span>
              </span>
            )}
            {locationStatus === "denied" && (
              <span>Location not available — please enable GPS in browser settings</span>
            )}
            {locationStatus === "idle" && <span>Requesting location...</span>}
          </div>

          {/* Photo Upload */}
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhotoChange}
          />

          {visitPhotoPreview ? (
            <div className="relative w-full max-w-xs">
              <img
                src={visitPhotoPreview}
                alt="Visit photo"
                className="w-full rounded-lg border border-gray-200 object-cover max-h-48"
              />
              <button
                type="button"
                onClick={() => {
                  setVisitPhoto(null);
                  setVisitPhotoPreview(null);
                  if (photoInputRef.current) photoInputRef.current.value = "";
                }}
                className="absolute top-2 right-2 p-1 bg-white rounded-full shadow border border-gray-200 text-gray-500 hover:text-red-500"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="mt-1 flex items-center gap-1 text-xs text-green-600">
                <CheckCircle2 className="w-3 h-3" />
                Photo ready — will be uploaded with lead
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm font-medium text-gray-500 hover:border-brand-400 hover:text-brand-600 transition-colors w-full justify-center"
            >
              <Camera className="w-5 h-5" />
              Take Photo / Upload Image
            </button>
          )}

          {/* Visit Time */}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <AlertCircle className="w-3.5 h-3.5" />
            Visit time is automatically recorded as{" "}
            <span className="font-medium text-gray-700">
              {new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
            </span>
          </div>
        </div>

        {/* Lead Items */}
        <div className="space-y-3">
          <label className="text-lg font-semibold text-gray-900">
            Products / Requirements ({items.length})
          </label>

          {items.map((item, idx) => (
            <div key={item.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div
                className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer"
                onClick={() => updateItem(item.id, { expanded: !item.expanded })}
              >
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-bold">
                    {idx + 1}
                  </span>
                  <span className="text-sm font-medium text-gray-700">
                    {item.productCategory
                      ? PRODUCT_CATEGORIES.find((c) => c.value === item.productCategory)?.label
                      : t("leads.selectProduct")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeItem(item.id);
                      }}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  {item.expanded ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              </div>

              {item.expanded && (
                <div className="p-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t("leads.productCategory")}
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {PRODUCT_CATEGORIES.map((cat) => (
                        <button
                          key={cat.value}
                          type="button"
                          onClick={() => {
                            if (cat.value !== item.productCategory) {
                              updateItem(item.id, {
                                productCategory: cat.value,
                                productDetails: {},
                              });
                            }
                          }}
                          className={`px-3 py-2 text-sm rounded-lg border-2 font-medium transition-all ${
                            item.productCategory === cat.value
                              ? "border-brand-500 bg-brand-50 text-brand-700"
                              : "border-gray-200 text-gray-600 hover:border-gray-300"
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {item.productCategory && (
                    <ProductForm
                      productCategory={item.productCategory as ProductCategory}
                      productDetails={item.productDetails}
                      onChange={(details) => updateItem(item.id, { productDetails: details })}
                    />
                  )}

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        {t("leads.rateOptional")}
                      </label>
                      <div className="relative">
                        <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="number"
                          value={item.rate}
                          onChange={(e) => updateItem(item.id, { rate: e.target.value })}
                          placeholder="0"
                          className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        GST % <span className="text-gray-400 font-normal">(optional)</span>
                      </label>
                      <input
                        type="number"
                        value={item.gst}
                        onChange={(e) => updateItem(item.id, { gst: e.target.value })}
                        placeholder="e.g. 18"
                        className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={addItem}
            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm font-medium text-gray-500 hover:border-brand-400 hover:text-brand-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t("leads.addProduct")}
          </button>
        </div>

        {/* Additional Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">{t("leads.additionalInfo")}</h2>
          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("leads.remarks")}</label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Initial thoughts, special notes..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("leads.nextFollowUpDate")}</label>
              <input
                type="date"
                value={nextFollowUp}
                onChange={(e) => setNextFollowUp(e.target.value)}
                className="w-full lg:w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
        </div>

        <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
          <Link
            href="/leads"
            className="px-5 py-2.5 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors"
          >
            {t("common.cancel")}
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? t("leads.saving") : t("leads.createLead")}
          </button>
        </div>
      </form>
    </div>
  );
}
