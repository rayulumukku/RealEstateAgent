"use client";

import { useState, useEffect } from "react";
import { Users, Loader2, Search, X, Shield, Ban, Trash2, CheckCircle2, Crown, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface UserProfile {
  id: string;
  name: string;
  phone: string;
  role: string;
  status: string;
  agency_name: string;
  location: string;
  created_at: string;
  parent_id?: string | null;
  parent?: {
    name: string;
    agency_name: string;
  } | null;
}

export default function SuperAdminUsersPage() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => { loadUsers(); }, []);

  async function loadUsers() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .neq("role", "super_admin")
        .order("created_at", { ascending: false });
      if (data) {
        const usersWithParent = data.map((u: any) => {
          if (u.parent_id) {
            const parentProfile = data.find((parent: any) => parent.id === u.parent_id);
            if (parentProfile) {
              return {
                ...u,
                parent: {
                  name: parentProfile.name,
                  agency_name: parentProfile.agency_name
                }
              };
            }
          }
          return u;
        });
        setUsers(usersWithParent);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function handleSuspend(userId: string, userName: string) {
    if (!window.confirm(`Suspend "${userName}"? They will not be able to log in until reactivated.`)) return;
    setActionLoading(userId);
    try {
      const res = await fetch("/api/super-admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, action: "suspend" }),
      });
      const data = await res.json();
      if (res.ok && data.ok) await loadUsers();
      else alert(data.error || "Failed.");
    } catch { alert("Network error."); }
    finally { setActionLoading(null); }
  }

  async function handleReactivate(userId: string) {
    setActionLoading(userId);
    try {
      const res = await fetch("/api/super-admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, action: "reactivate" }),
      });
      const data = await res.json();
      if (res.ok && data.ok) await loadUsers();
      else alert(data.error || "Failed.");
    } catch { alert("Network error."); }
    finally { setActionLoading(null); }
  }

  async function handleDelete(userId: string, userName: string) {
    if (!window.confirm(`PERMANENTLY DELETE "${userName}"? This cannot be undone. All their data will be removed.`)) return;
    if (!window.confirm(`Are you ABSOLUTELY sure? Type reason: Deleting ${userName}`)) return;
    setActionLoading(userId);
    try {
      const res = await fetch("/api/super-admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await res.json();
      if (res.ok && data.ok) await loadUsers();
      else alert(data.error || "Failed.");
    } catch { alert("Network error."); }
    finally { setActionLoading(null); }
  }

  const filteredUsers = users.filter((u) => {
    const matchesSearch = u.name?.toLowerCase().includes(searchQuery.toLowerCase()) || u.phone?.includes(searchQuery) || u.agency_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = filterRole === "all" || u.role === filterRole;
    return matchesSearch && matchesRole;
  });

  function getRoleBadge(role: string) {
    switch (role) {
      case "admin": return "bg-emerald-50 text-emerald-600 border-emerald-200";
      case "super_builder": return "bg-purple-50 text-purple-600 border-purple-200";
      case "builder": return "bg-indigo-50 text-indigo-600 border-indigo-200";
      case "agent": return "bg-blue-50 text-blue-600 border-blue-200";
      default: return "bg-slate-50 text-slate-600 border-slate-200";
    }
  }

  function getRoleLabel(role: string) {
    switch (role) {
      case "admin": return "Admin";
      case "verification": return "Verification";
      case "operations": return "Operations";
      case "super_builder": return "Super Builder";
      case "builder": return "Builder";
      case "agent": return "Agent";
      default: return role;
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-red-500" /></div>;

  return (
    <div className="space-y-6 text-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">User Management</h1>
          <p className="text-[#64748b] text-xs font-semibold mt-0.5">Suspend, reactivate, or permanently delete any user (including admins).</p>
        </div>
        <button onClick={loadUsers} className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs rounded-xl transition flex items-center space-x-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /><span>Refresh</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by name, phone, or company..." className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:border-red-500 transition" />
          {searchQuery && <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-slate-400" /></button>}
        </div>
        <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl overflow-x-auto">
          {["all", "admin", "super_builder", "builder", "agent", "verification", "operations"].map((role) => (
            <button key={role} onClick={() => setFilterRole(role)} className={`px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition whitespace-nowrap ${filterRole === role ? "bg-white text-red-700 shadow-sm" : "text-slate-500"}`}>
              {role === "all" ? `All (${users.length})` : `${getRoleLabel(role)} (${users.filter(u => u.role === role).length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Suspended count */}
      {users.filter(u => u.status === "suspended").length > 0 && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-bold flex items-center space-x-2">
          <Ban className="w-4 h-4" />
          <span>{users.filter(u => u.status === "suspended").length} user(s) currently suspended</span>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-6 py-3 border-b border-slate-100 bg-slate-50">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">User</span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Role</span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Joined</span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Actions</span>
        </div>
        <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
          {filteredUsers.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">No users match your filters.</div>
          ) : (
            filteredUsers.map((user) => (
              <div key={user.id} className={`grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-6 py-4 items-center hover:bg-slate-50 transition ${user.status === "suspended" ? "bg-red-50/30" : ""}`}>
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-bold text-slate-900 flex items-center space-x-1">
                      {user.role === "admin" && <Shield className="w-3 h-3 text-emerald-500" />}
                      {user.role === "super_builder" && <Crown className="w-3 h-3 text-purple-500" />}
                      <span>{user.name || "Unnamed"}</span>
                    </p>
                    {user.parent && (
                      <span className="px-1.5 py-0.5 bg-purple-50 text-purple-650 border border-purple-200 rounded text-[8px] font-extrabold">
                        Sub-builder of {user.parent.agency_name || user.parent.name}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500">{user.agency_name || "—"} · {user.phone}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider border ${getRoleBadge(user.role)}`}>
                  {getRoleLabel(user.role)}
                </span>
                <span className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider ${
                  user.status === "approved" ? "bg-emerald-50 text-emerald-600" :
                  user.status === "suspended" ? "bg-red-50 text-red-600" :
                  user.status === "pending" ? "bg-amber-50 text-amber-600" :
                  "bg-slate-50 text-slate-600"
                }`}>
                  {user.status === "suspended" ? "SUSPENDED" : user.status || "active"}
                </span>
                <span className="text-[10px] text-slate-400 whitespace-nowrap">
                  {new Date(user.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
                </span>
                <div className="flex items-center space-x-1">
                  {user.status === "suspended" ? (
                    <button onClick={() => handleReactivate(user.id)} disabled={actionLoading === user.id} className="p-1.5 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition disabled:opacity-50" title="Reactivate">
                      {actionLoading === user.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    </button>
                  ) : (
                    <button onClick={() => handleSuspend(user.id, user.name)} disabled={actionLoading === user.id} className="p-1.5 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition disabled:opacity-50" title="Suspend">
                      {actionLoading === user.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                    </button>
                  )}
                  <button onClick={() => handleDelete(user.id, user.name)} disabled={actionLoading === user.id} className="p-1.5 text-red-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition disabled:opacity-50" title="Delete permanently">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
