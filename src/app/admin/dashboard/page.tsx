"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  ShieldAlert, Users, Building, 
  Clock, CheckCircle2, Loader2,
  Briefcase, RefreshCw, X, ChevronRight, MapPin, Phone
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Profile {
  id: string;
  name: string;
  agency_name: string;
  phone: string;
  role: string;
  status: string;
  location: string;
  points: number;
  created_at: string;
}

interface Project {
  id: string;
  name: string;
  location: string;
  city: string;
  price_range: string;
  type: string;
  created_at: string;
  developer_id: string;
  developer_name?: string;
}

interface Lead {
  id: string;
  name: string;
  phone: string;
  status: string;
  requirement: string;
  location: string;
  budget: string;
  created_at: string;
  agent_id: string;
  agent_name?: string;
}

type ActiveTab = "projects" | "agents" | "builders" | "leads" | "pending";

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<Profile[]>([]);
  const [builders, setBuilders] = useState<Profile[]>([]);
  const [pendingProfiles, setPendingProfiles] = useState<Profile[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>("projects");

  // Agent detail view
  const [selectedAgent, setSelectedAgent] = useState<Profile | null>(null);
  const [agentLeads, setAgentLeads] = useState<Lead[]>([]);
  const [loadingAgentLeads, setLoadingAgentLeads] = useState(false);

  // Builder detail view
  const [selectedBuilder, setSelectedBuilder] = useState<Profile | null>(null);
  const [builderProjects, setBuilderProjects] = useState<Project[]>([]);

  async function loadData() {
    setLoading(true);
    try {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profiles) {
        setAgents(profiles.filter((p: Profile) => p.role === "agent"));
        setBuilders(profiles.filter((p: Profile) => p.role === "builder"));
        setPendingProfiles(profiles.filter((p: Profile) => p.status === "pending"));
      }

      const { data: leadsData } = await supabase
        .from("leads")
        .select("*, profiles!leads_agent_id_fkey(name)")
        .order("created_at", { ascending: false });

      if (leadsData) {
        const mappedLeads = leadsData.map((l: any) => ({
          ...l,
          agent_name: l.profiles?.name || "Unknown Agent",
        }));
        setLeads(mappedLeads);
      }

      const { data: projectsData } = await supabase
        .from("projects")
        .select("*, profiles(name)")
        .order("created_at", { ascending: false });

      if (projectsData) {
        setProjects(projectsData.map((p: any) => ({
          ...p,
          developer_name: p.profiles?.name || "Unknown Builder"
        })));
      }
    } catch (err) {
      console.error("Error loading admin data:", err);
    } finally {
      setLoading(false);
    }
  }

  async function viewAgentLeads(agent: Profile) {
    setSelectedAgent(agent);
    setLoadingAgentLeads(true);
    try {
      const { data: agentLeadsData } = await supabase
        .from("leads")
        .select("*")
        .eq("agent_id", agent.id)
        .order("created_at", { ascending: false });

      setAgentLeads(agentLeadsData || []);
    } catch (err) {
      console.error("Error loading agent leads:", err);
    } finally {
      setLoadingAgentLeads(false);
    }
  }

  function viewBuilderProjects(builder: Profile) {
    setSelectedBuilder(builder);
    setBuilderProjects(projects.filter(p => p.developer_id === builder.id));
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

  const tabs: { key: ActiveTab; label: string; count: number; icon: any; color: string }[] = [
    { key: "projects", label: "Total Projects", count: projects.length, icon: Building, color: "blue" },
    { key: "builders", label: "Builders", count: builders.length, icon: Building, color: "indigo" },
    { key: "agents", label: "Registered Agents", count: agents.length, icon: Users, color: "emerald" },
    { key: "pending", label: "Pending Verification", count: pendingProfiles.length, icon: ShieldAlert, color: "red" },
  ];

  return (
    <div className="space-y-6 text-slate-800">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Admin Console</h1>
          <p className="text-[#64748b] text-xs font-semibold mt-0.5">Live platform data — agents, leads, and verifications.</p>
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
            href="/admin/verification" 
            className="glow-button px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition flex items-center space-x-1.5 shadow-md shadow-emerald-700/25"
          >
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>Verifications Queue</span>
          </Link>
        </div>
      </div>

      {loading && (
        <div className="flex items-center space-x-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
          <span>Loading platform data...</span>
        </div>
      )}

      {/* Tabs — clickable metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`p-5 rounded-2xl border-2 flex items-center justify-between shadow-sm transition-all text-left ${
                isActive
                  ? `border-${tab.color}-500 bg-${tab.color}-50/30 ring-1 ring-${tab.color}-200`
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div>
                <div className="text-2xl font-extrabold text-slate-900">{tab.count}</div>
                <div className="text-xs text-slate-400 mt-1 font-bold uppercase tracking-wider">{tab.label}</div>
              </div>
              <Icon className={`w-5 h-5 ${isActive ? `text-${tab.color}-500` : "text-slate-300"}`} />
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm min-h-[400px]">

        {/* PROJECTS TAB */}
        {activeTab === "projects" && (
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
              All Projects ({projects.length})
            </h3>
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {projects.length === 0 && !loading && (
                <div className="text-center text-slate-400 text-xs py-8">No projects created yet.</div>
              )}
              {projects.map((project) => (
                <div key={project.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 hover:border-blue-300 transition text-xs font-semibold">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-extrabold text-slate-900">{project.name}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5 capitalize">
                        {project.type} · {project.location}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">
                        Developer: <span className="text-indigo-600 font-bold">{project.developer_name}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 text-blue-600">
                        Active
                      </span>
                      <div className="text-[9px] text-slate-400 mt-1">{timeAgo(project.created_at)}</div>
                      {project.price_range && <div className="text-[9px] text-emerald-600 font-bold mt-0.5">{project.price_range}</div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AGENTS TAB */}
        {activeTab === "agents" && (
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
              Agents ({agents.length}) — Click to view leads
            </h3>
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {agents.length === 0 && !loading && (
                <div className="text-center text-slate-400 text-xs py-8">No agents registered yet.</div>
              )}
              {agents.map((agent) => {
                const agentLeadCount = leads.filter(l => l.agent_id === agent.id).length;
                return (
                  <button
                    key={agent.id}
                    onClick={() => viewAgentLeads(agent)}
                    className="w-full text-left p-4 bg-slate-50 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30 transition text-xs font-semibold group"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-extrabold text-slate-900">{agent.name}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {agent.agency_name || "Independent"} · {agent.phone}
                        </div>
                        {agent.location && (
                          <div className="text-[10px] text-slate-400 mt-0.5 flex items-center space-x-1">
                            <MapPin className="w-2.5 h-2.5" />
                            <span>{agent.location}</span>
                          </div>
                        )}
                      </div>
                      <div className="text-right flex items-center space-x-3">
                        <div>
                          <div className="text-[9px] text-slate-400">Leads</div>
                          <div className="font-extrabold text-slate-900">{agentLeadCount}</div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          agent.status === "approved" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                        }`}>
                          {agent.status === "approved" ? "Approved" : "Pending"}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 transition" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* BUILDERS TAB */}
        {activeTab === "builders" && (
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
              Builders ({builders.length})
            </h3>
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {builders.length === 0 && !loading && (
                <div className="text-center text-slate-400 text-xs py-8">No builders registered yet.</div>
              )}
              {builders.map((builder) => {
                const builderProjectCount = projects.filter(p => p.developer_id === builder.id).length;
                return (
                  <button 
                    key={builder.id} 
                    onClick={() => viewBuilderProjects(builder)}
                    className="w-full text-left p-4 bg-slate-50 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition text-xs font-semibold group"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-extrabold text-slate-900">{builder.name}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {builder.agency_name || "Builder"} · {builder.phone}
                        </div>
                        {builder.location && (
                          <div className="text-[10px] text-slate-400 mt-0.5 flex items-center space-x-1">
                            <MapPin className="w-2.5 h-2.5" />
                            <span>{builder.location}</span>
                          </div>
                        )}
                      </div>
                      <div className="text-right flex items-center space-x-3">
                        <div>
                          <div className="text-[9px] text-slate-400">Projects</div>
                          <div className="font-extrabold text-slate-900">{builderProjectCount}</div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          builder.status === "approved" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                        }`}>
                          {builder.status === "approved" ? "Approved" : "Pending"}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* LEADS TAB */}
        {activeTab === "leads" && (
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
              All Platform Leads ({leads.length})
            </h3>
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {leads.length === 0 && !loading && (
                <div className="text-center text-slate-400 text-xs py-8">No leads yet.</div>
              )}
              {leads.map((lead) => (
                <div key={lead.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 hover:border-slate-300 transition text-xs font-semibold">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-extrabold text-slate-900">{lead.name}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {lead.phone} · {lead.location || "N/A"} · {lead.requirement || "N/A"}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">
                        Added by: <span className="text-emerald-600 font-bold">{lead.agent_name}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        lead.status === "new" ? "bg-slate-100 text-slate-600" :
                        lead.status === "interested" ? "bg-indigo-50 text-indigo-600" :
                        lead.status === "site_visit" ? "bg-purple-50 text-purple-600" :
                        lead.status === "negotiation" ? "bg-amber-50 text-amber-600" :
                        lead.status === "closed" ? "bg-emerald-50 text-emerald-600" :
                        "bg-red-50 text-red-600"
                      }`}>
                        {lead.status?.toUpperCase()}
                      </span>
                      <div className="text-[9px] text-slate-400 mt-1">{timeAgo(lead.created_at)}</div>
                      {lead.budget && <div className="text-[9px] text-slate-500 mt-0.5">{lead.budget}</div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PENDING VERIFICATION TAB */}
        {activeTab === "pending" && (
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
              Pending Verification ({pendingProfiles.length})
            </h3>
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {pendingProfiles.length === 0 && !loading && (
                <div className="text-center text-slate-400 text-xs py-8">No pending verifications.</div>
              )}
              {pendingProfiles.map((profile) => (
                <div key={profile.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 hover:border-amber-200 transition text-xs font-semibold">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-extrabold text-slate-900">{profile.name}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {profile.agency_name || "N/A"} · {profile.phone}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 capitalize">Role: {profile.role}</div>
                    </div>
                    <div className="text-right">
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-600">
                        Pending
                      </span>
                      <div className="text-[9px] text-slate-400 mt-1">{timeAgo(profile.created_at)}</div>
                      <Link
                        href="/admin/verification"
                        className="text-[9px] text-emerald-600 font-bold mt-1 block hover:underline"
                      >
                        Review →
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Agent Detail Modal */}
      {selectedAgent && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex justify-between items-start">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">{selectedAgent.name}</h2>
                <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                  <div className="flex items-center space-x-1">
                    <Phone className="w-3 h-3" />
                    <span>{selectedAgent.phone}</span>
                  </div>
                  <div>{selectedAgent.agency_name || "Independent Agent"}</div>
                  {selectedAgent.location && (
                    <div className="flex items-center space-x-1">
                      <MapPin className="w-3 h-3" />
                      <span>{selectedAgent.location}</span>
                    </div>
                  )}
                </div>
                <div className="mt-2 flex items-center space-x-2">
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                    selectedAgent.status === "approved" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                  }`}>
                    {selectedAgent.status === "approved" ? "Approved" : "Pending"}
                  </span>
                  {selectedAgent.points > 0 && (
                    <span className="text-[9px] font-bold text-indigo-500">{selectedAgent.points} XP</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedAgent(null)}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-6 max-h-[400px] overflow-y-auto">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                Leads added by {selectedAgent.name} ({agentLeads.length})
              </h3>

              {loadingAgentLeads && (
                <div className="flex items-center space-x-2 text-xs text-slate-400 py-4">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading leads...</span>
                </div>
              )}

              {!loadingAgentLeads && agentLeads.length === 0 && (
                <div className="text-center text-slate-400 text-xs py-8">This agent has not added any leads yet.</div>
              )}

              <div className="space-y-3">
                {agentLeads.map((lead) => (
                  <div key={lead.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs font-semibold">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-extrabold text-slate-900">{lead.name}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {lead.phone} · {lead.location || "N/A"}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Requirement: {lead.requirement || "N/A"} · Budget: {lead.budget || "N/A"}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          lead.status === "new" ? "bg-slate-100 text-slate-600" :
                          lead.status === "interested" ? "bg-indigo-50 text-indigo-600" :
                          lead.status === "site_visit" ? "bg-purple-50 text-purple-600" :
                          lead.status === "negotiation" ? "bg-amber-50 text-amber-600" :
                          lead.status === "closed" ? "bg-emerald-50 text-emerald-600" :
                          "bg-red-50 text-red-600"
                        }`}>
                          {lead.status?.toUpperCase()}
                        </span>
                        <div className="text-[9px] text-slate-400 mt-1">{timeAgo(lead.created_at)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Builder Detail Modal */}
      {selectedBuilder && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex justify-between items-start">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">{selectedBuilder.name}</h2>
                <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                  <div className="flex items-center space-x-1">
                    <Phone className="w-3 h-3" />
                    <span>{selectedBuilder.phone}</span>
                  </div>
                  <div>{selectedBuilder.agency_name || "Builder"}</div>
                  {selectedBuilder.location && (
                    <div className="flex items-center space-x-1">
                      <MapPin className="w-3 h-3" />
                      <span>{selectedBuilder.location}</span>
                    </div>
                  )}
                </div>
                <div className="mt-2 flex items-center space-x-2">
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                    selectedBuilder.status === "approved" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                  }`}>
                    {selectedBuilder.status === "approved" ? "Approved" : "Pending"}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedBuilder(null)}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-6 max-h-[400px] overflow-y-auto">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                Projects by {selectedBuilder.name} ({builderProjects.length})
              </h3>

              {builderProjects.length === 0 && (
                <div className="text-center text-slate-400 text-xs py-8">This builder has not added any projects yet.</div>
              )}

              <div className="space-y-3">
                {builderProjects.map((project) => (
                  <div key={project.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs font-semibold">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-extrabold text-slate-900">{project.name}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {project.type} · {project.location}, {project.city}
                        </div>
                        {project.price_range && (
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Est. Price: <span className="font-bold text-emerald-600">{project.price_range}</span>
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 text-blue-600">
                          Active
                        </span>
                        <div className="text-[9px] text-slate-400 mt-1">{timeAgo(project.created_at)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
