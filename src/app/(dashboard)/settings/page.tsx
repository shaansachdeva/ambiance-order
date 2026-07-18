"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { UserRole } from "@/types";
import toast, { Toaster } from "react-hot-toast";
import {
  Settings, Users, Layers, Lock, ChevronRight, Shield, X, KeyRound,
} from "lucide-react";

interface CardConfig {
  href: string;
  title: string;
  description: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  iconRing: string;
  adminOnly?: boolean;
}

const SETTINGS_CARDS: CardConfig[] = [
  {
    href: "/settings/users",
    title: "Users & Permissions",
    description: "Add team members, set roles, manage feature access",
    icon: Users,
    iconBg: "bg-brand-50",
    iconColor: "text-brand-600",
    iconRing: "ring-brand-100",
    adminOnly: true,
  },
  {
    href: "/settings/products",
    title: "Product Categories",
    description: "Add custom product types with their own data fields",
    icon: Layers,
    iconBg: "bg-purple-50",
    iconColor: "text-purple-600",
    iconRing: "ring-purple-100",
    adminOnly: true,
  },
];

export default function SettingsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const { t } = useLanguage();
  const userRole = ((session?.user as any)?.role || "SALES") as UserRole;
  const isAdmin = userRole === "ADMIN";

  // Change password (current user)
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPwd !== confirmPwd) { toast.error("Passwords do not match"); return; }
    if (newPwd.length < 4) { toast.error("Password must be at least 4 characters"); return; }
    setChangingPassword(true);
    try {
      const res = await fetch("/api/users/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword: newPwd }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Password changed successfully");
        setCurrentPassword(""); setNewPwd(""); setConfirmPwd("");
        setShowChangePassword(false);
      } else { toast.error(data.error || "Failed to change password"); }
    } catch { toast.error("Something went wrong"); }
    finally { setChangingPassword(false); }
  };

  if (sessionStatus === "loading") {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="h-20 bg-white rounded-2xl border border-gray-200/80 animate-pulse" />
        <div className="h-32 bg-white rounded-2xl border border-gray-200/80 animate-pulse" />
        <div className="h-32 bg-white rounded-2xl border border-gray-200/80 animate-pulse" />
      </div>
    );
  }

  const visibleCards = SETTINGS_CARDS.filter((c) => !c.adminOnly || isAdmin);

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-24 md:pb-6">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Settings className="w-6 h-6 text-brand-500 flex-shrink-0" />
            {t("settings.title")}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Account &amp; workspace settings
          </p>
        </div>
      </div>

      {/* Account / Personal section — visible to everyone */}
      <div>
        <h2 className="text-[11px] uppercase tracking-wide font-bold text-gray-500 px-1 mb-2">Your Account</h2>
        <div className="bg-white rounded-2xl border border-gray-200/80 overflow-hidden">
          {/* Profile snippet */}
          <div className="p-4 sm:p-5 flex items-center gap-3 border-b border-gray-200/70">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-100 to-brand-200 text-brand-700 text-sm font-bold flex items-center justify-center ring-2 ring-white shadow-sm">
              {(session?.user?.name || "U").split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-gray-900 truncate">{session?.user?.name || "User"}</p>
              <p className="text-[11px] uppercase tracking-wider text-brand-600 font-bold mt-0.5">
                {userRole.toLowerCase().replace("_", " ")}
              </p>
            </div>
          </div>

          {/* Change password row */}
          <button
            onClick={() => setShowChangePassword(!showChangePassword)}
            className="w-full flex items-center gap-3 p-4 sm:p-5 hover:bg-gray-50 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-gray-50 ring-1 ring-gray-200 flex items-center justify-center flex-shrink-0">
              <KeyRound className="w-4 h-4 text-gray-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-gray-900">{t("settings.myPassword") || "Password"}</p>
              <p className="text-xs text-gray-500 mt-0.5">{t("settings.changePassword") || "Change your login password"}</p>
            </div>
            {showChangePassword
              ? <X className="w-5 h-5 text-gray-300 flex-shrink-0" />
              : <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />}
          </button>

          {showChangePassword && (
            <form onSubmit={handleChangePassword} className="p-4 sm:p-5 border-t border-gray-200/70 bg-gray-50/40 space-y-3">
              <div>
                <label className="block text-[11px] uppercase tracking-wide font-semibold text-gray-500 mb-1.5">
                  {t("settings.currentPassword") || "Current Password"}
                </label>
                <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 bg-white transition-all" />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wide font-semibold text-gray-500 mb-1.5">New Password</label>
                <input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} required
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 bg-white transition-all" />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wide font-semibold text-gray-500 mb-1.5">Confirm New Password</label>
                <input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} required
                  className={`w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 bg-white transition-all ${
                    confirmPwd && confirmPwd !== newPwd
                      ? "border-rose-300 focus:ring-rose-400/30 focus:border-rose-400"
                      : "border-gray-200 focus:ring-brand-500/30 focus:border-brand-500"
                  }`} />
                {confirmPwd && confirmPwd !== newPwd && (
                  <p className="text-xs text-rose-600 mt-1">Passwords do not match</p>
                )}
              </div>
              <button type="submit" disabled={changingPassword || !currentPassword || !newPwd || newPwd !== confirmPwd}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow active:scale-[0.97] disabled:opacity-50 transition-all">
                {changingPassword ? "Changing..." : <><Lock className="w-4 h-4" /> Change Password</>}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Workspace / Admin section — only if admin has any cards */}
      {visibleCards.length > 0 && (
        <div>
          <h2 className="text-[11px] uppercase tracking-wide font-bold text-gray-500 px-1 mb-2">Workspace</h2>
          <div className="space-y-2">
            {visibleCards.map((card) => {
              const Icon = card.icon;
              return (
                <Link
                  key={card.href}
                  href={card.href}
                  className="group flex items-center gap-3 bg-white rounded-2xl border border-gray-200/80 p-4 sm:p-5 hover:border-gray-300 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] transition-all"
                >
                  <div className={`w-11 h-11 rounded-xl ring-1 flex items-center justify-center flex-shrink-0 ${card.iconBg} ${card.iconRing}`}>
                    <Icon className={`w-5 h-5 ${card.iconColor}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-gray-900">{card.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{card.description}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0 transition-all group-hover:text-brand-500 group-hover:translate-x-0.5" />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Non-admin notice */}
      {!isAdmin && (
        <div className="bg-gray-50/60 border border-dashed border-gray-200 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-white ring-1 ring-gray-200 flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-gray-500" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-700">Workspace settings</p>
            <p className="text-xs text-gray-500 mt-0.5">User and product management is restricted to administrators.</p>
          </div>
        </div>
      )}
    </div>
  );
}
