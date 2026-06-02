"use client";

import { useEffect, useState } from "react";
import { Loader2, Users, Trash2, Building2, Search, X, UserMinus } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface SharedBuilder {
  id: string;
  builder_id: string;
  project_id: string;
  status: string;
  created_at: string;
  builder_name: string;
  builder_phone: string;
  builder_company: string;
  project_name: string;
}

export default function ManageBuildersPage() {
  const [loading, setLoading] = useState(true);
  const [shares, setShares] = useState<SharedBuilder[]>([]);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadShares();
  }, []);

  async function loadShares() {
    setLoading(true);
    try {
      const meRes = await fetch("/api/me");
      const meData = await meRes.json();
      if (!meData.user) return;

      const { data } = await supabase
        .from("project_shares")
        .select("*, projects(name), profiles!project_shares_builder_id_fkey(name, phone, agency_name)")
        .eq("shared_by", meData.user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (data) {
        const mapped = data.map((s: any) => ({
          id: s.id,
          builder_id: s.builder_id,
          project_id: s.project_id,
          status: s.status,
          created_at: s.created_at,
          builder_name: s.profiles?.name || "Unnamed",
          builder_phone: s.profiles?.phone || "",
          builder_company: s.profiles?.agency_name || "",
          project_name: s.projects?.name || "Project",
        }));
        setShares(mapped);
      }
    } catch (err) {
      console.error("Error loading shares:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveBuilder(shareId: string, builderName: string, projectName: string) {
    if (!window.confirm(`Remove "${builderName}" from "${projectName}"? They will no longer have access to this project.`)) {
      return;
    }

    setRemovingId(shareId);
    try {
      const res = await fetch("/api/super-builder/share", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ share_id: shareId }),
      });

      const data = await res.json();
      if (res.ok && !data.error) {
        setShares((prev) => prev.filter((s) => s.id !== shareId));
      } else {
        alert(data.error || "Failed to remove builder.");
      }
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setRemovingId(null);
    }
  }

  const filteredShares = shares.filter(
    (s) =>
      s.builder_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.builder_phone.includes(searchQuery) ||
      s.builder_company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.project_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-800">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
            <Users className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Manage Builders</h1>
            <p className="text-sm text-slate-500">View and remove builders from your shared projects</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by builder name, phone, company, or project..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:border-purple-500 transition"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        )}
      </div>

      {/* Builders List */}
      {filteredShares.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
          <UserMinus className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-sm text-slate-500">
            {shares.length === 0
              ? "No builders have access to your projects yet. Share a project first."
              : "No results match your search."}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-4 px-6 py-3 border-b border-slate-100 bg-slate-50">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Builder</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Company</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Project</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Action</span>
          </div>
          <div className="divide-y divide-slate-100">
            {filteredShares.map((share) => (
              <div key={share.id} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-4 px-6 py-4 items-center hover:bg-slate-50 transition">
                <div>
                  <p className="text-sm font-bold text-slate-900">{share.builder_name}</p>
                  <p className="text-xs text-slate-500">{share.builder_phone}</p>
                </div>
                <p className="text-sm text-slate-600">{share.builder_company || "—"}</p>
                <div className="flex items-center space-x-2">
                  <Building2 className="w-3.5 h-3.5 text-purple-500" />
                  <span className="text-sm text-slate-700">{share.project_name}</span>
                </div>
                <button
                  onClick={() => handleRemoveBuilder(share.id, share.builder_name, share.project_name)}
                  disabled={removingId === share.id}
                  className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                  title="Remove builder access"
                >
                  {removingId === share.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="text-xs text-slate-400 text-center">
        {shares.length} active share{shares.length !== 1 ? "s" : ""} across your projects
      </div>
    </div>
  );
}
