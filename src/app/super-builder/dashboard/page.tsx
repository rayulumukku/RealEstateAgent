"use client";

import { useState, useEffect } from "react";
import { Building2, Users, Share2, Loader2, Crown } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function SuperBuilderDashboard() {
  const [loading, setLoading] = useState(true);
  const [totalProjects, setTotalProjects] = useState(0);
  const [totalBuilders, setTotalBuilders] = useState(0);
  const [sharedCount, setSharedCount] = useState(0);
  const [recentShares, setRecentShares] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const meRes = await fetch("/api/me");
      const meData = await meRes.json();
      if (!meData.user) return;

      const userId = meData.user.id;

      // Get my projects count
      const { count: projCount } = await supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("developer_id", userId);
      setTotalProjects(projCount || 0);

      // Get total builders in the system
      const { count: builderCount } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "builder");
      setTotalBuilders(builderCount || 0);

      // Get shared project count
      const { count: shareCount } = await supabase
        .from("project_shares")
        .select("id", { count: "exact", head: true })
        .eq("shared_by", userId);
      setSharedCount(shareCount || 0);

      // Get recent shares
      const { data: shares } = await supabase
        .from("project_shares")
        .select("*, projects(name), profiles!project_shares_builder_id_fkey(name, phone)")
        .eq("shared_by", userId)
        .order("created_at", { ascending: false })
        .limit(5);
      setRecentShares(shares || []);
    } catch (err) {
      console.error("Error loading super builder data:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8 text-slate-800">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
            <Crown className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Super Builder Dashboard</h1>
            <p className="text-sm text-slate-500">Manage and share your projects with builders</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-slate-900">{totalProjects}</p>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">My Projects</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-slate-900">{totalBuilders}</p>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Builders in System</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
              <Share2 className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-slate-900">{sharedCount}</p>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Shares</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Shares */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-extrabold text-slate-900 mb-4">Recent Project Shares</h2>
        {recentShares.length === 0 ? (
          <p className="text-sm text-slate-400">No projects shared yet. Go to &quot;Share Projects&quot; to get started.</p>
        ) : (
          <div className="space-y-3">
            {recentShares.map((share) => (
              <div key={share.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <p className="text-sm font-bold text-slate-800">{share.projects?.name || "Project"}</p>
                  <p className="text-xs text-slate-500">
                    Shared with: {share.profiles?.name || share.profiles?.phone || "Builder"}
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                  share.status === "active" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                }`}>
                  {share.status || "active"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
