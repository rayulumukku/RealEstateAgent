"use client";

import { useState, useEffect } from "react";
import { Calendar, Loader2, MapPin, Users, Crown, Clock, Search, X, Timer, Pencil, Trash2, Plus, Save } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface EventItem {
  id: string;
  title: string;
  date: string;
  location: string;
  description: string;
  event_type: string;
  target_audience?: string;
  target_locations?: string[];
  created_at: string;
  source: "builder_campaign" | "super_builder";
  creator_name: string;
  creator_role: string;
  creator_phone: string;
  days_until: number | null;
  rsvp_count: number;
}

interface BuilderOption {
  id: string;
  name: string;
  phone: string;
  role: string;
}

export default function AdminEventsPage() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "upcoming" | "past">("all");

  // Edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSource, setEditSource] = useState<"event" | "super_builder_event">("event");
  const [editForm, setEditForm] = useState({ title: "", date: "", location: "", description: "" });
  const [saving, setSaving] = useState(false);

  // Delete
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Create
  const [showCreate, setShowCreate] = useState(false);
  const [createType, setCreateType] = useState<"event" | "super_builder_event">("event");
  const [createForm, setCreateForm] = useState({ builder_id: "", created_by: "", title: "", date: "", location: "", description: "", target_audience: "both" });
  const [creating, setCreating] = useState(false);
  const [builders, setBuilders] = useState<BuilderOption[]>([]);

  useEffect(() => {
    loadEvents();
    loadBuilders();
  }, []);

  async function loadBuilders() {
    const { data } = await supabase
      .from("profiles")
      .select("id, name, phone, role")
      .in("role", ["builder", "super_builder"])
      .order("name", { ascending: true });
    if (data) setBuilders(data);
  }

  function parseDateToMs(dateStr: string): number | null {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.getTime();
    const cleaned = dateStr.replace(/(\d+)(st|nd|rd|th)/, "$1");
    const d2 = new Date(cleaned);
    if (!isNaN(d2.getTime())) return d2.getTime();
    return null;
  }

  function getDaysUntil(dateStr: string): number | null {
    const ms = parseDateToMs(dateStr);
    if (!ms) return null;
    return Math.ceil((ms - Date.now()) / (1000 * 60 * 60 * 24));
  }

  async function loadEvents() {
    setLoading(true);
    try {
      const allEvents: EventItem[] = [];

      const { data: generalEvents } = await supabase.from("events").select("*").order("created_at", { ascending: false });
      const { data: sbEvents } = await supabase.from("super_builder_events").select("*, profiles!super_builder_events_created_by_fkey(name, role, phone)").order("created_at", { ascending: false });
      const { data: campaigns } = await supabase.from("campaigns").select("*, profiles!campaigns_builder_id_fkey(name, role, phone)").order("created_at", { ascending: false });
      const { data: rsvps } = await supabase.from("rsvps").select("event_id");

      const rsvpMap = new Map<string, number>();
      if (rsvps) for (const r of rsvps) rsvpMap.set(r.event_id, (rsvpMap.get(r.event_id) || 0) + 1);

      const campaignMap = new Map<string, any>();
      if (campaigns) for (const c of campaigns) campaignMap.set(c.name, { name: c.profiles?.name || "Unknown", role: c.profiles?.role || "builder", phone: c.profiles?.phone || "" });

      if (generalEvents) {
        for (const e of generalEvents) {
          const creator = campaignMap.get(e.title);
          allEvents.push({ id: e.id, title: e.title, date: e.date, location: e.location, description: e.description || "", event_type: e.event_type || "campaign", target_locations: e.target_locations || [], created_at: e.created_at, source: "builder_campaign", creator_name: creator?.name || "Builder", creator_role: creator?.role || "builder", creator_phone: creator?.phone || "", days_until: getDaysUntil(e.date), rsvp_count: rsvpMap.get(e.id) || 0 });
        }
      }

      if (sbEvents) {
        for (const e of sbEvents) {
          allEvents.push({ id: e.id, title: e.title, date: e.date, location: e.location, description: e.description || "", event_type: "super_builder_event", target_audience: e.target_audience, target_locations: e.target_locations || [], created_at: e.created_at, source: "super_builder", creator_name: e.profiles?.name || "Super Builder", creator_role: "super_builder", creator_phone: e.profiles?.phone || "", days_until: getDaysUntil(e.date), rsvp_count: 0 });
        }
      }

      allEvents.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setEvents(allEvents);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  }

  function startEdit(event: EventItem) {
    setEditingId(event.id);
    setEditSource(event.source === "super_builder" ? "super_builder_event" : "event");
    setEditForm({ title: event.title, date: event.date, location: event.location, description: event.description });
  }

  async function handleSaveEdit() {
    if (!editingId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/manage", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: editSource, id: editingId, updates: editForm }) });
      const data = await res.json();
      if (res.ok && data.ok) { setEditingId(null); await loadEvents(); }
      else alert(data.error || "Failed.");
    } catch { alert("Network error."); }
    finally { setSaving(false); }
  }

  async function handleDelete(event: EventItem) {
    if (!window.confirm(`Delete event "${event.title}"? This cannot be undone.`)) return;
    setDeletingId(event.id);
    const type = event.source === "super_builder" ? "super_builder_event" : "event";
    try {
      const res = await fetch("/api/admin/manage", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, id: event.id }) });
      const data = await res.json();
      if (res.ok && data.ok) await loadEvents();
      else alert(data.error || "Failed.");
    } catch { alert("Network error."); }
    finally { setDeletingId(null); }
  }

  async function handleCreate() {
    if (!createForm.title || !createForm.date || !createForm.location) { alert("Title, date, and location are required."); return; }
    setCreating(true);
    try {
      const body = createType === "super_builder_event"
        ? { type: "super_builder_event", data: { created_by: createForm.created_by, title: createForm.title, date: createForm.date, location: createForm.location, description: createForm.description, target_audience: createForm.target_audience } }
        : { type: "event", data: { builder_id: createForm.builder_id || undefined, title: createForm.title, date: createForm.date, location: createForm.location, description: createForm.description } };

      const res = await fetch("/api/admin/manage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (res.ok && data.ok) { setShowCreate(false); setCreateForm({ builder_id: "", created_by: "", title: "", date: "", location: "", description: "", target_audience: "both" }); await loadEvents(); }
      else alert(data.error || "Failed.");
    } catch { alert("Network error."); }
    finally { setCreating(false); }
  }

  const filteredEvents = events.filter((e) => {
    const matchesSearch = e.title.toLowerCase().includes(searchQuery.toLowerCase()) || e.creator_name.toLowerCase().includes(searchQuery.toLowerCase()) || e.location.toLowerCase().includes(searchQuery.toLowerCase());
    if (filterType === "upcoming") return matchesSearch && e.days_until !== null && e.days_until > 0;
    if (filterType === "past") return matchesSearch && (e.days_until === null || e.days_until <= 0);
    return matchesSearch;
  });

  const upcomingCount = events.filter((e) => e.days_until !== null && e.days_until > 0).length;

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>;

  return (
    <div className="space-y-6 text-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">All Events</h1>
          <p className="text-[#64748b] text-xs font-semibold mt-0.5">Edit, delete, or create events on behalf of builders or super builders.</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition uppercase tracking-wider flex items-center space-x-2">
          <Plus className="w-4 h-4" /><span>Create Event</span>
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center space-x-3 mb-2">
            <h3 className="text-sm font-bold text-slate-900">Create Event</h3>
            <div className="flex space-x-1 bg-slate-100 p-0.5 rounded-lg">
              <button onClick={() => setCreateType("event")} className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase ${createType === "event" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500"}`}>Builder Event</button>
              <button onClick={() => setCreateType("super_builder_event")} className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase ${createType === "super_builder_event" ? "bg-white text-purple-700 shadow-sm" : "text-slate-500"}`}>Super Builder Event</button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Assign to *</label>
              <select value={createType === "super_builder_event" ? createForm.created_by : createForm.builder_id} onChange={(e) => createType === "super_builder_event" ? setCreateForm({ ...createForm, created_by: e.target.value }) : setCreateForm({ ...createForm, builder_id: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500">
                <option value="">Select {createType === "super_builder_event" ? "super builder" : "builder"}...</option>
                {builders.filter(b => createType === "super_builder_event" ? b.role === "super_builder" : true).map((b) => (
                  <option key={b.id} value={b.id}>{b.name} ({b.role === "super_builder" ? "SB" : "B"}) - {b.phone}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Event Title *</label>
              <input type="text" value={createForm.title} onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })} placeholder="e.g. CP Meet Launch" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Date *</label>
              <input type="text" value={createForm.date} onChange={(e) => setCreateForm({ ...createForm, date: e.target.value })} placeholder="e.g. 20th June 2026, 3:00 PM" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Location *</label>
              <input type="text" value={createForm.location} onChange={(e) => setCreateForm({ ...createForm, location: e.target.value })} placeholder="e.g. Kokapet, Hyderabad" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Description</label>
              <textarea rows={2} value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} placeholder="Event details..." className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500 resize-none" />
            </div>
            {createType === "super_builder_event" && (
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Target Audience</label>
                <select value={createForm.target_audience} onChange={(e) => setCreateForm({ ...createForm, target_audience: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500">
                  <option value="both">Both (Builders & Agents)</option>
                  <option value="builders">Builders Only</option>
                  <option value="agents">Agents Only</option>
                </select>
              </div>
            )}
          </div>
          <div className="flex space-x-3 pt-2">
            <button onClick={handleCreate} disabled={creating} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition disabled:opacity-50 uppercase tracking-wider">{creating ? "Creating..." : "Create Event"}</button>
            <button onClick={() => setShowCreate(false)} className="px-5 py-2.5 text-slate-500 hover:text-slate-800 font-bold text-xs uppercase tracking-wider">Cancel</button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm"><p className="text-2xl font-extrabold text-slate-900">{events.length}</p><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Events</p></div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm"><p className="text-2xl font-extrabold text-emerald-600">{upcomingCount}</p><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Upcoming</p></div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm"><p className="text-2xl font-extrabold text-slate-900">{events.filter(e => e.source === "builder_campaign").length}</p><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">By Builders</p></div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm"><p className="text-2xl font-extrabold text-purple-600">{events.filter(e => e.source === "super_builder").length}</p><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">By Super Builders</p></div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search event, creator, or location..." className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:border-emerald-500 transition" />
          {searchQuery && <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-slate-400" /></button>}
        </div>
        <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl">
          {(["all", "upcoming", "past"] as const).map((type) => (
            <button key={type} onClick={() => setFilterType(type)} className={`px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition ${filterType === type ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500"}`}>{type === "all" ? "All" : type === "upcoming" ? `Upcoming (${upcomingCount})` : "Past"}</button>
          ))}
        </div>
      </div>

      {/* Events List */}
      <div className="space-y-3">
        {filteredEvents.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center"><Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" /><p className="text-sm text-slate-500">No events match your filters.</p></div>
        ) : (
          filteredEvents.map((event) => (
            <div key={event.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition">
              {editingId === event.id ? (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600">Editing Event</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input type="text" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} placeholder="Title" className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
                    <input type="text" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} placeholder="Date" className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
                    <input type="text" value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} placeholder="Location" className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
                    <input type="text" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} placeholder="Description" className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
                  </div>
                  <div className="flex space-x-3">
                    <button onClick={handleSaveEdit} disabled={saving} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition disabled:opacity-50 flex items-center space-x-1.5"><Save className="w-3.5 h-3.5" /><span>{saving ? "Saving..." : "Save"}</span></button>
                    <button onClick={() => setEditingId(null)} className="px-4 py-2 text-slate-500 hover:text-slate-800 font-bold text-xs">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <h3 className="text-sm font-extrabold text-slate-900">{event.title}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${event.source === "super_builder" ? "bg-purple-50 text-purple-600" : "bg-indigo-50 text-indigo-600"}`}>{event.source === "super_builder" ? "Super Builder" : "Builder Campaign"}</span>
                      {event.target_audience && <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${event.target_audience === "builders" ? "bg-blue-50 text-blue-600" : event.target_audience === "agents" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>{event.target_audience === "both" ? "Both" : event.target_audience}</span>}
                    </div>
                    <div className="flex items-center space-x-4 text-xs text-slate-500">
                      <span className="flex items-center space-x-1"><Calendar className="w-3 h-3" /><span>{event.date}</span></span>
                      <span className="flex items-center space-x-1"><MapPin className="w-3 h-3" /><span>{event.location}</span></span>
                      {event.rsvp_count > 0 && <span className="flex items-center space-x-1 text-emerald-600 font-bold"><Users className="w-3 h-3" /><span>{event.rsvp_count} RSVPs</span></span>}
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-slate-500">
                      <span>By:</span>
                      <span className="font-bold text-slate-800 flex items-center space-x-1">{event.creator_role === "super_builder" && <Crown className="w-3 h-3 text-purple-500" />}<span>{event.creator_name}</span></span>
                      <span className="text-slate-400">({event.creator_phone})</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 shrink-0 ml-3">
                    {/* Countdown */}
                    {event.days_until !== null && event.days_until > 0 && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-2.5 py-1.5 text-center mr-2">
                        <span className="text-sm font-extrabold text-emerald-600">{event.days_until}</span>
                        <p className="text-[8px] font-bold text-emerald-500 uppercase">days</p>
                      </div>
                    )}
                    {event.days_until === 0 && <span className="px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-lg text-[10px] font-bold text-amber-600 mr-2">TODAY</span>}
                    {event.days_until !== null && event.days_until < 0 && <span className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-400 mr-2">PAST</span>}
                    <button onClick={() => startEdit(event)} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition" title="Edit"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(event)} disabled={deletingId === event.id} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50" title="Delete">{deletingId === event.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}</button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
