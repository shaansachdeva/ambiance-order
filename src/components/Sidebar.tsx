"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Package,
  PlusCircle,
  Settings,
  LogOut,
  BarChart3,
  User,
  Calendar,
  Warehouse,
  Users,
  Menu,
  X as CloseIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";

interface SidebarProps {
  user: {
    name: string;
    role: UserRole;
  };
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: UserRole[] | "all";
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: "all",
  },
  {
    href: "/orders",
    label: "Orders",
    icon: Package,
    roles: "all",
  },
  {
    href: "/calendar",
    label: "Calendar",
    icon: Calendar,
    roles: "all",
  },
  {
    href: "/customers",
    label: "Parties",
    icon: Users,
    roles: ["ADMIN", "SALES", "ACCOUNTANT"],
  },
  {
    href: "/inventory",
    label: "Inventory",
    icon: Warehouse,
    roles: ["ADMIN", "PRODUCTION"],
  },
  {
    href: "/reports",
    label: "Reports",
    icon: BarChart3,
    roles: "all",
  },
  {
    href: "/orders/new",
    label: "New Order",
    icon: PlusCircle,
    roles: ["ADMIN", "SALES"],
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    roles: ["ADMIN"],
  },
];

function getVisibleItems(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter(
    (item) => item.roles === "all" || item.roles.includes(role)
  );
}

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const visibleItems = getVisibleItems(user.role);
  const [showProfile, setShowProfile] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown when clicking outside
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

  return (
    <>
      {/* Mobile Top Bar with Profile */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowMobileMenu(true)}
            className="p-1 -ml-1 text-gray-500 hover:bg-gray-100 rounded-md"
          >
            <Menu className="w-6 h-6" />
          </button>
          <Link href="/" className="flex items-center shrink-0">
            <img src="/logo.png" alt="Ambiance Printing & Packaging" className="h-7 w-auto object-contain" />
          </Link>
        </div>
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setShowProfile(!showProfile)}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold"
          >
            {initials}
          </button>
          {showProfile && (
            <div className="absolute right-0 top-10 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900">{user.name}</p>
                <p className="text-xs text-gray-500 capitalize">
                  {user.role.toLowerCase().replace("_", " ")}
                </p>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-64 md:min-h-screen bg-white border-r border-gray-200 fixed top-0 left-0 bottom-0">
        {/* Logo */}
        <div className="flex items-center px-6 py-5 border-b border-gray-100">
          <Link href="/" className="block hover:opacity-90 transition-opacity shrink-0">
            <img src="/logo.png" alt="Ambiance Printing & Packaging" className="h-10 w-auto object-contain" />
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
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
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-brand-50 text-brand-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <Icon
                  className={cn(
                    "w-5 h-5 flex-shrink-0",
                    isActive ? "text-brand-500" : "text-gray-400"
                  )}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User Info & Logout */}
        <div className="border-t border-gray-100 px-4 py-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user.name}
              </p>
              <p className="text-xs text-gray-500 capitalize">
                {user.role.toLowerCase().replace("_", " ")}
              </p>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav 
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white border-t border-gray-200 safe-area-bottom overflow-x-auto scrollbar-hide"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <div className="flex items-center min-w-max px-2 py-1">
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
                  "flex flex-col items-center justify-center gap-0.5 px-4 py-2 rounded-lg transition-colors shrink-0",
                  isActive ? "text-brand-500" : "text-gray-400"
                )}
              >
                <Icon className="w-5 h-5 mb-0.5" />
                <span className="text-[10px] items-center font-medium leading-tight">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Mobile Side Menu Overlay */}
      {showMobileMenu && (
        <div className="md:hidden fixed inset-0 z-[60] flex">
          <div 
            className="fixed inset-0 bg-gray-900/50 transition-opacity" 
            onClick={() => setShowMobileMenu(false)} 
          />
          <div className="relative w-64 max-w-[80vw] bg-white h-full shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
              <span className="font-semibold text-gray-900">Menu</span>
              <button 
                onClick={() => setShowMobileMenu(false)} 
                className="p-1 text-gray-500"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-2">
              {visibleItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href));
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setShowMobileMenu(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-brand-50 text-brand-700 border-r-4 border-brand-500"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-5 h-5",
                        isActive ? "text-brand-500" : "text-gray-400"
                      )}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
