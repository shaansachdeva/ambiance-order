"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useLanguage } from "@/contexts/LanguageContext";
import { USER_ROLES, USER_FEATURES } from "@/types";
import type { UserRole } from "@/types";
import toast, { Toaster } from "react-hot-toast";
import {
  Users, UserPlus, Shield, X, Pencil, Trash2,
  SlidersHorizontal, RotateCcw, ArrowLeft,
} from "lucide-react";

interface UserItem {
  id: string;
  name: string;
  username: string;
  role: string;
  customPermissions?: string | null;
  active: boolean;
}

export default function SettingsUsersPage() {
  const { data: session, status: sessionStatus } = useSession();
  const { t, tRole } = useLanguage();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showForm, setShowForm] = useState(false);

  // New user form
  const [newName, setNewName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("SALES");
  const [submitting, setSubmitting] = useState(false);

  // Admin reset password for other user
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetNewPwd, setResetNewPwd] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);

  // Edit credentials
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editingCredentials, setEditingCredentials] = useState(false);

  // Permissions panel
  const [permUserId, setPermUserId] = useState<string | null>(null);
  const [permSelected, setPermSelected] = useState<Set<string>>(new Set());
  const [savingPerms, setSavingPerms] = useState(false);

  const userRole = ((session?.user as any)?.role || "SALES") as UserRole;
  const userId = (session?.user as any)?.id;
  const isAdmin = userRole === "ADMIN";

  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (!isAdmin) { setLoading(false); return; }
    setLoading(true);
    setLoadError("");
    fetch("/api/users")
      .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then((data) => { setUsers(Array.isArray(data) ? data : []); setLoading(false); })
      .catch((err) => { setUsers([]); setLoadError(err.message || "Failed to load users"); setLoading(false); });
  }, [isAdmin, sessionStatus]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newUsername || !newPassword) { toast.error("All fields are required"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, username: newUsername, password: newPassword, role: newRole }),
      });
      const data = await res.json();
      if (res.ok) {
        setUsers((prev) => [data, ...prev]);
        setNewName(""); setNewUsername(""); setNewPassword(""); setNewRole("SALES");
        setShowForm(false);
        toast.success(`User "${data.name}" created`);
      } else { toast.error(data.error || "Failed to create user"); }
    } catch { toast.error("Something went wrong"); }
    finally { setSubmitting(false); }
  };

  const handleToggleActive = async (user: UserItem) => {
    if (user.id === userId) { toast.error("You cannot deactivate yourself"); return; }
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !user.active }),
      });
      if (res.ok) {
        setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, active: !u.active } : u));
        toast.success(user.active ? `${user.name} deactivated` : `${user.name} activated`);
      }
    } catch { toast.error("Failed to update user"); }
  };

  const handleRoleChange = async (user: UserItem, role: string) => {
    if (user.id === userId) { toast.error("You cannot change your own role"); return; }
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (res.ok) {
        setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, role } : u));
        toast.success(`${user.name}'s role updated`);
      }
    } catch { toast.error("Failed to update role"); }
  };

  const handleAdminResetPassword = async (user: UserItem) => {
    if (!resetNewPwd.trim()) { toast.error("Enter a new password"); return; }
    if (resetNewPwd.length < 4) { toast.error("Password must be at least 4 characters"); return; }
    setResettingPassword(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetNewPwd }),
      });
      if (res.ok) {
        setResetUserId(null); setResetNewPwd("");
        toast.success(`${user.name}'s password updated`);
      } else { const data = await res.json(); toast.error(data.error || "Failed to reset password"); }
    } catch { toast.error("Something went wrong"); }
    finally { setResettingPassword(false); }
  };

  const openPermissions = (user: UserItem) => {
    let selected: string[];
    if (user.customPermissions) {
      try { selected = JSON.parse(user.customPermissions); } catch { selected = []; }
    } else { selected = USER_FEATURES.map((f) => f.key); }
    setPermSelected(new Set(selected));
    setPermUserId(user.id);
    setEditUserId(null); setResetUserId(null);
  };

  const handleSavePermissions = async (user: UserItem) => {
    setSavingPerms(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customPermissions: Array.from(permSelected) }),
      });
      if (res.ok) {
        setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, customPermissions: JSON.stringify(Array.from(permSelected)) } : u));
        setPermUserId(null);
        toast.success(`${user.name}'s permissions saved`);
      } else { const data = await res.json(); toast.error(data.error || "Failed to save permissions"); }
    } catch { toast.error("Something went wrong"); }
    finally { setSavingPerms(false); }
  };

  const handleResetPermissions = async (user: UserItem) => {
    setSavingPerms(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customPermissions: null }),
      });
      if (res.ok) {
        setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, customPermissions: null } : u));
        setPermUserId(null);
        toast.success(`${user.name}'s permissions reset to role defaults`);
      } else { const data = await res.json(); toast.error(data.error || "Failed to reset"); }
    } catch { toast.error("Something went wrong"); }
    finally { setSavingPerms(false); }
  };

  const handleDeleteUser = async (user: UserItem) => {
    if (!confirm(`Delete user "${user.name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== user.id));
        toast.success(`${user.name} deleted`);
      } else { const data = await res.json(); toast.error(data.error || "Failed to delete user"); }
    } catch { toast.error("Something went wrong"); }
  };

  const handleEditCredentials = async (user: UserItem) => {
    if (!editName.trim() || !editUsername.trim()) { toast.error("Name and username are required"); return; }
    setEditingCredentials(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, username: editUsername }),
      });
      if (res.ok) {
        setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, name: editName, username: editUsername } : u));
        setEditUserId(null);
        toast.success(`${editName}'s credentials updated`);
      } else { const data = await res.json(); toast.error(data.error || "Failed to update"); }
    } catch { toast.error("Something went wrong"); }
    finally { setEditingCredentials(false); }
  };

  if (sessionStatus === "loading") {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="h-20 bg-white rounded-2xl border border-gray-200/80 animate-pulse" />
        <div className="h-64 bg-white rounded-2xl border border-gray-200/80 animate-pulse" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-col items-center justify-center text-center py-16 bg-white rounded-2xl border border-dashed border-gray-300">
          <div className="w-14 h-14 rounded-2xl bg-gray-50 ring-1 ring-gray-200 flex items-center justify-center mb-4">
            <Shield className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-base font-semibold text-gray-900">Admin access required</p>
          <p className="text-xs text-gray-500 mt-1">User management is restricted to administrators.</p>
          <Link
            href="/settings"
            className="inline-flex items-center gap-1.5 mt-5 px-4 py-2 text-sm font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 ring-1 ring-brand-100 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Settings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-24 md:pb-6">
      <Toaster position="top-right" />

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-3.5 sm:p-4">
        <div className="flex items-center gap-3">
          <Link
            href="/settings"
            className="p-2 -ml-1 hover:bg-gray-100 rounded-xl transition-colors active:scale-95"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <Users className="w-5 h-5 text-brand-500 flex-shrink-0" />
              User Management
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {users.length} user{users.length !== 1 ? "s" : ""} · Add, edit, deactivate, or manage permissions
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl transition-all shadow-sm hover:shadow active:scale-[0.97]"
          >
            {showForm ? <><X className="w-4 h-4" /> Cancel</> : <><UserPlus className="w-4 h-4" /> Add User</>}
          </button>
        </div>
      </div>

      {/* Add User Form */}
      {showForm && (
        <form
          onSubmit={handleAddUser}
          className="bg-white rounded-2xl border border-gray-200/80 p-4 sm:p-5 space-y-4"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center">
              <UserPlus className="w-4 h-4 text-brand-600" />
            </div>
            <h2 className="text-sm font-bold text-gray-900">Create New User</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] uppercase tracking-wide font-semibold text-gray-500 mb-1.5">Full Name</label>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 placeholder:text-gray-400 transition-all"
                placeholder="John Doe" required />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wide font-semibold text-gray-500 mb-1.5">Username</label>
              <input type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 placeholder:text-gray-400 transition-all"
                placeholder="john" required />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wide font-semibold text-gray-500 mb-1.5">Password</label>
              <input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 placeholder:text-gray-400 transition-all"
                placeholder="At least 4 characters" required />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wide font-semibold text-gray-500 mb-1.5">Role</label>
              <select value={newRole} onChange={(e) => setNewRole(e.target.value as UserRole)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 bg-white cursor-pointer transition-all">
                {USER_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          </div>
          <button type="submit" disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow active:scale-[0.97] disabled:opacity-50 transition-all">
            {submitting ? "Creating..." : <><UserPlus className="w-4 h-4" /> Create User</>}
          </button>
        </form>
      )}

      {/* Users List */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-white rounded-2xl border border-gray-200/80 animate-pulse" />)}
        </div>
      ) : loadError ? (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-sm text-rose-700">
          Error loading users: {loadError}. Try refreshing the page.
        </div>
      ) : users.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-12 text-center text-sm text-gray-400">No users found.</div>
      ) : (
        <div className="space-y-2">
          {users.map((user) => (
            <div key={user.id} className={`bg-white rounded-2xl border border-gray-200/80 p-4 ${!user.active ? "opacity-60" : ""}`}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-gray-900">
                      {user.name}
                      {user.id === userId && <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 bg-brand-100 text-brand-700 ring-1 ring-brand-200 text-[10px] font-bold rounded-md">YOU</span>}
                    </p>
                    {!user.active && <span className="inline-flex items-center px-1.5 py-0.5 bg-gray-100 text-gray-600 ring-1 ring-gray-200 text-[10px] font-bold rounded-md">INACTIVE</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">@{user.username}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
                  <select value={user.role} onChange={(e) => handleRoleChange(user, e.target.value)} disabled={user.id === userId}
                    className="text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:opacity-50 cursor-pointer">
                    {USER_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                  <button onClick={() => handleToggleActive(user)} disabled={user.id === userId}
                    className={`text-xs px-2.5 py-1.5 rounded-lg font-semibold transition-colors disabled:opacity-50 ring-1 ${
                      user.active ? "bg-rose-50 text-rose-700 ring-rose-100 hover:bg-rose-100"
                                  : "bg-emerald-50 text-emerald-700 ring-emerald-100 hover:bg-emerald-100"
                    }`}>
                    {user.active ? "Deactivate" : "Activate"}
                  </button>
                  {user.id !== userId && (
                    <>
                      <button onClick={() => { setEditUserId(user.id); setEditName(user.name); setEditUsername(user.username); setResetUserId(null); }}
                        className="p-1.5 text-gray-400 hover:text-brand-600 rounded-lg hover:bg-brand-50 transition-colors" title="Edit credentials">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => openPermissions(user)}
                        className="p-1.5 text-gray-400 hover:text-purple-600 rounded-lg hover:bg-purple-50 transition-colors" title="Manage feature permissions">
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDeleteUser(user)}
                        className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors" title="Delete user">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Permissions Panel */}
              {permUserId === user.id && (
                <div className="mt-3 border border-purple-200 rounded-xl bg-purple-50/40 p-4">
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <p className="text-xs font-bold text-purple-800 flex items-center gap-1.5">
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      Feature Access for {user.name}
                    </p>
                    <div className="flex gap-2 text-xs">
                      <button onClick={() => setPermSelected(new Set(USER_FEATURES.map(f => f.key)))} className="text-purple-600 hover:text-purple-800 font-semibold">Select All</button>
                      <span className="text-gray-300">·</span>
                      <button onClick={() => setPermSelected(new Set())} className="text-purple-600 hover:text-purple-800 font-semibold">Clear All</button>
                    </div>
                  </div>
                  {Array.from(new Set(USER_FEATURES.map(f => f.group))).map(group => (
                    <div key={group} className="mb-3">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">{group}</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {USER_FEATURES.filter(f => f.group === group).map(feature => (
                          <label key={feature.key} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer text-xs font-medium transition-colors ${
                            permSelected.has(feature.key) ? "bg-purple-100 text-purple-800 border border-purple-200" : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300"
                          }`}>
                            <input type="checkbox" checked={permSelected.has(feature.key)}
                              onChange={(e) => {
                                const next = new Set(permSelected);
                                e.target.checked ? next.add(feature.key) : next.delete(feature.key);
                                setPermSelected(next);
                              }}
                              className="w-3 h-3 accent-purple-600" />
                            {feature.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-purple-200">
                    <button onClick={() => handleSavePermissions(user)} disabled={savingPerms}
                      className="flex-1 py-2 bg-purple-600 text-white text-xs font-bold rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors">
                      {savingPerms ? "Saving..." : "Save Permissions"}
                    </button>
                    <button onClick={() => handleResetPermissions(user)} disabled={savingPerms}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50" title="Reset to role defaults">
                      <RotateCcw className="w-3 h-3" />
                      Reset
                    </button>
                    <button onClick={() => setPermUserId(null)} className="px-3 py-2 text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                  </div>
                  {user.customPermissions && (
                    <p className="text-[10px] text-purple-600 mt-2">✓ Custom permissions active — overrides role defaults</p>
                  )}
                </div>
              )}

              {/* Edit Credentials */}
              {editUserId === user.id && (
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Full name"
                    className="flex-1 min-w-[120px] px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
                  <input type="text" value={editUsername} onChange={(e) => setEditUsername(e.target.value)} placeholder="Username"
                    className="flex-1 min-w-[120px] px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
                  <button onClick={() => handleEditCredentials(user)} disabled={editingCredentials}
                    className="text-xs px-3 py-1.5 bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50 font-semibold">
                    {editingCredentials ? "..." : "Save"}
                  </button>
                  <button onClick={() => setEditUserId(null)} className="text-xs px-2 py-1.5 text-gray-500 hover:text-gray-700">Cancel</button>
                </div>
              )}

              {/* Admin Reset Password */}
              {user.id !== userId && (
                <div className="mt-2">
                  {resetUserId === user.id ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <input type="text" value={resetNewPwd} onChange={(e) => setResetNewPwd(e.target.value)} placeholder="New password"
                        className="flex-1 min-w-[120px] px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
                      <button onClick={() => handleAdminResetPassword(user)} disabled={resettingPassword}
                        className="text-xs px-3 py-1.5 bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50 font-semibold">
                        {resettingPassword ? "..." : "Save"}
                      </button>
                      <button onClick={() => { setResetUserId(null); setResetNewPwd(""); }} className="text-xs px-2 py-1.5 text-gray-500 hover:text-gray-700">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => { setResetUserId(user.id); setEditUserId(null); }}
                      className="text-xs text-brand-700 hover:text-brand-800 font-semibold">
                      Reset Password
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
