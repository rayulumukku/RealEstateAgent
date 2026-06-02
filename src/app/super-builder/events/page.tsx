"use client";

import { useEffect, useState } from "react";
import { Calendar, MapPin, Loader2, Send, Users, Building2, Check, X, Search, Megaphone } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { HYDERABAD_LOCATIONS } from "@/lib/hyderabadLocations";

type AudienceType = "builders" | "agents" | "both";

interface MyEvent {
  id: string;
  title: string;
  date: string;
  location: string;
  description: string;
  event_type: string;
  target_audience: string;
  created_at: string;
}

export default function SuperBuilderEvents() {
  const [loading, setLoading] = useState(true);
  const [myEvents, setMyEvents] = useState<MyEvent[]>([]);
  const [tab, setTab] = useState<"create" | "history">("create");

  // Create event form
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [targetAudience, setTargetAudience] = useState<AudienceType>("both");
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [locationSearch, setLocationSearch] = useState("");
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [creating, setCreating] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    setLoading(true);
    try {
      const meRes = await fetch("/api/me");
      const meData = await meRes.json();
      if (!meData.user) return;

      const { data: events } = await supabase
        .from("super_builder_events")
        .select("*")
        .eq("created_by", meData.user.id)
        .order("created_at", { ascending: false });

      if (events) setMyEvents(events);
    } catch (err) {
      console.error("Error loading events:", err);
    } finally {
      setLoading(false);
    }
  }

  function toggleLocation(loc: string) {
    setSelectedLocations((prev) =>
      prev.includes(loc) ? prev.filter((l) => l !== loc) : [...prev, loc]
    );
  }

  const filteredLocations = HYDERABAD_LOCATIONS.filter((loc) =>
    loc.toLowerCase().includes(locationSearch.toLowerCase())
  );

  async function handleCreateEvent() {
    if (!eventName || !eventDate || !eventLocation) {
      setError("Event name, date, and location are required.");
      return;
    }

    setCreating(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/super-builder/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: eventName,
          date: eventDate,
          location: eventLocation,
          description: eventDescription,
          target_audience: targetAudience,
          target_locations: selectedLocations,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Failed to create event.");
      } else {
        setSuccess(`Event "${eventName}" created for ${targetAudience === "both" ? "builders & agents" : targetAudience}!`);
        setEventName("");
        setEventDate("");
        setEventLocation("");
        setEventDescription("");
        setSelectedLocations([]);
        loadEvents();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-800">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
            <Calendar className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Events</h1>
            <p className="text-sm text-slate-500">Create events for builders, agents, or both</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab("create")}
          className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
            tab === "create" ? "bg-white text-purple-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Create Event
        </button>
        <button
          onClick={() => setTab("history")}
          className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
            tab === "history" ? "bg-white text-purple-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          My Events ({myEvents.length})
        </button>
      </div>

      {/* Create Event Tab */}
      {tab === "create" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
          {/* Audience Selection */}
          <div className="space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Target Audience *
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setTargetAudience("builders")}
                className={`p-4 rounded-xl border text-center transition ${
                  targetAudience === "builders"
                    ? "border-purple-500 bg-purple-50 ring-2 ring-purple-200"
                    : "border-slate-200 hover:border-purple-300"
                }`}
              >
                <Building2 className={`w-6 h-6 mx-auto mb-2 ${targetAudience === "builders" ? "text-purple-600" : "text-slate-400"}`} />
                <p className="text-xs font-bold text-slate-800">Builders Only</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Regular builders</p>
              </button>
              <button
                type="button"
                onClick={() => setTargetAudience("agents")}
                className={`p-4 rounded-xl border text-center transition ${
                  targetAudience === "agents"
                    ? "border-purple-500 bg-purple-50 ring-2 ring-purple-200"
                    : "border-slate-200 hover:border-purple-300"
                }`}
              >
                <Users className={`w-6 h-6 mx-auto mb-2 ${targetAudience === "agents" ? "text-purple-600" : "text-slate-400"}`} />
                <p className="text-xs font-bold text-slate-800">Agents Only</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Channel partners</p>
              </button>
              <button
                type="button"
                onClick={() => setTargetAudience("both")}
                className={`p-4 rounded-xl border text-center transition ${
                  targetAudience === "both"
                    ? "border-purple-500 bg-purple-50 ring-2 ring-purple-200"
                    : "border-slate-200 hover:border-purple-300"
                }`}
              >
                <Megaphone className={`w-6 h-6 mx-auto mb-2 ${targetAudience === "both" ? "text-purple-600" : "text-slate-400"}`} />
                <p className="text-xs font-bold text-slate-800">Both</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Builders & agents</p>
              </button>
            </div>
          </div>

          {/* Event Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Event Name *</label>
              <input
                type="text"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="e.g. Skyline Heights CP Meet"
                className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 rounded-xl py-2.5 px-3 text-slate-800 outline-none text-sm font-medium transition"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Date & Time *</label>
              <input
                type="text"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                placeholder="e.g. 15th June 2026, 3:00 PM"
                className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 rounded-xl py-2.5 px-3 text-slate-800 outline-none text-sm font-medium transition"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Event Location *</label>
            <input
              type="text"
              value={eventLocation}
              onChange={(e) => setEventLocation(e.target.value)}
              placeholder="e.g. Kokapet Convention Center, Hyderabad"
              className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 rounded-xl py-2.5 px-3 text-slate-800 outline-none text-sm font-medium transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Description</label>
            <textarea
              rows={3}
              value={eventDescription}
              onChange={(e) => setEventDescription(e.target.value)}
              placeholder="Describe the event, special offers, highlights..."
              className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 rounded-xl py-2.5 px-3 text-slate-800 outline-none text-sm font-medium transition resize-none"
            />
          </div>

          {/* Location Filter (for agents) */}
          {(targetAudience === "agents" || targetAudience === "both") && (
            <div className="space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Filter by Agent Location (optional)
              </label>
              {selectedLocations.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedLocations.map((loc) => (
                    <span key={loc} className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-600 border border-purple-200 text-[11px] font-bold">
                      <MapPin className="w-3 h-3" />
                      <span>{loc}</span>
                      <button type="button" onClick={() => toggleLocation(loc)}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <button type="button" onClick={() => setSelectedLocations([])} className="text-[10px] text-red-500 font-bold uppercase px-2 py-1">Clear</button>
                </div>
              )}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={locationSearch}
                  onChange={(e) => { setLocationSearch(e.target.value); setShowLocationDropdown(true); }}
                  onFocus={() => setShowLocationDropdown(true)}
                  placeholder="Search Hyderabad areas..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-purple-500 rounded-xl text-sm text-slate-800 outline-none transition"
                />
                {showLocationDropdown && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                    {filteredLocations.slice(0, 20).map((loc) => (
                      <button
                        key={loc}
                        type="button"
                        onClick={() => { toggleLocation(loc); setLocationSearch(""); }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center justify-between ${
                          selectedLocations.includes(loc) ? "bg-purple-50 text-purple-700" : "text-slate-700"
                        }`}
                      >
                        <span>{loc}</span>
                        {selectedLocations.includes(loc) && <Check className="w-3.5 h-3.5 text-purple-600" />}
                      </button>
                    ))}
                    <button type="button" onClick={() => setShowLocationDropdown(false)} className="w-full text-center py-2 text-[10px] text-slate-400 font-bold uppercase border-t border-slate-100">Close</button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Status Messages */}
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-bold">{error}</div>}
          {success && <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-600 font-bold">{success}</div>}

          {/* Submit */}
          <button
            onClick={handleCreateEvent}
            disabled={creating}
            className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm rounded-xl shadow-md transition disabled:opacity-50 uppercase tracking-wider flex items-center justify-center space-x-2"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /><span>Create Event</span></>}
          </button>
        </div>
      )}

      {/* History Tab */}
      {tab === "history" && (
        <div className="space-y-3">
          {myEvents.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
              <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-sm text-slate-500">No events created yet.</p>
            </div>
          ) : (
            myEvents.map((event) => (
              <div key={event.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="text-sm font-extrabold text-slate-900">{event.title}</h3>
                    <div className="flex items-center space-x-3 text-xs text-slate-500">
                      <span className="flex items-center space-x-1"><Calendar className="w-3 h-3" /><span>{event.date}</span></span>
                      <span className="flex items-center space-x-1"><MapPin className="w-3 h-3" /><span>{event.location}</span></span>
                    </div>
                    {event.description && <p className="text-xs text-slate-500 mt-2 line-clamp-2">{event.description}</p>}
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                      event.target_audience === "builders" ? "bg-indigo-50 text-indigo-600" :
                      event.target_audience === "agents" ? "bg-emerald-50 text-emerald-600" :
                      "bg-purple-50 text-purple-600"
                    }`}>
                      {event.target_audience === "both" ? "Builders & Agents" : event.target_audience}
                    </span>
                    <p className="text-[10px] text-slate-400">{formatDate(event.created_at)}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
