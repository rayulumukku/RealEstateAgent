"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Building2, Users, Megaphone, CalendarCheck, 
  BarChart3, TrendingUp, HelpCircle,
  Loader2, RefreshCw, UserCheck, Briefcase, MapPin
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Agent {
  id: string;
  name: string;
  agency_name: string;
  phone: string;
  status: string;
  location: string;
  points: number;
  created_at: string;
}

export default function BuilderDashboard() {
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [totalProjects, setTotalProjects] = useState(0);

  async function loadData() {
    setLoading(true);
    try {
      // Fetch all agents
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "agent")
        .order("created_at", { ascending: false });

      if (profiles) {
        setAgents(profiles);
      }

      // Fetch total leads count
      const { count: leadsCount } = await supabase
        .from("leads")
        .select("id", { count: "exact", head: true });

      setTotalLeads(leadsCount || 0);

      // Fetch total projects count
      const { count: projectsCount } = await supabase
        .from("projects")
        .select("id", { count: "exact", head: true });

      setTotalProjects(projectsCount || 0);
    } catch (err) {
      console.error("Error loading builder data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="space-y-8 text-slate-800">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Builder Hub Overview</h1>
          <p className="text-[#64748b] text-xs font-semibold mt-0.5">Live platform data — registered agents, leads, and projects.</p>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          <button
            onClick={() => loadData()}
            className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs rounded-xl transition flex items-center space-x-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
          <Link 
            href="/builder/campaigns" 
            className="glow-button px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition flex items-center space-x-1.5 shadow-md shadow-indigo-600/25"
          >
            <Megaphone className="w-4 h-4 shrink-0" />
            <span>Create Campaign</span>
          </Link>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center space-x-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
          <span>Loading platform data...</span>
        </div>
      )}

      {/* Quick Actions Row */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs font-bold">
          <Link href="/builder/campaigns" className="p-3 bg-slate-50 hover:bg-indigo-50/50 rounded-xl border border-slate-200 text-slate-700 flex flex-col items-center text-center transition">
            <span className="text-lg mb-1">📢</span>
            <span>Create Campaign</span>
          </Link>
          <Link href="/builder/projects/new" className="p-3 bg-slate-50 hover:bg-indigo-50/50 rounded-xl border border-slate-200 text-slate-700 flex flex-col items-center text-center transition">
            <span className="text-lg mb-1">🚜</span>
            <span>Upload Inventory</span>
          </Link>
          <button onClick={() => alert("Sponsor Webinar: generate rewards voucher pass.")} className="p-3 bg-slate-50 hover:bg-indigo-50/50 rounded-xl border border-slate-200 text-slate-700 flex flex-col items-center text-center transition">
            <span className="text-lg mb-1">🎓</span>
            <span>Sponsor Webinar</span>
          </button>
          <button onClick={() => alert("Create CP Meet Launch event & generate QR pass.")} className="p-3 bg-slate-50 hover:bg-indigo-50/50 rounded-xl border border-slate-200 text-slate-700 flex flex-col items-center text-center transition">
            <span className="text-lg mb-1">🚀</span>
            <span>Create Launch Event</span>
          </button>
          <button onClick={() => alert("Open Document vault to upload brochures.")} className="p-3 bg-slate-50 hover:bg-indigo-50/50 rounded-xl border border-slate-200 text-slate-700 flex flex-col items-center text-center transition">
            <span className="text-lg mb-1">📄</span>
            <span>Upload Brochure</span>
          </button>
        </div>
      </div>

      {/* Metrics Row — LIVE from Supabase */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 flex items-center justify-between shadow-sm">
          <div>
            <div className="text-2xl font-extrabold text-slate-900">{totalProjects}</div>
            <div className="text-xs text-slate-400 mt-1 font-bold uppercase tracking-wider">Active Projects</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 flex items-center justify-between shadow-sm">
          <div>
            <div className="text-2xl font-extrabold text-slate-900">{agents.length}</div>
            <div className="text-xs text-slate-400 mt-1 font-bold uppercase tracking-wider">Registered Agents</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 flex items-center justify-between shadow-sm">
          <div>
            <div className="text-2xl font-extrabold text-slate-900">{totalLeads}</div>
            <div className="text-xs text-slate-400 mt-1 font-bold uppercase tracking-wider">Total Leads</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center">
            <Briefcase className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 flex items-center justify-between shadow-sm">
          <div>
            <div className="text-2xl font-extrabold text-slate-900">{agents.filter(a => a.status === "approved").length}</div>
            <div className="text-xs text-slate-400 mt-1 font-bold uppercase tracking-wider">Approved Agents</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-[#25d366]/10 text-[#16c47f] flex items-center justify-center">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Agent Directory — LIVE from Supabase */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
            <Users className="w-4 h-4 text-indigo-500" />
            <span>Agent Directory ({agents.length})</span>
          </h3>
          <Link href="/builder/agents" className="text-xs text-indigo-600 font-bold uppercase hover:underline">
            View All
          </Link>
        </div>

        <div className="space-y-3 max-h-[500px] overflow-y-auto">
          {agents.length === 0 && !loading && (
            <div className="text-center text-slate-400 text-xs py-8">No agents registered yet.</div>
          )}
          {agents.map((agent) => (
            <div key={agent.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 hover:border-indigo-200 transition flex justify-between items-center text-xs font-semibold">
              <div>
                <div className="font-extrabold text-slate-900">{agent.name}</div>
                <div className="text-[10px] text-slate-500 mt-0.5 flex items-center space-x-2">
                  <span>{agent.agency_name || "Independent Agent"}</span>
                  {agent.location && (
                    <>
                      <span>·</span>
                      <span className="flex items-center">
                        <MapPin className="w-2.5 h-2.5 mr-0.5" />
                        {agent.location}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="text-right">
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                  agent.status === "approved" 
                    ? "bg-emerald-50 text-emerald-600" 
                    : "bg-amber-50 text-amber-600"
                }`}>
                  {agent.status === "approved" ? "Approved" : "Pending"}
                </span>
                <div className="text-[9px] text-slate-400 mt-1">Joined {timeAgo(agent.created_at)}</div>
                {agent.points > 0 && (
                  <div className="text-[9px] text-indigo-500 font-bold mt-0.5">{agent.points} XP</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
