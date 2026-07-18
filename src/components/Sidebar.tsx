"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  Package,
  PlusCircle,
  Settings,
  LogOut,
  BarChart3,
  Calendar,
  Users,
  Target,
  Menu,
  Columns3,
  Truck,
  ClipboardList,
  Activity,
  Languages,
  Calculator,
  Trash2,
  Barcode,
  FileText,
  Layers,
  FileEdit,
  X as CloseIcon,
  ShieldCheck,
  GripVertical,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import GlobalSearch from "@/components/GlobalSearch";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { fetchPreferences, setPreference, getCachedPreference } from "@/lib/userPreferences";
import type { TranslationKey } from "@/lib/translations";
import type { UserRole } from "@/types";

interface SidebarProps {
  user: {
    name: string;
    role: UserRole;
    customPermissions: string[] | null;
  };
}

interface NavItem {
  href: string;
  labelKey: TranslationKey;
  icon: React.ElementType;
  roles: UserRole[] | "all";
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", labelKey: "nav.dashboard", icon: LayoutDashboard, roles: "all" },
  { href: "/orders", labelKey: "nav.orders", icon: Package, roles: "all" },
  { href: "/calendar", labelKey: "nav.calendar", icon: Calendar, roles: "all" },
  { href: "/customers", labelKey: "nav.parties", icon: Users, roles: ["ADMIN", "SALES", "ACCOUNTANT"] },
  { href: "/production-queue", labelKey: "nav.production", icon: Columns3, roles: ["ADMIN", "ACCOUNTANT", "DISPATCH"] },
  { href: "/dispatched", labelKey: "nav.dispatched", icon: Truck, roles: ["ADMIN", "PRODUCTION", "DISPATCH"] },
  { href: "/leads", labelKey: "nav.leads", icon: Target, roles: ["ADMIN", "SALES"] },
  { href: "/production-report", labelKey: "nav.dailyReport", icon: ClipboardList, roles: ["ADMIN", "PRODUCTION"] },
  { href: "/reports", labelKey: "nav.reports", icon: BarChart3, roles: ["ADMIN", "SALES", "ACCOUNTANT"] },
  // PRODUCTION users explicitly excluded from the activity log per ops decision.
  { href: "/activity-log", labelKey: "nav.activityLog", icon: Activity, roles: ["ADMIN", "SALES", "ACCOUNTANT", "DISPATCH"] },
  { href: "/recycle-bin", labelKey: "nav.recycleBin", icon: Trash2, roles: ["ADMIN"] },
  { href: "/calculator", labelKey: "nav.calculator", icon: Calculator, roles: ["ADMIN"] },
  { href: "/barcode", labelKey: "nav.barcode", icon: Barcode, roles: "all" },
  { href: "/quotations", labelKey: "nav.quotations", icon: FileText, roles: ["ADMIN", "SALES", "ACCOUNTANT"] },
  { href: "/products", labelKey: "nav.products", icon: Layers, roles: ["ADMIN"] },
  { href: "/drafts", labelKey: "nav.drafts", icon: FileEdit, roles: ["ADMIN", "SALES", "ACCOUNTANT"] },
  { href: "/orders/new", labelKey: "nav.newOrder", icon: PlusCircle, roles: ["ADMIN", "SALES"] },
  { href: "/pending-approvals", labelKey: "nav.pendingApprovals", icon: ShieldCheck, roles: ["ADMIN"] },
  { href: "/settings", labelKey: "nav.settings", icon: Settings, roles: ["ADMIN"] },
];

function getVisibleItems(role: UserRole, customPermissions: string[] | null): NavItem[] {
  return NAV_ITEMS.filter((item) => {
    // `roles: "all"` is a floor, not a default: these screens (Dashboard, Orders,
    // Calendar, Labels) are open to every role, so a custom permission list can
    // add to them but never take them away. Without this, a user with any custom
    // list silently loses the shared screens — e.g. an admin's label formats are
    // meant for everyone, but the Labels link would vanish for that user.
    if (item.roles === "all") return true;
    // A custom list, when set, fully replaces role-based access for everything else.
    if (customPermissions !== null) {
      return customPermissions.includes(item.labelKey);
    }
    return item.roles.includes(role);
  });
}

const NAV_ORDER_KEY = "sidebar_nav_order";
const COLLAPSED_KEY = "sidebar_collapsed";
const PREF_NAV_ORDER = "sidebarNavOrder";
const PREF_COLLAPSED = "sidebarCollapsed";

function applySavedOrder(items: NavItem[], saved: string[]): NavItem[] {
  if (!saved.length) return items;
  const indexed = new Map(items.map((item) => [item.href, item]));
  const ordered: NavItem[] = [];
  // First add items that are in the saved order
  for (const href of saved) {
    if (indexed.has(href)) {
      ordered.push(indexed.get(href)!);
      indexed.delete(href);
    }
  }
  // Then append any new items not in saved order
  for (const item of Array.from(indexed.values())) {
    ordered.push(item);
  }
  return ordered;
}

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const customPermissions = user.customPermissions;
  const baseVisibleItems = getVisibleItems(user.role, customPermissions);

  // CRITICAL: initial state must NOT read from localStorage or any client-only
  // store. The server renders with the default values; the client must match
  // for the first paint, then we sync in useEffect. Otherwise hydration mismatches.
  const [savedOrder, setSavedOrder] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const dragSrcRef = useRef<string | null>(null);
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const hydratedRef = useRef(false);

  // Hydrate from server (one-time on mount), with one-time migration from legacy localStorage.
  useEffect(() => {
    // Apply cached prefs synchronously first (client-only) so the user's saved
    // order/collapsed state appears immediately without waiting for the network.
    const cachedOrder = getCachedPreference<string[]>(PREF_NAV_ORDER, []);
    const cachedCollapsed = getCachedPreference<boolean>(PREF_COLLAPSED, false);
    if (Array.isArray(cachedOrder) && cachedOrder.length > 0) setSavedOrder(cachedOrder);
    if (typeof cachedCollapsed === "boolean") setCollapsed(cachedCollapsed);

    fetchPreferences().then((prefs) => {
      // Migration: if server has nothing but legacy localStorage has values, push them up.
      let nextOrder = Array.isArray(prefs[PREF_NAV_ORDER]) ? (prefs[PREF_NAV_ORDER] as string[]) : null;
      let nextCollapsed = typeof prefs[PREF_COLLAPSED] === "boolean" ? prefs[PREF_COLLAPSED] as boolean : null;
      if (nextOrder === null) {
        try {
          const raw = localStorage.getItem(NAV_ORDER_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) { nextOrder = parsed; setPreference(PREF_NAV_ORDER, parsed); }
          }
        } catch {}
      }
      if (nextCollapsed === null) {
        try {
          const v = localStorage.getItem(COLLAPSED_KEY);
          if (v === "1" || v === "0") { nextCollapsed = v === "1"; setPreference(PREF_COLLAPSED, nextCollapsed); }
        } catch {}
      }
      if (nextOrder) setSavedOrder(nextOrder);
      if (nextCollapsed !== null) setCollapsed(nextCollapsed);
      hydratedRef.current = true;
    });
  }, []);

  // Sync sidebar width as a CSS variable so the dashboard <main> margin tracks it
  useEffect(() => {
    document.documentElement.style.setProperty("--sb-w", collapsed ? "4.25rem" : "16rem");
    if (hydratedRef.current) setPreference(PREF_COLLAPSED, collapsed);
  }, [collapsed]);

  const visibleItems = applySavedOrder(baseVisibleItems, savedOrder);

  const handleDragStart = (href: string) => {
    dragSrcRef.current = href;
  };

  const handleDrop = (targetHref: string) => {
    const srcHref = dragSrcRef.current;
    if (!srcHref || srcHref === targetHref) {
      setDragOver(null);
      return;
    }
    const current = visibleItems.map((i) => i.href);
    const srcIdx = current.indexOf(srcHref);
    const tgtIdx = current.indexOf(targetHref);
    const updated = [...current];
    updated.splice(srcIdx, 1);
    updated.splice(tgtIdx, 0, srcHref);
    setSavedOrder(updated);
    setPreference(PREF_NAV_ORDER, updated);
    dragSrcRef.current = null;
    setDragOver(null);
  };

  const [showProfile, setShowProfile] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const { t, lang, setLang } = useLanguage();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfile(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const toggleLang = () => setLang(lang === "en" ? "hi" : "en");

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowMobileMenu(true)}
            className="p-1.5 -ml-1.5 text-gray-600 hover:bg-gray-100 rounded-lg active:scale-95 transition-all"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Link href="/" className="flex items-center shrink-0 select-none cursor-pointer">
            <img
              src="/logo.png"
              alt=""
              draggable={false}
              className="h-7 w-auto object-contain pointer-events-none select-none"
            />
          </Link>
        </div>
        <div className="flex items-center gap-2">
          {/* Refresh - mobile */}
          <button
            onClick={() => window.location.reload()}
            className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 active:scale-95 transition-all"
            title="Refresh"
            aria-label="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {/* Language toggle - mobile */}
          <button
            onClick={toggleLang}
            className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 text-gray-700 text-[10px] font-bold hover:bg-gray-200 active:scale-95 transition-all"
            title={lang === "en" ? "हिंदी में बदलें" : "Switch to English"}
          >
            {lang === "en" ? "हि" : "EN"}
          </button>
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setShowProfile(!showProfile)}
              className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-brand-100 to-brand-200 text-brand-700 text-xs font-bold ring-2 ring-white shadow-sm active:scale-95 transition-all"
            >
              {initials}
            </button>
            {showProfile && (
              <div className="absolute right-0 top-11 w-52 bg-white rounded-xl shadow-lg border border-gray-200 py-1.5 z-50 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-900">{user.name}</p>
                  <p className="text-[11px] uppercase tracking-wider text-brand-600 font-bold mt-0.5">
                    {user.role.toLowerCase().replace("_", " ")}
                  </p>
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  {t("nav.logout")}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden md:flex md:flex-col md:min-h-screen bg-gradient-to-b from-white to-gray-50/40 border-r border-gray-200/70 fixed top-0 left-0 bottom-0 transition-[width] duration-200 z-40",
          collapsed ? "md:w-[4.25rem]" : "md:w-64"
        )}
      >
        {/* Collapse / expand toggle */}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="absolute -right-3 top-7 z-10 w-6 h-6 rounded-full bg-white border border-gray-200 text-gray-500 hover:text-brand-600 hover:border-brand-300 shadow-sm flex items-center justify-center active:scale-90 transition-all"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>

        {/* Logo */}
        <div className={cn("flex items-center py-5 transition-[padding] duration-200", collapsed ? "px-2 justify-center" : "px-6")}>
          <Link
            href="/"
            className="block hover:opacity-90 transition-opacity shrink-0 select-none cursor-pointer"
            title="Home"
            aria-label="Ambiance Printing & Packaging — Home"
          >
            {collapsed ? (
              <img
                src="/small-logo.png"
                alt=""
                draggable={false}
                className="w-9 h-9 object-contain pointer-events-none select-none"
              />
            ) : (
              <img
                src="/logo.png"
                alt=""
                draggable={false}
                className="h-10 w-auto object-contain pointer-events-none select-none"
              />
            )}
          </Link>
        </div>

        {/* Search — only when expanded */}
        {!collapsed && (
          <div className="px-3">
            <GlobalSearch />
          </div>
        )}

        {/* Navigation */}
        <nav
          className={cn(
            "flex-1 py-4 space-y-0.5 overflow-y-auto overflow-x-hidden",
            collapsed ? "px-2" : "px-3"
          )}
        >
          {visibleItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            const Icon = item.icon;
            const isDragTarget = dragOver === item.href;
            const label = t(item.labelKey);

            return (
              <div
                key={item.href}
                draggable={!collapsed}
                onDragStart={() => handleDragStart(item.href)}
                onDragOver={(e) => { e.preventDefault(); setDragOver(item.href); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={() => handleDrop(item.href)}
                className={cn(
                  "group relative rounded-lg transition-all",
                  isDragTarget && !collapsed && "border-2 border-dashed border-brand-400 bg-brand-50/50"
                )}
              >
                <Link
                  href={item.href}
                  title={collapsed ? label : undefined}
                  className={cn(
                    "relative flex items-center rounded-lg text-sm transition-all",
                    collapsed
                      ? "justify-center w-11 h-11 mx-auto"
                      : "gap-3 pl-4 pr-3 py-2.5",
                    isActive
                      ? collapsed
                        ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200"
                        : "bg-gradient-to-r from-brand-50 to-brand-50/30 text-brand-700 font-semibold shadow-[inset_2px_0_0_0] shadow-brand-500"
                      : "text-gray-600 font-medium hover:bg-gray-100/70 hover:text-gray-900"
                  )}
                >
                  {!collapsed && (
                    <GripVertical className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 flex-shrink-0 cursor-grab absolute left-0.5 top-1/2 -translate-y-1/2" />
                  )}
                  <Icon
                    className={cn(
                      "w-[18px] h-[18px] flex-shrink-0 transition-colors",
                      isActive ? "text-brand-600" : "text-gray-400 group-hover:text-gray-600"
                    )}
                  />
                  {!collapsed && <span className="tracking-tight">{label}</span>}
                </Link>
              </div>
            );
          })}
        </nav>

        {/* Footer: user + action icons */}
        <div className={cn("pb-3 pt-2 border-t border-gray-200/60", collapsed ? "px-2" : "px-3")}>
          {collapsed ? (
            <div className="flex flex-col items-center gap-1.5">
              <div
                className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-brand-100 to-brand-200 text-brand-700 text-[11px] font-bold"
                title={`${user.name} · ${user.role.toLowerCase().replace("_", " ")}`}
              >
                {initials}
              </div>
              <button
                onClick={() => window.location.reload()}
                title="Refresh"
                className="flex items-center justify-center w-9 h-8 text-gray-500 hover:bg-gray-100 hover:text-gray-700 rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={toggleLang}
                title={lang === "en" ? "हिंदी" : "English"}
                className="flex items-center justify-center w-9 h-8 text-gray-500 hover:bg-gray-100 hover:text-gray-700 rounded-lg transition-colors text-[10px] font-bold"
              >
                {lang === "en" ? "हि" : "EN"}
              </button>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                title={t("nav.logout")}
                className="flex items-center justify-center w-9 h-8 text-gray-500 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
                aria-label={t("nav.logout")}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-brand-100 to-brand-200 text-brand-700 text-[11px] font-bold flex-shrink-0">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-gray-900 truncate leading-tight">
                  {user.name}
                </p>
                <p className="text-[9px] uppercase tracking-wider text-brand-600 font-bold leading-tight">
                  {user.role.toLowerCase().replace("_", " ")}
                </p>
              </div>
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button
                  onClick={() => window.location.reload()}
                  title="Refresh"
                  className="flex items-center justify-center w-7 h-7 text-gray-500 hover:bg-gray-100 hover:text-gray-700 rounded-lg transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={toggleLang}
                  title={lang === "en" ? "हिंदी में बदलें" : "Switch to English"}
                  className="flex items-center justify-center w-7 h-7 text-gray-500 hover:bg-gray-100 hover:text-gray-700 rounded-lg transition-colors text-[9px] font-bold"
                >
                  {lang === "en" ? "हि" : "EN"}
                </button>
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  title={t("nav.logout")}
                  className="flex items-center justify-center w-7 h-7 text-gray-500 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
                  aria-label={t("nav.logout")}
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white border-t border-gray-200 safe-area-bottom overflow-x-auto scrollbar-hide shadow-[0_-4px_12px_-4px_rgba(0,0,0,0.05)]"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <div className="flex items-center min-w-max px-2 py-1.5">
          <style dangerouslySetInnerHTML={{__html: `nav::-webkit-scrollbar { display: none; }`}} />
          {visibleItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-xl transition-all shrink-0",
                  isActive
                    ? "text-brand-700"
                    : "text-gray-400 active:text-gray-600 active:scale-95"
                )}
              >
                <span
                  className={cn(
                    "flex items-center justify-center w-9 h-7 rounded-lg transition-all",
                    isActive
                      ? "bg-gradient-to-br from-brand-100 to-brand-50 ring-1 ring-brand-200/80"
                      : ""
                  )}
                >
                  <Icon className="w-[18px] h-[18px]" />
                </span>
                <span className="text-[10px] font-semibold leading-tight tracking-tight">{t(item.labelKey)}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Mobile Side Menu Overlay */}
      {showMobileMenu && (
        <div className="md:hidden fixed inset-0 z-[60] flex">
          <div
            className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => setShowMobileMenu(false)}
          />
          <div className="relative w-72 max-w-[85vw] bg-white h-full shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200/60">
              <span className="font-bold text-gray-900 tracking-tight">{t("nav.menu")}</span>
              <button
                onClick={() => setShowMobileMenu(false)}
                className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
              {visibleItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href));
                const Icon = item.icon;
                const isDragTarget = dragOver === item.href;

                return (
                  <div
                    key={item.href}
                    draggable
                    onDragStart={() => handleDragStart(item.href)}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(item.href); }}
                    onDragLeave={() => setDragOver(null)}
                    onDrop={() => handleDrop(item.href)}
                    className={cn(isDragTarget && "border-2 border-dashed border-brand-400 bg-brand-50/50 rounded-lg")}
                  >
                    <Link
                      href={item.href}
                      onClick={() => setShowMobileMenu(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                        isActive
                          ? "bg-gradient-to-r from-brand-50 to-brand-50/30 text-brand-700 font-semibold shadow-[inset_2px_0_0_0] shadow-brand-500"
                          : "text-gray-600 font-medium hover:bg-gray-100/70 hover:text-gray-900"
                      )}
                    >
                      <Icon
                        className={cn(
                          "w-[18px] h-[18px]",
                          isActive ? "text-brand-600" : "text-gray-400"
                        )}
                      />
                      <span className="tracking-tight">{t(item.labelKey)}</span>
                    </Link>
                  </div>
                );
              })}
            </nav>
            {/* Language toggle in mobile menu */}
            <div className="border-t border-gray-200/60 p-3">
              <button
                onClick={toggleLang}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100/70 rounded-lg transition-colors"
              >
                <Languages className="w-4 h-4 text-gray-400" />
                <span>{lang === "en" ? "हिंदी में बदलें" : "Switch to English"}</span>
                <span className="ml-auto text-[10px] font-bold bg-gray-200/80 text-gray-600 px-1.5 py-0.5 rounded">
                  {lang === "en" ? "EN" : "हि"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
