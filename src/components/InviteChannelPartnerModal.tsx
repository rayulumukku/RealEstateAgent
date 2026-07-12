"use client";

import { useState, useEffect, useMemo } from "react";
import { Users, X, MapPin, Send, Loader2, CheckSquare, Square } from "lucide-react";
import { HYDERABAD_LOCATIONS } from "@/lib/hyderabadLocations";
import { supabase } from "@/lib/supabase";
import { maskPhone } from "@/lib/mask";

interface AgentProfile {
  id: string;
  name: string;
  agency_name: string;
  location: string;
  is_rera_approved: boolean;
}

interface InviteChannelPartnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingConnections?: Record<string, "invited" | "connected" | "none">;
}

export default function InviteChannelPartnerModal({ isOpen, onClose, existingConnections }: InviteChannelPartnerModalProps) {
  const [recipientFilter, setRecipientFilter] = useState<"all" | "rera">("all");
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [locationSearch, setLocationSearch] = useState("");
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  
  const [filteredAgents, setFilteredAgents] = useState<AgentProfile[]>([]);
  const [selectedAgentIds, setSelectedAgentIds] = useState<Set<string>>(new Set());
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);
  
  const [messageTemplate, setMessageTemplate] = useState("We are incredibly excited to invite you to join our exclusive Channel Partner network!");
  
  const [sending, setSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchFilteredAgents();
    }
  }, [isOpen, selectedLocations, recipientFilter]);

  async function fetchFilteredAgents() {
    setIsLoadingAgents(true);
    try {
      let query = supabase
        .from("profiles")
        .select("id, name, agency_name, location, is_rera_approved")
        .eq("role", "agent")
        .eq("status", "approved");

      if (recipientFilter === "rera") {
        query = query.eq("is_rera_approved", true);
      }

      if (selectedLocations.length > 0) {
        query = query.in("location", selectedLocations);
      }

      const { data, error } = await query;
      if (!error && data) {
        let finalData = data;
        if (existingConnections) {
          finalData = data.filter(a => !existingConnections[a.id]);
        }
        setFilteredAgents(finalData);
        // By default, select all filtered agents
        setSelectedAgentIds(new Set(finalData.map(a => a.id)));
      } else {
        setFilteredAgents([]);
        setSelectedAgentIds(new Set());
      }
    } catch {
      setFilteredAgents([]);
      setSelectedAgentIds(new Set());
    } finally {
      setIsLoadingAgents(false);
    }
  }

  const toggleLocation = (loc: string) => {
    setSelectedLocations((prev) =>
      prev.includes(loc) ? prev.filter((l) => l !== loc) : [...prev, loc]
    );
  };

  const toggleAgentSelection = (id: string) => {
    const newSelection = new Set(selectedAgentIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedAgentIds(newSelection);
  };

  const selectAll = () => {
    setSelectedAgentIds(new Set(filteredAgents.map(a => a.id)));
  };

  const deselectAll = () => {
    setSelectedAgentIds(new Set());
  };

  const filteredLocations = HYDERABAD_LOCATIONS.filter((loc) =>
    loc.toLowerCase().includes(locationSearch.toLowerCase())
  );

  const handleLaunchCampaign = async () => {
    if (selectedAgentIds.size === 0) return;
    
    setSending(true);
    const phone = localStorage.getItem("agentsapp_logged_in_phone") || "";
    
    try {
      const res = await fetch("/api/invite-partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          builderPhone: phone,
          agentIds: Array.from(selectedAgentIds),
          messageTemplate
        })
      });

      const data = await res.json();
      if (data.success) {
        setSentSuccess(true);
        setTimeout(() => {
          setSentSuccess(false);
          onClose();
        }, 3000);
      } else {
        alert("Failed to send invitations: " + data.error);
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-800">Invite Channel Partners</h2>
              <p className="text-xs font-semibold text-slate-500">Send WhatsApp invitations (100 credits on accept)</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {sentSuccess ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                <Send className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-extrabold text-slate-800">Invitations Sent!</h3>
                <p className="text-sm text-slate-500 font-medium mt-1">
                  We've broadcasted the channel partner invitation to {selectedAgentIds.size} agents.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* RERA Filter */}
              <div className="space-y-2">
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider">Agent Type Filter</label>
                <div className="flex space-x-3">
                  <label className={`flex-1 flex flex-col items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition ${recipientFilter === "all" ? "border-indigo-600 bg-indigo-50/50" : "border-slate-200 hover:border-slate-300 bg-white"}`}>
                    <input 
                      type="radio" 
                      name="agentType" 
                      className="sr-only" 
                      checked={recipientFilter === "all"} 
                      onChange={() => setRecipientFilter("all")} 
                    />
                    <span className={`text-sm font-extrabold ${recipientFilter === "all" ? "text-indigo-700" : "text-slate-700"}`}>All Verified Agents</span>
                  </label>
                  <label className={`flex-1 flex flex-col items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition ${recipientFilter === "rera" ? "border-indigo-600 bg-indigo-50/50" : "border-slate-200 hover:border-slate-300 bg-white"}`}>
                    <input 
                      type="radio" 
                      name="agentType" 
                      className="sr-only" 
                      checked={recipientFilter === "rera"} 
                      onChange={() => setRecipientFilter("rera")} 
                    />
                    <span className={`text-sm font-extrabold flex items-center space-x-1 ${recipientFilter === "rera" ? "text-indigo-700" : "text-slate-700"}`}>
                      <span>RERA Approved</span>
                      <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded ml-1">RERA</span>
                    </span>
                  </label>
                </div>
              </div>

              {/* Location Filter */}
              <div className="space-y-2">
                <label className="block uppercase tracking-wider text-[10px] font-extrabold text-slate-500">
                  Location Filter
                </label>

                {selectedLocations.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {selectedLocations.map((loc) => (
                      <span key={loc} className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200 text-[11px] font-bold">
                        <MapPin className="w-3 h-3" />
                        <span>{loc}</span>
                        <button type="button" onClick={() => toggleLocation(loc)} className="text-indigo-400 hover:text-indigo-600 ml-1">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                    <button type="button" onClick={() => setSelectedLocations([])} className="text-[10px] text-red-500 hover:text-red-700 font-bold uppercase tracking-wider px-2 py-1">
                      Clear All
                    </button>
                  </div>
                )}

                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search areas to filter (e.g. Kokapet)"
                    value={locationSearch}
                    onChange={(e) => {
                      setLocationSearch(e.target.value);
                      setShowLocationDropdown(true);
                    }}
                    onFocus={() => setShowLocationDropdown(true)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl py-2 px-3 text-slate-800 outline-none text-sm font-medium transition"
                  />
                  
                  {showLocationDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 shadow-xl rounded-xl max-h-48 overflow-y-auto">
                      <div className="sticky top-0 bg-slate-50 border-b border-slate-100 p-2 flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Select Areas</span>
                        <button type="button" onClick={() => setShowLocationDropdown(false)} className="text-slate-400 hover:text-slate-600 p-1">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="p-1">
                        {filteredLocations.length > 0 ? (
                          filteredLocations.map((loc) => (
                            <button
                              key={loc}
                              type="button"
                              onClick={() => {
                                toggleLocation(loc);
                                setLocationSearch("");
                              }}
                              className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-lg flex items-center justify-between"
                            >
                              <span>{loc}</span>
                              {selectedLocations.includes(loc) && (
                                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                              )}
                            </button>
                          ))
                        ) : (
                          <div className="p-3 text-center text-xs font-bold text-slate-400">
                            No locations found
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Agent Selection List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                    Select Agents ({selectedAgentIds.size} / {filteredAgents.length})
                  </label>
                  <div className="flex space-x-3 text-[10px] font-bold uppercase tracking-wider">
                    <button type="button" onClick={selectAll} className="text-indigo-600 hover:text-indigo-700">Select All</button>
                    <button type="button" onClick={deselectAll} className="text-slate-500 hover:text-slate-700">Clear</button>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl border border-slate-200 max-h-56 overflow-y-auto p-1">
                  {isLoadingAgents ? (
                    <div className="flex flex-col items-center justify-center p-8 text-slate-400">
                      <Loader2 className="w-5 h-5 animate-spin mb-2" />
                      <span className="text-xs font-bold uppercase tracking-wider">Loading agents...</span>
                    </div>
                  ) : filteredAgents.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                      <p className="text-xs font-bold uppercase tracking-wider">No agents match filters</p>
                    </div>
                  ) : (
                    filteredAgents.map(agent => (
                      <div 
                        key={agent.id}
                        onClick={() => toggleAgentSelection(agent.id)}
                        className="flex items-center space-x-3 p-3 hover:bg-white rounded-lg cursor-pointer transition border border-transparent hover:border-slate-200"
                      >
                        <div className="shrink-0 text-indigo-600">
                          {selectedAgentIds.has(agent.id) ? (
                            <CheckSquare className="w-5 h-5" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-300" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-extrabold text-slate-800 truncate">{agent.name}</span>
                            {agent.is_rera_approved && (
                              <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded shrink-0 font-bold">RERA</span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 text-xs text-slate-500 font-medium mt-0.5 truncate">
                            <span>{agent.agency_name}</span>
                            <span>•</span>
                            <span className="truncate">{agent.location}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Message Template */}
              <div className="space-y-2">
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider">Custom Message</label>
                <textarea 
                  rows={4}
                  value={messageTemplate}
                  onChange={(e) => setMessageTemplate(e.target.value)}
                  placeholder="Write your custom invitation message..."
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl py-2 px-3 text-slate-800 outline-none text-sm font-medium transition"
                />
                <p className="text-[10px] text-slate-500 font-semibold italic">
                  Note: The bot will automatically append "Reply Yes to accept, or No to decline." to the end of your message.
                </p>
              </div>

            </div>
          )}
        </div>

        {/* Footer */}
        {!sentSuccess && (
          <div className="border-t border-slate-100 p-4 bg-slate-50/50 flex items-center justify-between">
            <div className="text-xs font-bold text-slate-500">
              Selected: <span className="text-indigo-600 text-sm font-extrabold">{selectedAgentIds.size}</span> agents
            </div>
            <div className="flex space-x-3">
              <button onClick={onClose} disabled={sending} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-200 rounded-xl transition text-sm">
                Cancel
              </button>
              <button 
                onClick={handleLaunchCampaign}
                disabled={sending || selectedAgentIds.size === 0}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-2 rounded-xl font-extrabold text-sm shadow-md transition flex items-center"
              >
                {sending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...</>
                ) : (
                  <><Send className="w-4 h-4 mr-2" /> Send Invites</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
