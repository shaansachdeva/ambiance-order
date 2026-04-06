"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useLanguage } from "@/contexts/LanguageContext";
import { USER_ROLES } from "@/types";
import type { UserRole } from "@/types";
import toast, { Toaster } from "react-hot-toast";
import { Settings, UserPlus, Shield, X, Eye, EyeOff, Lock } from "lucide-react";

interface UserItem {
  id: string;
  name: string;
  username: string;
  plainPassword?: string;
  role: string;
  active: boolean;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const { t, tRole } = useLanguage();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
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

  const userRole = ((session?.user as any)?.role || "SALES") as UserRole;
  const userId = (session?.user as any)?.id;
  const isAdmin = userRole === "ADMIN";

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => {
        setUsers(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [isAdmin]);

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
                    </div>
                  </div>

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
                          onClick={() => setResetUserId(user.id)}
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
