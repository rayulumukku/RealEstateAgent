"use client";

import { useEffect, useState } from "react";
import { getCampaignsAction, getCampaignDetailsAction } from "./actions";
import { Megaphone, Search, Users, MapPin, X, CheckCircle2, XCircle } from "lucide-react";

export default function AdminCampaignsMonitor() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [searchAgent, setSearchAgent] = useState("");
  const [filterStatus, setFilterStatus] = useState<"All" | "Sent" | "Didn't send">("All");

  useEffect(() => {
    fetchCampaigns();
  }, []);

  async function fetchCampaigns() {
    setLoading(true);
    const res = await getCampaignsAction();
    if (res.ok) {
      setCampaigns(res.campaigns);
    } else {
      console.error("Failed to load campaigns:", res.error);
    }
    setLoading(false);
  }

  async function handleSelectCampaign(campaign: any) {
    setSelectedCampaign(campaign);
    setAgents([]);
    setSearchAgent("");
    setFilterStatus("All");
    setLoadingDetails(true);

    const res = await getCampaignDetailsAction(
      campaign.name,
      campaign.created_at,
      campaign.audience_segment || ""
    );
    if (res.ok) {
      setAgents(res.agents);
    } else {
      console.error("Failed to load campaign details:", res.error);
    }
    setLoadingDetails(false);
  }

  const filteredAgents = agents
    .filter(agent => {
      const matchesSearch = (agent.name || "").toLowerCase().includes(searchAgent.toLowerCase()) || 
                            (agent.phone || "").includes(searchAgent);
      const matchesStatus = filterStatus === "All" || agent.status === filterStatus;
      return matchesSearch && matchesStatus;
    })
    // Sort: Sent first, Didn't send second
    .sort((a, b) => {
      if (a.status === "Sent" && b.status !== "Sent") return -1;
      if (a.status !== "Sent" && b.status === "Sent") return 1;
      return (a.name || "").localeCompare(b.name || "");
    });

  const sentCount = agents.filter(a => a.status === "Sent").length;
  const notSentCount = agents.length - sentCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Campaign Monitor</h1>
          <p className="text-[#64748b] text-sm mt-1">
            Track builder WhatsApp broadcasts and verify delivery to individual agents.
          </p>
        </div>
        <button 
          onClick={fetchCampaigns}
          className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition"
        >
          Refresh Data
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start relative">
        {/* Campaigns List (Left) */}
        <div className={`transition-all duration-300 ${selectedCampaign ? 'lg:col-span-5' : 'lg:col-span-12'}`}>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[700px]">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-indigo-500" />
                All Broadcasts
              </h2>
              <span className="text-xs font-bold text-slate-400">{campaigns.length} total</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loading ? (
                <div className="text-center text-sm text-slate-400 py-10 animate-pulse">Loading campaigns...</div>
              ) : campaigns.length === 0 ? (
                <div className="text-center text-sm text-slate-400 py-10">No campaigns found.</div>
              ) : (
                campaigns.map((camp) => (
                  <div 
                    key={camp.id}
                    onClick={() => handleSelectCampaign(camp)}
                    className={`p-4 rounded-xl border transition cursor-pointer group ${
                      selectedCampaign?.id === camp.id 
                        ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-500' 
                        : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-md'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className={`font-extrabold text-sm ${selectedCampaign?.id === camp.id ? 'text-indigo-900' : 'text-slate-900 group-hover:text-indigo-600'}`}>
                        {camp.name}
                      </h3>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded-full">
                        {new Date(camp.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                      <span className="font-semibold text-slate-700">{camp.builder?.name || "Unknown Builder"}</span>
                      {camp.builder?.agency_name && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                          <span className="truncate max-w-[150px]">{camp.builder.agency_name}</span>
                        </>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100/50">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
                        <Users className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-slate-600">Reached: <span className="text-emerald-700">{camp.sent_count} agents</span></span>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span className="text-[10px] text-slate-500 truncate max-w-[120px]" title={camp.audience_segment}>
                          {camp.audience_segment}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Campaign Detail Panel (Right) */}
        {selectedCampaign && (
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden flex flex-col h-[700px] animate-in slide-in-from-right-4">
            
            {/* Detail Header */}
            <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-slate-900 to-slate-800 text-white relative">
              <button 
                onClick={() => setSelectedCampaign(null)}
                className="absolute top-4 right-4 p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition"
              >
                <X className="w-4 h-4 text-white" />
              </button>
              
              <div className="pr-8">
                <div className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider mb-1">
                  {new Date(selectedCampaign.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
                <h2 className="text-xl font-extrabold text-white mb-3">
                  {selectedCampaign.name}
                </h2>
                
                <div className="flex flex-wrap gap-3">
                  <div className="bg-white/10 backdrop-blur px-3 py-1.5 rounded-lg text-xs font-medium text-white flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-indigo-300" />
                    <span>By: <span className="font-bold">{selectedCampaign.builder?.name || "Unknown"}</span></span>
                  </div>
                  <div className="bg-white/10 backdrop-blur px-3 py-1.5 rounded-lg text-xs font-medium text-white flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-emerald-300" />
                    <span className="truncate max-w-[200px]" title={selectedCampaign.audience_segment}>
                      {selectedCampaign.audience_segment}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Metrics Bar */}
            <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100 bg-slate-50 shrink-0">
              <div className="p-3 text-center">
                <div className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Targeted</div>
                <div className="text-lg font-black text-slate-800">{selectedCampaign.sent_count}</div>
              </div>
              <div className="p-3 text-center bg-emerald-50/50">
                <div className="text-[10px] uppercase font-bold text-emerald-600 mb-0.5">✅ Sent</div>
                <div className="text-lg font-black text-emerald-700">
                  {loadingDetails ? "..." : sentCount}
                </div>
              </div>
              <div className="p-3 text-center bg-red-50/50">
                <div className="text-[10px] uppercase font-bold text-red-400 mb-0.5">❌ Didn't Send</div>
                <div className="text-lg font-black text-red-600">
                  {loadingDetails ? "..." : notSentCount}
                </div>
              </div>
            </div>

            {/* Zero-reach warning */}
            {selectedCampaign.sent_count === 0 && (
              <div className="mx-4 mt-3 mb-0 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-semibold flex items-start gap-2">
                <span className="text-lg leading-none">⚠️</span>
                <span>
                  This campaign reached <strong>0 agents</strong>. This usually means the filter (e.g. RERA Only) had no matching agents in the database at launch time.
                  {selectedCampaign.audience_segment?.toLowerCase().includes("rera") && (
                    <> Check that agents have their <strong>RERA Approved</strong> toggle turned ON in the Verification page.</>
                  )}
                </span>
              </div>
            )}

            {/* Search & Filter */}
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3 shrink-0">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  placeholder="Search agent name or phone..."
                  value={searchAgent}
                  onChange={(e) => setSearchAgent(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl text-sm outline-none transition"
                />
              </div>
              <div className="flex bg-slate-100 p-1 rounded-xl shrink-0">
                {(["All", "Sent", "Didn't send"] as const).map(status => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
                      filterStatus === status 
                        ? 'bg-white text-slate-900 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {/* Agent List */}
            <div className="flex-1 overflow-y-auto">
              {loadingDetails ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-3">
                  <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                  <div className="text-sm font-bold">Analyzing message delivery logs...</div>
                </div>
              ) : filteredAgents.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 p-6 text-center">
                  <Users className="w-12 h-12 text-slate-200 mb-3" />
                  <div className="text-sm font-bold text-slate-600">No agents found</div>
                  <div className="text-xs mt-1">Try adjusting your search or filters. Note: Only approved agents are checked.</div>
                </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-white sticky top-0 border-b border-slate-200 z-10 shadow-sm">
                    <tr>
                      <th className="px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider">Agent Details</th>
                      <th className="px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider">Location</th>
                      <th className="px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider text-right">Delivery Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAgents.map(agent => (
                      <tr key={agent.id} className="hover:bg-slate-50/80 transition">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{agent.name || "Unknown"}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{agent.phone || "No phone"}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs font-medium text-slate-600 bg-slate-100 inline-flex px-2 py-1 rounded-md">
                            {agent.location || "Not set"}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {agent.status === "Sent" ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Sent
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-xs font-bold border border-slate-200">
                              <XCircle className="w-3.5 h-3.5" />
                              Didn't send
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
