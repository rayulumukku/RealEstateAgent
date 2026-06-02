"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, Send, Loader2, Users, Check, Clock, Shield } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Warning {
  id: string;
  message: string;
  target_roles: string[];
  target_user_ids: string[];
  created_at: string;
  ack_count: number;
}

interface UserOption {
  id: string;
  name: string;
  phone: string;
  role: string;
}

const ROLE_OPTIONS = [
  { value: "agent", label: "Agents" },
  { value: "builder", label: "Builders" },
  { value: "super_builder", label: "Super Builders" },
  { value: "admin", label: "Admins" },
  { value: "verification", label: "Verification Team" },
  { value: "operations", label: "Operations Team" },
];

export default function SuperAdminWarningsPage() {
  const [loading, setLoading] = useState(true);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);

  // Form state
  const [message, setMessage] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadWarnings();
    loadUsers();
  }, []);

  async function loadWarnings() {
    setLoading(true);
    try {
      const res = await fetch("/api/super-admin/warnings");
      const data = await res.json();
      if (data.warnings) setWarnings(data.warnings);
    } catch (err) {
      console.error("Error loading warnings:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadUsers() {
    const { data } = await supabase
      .from("profiles")
      .select("id, name, phone, role")
      .neq("role", "super_admin")
      .order("name", { ascending: true });
    if (data) setUsers(data);
  }

  function toggleRole(role: string) {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  }

  function toggleUser(userId: string) {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  async function handleSendWarning() {
    if (!message.trim()) {
      setError("Please write a warning message.");
      return;
    }
    if (selectedRoles.length === 0 && selectedUsers.length === 0) {
      setError("Select at least one role or specific user to send the warning to.");
      return;
    }

    setSending(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/super-admin/warnings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          target_roles: selectedRoles,
          target_user_ids: selectedUsers,
        }),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        const targetDesc = [
          ...selectedRoles.map((r) => ROLE_OPTIONS.find((o) => o.value === r)?.label || r),
          ...selectedUsers.map((id) => users.find((u) => u.id === id)?.name || "User"),
        ].join(", ");
        setSuccess(`Warning sent to: ${targetDesc}`);
        setMessage("");
        setSelectedRoles([]);
        setSelectedUsers([]);
        await loadWarnings();
      } else {
        setError(data.error || "Failed to send warning.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  }

  const filteredUsers = users.filter(
    (u) =>
      u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.phone?.includes(userSearch) ||
      u.role?.includes(userSearch.toLowerCase())
  );

  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getRoleLabel(role: string) {
    return ROLE_OPTIONS.find((o) => o.value === role)?.label || role;
  }

  return (
    <div className="space-y-6 text-slate-800">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Send Warning</h1>
            <p className="text-sm text-slate-500">Send real-time popup warnings to specific roles or users. They must acknowledge to dismiss.</p>
          </div>
        </div>
      </div>

      {/* Send Warning Form */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
        {/* Message */}
        <div className="space-y-2">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Warning Message *</label>
          <textarea
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write your warning message here... This will appear as a popup that users MUST acknowledge."
            className="w-full bg-slate-50 border border-slate-200 focus:border-red-500 rounded-xl py-3 px-4 text-sm text-slate-800 outline-none transition resize-none"
          />
        </div>

        {/* Target Roles */}
        <div className="space-y-2">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Send to Roles (select one or more)</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {ROLE_OPTIONS.map((role) => (
              <button
                key={role.value}
                type="button"
                onClick={() => toggleRole(role.value)}
                className={`p-3 rounded-xl border text-xs font-bold transition text-left ${
                  selectedRoles.includes(role.value)
                    ? "border-red-500 bg-red-50 text-red-700 ring-2 ring-red-200"
                    : "border-slate-200 text-slate-600 hover:border-red-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{role.label}</span>
                  {selectedRoles.includes(role.value) && <Check className="w-4 h-4 text-red-600" />}
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">{users.filter((u) => u.role === role.value).length} users</p>
              </button>
            ))}
          </div>
          {selectedRoles.length > 0 && (
            <button type="button" onClick={() => setSelectedRoles([])} className="text-[10px] text-red-500 font-bold uppercase tracking-wider">
              Clear All Roles
            </button>
          )}
        </div>

        {/* Specific Users (optional) */}
        <div className="space-y-2">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Or Send to Specific Users (optional — in addition to roles above)
          </label>
          <input
            type="text"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            placeholder="Search user by name, phone, or role..."
            className="w-full bg-slate-50 border border-slate-200 focus:border-red-500 rounded-xl py-2.5 px-3 text-sm text-slate-800 outline-none transition"
          />
          {selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedUsers.map((id) => {
                const user = users.find((u) => u.id === id);
                return (
                  <span key={id} className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-red-50 text-red-600 border border-red-200 text-[11px] font-bold">
                    <span>{user?.name || "User"} ({user?.role})</span>
                    <button type="button" onClick={() => toggleUser(id)} className="text-red-400 hover:text-red-700">×</button>
                  </span>
                );
              })}
            </div>
          )}
          {userSearch && (
            <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl bg-white">
              {filteredUsers.slice(0, 15).map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => { toggleUser(user.id); setUserSearch(""); }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 border-b border-slate-100 last:border-0 flex items-center justify-between ${
                    selectedUsers.includes(user.id) ? "bg-red-50 text-red-700" : "text-slate-700"
                  }`}
                >
                  <span>{user.name} — {user.phone} <span className="text-slate-400">({user.role})</span></span>
                  {selectedUsers.includes(user.id) && <Check className="w-3.5 h-3.5 text-red-600" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Status Messages */}
        {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-bold">{error}</div>}
        {success && <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-600 font-bold flex items-center space-x-2"><Check className="w-4 h-4" /><span>{success}</span></div>}

        {/* Send Button */}
        <button
          onClick={handleSendWarning}
          disabled={sending}
          className="w-full px-6 py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-xl shadow-md transition disabled:opacity-50 uppercase tracking-wider flex items-center justify-center space-x-2"
        >
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>Send Warning Now</span>
            </>
          )}
        </button>
      </div>

      {/* Warning History */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-sm font-bold text-slate-900 mb-4">Sent Warnings History</h2>
        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-red-500" /></div>
        ) : warnings.length === 0 ? (
          <p className="text-xs text-slate-400">No warnings sent yet.</p>
        ) : (
          <div className="space-y-3">
            {warnings.map((w) => (
              <div key={w.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <p className="text-sm font-bold text-slate-900">{w.message}</p>
                    <div className="flex items-center flex-wrap gap-1.5 mt-2">
                      {w.target_roles.map((role) => (
                        <span key={role} className="px-2 py-0.5 bg-red-50 text-red-600 border border-red-200 rounded text-[9px] font-bold uppercase">
                          {getRoleLabel(role)}
                        </span>
                      ))}
                      {w.target_user_ids.length > 0 && (
                        <span className="px-2 py-0.5 bg-purple-50 text-purple-600 border border-purple-200 rounded text-[9px] font-bold uppercase">
                          +{w.target_user_ids.length} specific user{w.target_user_ids.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <div className="flex items-center space-x-1 text-xs text-emerald-600 font-bold">
                      <Check className="w-3 h-3" />
                      <span>{w.ack_count} acknowledged</span>
                    </div>
                    <div className="flex items-center space-x-1 text-[10px] text-slate-400 mt-1">
                      <Clock className="w-3 h-3" />
                      <span>{formatTime(w.created_at)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
