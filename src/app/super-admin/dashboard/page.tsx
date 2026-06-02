"use client";

import { useState, useEffect } from "react";
import { Users, Building2, Calendar, Shield, Loader2, Crown, ShieldAlert } from "lucide-react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function SuperAdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ agents: 0, builders: 0, superBuilders: 0, admins: 0, projects: 0, events: 0, suspended: 0 });

  useEffect(() => { loadStats(); }, []);

  async function loadStats() {
    setLoading(true);
    try {
      const { count: agents } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "agent");
      const { count: builders } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "builder");
      const { count: superBuilders } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "super_builder");
      const { count: admins } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin");
      const { count: projects } = await supabase.from("projects").select("id", { count: "exact", head: true });
      const { count: events } = await supabase.from("events").select("id", { count: "exact", head: true });
      const { count: suspended } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "suspended");

      setStats({
        agents: agents || 0,
        builders: builders || 0,
        superBuilders: superBuilders || 0,
        admins: admins || 0,
        projects: projects || 0,
        events: events || 0,
        suspended: suspended || 0,
      });
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-red-500" /></div>;

  return (
    <div className="space-y-8 text-slate-800">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-6">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
            <Shield className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Super Admin Console</h1>
            <p className="text-sm text-slate-500">Highest authority — full platform control. Suspend or delete any user.</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-2xl font-extrabold text-slate-900">{stats.agents}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Agents</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-2xl font-extrabold text-indigo-600">{stats.builders}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Builders</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-2xl font-extrabold text-purple-600">{stats.superBuilders}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Super Builders</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-2xl font-extrabold text-emerald-600">{stats.admins}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Admins</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-2xl font-extrabold text-blue-600">{stats.projects}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Projects</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-2xl font-extrabold text-amber-600">{stats.events}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Events</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-red-200 shadow-sm">
          <p className="text-2xl font-extrabold text-red-600">{stats.suspended}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-red-400">Suspended</p>
        </div>
        <Link href="/super-admin/users" className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-red-300 transition text-center">
          <ShieldAlert className="w-6 h-6 text-red-500 mx-auto mb-1" />
          <p className="text-[10px] font-bold uppercase tracking-wider text-red-500">Manage Users →</p>
        </Link>
      </div>

      {/* Quick Links */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-3">
        <h2 className="text-sm font-bold text-slate-900">Quick Access</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link href="/super-admin/users" className="p-4 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl text-center transition">
            <Users className="w-5 h-5 text-red-600 mx-auto mb-1" />
            <p className="text-xs font-bold text-red-700">User Management</p>
          </Link>
          <Link href="/admin/projects" className="p-4 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl text-center transition">
            <Building2 className="w-5 h-5 text-blue-600 mx-auto mb-1" />
            <p className="text-xs font-bold text-blue-700">All Projects</p>
          </Link>
          <Link href="/admin/events" className="p-4 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl text-center transition">
            <Calendar className="w-5 h-5 text-purple-600 mx-auto mb-1" />
            <p className="text-xs font-bold text-purple-700">All Events</p>
          </Link>
          <Link href="/admin/verification" className="p-4 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-center transition">
            <ShieldAlert className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
            <p className="text-xs font-bold text-emerald-700">Verification Queue</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
