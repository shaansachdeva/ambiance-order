"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import {
  Target, ArrowLeft, Loader2, Plus, Trash2, IndianRupee, ChevronDown, ChevronUp,
  Camera, MapPin, CheckCircle2, AlertCircle, X, Building2, UserPlus, Package,
  FileText, Calendar, Search, Check,
} from "lucide-react";
import Link from "next/link";
import ProductForm from "@/components/ProductForm";
import type { ProductCategory } from "@/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCategoryPicker, type PickerCategory } from "@/lib/useCategoryPicker";
import { compressImage } from "@/lib/imageCompress";

// Unified searchable picker — same one used in /orders/new (built-ins + customs in one list).
function CategoryPicker({
  value, categories, onChange, loaded,
}: {
  value: string;
  categories: PickerCategory[];
  onChange: (value: string) => void;
  loaded: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlight, setHighlight] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const selected = categories.find((c) => c.value === value) || null;
  const q = search.trim().toLowerCase();
  const filtered = q
    ? categories.filter((c) => c.label.toLowerCase().includes(q) || c.value.toLowerCase().includes(q))
    : categories;

  return (
    <div ref={boxRef} className="relative">
      {selected && !open ? (
        <button
          type="button"
          onClick={() => { setOpen(true); setSearch(""); setHighlight(0); }}
          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-brand-50 border border-brand-200 ring-1 ring-brand-100 rounded-xl hover:border-brand-300 hover:bg-brand-100/60 transition-all active:scale-[0.99]"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-brand-500 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Package className="w-4 h-4" />
            </div>
            <div className="min-w-0 text-left">
              <p className="text-sm font-semibold text-gray-900 truncate">{selected.label}</p>
              <p className="text-[11px] text-gray-500">Tap to change</p>
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
        </button>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onFocus={() => { setOpen(true); setHighlight(0); }}
              onChange={(e) => { setSearch(e.target.value); setOpen(true); setHighlight(0); }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setHighlight((h) => Math.min(filtered.length - 1, h + 1)); }
                else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(0, h - 1)); }
                else if (e.key === "Enter") {
                  e.preventDefault();
                  const pick = filtered[highlight];
                  if (pick) { onChange(pick.value); setOpen(false); setSearch(""); }
                } else if (e.key === "Escape") { setOpen(false); }
              }}
              placeholder={loaded ? (categories.length === 0 ? "No products yet" : "Search products...") : "Loading..."}
              className="w-full pl-9 pr-10 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 bg-white placeholder:text-gray-400 transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => { setSearch(""); setHighlight(0); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {open && (
            <div className="absolute z-30 left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-lg ring-1 ring-gray-200/40 max-h-72 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <div className="w-10 h-10 rounded-xl bg-gray-50 ring-1 ring-gray-100 flex items-center justify-center mx-auto mb-2">
                    <Package className="w-5 h-5 text-gray-400" />
                  </div>
                  <p className="text-sm font-medium text-gray-700">
                    {loaded ? (categories.length === 0 ? "No products yet" : "No matching products") : "Loading..."}
                  </p>
                </div>
              ) : (
                filtered.map((c, idx) => (
                  <button
                    key={c.value}
                    type="button"
                    onMouseEnter={() => setHighlight(idx)}
                    onClick={() => { onChange(c.value); setOpen(false); setSearch(""); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                      idx === highlight ? "bg-brand-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{c.label}</p>
                    </div>
                    {c.value === value && <Check className="w-4 h-4 text-brand-500 shrink-0" />}
                  </button>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

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
  const { categories: allCategories, loaded: categoriesLoaded } = useCategoryPicker();
  const [submitting, setSubmitting] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [location, setLocation] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});
  const [remarks, setRemarks] = useState("");
  const [nextFollowUp, setNextFollowUp] = useState("");
  const [contacts, setContacts] = useState<LeadContactData[]>([newContact()]);
  const [items, setItems] = useState<LeadItemData[]>([newItem()]);
  const [customCategories, setCustomCategories] = useState<{ id: string; name: string; fields: string }[]>([]);

  // Custom categories (for ProductForm fields lookup)
  useEffect(() => {
    fetch("/api/product-categories")
      .then((r) => r.json())
      .then((d) => setCustomCategories(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

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

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.files?.[0];
    if (!raw) return;
    let file = raw;
    try {
      file = await compressImage(raw);
    } catch {
      // fall back to the original file
    }
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
    const newErrors: Record<string, boolean> = {};
    if (!companyName.trim()) newErrors.companyName = true;
    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      toast.error("Please fill in the highlighted required fields");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          location,
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
          try {
            const formData = new FormData();
            formData.append("photo", visitPhoto);
            const photoRes = await fetch(`/api/leads/${data.id}/photo`, { method: "POST", body: formData });
            if (!photoRes.ok) {
              const pdata = await photoRes.json().catch(() => ({}));
              toast.error(`Photo upload failed: ${pdata.error || photoRes.statusText}`);
            }
          } catch (err) {
            toast.error("Photo upload failed — please retry from the lead page");
          }
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
    <div className="max-w-3xl mx-auto space-y-4 pb-24 md:pb-6">
      <Toaster position="top-right" />

      {/* ── Header card ────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-3.5 sm:p-4">
        <div className="flex items-center gap-3">
          <Link
            href="/leads"
            className="p-2 -ml-1 hover:bg-gray-100 rounded-xl transition-colors active:scale-95"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <Target className="w-5 h-5 text-brand-500 flex-shrink-0" />
              {t("leads.createTitle")}
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">{t("leads.createDesc")}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* ── Basic Info ────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-brand-600" />
            </div>
            <h2 className="text-sm font-bold text-gray-900">{t("leads.basicInfo")}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] uppercase tracking-wide font-semibold text-gray-500 mb-1.5">
                {t("leads.companyName")}
                <span className="text-rose-500 ml-1">*</span>
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => { setCompanyName(e.target.value); if (e.target.value.trim()) setFieldErrors(p => ({ ...p, companyName: false })); }}
                  className={`w-full pl-9 pr-3 py-2.5 text-sm rounded-xl focus:outline-none focus:ring-2 transition-all border ${
                    fieldErrors.companyName
                      ? "border-rose-300 bg-rose-50/40 focus:ring-rose-400/30 focus:border-rose-400"
                      : "border-gray-200 focus:ring-brand-500/30 focus:border-brand-500"
                  }`}
                  placeholder="e.g. Acme Corp"
                />
              </div>
              {fieldErrors.companyName && (
                <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Company name is required
                </p>
              )}
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wide font-semibold text-gray-500 mb-1.5">
                Location <span className="text-gray-400 font-normal normal-case">(city / address)</span>
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all placeholder:text-gray-400"
                  placeholder="e.g. Andheri, Mumbai"
                />
              </div>
            </div>
          </div>

          {/* Contacts */}
          <div className="space-y-2.5 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] uppercase tracking-wide font-semibold text-gray-500">
                {t("leads.contactPersons")}
              </label>
              <button
                type="button"
                onClick={addContact}
                className="inline-flex items-center gap-1 text-xs text-brand-700 hover:text-brand-800 font-semibold"
              >
                <UserPlus className="w-3.5 h-3.5" />
                {t("leads.addContact")}
              </button>
            </div>
            {contacts.map((contact) => (
              <div key={contact.id} className="rounded-xl border border-gray-200/80 bg-gray-50/50 p-3 space-y-2 relative">
                {contacts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeContact(contact.id)}
                    className="absolute top-2 right-2 p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors active:scale-95"
                    aria-label="Remove contact"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={contact.name}
                    onChange={(e) => updateContact(contact.id, { name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 bg-white placeholder:text-gray-400 transition-all"
                    placeholder="Contact name"
                  />
                  <input
                    type="text"
                    value={contact.designation}
                    onChange={(e) => updateContact(contact.id, { designation: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 bg-white placeholder:text-gray-400 transition-all"
                    placeholder="Designation"
                  />
                  <input
                    type="tel"
                    value={contact.phone}
                    onChange={(e) => updateContact(contact.id, { phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 bg-white placeholder:text-gray-400 transition-all"
                    placeholder="Phone"
                  />
                  <input
                    type="email"
                    value={contact.email}
                    onChange={(e) => updateContact(contact.id, { email: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 bg-white placeholder:text-gray-400 transition-all"
                    placeholder="Email"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Visit Proof ────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center">
              <Camera className="w-4 h-4 text-brand-600" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-gray-900">Visit Proof</h2>
              <p className="text-[11px] text-gray-500">
                Photo + GPS + visit time auto-recorded
              </p>
            </div>
          </div>

          {/* Location Status */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium ring-1 ${
            locationStatus === "granted"
              ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
              : locationStatus === "denied"
              ? "bg-rose-50 text-rose-700 ring-rose-100"
              : "bg-gray-50 text-gray-600 ring-gray-200"
          }`}>
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            {locationStatus === "requesting" && <span>Getting your location...</span>}
            {locationStatus === "granted" && visitLocation && (
              <span>
                <span className="font-semibold">Location captured</span>
                <span className="opacity-70 ml-1.5">
                  ({visitLocation.lat.toFixed(5)}, {visitLocation.lng.toFixed(5)})
                </span>
              </span>
            )}
            {locationStatus === "denied" && <span>Location not available — enable GPS in browser settings</span>}
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
                className="w-full rounded-xl ring-1 ring-gray-200 object-cover max-h-48"
              />
              <button
                type="button"
                onClick={() => {
                  setVisitPhoto(null);
                  setVisitPhotoPreview(null);
                  if (photoInputRef.current) photoInputRef.current.value = "";
                }}
                className="absolute top-2 right-2 p-1.5 bg-white rounded-lg shadow border border-gray-200 text-gray-500 hover:text-rose-600 transition-colors active:scale-95"
                aria-label="Remove photo"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <div className="mt-2 flex items-center gap-1 text-xs text-emerald-700 font-semibold">
                <CheckCircle2 className="w-3 h-3" />
                Photo ready — uploads with lead
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm font-semibold text-gray-500 hover:border-brand-400 hover:bg-brand-50/40 hover:text-brand-700 transition-all w-full justify-center active:scale-[0.99]"
            >
              <Camera className="w-5 h-5" />
              Take Photo / Upload Image
            </button>
          )}

          <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
            <AlertCircle className="w-3.5 h-3.5" />
            Visit time recorded as{" "}
            <span className="font-semibold text-gray-700">
              {new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
            </span>
          </div>
        </div>

        {/* ── Lead Items ────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center">
                <Package className="w-4 h-4 text-brand-600" />
              </div>
              <label className="text-sm font-bold text-gray-900">
                Products / Requirements
                <span className="text-gray-400 font-medium ml-1.5">({items.length})</span>
              </label>
            </div>
          </div>

          {items.map((item, idx) => (
            <div key={item.id} className="bg-white rounded-2xl border border-gray-200/80">
              <div
                className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200/70 rounded-t-2xl cursor-pointer hover:from-gray-100/60 transition-colors"
                onClick={() => updateItem(item.id, { expanded: !item.expanded })}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-brand-100 text-brand-700 text-xs font-bold ring-1 ring-brand-200 flex-shrink-0">
                    {idx + 1}
                  </span>
                  <span className="text-sm font-semibold text-gray-800 truncate">
                    {item.productCategory
                      ? (allCategories.find((c) => c.value === item.productCategory)?.label || item.productCategory)
                      : t("leads.selectProduct")}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                      className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors active:scale-[0.97]"
                      aria-label="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  {item.expanded
                    ? <ChevronUp className="w-4 h-4 text-gray-400" />
                    : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>
              </div>

              {item.expanded && (
                <div className="p-4 space-y-4">
                  <div>
                    <label className="block text-[11px] uppercase tracking-wide font-semibold text-gray-500 mb-1.5">
                      {t("leads.productCategory")}
                    </label>
                    <CategoryPicker
                      value={item.productCategory}
                      categories={allCategories}
                      onChange={(value) => {
                        if (value !== item.productCategory) {
                          updateItem(item.id, { productCategory: value as ProductCategory, productDetails: {} });
                        }
                      }}
                      loaded={categoriesLoaded}
                    />
                  </div>

                  {item.productCategory && (() => {
                    const customCat = customCategories.find((c) => c.name === item.productCategory);
                    let customFields: string[] | undefined;
                    if (customCat) {
                      try { customFields = JSON.parse(customCat.fields); } catch {}
                    }
                    return (
                      <ProductForm
                        productCategory={item.productCategory as ProductCategory}
                        productDetails={item.productDetails}
                        onChange={(details) => updateItem(item.id, { productDetails: details })}
                        customFields={customFields}
                      />
                    );
                  })()}

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-200/70">
                    <div>
                      <label className="block text-[11px] uppercase tracking-wide font-semibold text-gray-500 mb-1.5">
                        {t("leads.rateOptional")}
                      </label>
                      <div className="relative">
                        <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="number"
                          value={item.rate}
                          onChange={(e) => updateItem(item.id, { rate: e.target.value })}
                          placeholder="0"
                          className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 placeholder:text-gray-400 transition-all"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] uppercase tracking-wide font-semibold text-gray-500 mb-1.5">
                        GST % <span className="text-gray-400 font-normal normal-case">(optional)</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">%</span>
                        <input
                          type="number"
                          value={item.gst}
                          onChange={(e) => updateItem(item.id, { gst: e.target.value })}
                          placeholder="e.g. 18"
                          min="0"
                          max="100"
                          className="w-full pl-8 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 placeholder:text-gray-400 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={addItem}
            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-2xl text-sm font-semibold text-gray-500 hover:border-brand-400 hover:bg-brand-50/40 hover:text-brand-700 transition-all active:scale-[0.99]"
          >
            <Plus className="w-4 h-4" />
            {t("leads.addProduct")}
          </button>
        </div>

        {/* ── Additional Info ───────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gray-50 ring-1 ring-gray-200 flex items-center justify-center">
              <FileText className="w-4 h-4 text-gray-600" />
            </div>
            <h2 className="text-sm font-bold text-gray-900">{t("leads.additionalInfo")}</h2>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wide font-semibold text-gray-500 mb-1.5">
              {t("leads.remarks")}
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 placeholder:text-gray-400 resize-none transition-all"
              placeholder="Initial thoughts, special notes..."
            />
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wide font-semibold text-gray-500 mb-1.5">
              {t("leads.nextFollowUpDate")}
            </label>
            <div className="relative w-full lg:w-1/2">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="date"
                value={nextFollowUp}
                onChange={(e) => setNextFollowUp(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
              />
            </div>
          </div>
        </div>

        {/* ── Submit ─────────────────────────────────────────── */}
        <div className="flex justify-end gap-3 pt-2">
          <Link
            href="/leads"
            className="px-5 py-2.5 text-gray-700 font-semibold hover:bg-gray-100 rounded-xl transition-colors"
          >
            {t("common.cancel")}
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-br from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white font-bold rounded-xl shadow-lg shadow-brand-500/20 hover:shadow-xl hover:shadow-brand-500/30 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99] transition-all"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? t("leads.saving") : t("leads.createLead")}
          </button>
        </div>
      </form>
    </div>
  );
}
