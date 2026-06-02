"use client";

import { useState, useEffect } from "react";
import { 
  Users, Search, MapPin, Building2, 
  Trophy, Loader2, UserCheck
} from "lucide-react";
import { getVerificationRequests } from "@/app/admin/verification/actions";

interface Agent {
  id: string;
  name: string;
  agency_name: string;
  phone: string;
  cp_id: string;
  points: number;
  location: string;
  created_at: string;
}

export default function AgentDirectory() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

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
              cp_id: p.cp_id || "Pending",
              points: p.points || 0,
              location: p.location || "Hyderabad",
              created_at: p.created_at
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

  const filteredAgents = agents.filter(agent => 
    agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.agency_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.cp_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, agency name, or CP ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition shadow-sm"
          />
        </div>
        <div className="text-slate-400 text-xs font-bold shrink-0 self-center">
          {filteredAgents.length} verified partner(s) found
        </div>
      </div>

      {/* Loader */}
      {loading && (
        <div className="flex items-center space-x-2 text-xs font-bold text-slate-400 uppercase tracking-wider justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
          <span>Loading partner list...</span>
        </div>
      )}

      {/* Grid of Agent Cards */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredAgents.map(agent => (
            <div 
              key={agent.id} 
              className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-50/20 transition-all flex flex-col justify-between shadow-sm relative overflow-hidden"
            >
              {/* Badge for Approved */}
              <div className="absolute top-0 right-0 bg-indigo-50 text-indigo-600 px-3 py-1 text-[9px] font-bold uppercase rounded-bl-xl flex items-center space-x-1">
                <UserCheck className="w-3 h-3" />
                <span>Verified</span>
              </div>

              <div className="space-y-4">
                {/* Agent Avatar & Name */}
                <div className="flex items-center space-x-3.5">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-base shadow-sm">
                    {agent.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-sm tracking-tight">{agent.name}</h4>
                    <div className="flex items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                      <span className="text-indigo-600 mr-1.5">{agent.cp_id}</span>
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-2.5 pt-1 text-xs font-semibold text-slate-600">
                  <div className="flex items-center space-x-2">
                    <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>{agent.agency_name}</span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>{agent.location}</span>
                  </div>
                </div>
              </div>

              {/* Footer Metrics */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-3.5 mt-4">
                <div className="text-[10px] text-slate-400 font-bold uppercase">
                  Joined {new Date(agent.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </div>
                <div className="flex items-center space-x-1 bg-amber-50 text-amber-700 px-2.5 py-1 rounded-lg text-xs font-bold">
                  <Trophy className="w-3.5 h-3.5 fill-amber-550 stroke-amber-700" />
                  <span>{agent.points} XP</span>
                </div>
              </div>
            </div>
          ))}

          {filteredAgents.length === 0 && (
            <div className="col-span-full bg-slate-50 border border-slate-200 border-dashed rounded-2xl p-12 text-center text-slate-400">
              <Users className="w-10 h-10 mx-auto text-slate-300 mb-3" />
              <p className="text-sm font-bold">No verified agents match your search.</p>
              <p className="text-xs mt-1">Make sure you have approved channel partners in the Admin queue.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
