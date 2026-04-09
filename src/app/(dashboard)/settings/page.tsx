"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useLanguage } from "@/contexts/LanguageContext";
import { USER_ROLES, USER_FEATURES } from "@/types";
import type { UserRole } from "@/types";
import toast, { Toaster } from "react-hot-toast";
import { Settings, UserPlus, Shield, X, Eye, EyeOff, Lock, Pencil, Trash2, SlidersHorizontal, RotateCcw } from "lucide-react";

interface UserItem {
  id: string;
  name: string;
  username: string;
  plainPassword?: string;
  role: string;
  customPermissions?: string | null;
  active: boolean;
}

export default function SettingsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const { t, tRole } = useLanguage();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());

  // New user form
  const [newName, setNewName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("SALES");
  const [submitting, setSubmitting] = useState(false);

  // Change password (for current user)
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

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
    // Wait for session to resolve before deciding — avoids premature loading=false
    if (sessionStatus === "loading") return;
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError("");
    fetch("/api/users")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setUsers(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        setUsers([]);
        setLoadError(err.message || "Failed to load users");
        setLoading(false);
      });
  }, [isAdmin, sessionStatus]);

  const togglePasswordVisibility = (userId: string) => {
    setVisiblePasswords((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newUsername || !newPassword) {
      toast.error("All fields are required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          username: newUsername,
          password: newPassword,
          role: newRole,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setUsers((prev) => [{ ...data, plainPassword: newPassword }, ...prev]);
        setNewName("");
        setNewUsername("");
        setNewPassword("");
        setNewRole("SALES");
        setShowForm(false);
        toast.success(`User "${data.name}" created`);
      } else {
        toast.error(data.error || "Failed to create user");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (user: UserItem) => {
    if (user.id === userId) {
      toast.error("You cannot deactivate yourself");
      return;
    }
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !user.active }),
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, active: !u.active } : u))
        );
        toast.success(
          user.active ? `${user.name} deactivated` : `${user.name} activated`
        );
      }
    } catch {
      toast.error("Failed to update user");
    }
  };

  const handleRoleChange = async (user: UserItem, role: string) => {
    if (user.id === userId) {
      toast.error("You cannot change your own role");
      return;
    }
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, role } : u))
        );
        toast.success(`${user.name}'s role updated`);
      }
    } catch {
      toast.error("Failed to update role");
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPwd !== confirmPwd) {
      toast.error("Passwords do not match");
      return;
    }
    if (newPwd.length < 4) {
      toast.error("Password must be at least 4 characters");
      return;
    }
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
        setCurrentPassword("");
        setNewPwd("");
        setConfirmPwd("");
        setShowChangePassword(false);
      } else {
        toast.error(data.error || "Failed to change password");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleAdminResetPassword = async (user: UserItem) => {
    if (!resetNewPwd.trim()) {
      toast.error("Enter a new password");
      return;
    }
    if (resetNewPwd.length < 4) {
      toast.error("Password must be at least 4 characters");
      return;
    }
    setResettingPassword(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetNewPwd }),
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === user.id ? { ...u, plainPassword: resetNewPwd } : u
          )
        );
        setResetUserId(null);
        setResetNewPwd("");
        toast.success(`${user.name}'s password updated`);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to reset password");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setResettingPassword(false);
    }
  };

  const openPermissions = (user: UserItem) => {
    let selected: string[];
    if (user.customPermissions) {
      try { selected = JSON.parse(user.customPermissions); } catch { selected = []; }
    } else {
      // Default to all features for a clean starting point
      selected = USER_FEATURES.map((f) => f.key);
    }
    setPermSelected(new Set(selected));
    setPermUserId(user.id);
    setEditUserId(null);
    setResetUserId(null);
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
        setUsers((prev) =>
          prev.map((u) =>
            u.id === user.id
              ? { ...u, customPermissions: JSON.stringify(Array.from(permSelected)) }
              : u
          )
        );
        setPermUserId(null);
        toast.success(`${user.name}'s permissions saved`);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to save permissions");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSavingPerms(false);
    }
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
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, customPermissions: null } : u))
        );
        setPermUserId(null);
        toast.success(`${user.name}'s permissions reset to role defaults`);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to reset");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSavingPerms(false);
    }
  };

  const handleDeleteUser = async (user: UserItem) => {
    if (!confirm(`Delete user "${user.name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== user.id));
        toast.success(`${user.name} deleted`);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to delete user");
      }
    } catch {
      toast.error("Something went wrong");
    }
  };

  const handleEditCredentials = async (user: UserItem) => {
    if (!editName.trim() || !editUsername.trim()) {
      toast.error("Name and username are required");
      return;
    }
    setEditingCredentials(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, username: editUsername }),
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === user.id ? { ...u, name: editName, username: editUsername } : u
          )
        );
        setEditUserId(null);
        toast.success(`${editName}'s credentials updated`);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to update");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setEditingCredentials(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Toaster position="top-right" />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="w-5 h-5 text-brand-500" />
          {t("settings.title")}
        </h1>
      </div>

      {/* Change My Password — available to all users */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">{t("settings.myPassword")}</h2>
          <button
            onClick={() => setShowChangePassword(!showChangePassword)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            {showChangePassword ? (
              <><X className="w-3.5 h-3.5" /> {t("settings.cancel")}</>
            ) : (
              <><Lock className="w-3.5 h-3.5" /> {t("settings.changePassword")}</>
            )}
          </button>
        </div>

        {showChangePassword && (
          <form
            onSubmit={handleChangePassword}
            className="bg-white rounded-xl border border-gray-200 p-4 space-y-3"
          >
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {t("settings.currentPassword")}
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                New Password
              </label>
              <input
                type="password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                  confirmPwd && confirmPwd !== newPwd
                    ? "border-red-300 bg-red-50"
                    : "border-gray-300"
                }`}
                required
              />
              {confirmPwd && confirmPwd !== newPwd && (
                <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
              )}
            </div>
            <button
              type="submit"
              disabled={changingPassword || !currentPassword || !newPwd || newPwd !== confirmPwd}
              className="w-full py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {changingPassword ? "Changing..." : "Change Password"}
            </button>
          </form>
        )}
      </div>

      {/* Admin-only: User Management */}
      {isAdmin && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">User Management</h2>
            <button
              onClick={() => setShowForm(!showForm)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors"
            >
              {showForm ? (
                <><X className="w-3.5 h-3.5" /> Cancel</>
              ) : (
                <><UserPlus className="w-3.5 h-3.5" /> Add User</>
              )}
            </button>
          </div>

          {/* Add User Form */}
          {showForm && (
            <form
              onSubmit={handleAddUser}
              className="bg-white rounded-xl border border-gray-200 p-4 mb-4 space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Password
                  </label>
                  <input
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Role
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  >
                    {USER_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {submitting ? "Creating..." : "Create User"}
              </button>
            </form>
          )}

          {/* Users List */}
          {loading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : loadError ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">
              Error loading users: {loadError}. Try refreshing the page.
            </div>
          ) : users.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-6 text-center text-sm text-gray-400">
              No users found.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              {users.map((user) => (
                <div
                  key={user.id}
                  className={`p-4 ${!user.active ? "opacity-50" : ""}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {user.name}
                        {user.id === userId && (
                          <span className="ml-1.5 text-xs text-brand-600">(You)</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">@{user.username}</p>
                      {/* Show password */}
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-xs text-gray-400">Password:</span>
                        <span className="text-xs font-mono text-gray-600">
                          {visiblePasswords.has(user.id)
                            ? user.plainPassword || "—"
                            : "••••••"}
                        </span>
                        <button
                          onClick={() => togglePasswordVisibility(user.id)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          {visiblePasswords.has(user.id) ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user, e.target.value)}
                        disabled={user.id === userId}
                        className="text-xs px-2 py-1.5 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
                      >
                        {USER_ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleToggleActive(user)}
                        disabled={user.id === userId}
                        className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                          user.active
                            ? "bg-red-50 text-red-600 hover:bg-red-100"
                            : "bg-green-50 text-green-600 hover:bg-green-100"
                        }`}
                      >
                        {user.active ? "Deactivate" : "Activate"}
                      </button>
                      {user.id !== userId && (
                        <>
                          <button
                            onClick={() => {
                              setEditUserId(user.id);
                              setEditName(user.name);
                              setEditUsername(user.username);
                              setResetUserId(null);
                            }}
                            className="p-1.5 text-gray-400 hover:text-brand-600 rounded-lg hover:bg-brand-50 transition-colors"
                            title="Edit credentials"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user)}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                            title="Delete user"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => openPermissions(user)}
                            className="p-1.5 text-gray-400 hover:text-purple-600 rounded-lg hover:bg-purple-50 transition-colors"
                            title="Manage feature permissions"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Permissions Panel */}
                  {permUserId === user.id && (
                    <div className="mt-3 border border-purple-200 rounded-xl bg-purple-50/40 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold text-purple-800 flex items-center gap-1.5">
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                          Feature Access for {user.name}
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setPermSelected(new Set(USER_FEATURES.map(f => f.key)))}
                            className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                          >
                            Select All
                          </button>
                          <span className="text-gray-300">·</span>
                          <button
                            onClick={() => setPermSelected(new Set())}
                            className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                          >
                            Clear All
                          </button>
                        </div>
                      </div>

                      {/* Group features */}
                      {Array.from(new Set(USER_FEATURES.map(f => f.group))).map(group => (
                        <div key={group} className="mb-3">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">{group}</p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                            {USER_FEATURES.filter(f => f.group === group).map(feature => (
                              <label
                                key={feature.key}
                                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer text-xs font-medium transition-colors ${
                                  permSelected.has(feature.key)
                                    ? "bg-purple-100 text-purple-800 border border-purple-200"
                                    : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={permSelected.has(feature.key)}
                                  onChange={(e) => {
                                    const next = new Set(permSelected);
                                    e.target.checked ? next.add(feature.key) : next.delete(feature.key);
                                    setPermSelected(next);
                                  }}
                                  className="w-3 h-3 accent-purple-600"
                                />
                                {feature.label}
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}

                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-purple-200">
                        <button
                          onClick={() => handleSavePermissions(user)}
                          disabled={savingPerms}
                          className="flex-1 py-2 bg-purple-600 text-white text-xs font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                        >
                          {savingPerms ? "Saving..." : "Save Permissions"}
                        </button>
                        <button
                          onClick={() => handleResetPermissions(user)}
                          disabled={savingPerms}
                          className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                          title="Reset to role defaults"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Reset
                        </button>
                        <button
                          onClick={() => setPermUserId(null)}
                          className="px-3 py-2 text-xs text-gray-500 hover:text-gray-700"
                        >
                          Cancel
                        </button>
                      </div>

                      {user.customPermissions && (
                        <p className="text-[10px] text-purple-600 mt-2">
                          ✓ Custom permissions active — overrides role defaults
                        </p>
                      )}
                    </div>
                  )}

                  {/* Edit Credentials */}
                  {editUserId === user.id && (
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Full name"
                          className="flex-1 px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                        <input
                          type="text"
                          value={editUsername}
                          onChange={(e) => setEditUsername(e.target.value)}
                          placeholder="Username"
                          className="flex-1 px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                        <button
                          onClick={() => handleEditCredentials(user)}
                          disabled={editingCredentials}
                          className="text-xs px-3 py-1.5 bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50"
                        >
                          {editingCredentials ? "..." : "Save"}
                        </button>
                        <button
                          onClick={() => setEditUserId(null)}
                          className="text-xs px-2 py-1.5 text-gray-500 hover:text-gray-700"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Admin Reset Password */}
                  {user.id !== userId && (
                    <div className="mt-2">
                      {resetUserId === user.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={resetNewPwd}
                            onChange={(e) => setResetNewPwd(e.target.value)}
                            placeholder="New password"
                            className="flex-1 px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                          />
                          <button
                            onClick={() => handleAdminResetPassword(user)}
                            disabled={resettingPassword}
                            className="text-xs px-3 py-1.5 bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50"
                          >
                            {resettingPassword ? "..." : "Save"}
                          </button>
                          <button
                            onClick={() => {
                              setResetUserId(null);
                              setResetNewPwd("");
                            }}
                            className="text-xs px-2 py-1.5 text-gray-500 hover:text-gray-700"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setResetUserId(user.id); setEditUserId(null); }}
                          className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                        >
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
      )}

      {/* Non-admin: Access Denied for user management */}
      {!isAdmin && (
        <div className="text-center py-8">
          <Shield className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">User management is admin-only.</p>
        </div>
      )}
    </div>
  );
}
