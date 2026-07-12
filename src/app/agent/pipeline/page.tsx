"use client";

import { useState, useEffect } from "react";
import { 
  Search, Filter, Plus, FileText,
  MapPin, PhoneCall, Mail, MessageSquare, ArrowRightLeft,
  Calendar, Share2, Loader2, Edit3, Trash2, CheckCircle2,
  Kanban as KanbanIcon, List as ListIcon, X
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getAgentInventoryProjects, DBProject } from "../inventory/actions";

interface Client {
  id: string;
  name: string;
  phone: string;
  bhk: string;
  location: string;
  budget: string;
  date: string;
  propertyType: "Plot" | "Apartment" | "Villa" | "Commercial";
  lastInteraction: string;
  stage: "New" | "Interested" | "Site Visit" | "Negotiation" | "Closed" | "Lost";
}

const STAGE_MAP_DB_TO_UI: Record<string, Client["stage"]> = {
  "new": "New",
  "interested": "Interested",
  "site_visit": "Site Visit",
  "negotiation": "Negotiation",
  "closed": "Closed",
  "lost": "Lost"
};

const STAGE_MAP_UI_TO_DB: Record<Client["stage"], string> = {
  "New": "new",
  "Interested": "interested",
  "Site Visit": "site_visit",
  "Negotiation": "negotiation",
  "Closed": "closed",
  "Lost": "lost"
};

export default function ClientPipeline() {
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"All" | "Apartment" | "Plot" | "Villa" | "Commercial">("All");
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [agentId, setAgentId] = useState<string | null>(null);

  // Matching Builders Modal State
  const [showMatchingModal, setShowMatchingModal] = useState(false);
  const [matchingLead, setMatchingLead] = useState<Client | null>(null);
  const [matchingProjects, setMatchingProjects] = useState<DBProject[]>([]);
  const [loadingMatching, setLoadingMatching] = useState(false);

  // Form states
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientBhk, setNewClientBhk] = useState("");
  const [newClientLoc, setNewClientLoc] = useState("");
  const [newClientBudget, setNewClientBudget] = useState("");
  const [newClientProp, setNewClientProp] = useState<Client["propertyType"]>("Apartment");

  const [clients, setClients] = useState<Client[]>([]);

  const stages: Client["stage"][] = ["New", "Interested", "Site Visit", "Negotiation", "Closed", "Lost"];

  // Fetch client leads from server API (uses service role key — no permission issues)
  async function loadLeads() {
    setLoading(true);
    try {
      const res = await fetch("/api/leads");
      if (!res.ok) {
        console.error("Failed to fetch leads:", res.status);
        setLoading(false);
        return;
      }

      const data = await res.json();
      
      if (data.error) {
        console.error("Leads API error:", data.error);
        setLoading(false);
        return;
      }

      // Set agentId from session for adding new leads
      try {
        const meRes = await fetch("/api/me");
        if (meRes.ok) {
          const meData = await meRes.json();
          if (meData.user?.id) {
            setAgentId(meData.user.id);
          }
        }
      } catch { /* ignore */ }

      if (data.leads) {
        const mappedClients: Client[] = data.leads.map((l: any) => {
          const displayProp = l.details?.propertyType || "Apartment";
          const interaction = l.details?.lastInteraction || "Lead created";

          return {
            id: l.id,
            name: l.name,
            phone: l.phone || "",
            bhk: l.requirement || "",
            location: l.location || "",
            budget: l.budget || "",
            date: new Date(l.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
            propertyType: displayProp,
            lastInteraction: interaction,
            stage: STAGE_MAP_DB_TO_UI[l.status] || "New"
          };
        });
        setClients(mappedClients);
      }
    } catch (err) {
      console.error("Error loading leads:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLeads();
  }, []);

  // Filter clients based on search query
  const filteredClients = clients.filter(client => {
    const matchesSearch = 
      client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.bhk.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = filterType === "All" || client.propertyType === filterType;
    return matchesSearch && matchesType;
  });

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName) {
      alert("Please fill in the Client Name.");
      return;
    }
    setLoading(true);

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newClientName,
          phone: newClientPhone || null,
          requirement: newClientBhk || null,
          location: newClientLoc || null,
          budget: newClientBudget || null,
          details: {
            propertyType: newClientProp,
            lastInteraction: "Lead logged"
          }
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to add lead");
      }

      setNewClientName("");
      setNewClientPhone("");
      setNewClientLoc("");
      setNewClientBudget("");
      setShowAddModal(false);
      
      await loadLeads();
    } catch (err: any) {
      alert("Error adding lead: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMoveStageDirect = async (id: string, newStage: Client["stage"]) => {
    const dbStatus = STAGE_MAP_UI_TO_DB[newStage];
    setLoading(true);

    try {
      const { error } = await supabase
        .from("leads")
        .update({ status: dbStatus })
        .eq("id", id);

      if (error) throw error;
      
      await loadLeads();
    } catch (err: any) {
      alert("Error moving stage: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, newStage: Client["stage"]) => {
    e.preventDefault();
    const clientId = e.dataTransfer.getData("clientId");
    if (clientId) {
      handleMoveStageDirect(clientId, newStage);
    }
  };

  const handleDeleteClient = async (id: string) => {
    if (!confirm("Are you sure you want to delete this lead?")) return;
    setLoading(true);

    try {
      const { error } = await supabase
        .from("leads")
        .delete()
        .eq("id", id);

      if (error) throw error;

      await loadLeads();
    } catch (err: any) {
      alert("Error deleting lead: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReraClick = async (client: Client) => {
    setMatchingLead(client);
    setShowMatchingModal(true);
    setLoadingMatching(true);
    try {
      const allProjects = await getAgentInventoryProjects();
      const clientLocStr = client.location?.toLowerCase().trim() || "";
      const clientBhkStr = client.bhk?.toLowerCase().trim() || "";

      // Match logic:
      // A project matches if its location includes the client's location
      // Or if its name includes the client's location (fuzzy)
      const matched = allProjects.filter(p => {
        const pLoc = p.location?.toLowerCase() || "";
        const matchLoc = clientLocStr && (pLoc.includes(clientLocStr) || clientLocStr.includes(pLoc));
        return matchLoc;
      });
      setMatchingProjects(matched);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMatching(false);
    }
  };

  return (
    <div className="space-y-6 text-slate-800">
      
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Clients Pipeline</h1>
          <p className="text-[#64748b] text-xs font-semibold mt-0.5">Manage operational stages, RERA match preferences, and AI scoring metrics.</p>
        </div>

        <div className="flex items-center space-x-3 w-full md:w-auto shrink-0">
          <div className="flex items-center bg-white border border-slate-200 p-1 rounded-xl text-xs font-bold">
            <button 
              onClick={() => setView("kanban")}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition ${view === "kanban" ? "bg-[#25d366] text-white" : "text-slate-500 hover:text-slate-700"}`}
            >
              <KanbanIcon className="w-3.5 h-3.5" />
              <span>Kanban</span>
            </button>
            <button 
              onClick={() => setView("list")}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition ${view === "list" ? "bg-[#25d366] text-white" : "text-slate-500 hover:text-slate-700"}`}
            >
              <ListIcon className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
          </div>

          <button 
            onClick={() => setShowAddModal(true)}
            className="glow-button px-4 py-2.5 bg-[#25d366] hover:bg-[#16c47f] text-white font-bold text-xs rounded-xl transition flex items-center space-x-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add Client</span>
          </button>
        </div>
      </div>

      {/* Loader indicator */}
      {loading && (
        <div className="flex items-center space-x-2 text-xs font-bold text-slate-405 text-slate-400 uppercase tracking-wider">
          <Loader2 className="w-4 h-4 animate-spin text-[#25d366]" />
          <span>Syncing pipeline...</span>
        </div>
      )}

      {/* Search Filter Controls */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search lead name, location, property type..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 focus:border-[#25d366] rounded-xl py-2 pl-10 pr-4 text-xs text-slate-800 outline-none transition"
          />
        </div>
        <div className="w-full md:w-48">
          <select 
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="w-full bg-white border border-slate-200 text-slate-600 rounded-xl py-2 px-3 outline-none focus:border-[#25d366] transition text-xs font-bold"
          >
            <option value="All">All Types</option>
            <option value="Apartment">Apartment</option>
            <option value="Plot">Plot</option>
            <option value="Villa">Villa</option>
            <option value="Commercial">Commercial</option>
          </select>
        </div>
      </div>

      {/* Main Boards */}
      {view === "kanban" ? (
        <div className="flex space-x-4 overflow-x-auto pb-4 items-start scrollbar">
          {stages.map((stage) => {
            const stageClients = filteredClients.filter(c => c.stage === stage);
            
            return (
              <div 
                key={stage} 
                className="w-72 bg-white rounded-2xl border border-slate-200 p-4 shrink-0 flex flex-col min-h-[500px]"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, stage)}
              >
                {/* Column title */}
                <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2.5">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-[#25d366] inline-block"></span>
                    <h3 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">{stage}</h3>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-500 font-extrabold">
                    {stageClients.length}
                  </span>
                </div>

                {/* Column cards container */}
                <div className="space-y-3 flex-1">
                  {stageClients.map((client) => (
                    <div 
                      key={client.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("clientId", client.id)}
                      className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-[#25d366]/40 hover:bg-white transition flex flex-col justify-between group shadow-sm animate-in fade-in duration-200 cursor-grab active:cursor-grabbing"
                    >
                      <div>
                        <div className="flex justify-between items-start">
                          <h4 className="font-bold text-sm text-slate-800">{client.name}</h4>
                          <button 
                            onClick={() => handleDeleteClient(client.id)}
                            className="text-slate-400 hover:text-red-500 p-0.5 opacity-0 group-hover:opacity-100 transition"
                            title="Delete Client"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="text-[10px] text-slate-500 flex items-center space-x-1.5 mt-1 font-semibold">
                          <span>{client.propertyType}</span>
                          <span>·</span>
                          <span 
                            className="flex items-center text-slate-450 cursor-pointer hover:text-indigo-500 transition"
                            onClick={() => handleReraClick(client)}
                            title="Find Matching Builders"
                          >
                            <MapPin className="w-2.5 h-2.5 mr-0.5" />
                            {client.location}
                          </span>
                        </div>

                        {/* Preferred Config & AI score */}
                        <div className="mt-3 flex items-center justify-between">
                          {client.bhk && (
                            <span 
                              className="text-[9px] font-bold px-2 py-0.5 rounded bg-[#25d366]/10 text-[#16c47f] cursor-pointer hover:bg-[#25d366]/20 transition"
                              onClick={() => handleReraClick(client)}
                              title="Find Matching Builders"
                            >
                              {client.bhk}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Client Card interactive controls */}
                      <div className="mt-4 pt-3.5 border-t border-slate-200/80 flex justify-between items-center">
                        <div>
                          <div className="text-[8px] text-slate-400 uppercase tracking-wider font-semibold">Budget</div>
                          <div className="text-xs font-bold text-slate-900">{client.budget || "-"}</div>
                        </div>

                        {/* Direct contact quick action buttons */}
                        <div className="flex items-center space-x-1 text-slate-500">
                          <button 
                            onClick={() => alert(`Calling ${client.name} at ${client.phone}...`)}
                            className="p-1 hover:bg-slate-100 rounded hover:text-slate-800 transition"
                            title="Call Lead"
                          >
                            <PhoneCall className="w-3 h-3" />
                          </button>
                          
                          <button 
                            onClick={() => alert(`Opening WhatsApp Chat with ${client.name}...`)}
                            className="p-1 hover:bg-[#25d366]/10 rounded hover:text-[#25d366] transition"
                            title="WhatsApp Chat"
                          >
                            <MessageSquare className="w-3 h-3" />
                          </button>
                          
                          <select 
                            value={client.stage}
                            onChange={(e) => handleMoveStageDirect(client.id, e.target.value as Client["stage"])}
                            className="p-1 max-w-[80px] hover:bg-indigo-50 rounded hover:text-indigo-600 transition outline-none cursor-pointer text-[10px] bg-transparent"
                            title="Progress Stage"
                          >
                            {stages.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>

                          <button 
                            onClick={() => alert(`Sharing documents with ${client.name}...`)}
                            className="p-1 hover:bg-slate-100 rounded hover:text-slate-800 transition"
                            title="Share Docs"
                          >
                            <Share2 className="w-3 h-3" />
                          </button>

                          <button 
                            onClick={() => alert(`Editing lead ${client.name}...`)}
                            className="p-1 hover:bg-slate-100 rounded hover:text-slate-800 transition"
                            title="Edit Lead"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>

                          <button 
                            onClick={() => handleDeleteClient(client.id)}
                            className="p-1 hover:bg-red-50 rounded hover:text-red-500 transition"
                            title="Delete Lead"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {stageClients.length === 0 && (
                    <div className="h-28 rounded-xl border border-dashed border-slate-200 flex items-center justify-center text-slate-400 text-[10px]">
                      No leads here
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs font-semibold text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Lead Details</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">RERA Preference</th>
                <th className="px-5 py-3">Budget</th>
                <th className="px-5 py-3">Stage</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredClients.map((client) => (
                <tr key={client.id} className="hover:bg-slate-50/50 transition">
                  <td className="px-5 py-3">
                    <div className="font-bold text-slate-900">{client.name}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{client.phone}</div>
                  </td>
                  <td className="px-5 py-3">{client.propertyType}</td>
                  <td className="px-5 py-3">
                    {client.bhk && (
                      <button 
                        onClick={() => handleReraClick(client)}
                        className="span-bhk px-2 py-0.5 rounded bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 text-[10px] mr-1.5 transition cursor-pointer"
                        title="Find Matching Builders"
                      >
                        {client.bhk}
                      </button>
                    )}
                    <button 
                      onClick={() => handleReraClick(client)}
                      className="text-slate-500 hover:text-indigo-600 transition cursor-pointer"
                      title="Find Matching Builders"
                    >
                      {client.location || "-"}
                    </button>
                  </td>
                  <td className="px-5 py-3 font-bold text-slate-950">{client.budget || "-"}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      client.stage === "New" ? "bg-slate-100 text-slate-655" :
                      client.stage === "Interested" ? "bg-indigo-50 text-indigo-600" :
                      client.stage === "Site Visit" ? "bg-purple-50 text-purple-650" :
                      "bg-emerald-50 text-emerald-600"
                    }`}>
                      {client.stage}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right space-x-2">
                    <button 
                      onClick={() => alert(`Sharing documents with ${client.name}...`)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-semibold transition inline-flex items-center"
                      title="Share Docs"
                    >
                      <Share2 className="w-3 h-3 mr-1" /> Share Docs
                    </button>
                    <select 
                      value={client.stage}
                      onChange={(e) => handleMoveStageDirect(client.id, e.target.value as Client["stage"])}
                      className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded font-semibold transition cursor-pointer outline-none w-28 text-center"
                    >
                      {stages.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button 
                      onClick={() => alert(`Editing lead ${client.name}...`)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-semibold transition"
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => handleDeleteClient(client.id)}
                      className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded font-semibold transition inline-flex items-center"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Client Dialog Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white p-6 rounded-2xl border border-slate-200 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-655 p-1 rounded-lg hover:bg-slate-50 transition"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-lg font-bold text-[#0f172a] mb-4">Add Client Lead</h2>

            <form onSubmit={handleAddClient} className="space-y-4 text-xs font-semibold text-slate-400">
              <div className="space-y-1.5">
                <label className="block uppercase tracking-wider text-[10px]">Client Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#25d366] rounded-xl py-2.5 px-3 text-slate-800 placeholder-slate-400 outline-none text-sm font-medium transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block uppercase tracking-wider text-[10px]">Phone Number</label>
                <input 
                  type="tel" 
                  placeholder="98765 43210"
                  value={newClientPhone}
                  onChange={(e) => setNewClientPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#25d366] rounded-xl py-2.5 px-3 text-slate-800 placeholder-slate-400 outline-none text-sm font-medium transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block uppercase tracking-wider text-[10px]">Property Type</label>
                  <select 
                    value={newClientProp}
                    onChange={(e) => setNewClientProp(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-[#25d366] rounded-xl py-2.5 px-3 text-slate-800 outline-none text-sm font-medium transition"
                  >
                    <option>Apartment</option>
                    <option>Plot</option>
                    <option>Villa</option>
                    <option>Commercial</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block uppercase tracking-wider text-[10px]">Budget Limit</label>
                  <input 
                    type="text" 
                    placeholder="e.g. ₹1.80 Cr"
                    value={newClientBudget}
                    onChange={(e) => setNewClientBudget(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-[#25d366] rounded-xl py-2.5 px-3 text-slate-800 placeholder-slate-400 outline-none text-sm font-medium transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block uppercase tracking-wider text-[10px]">Config Preference</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 3 BHK"
                    value={newClientBhk}
                    onChange={(e) => setNewClientBhk(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-[#25d366] rounded-xl py-2.5 px-3 text-slate-800 placeholder-slate-400 outline-none text-sm font-medium transition"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block uppercase tracking-wider text-[10px]">Preferred Area</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Kokapet"
                    value={newClientLoc}
                    onChange={(e) => setNewClientLoc(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-[#25d366] rounded-xl py-2.5 px-3 text-slate-800 placeholder-slate-400 outline-none text-sm font-medium transition"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 text-sm font-bold">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 bg-transparent text-slate-500 hover:text-slate-800 rounded-xl transition"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2.5 bg-[#25d366] hover:bg-[#16c47f] text-white rounded-xl shadow-lg transition"
                >
                  Save Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Matching Builders Modal */}
      {showMatchingModal && matchingLead && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white p-6 rounded-2xl border border-slate-200 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowMatchingModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-655 p-1 rounded-lg hover:bg-slate-50 transition"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-lg font-bold text-[#0f172a] mb-1">Matching Builders</h2>
            <p className="text-xs font-semibold text-slate-500 mb-4">
              Builders with inventory matching <span className="font-bold text-slate-800">{matchingLead.bhk} in {matchingLead.location}</span>.
            </p>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {loadingMatching ? (
                <div className="flex justify-center items-center py-8 text-slate-400 space-x-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-xs font-bold uppercase tracking-wider">Searching Inventory...</span>
                </div>
              ) : matchingProjects.length > 0 ? (
                matchingProjects.map(proj => (
                  <div key={proj.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-sm font-bold text-slate-900">{proj.name}</div>
                        <div className="text-xs font-semibold text-indigo-600 mt-0.5">By {proj.builder}</div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
                        {proj.price}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 flex items-center space-x-3">
                      <span className="flex items-center"><MapPin className="w-3 h-3 mr-1"/>{proj.location}</span>
                      <span>{proj.type}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500 text-xs font-medium">
                  No matching builders found for this location.
                </div>
              )}
            </div>
            
            <div className="mt-4 pt-4 border-t border-slate-100 text-right">
              <button 
                onClick={() => setShowMatchingModal(false)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
