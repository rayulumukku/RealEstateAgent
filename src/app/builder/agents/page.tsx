"use client";

import { useState, useEffect } from "react";
import { 
  Users, Search, MapPin, Building2, 
  Trophy, Loader2, UserCheck, Phone, Mail,
  ChevronDown, ChevronUp, Calendar
} from "lucide-react";
import { getVerificationRequests } from "@/app/admin/verification/actions";
import { maskPhone, maskEmail } from "@/lib/mask";

interface Agent {
  id: string;
  name: string;
  agency_name: string;
  phone: string;
  email?: string;
  cp_id: string;
  points: number;
  location: string;
  created_at: string;
  is_rera_approved?: boolean;
}

export default function AgentDirectory() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);
  const [reraFilter, setReraFilter] = useState<"all" | "rera">("all");
  const [selectedLocation, setSelectedLocation] = useState("");

  useEffect(() => {
    async function loadAgents() {
      setLoading(true);
      try {
        const res = await getVerificationRequests();
        if (res.success && res.profiles) {
          // Filter to only show approved channel partners (agents)
          const approved = res.profiles
            .filter((p: any) => p.status === "approved")
            .map((p: any) => ({
              id: p.id,
              name: p.name,
              agency_name: p.agency_name || "Independent Agent",
              phone: p.phone,
              email: p.email || "No Email",
              cp_id: p.cp_id || "Pending",
              points: p.points || 0,
              location: p.location || "Hyderabad",
              created_at: p.created_at,
              is_rera_approved: p.is_rera_approved || false
            }));
          setAgents(approved);
        }
      } catch (err) {
        console.error("Error loading agents:", err);
      } finally {
        setLoading(false);
      }
    }
    loadAgents();
  }, []);

  const uniqueLocations = Array.from(
    new Set(agents.map((a) => a.location?.trim()).filter(Boolean))
  ).sort();

  const filteredAgents = agents.filter(agent => {
    const matchesSearch = 
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.agency_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.cp_id.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRera = reraFilter === "all" || agent.is_rera_approved;
    const matchesLocation = !selectedLocation || agent.location?.trim() === selectedLocation;

    return matchesSearch && matchesRera && matchesLocation;
  });

  return (
    <div className="space-y-6 text-slate-800">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Users className="w-7 h-7 text-indigo-600" />
            <span>Agent Directory</span>
          </h1>
          <p className="text-[#64748b] text-xs font-semibold mt-0.5">
            View all approved Channel Partners, their verification IDs, and engagement scores.
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-sm text-xs font-semibold">
        <div className="flex-1 max-w-md relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, agency name, or CP ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition shadow-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Location Filter */}
          <div className="flex items-center space-x-2 bg-white px-3 py-2 border border-slate-200 rounded-xl shadow-sm">
            <span className="text-slate-400 text-[10px] uppercase tracking-wider font-extrabold">Location:</span>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="bg-transparent text-slate-700 font-bold outline-none cursor-pointer"
            >
              <option value="">All Locations</option>
              {uniqueLocations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          {/* RERA Filter Tabs */}
          <div className="flex bg-slate-200/60 p-1 rounded-xl text-[11px] font-bold">
            <button
              onClick={() => setReraFilter("all")}
              className={`px-3 py-1.5 rounded-lg transition shrink-0 ${
                reraFilter === "all" ? "bg-white text-indigo-650 shadow-sm" : "text-slate-500 hover:text-slate-850"
              }`}
            >
              All Agents
            </button>
            <button
              onClick={() => setReraFilter("rera")}
              className={`px-3 py-1.5 rounded-lg transition shrink-0 ${
                reraFilter === "rera" ? "bg-white text-indigo-650 shadow-sm" : "text-slate-500 hover:text-slate-850"
              }`}
            >
              RERA Approved
            </button>
          </div>

          <div className="text-slate-400 font-bold shrink-0 pl-1 self-center">
            {filteredAgents.length} verified partner(s) found
          </div>
        </div>
      </div>

      {/* Loader */}
      {loading && (
        <div className="flex items-center space-x-2 text-xs font-bold text-slate-400 uppercase tracking-wider justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
          <span>Loading partner list...</span>
        </div>
      )}

      {/* List of Agents */}
      {!loading && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {filteredAgents.length === 0 ? (
            <div className="bg-slate-50 border-slate-200 border-dashed rounded-2xl p-12 text-center text-slate-400 m-4">
              <Users className="w-10 h-10 mx-auto text-slate-300 mb-3" />
              <p className="text-sm font-bold">No verified agents match your search.</p>
              <p className="text-xs mt-1">Make sure you have approved channel partners in the Admin queue.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {/* Header Row */}
              <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_auto] gap-4 px-6 py-3.5 bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                <span>Name / CP ID</span>
                <span>Agency Name</span>
                <span>Location</span>
                <span>Engagement Score</span>
                <span className="w-5"></span>
              </div>

              {filteredAgents.map((agent) => {
                const isExpanded = expandedAgentId === agent.id;
                return (
                  <div key={agent.id} className="transition-all hover:bg-slate-50/50">
                    {/* Main Row */}
                    <div 
                      onClick={() => setExpandedAgentId(isExpanded ? null : agent.id)}
                      className="grid grid-cols-[1.5fr_1fr_1fr_1fr_auto] gap-4 px-6 py-4.5 items-center cursor-pointer font-bold text-xs text-slate-700"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-650 flex items-center justify-center font-extrabold text-sm shadow-sm shrink-0 border border-indigo-100">
                          {agent.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <span className="font-extrabold text-slate-900 text-sm tracking-tight">{agent.name}</span>
                            {agent.is_rera_approved && (
                              <span className="text-[9px] bg-indigo-100 border border-indigo-200 text-indigo-700 px-1.5 py-0.5 rounded font-extrabold shrink-0">
                                RERA Verified
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider mt-0.5">{agent.cp_id}</p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1.5 text-slate-650">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{agent.agency_name}</span>
                      </div>

                      <div className="flex items-center space-x-1.5 text-slate-650">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{agent.location}</span>
                      </div>

                      <div>
                        <div className="flex items-center space-x-1 bg-amber-50 text-amber-700 border border-amber-100/50 px-2.5 py-1 rounded-lg text-xs font-bold w-fit">
                          <Trophy className="w-3.5 h-3.5 fill-amber-550 stroke-amber-700" />
                          <span>{agent.points} XP</span>
                        </div>
                      </div>

                      <div className="flex justify-end pr-2">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-400 transition" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400 transition" />
                        )}
                      </div>
                    </div>

                    {/* Expanded Details Row */}
                    {isExpanded && (
                      <div className="px-6 pb-5 pt-3.5 bg-slate-50/30 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-semibold">
                        <div className="flex items-center space-x-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                          <div className="p-2 bg-indigo-50 text-indigo-650 rounded-lg">
                            <Phone className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Phone Number</p>
                            <p className="text-slate-800 text-sm font-extrabold mt-0.5">{maskPhone(agent.phone)}</p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                          <div className="p-2 bg-indigo-50 text-indigo-650 rounded-lg">
                            <Mail className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Email Address</p>
                            <p className="text-slate-800 text-sm font-extrabold mt-0.5">{maskEmail(agent.email || "")}</p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                          <div className="p-2 bg-indigo-50 text-indigo-650 rounded-lg">
                            <Calendar className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Verification Date</p>
                            <p className="text-slate-800 text-sm font-extrabold mt-0.5">
                              {new Date(agent.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
