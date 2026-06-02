"use client";

import { useEffect, useState } from "react";
import { Calendar, MapPin, Loader2, Megaphone, Users, Clock, Building2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Campaign {
  id: string;
  name: string;
  audience_segment: string;
  template: string;
  sent_count: number;
  read_rate: number;
  created_at: string;
}

interface Event {
  id: string;
  title: string;
  date: string;
  location: string;
  description: string;
  event_type: string;
  created_at: string;
}

export default function BuilderEventsHistory() {
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [tab, setTab] = useState<"events" | "campaigns">("events");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const phone = localStorage.getItem("agentsapp_logged_in_phone");
      if (!phone) return;

      const { data: profileData } = await supabase
        .from("profiles")
        .select("id")
        .eq("phone", phone)
        .single();

      if (!profileData) return;

      // Load campaigns
      const { data: campaignsData } = await supabase
        .from("campaigns")
        .select("*")
        .eq("builder_id", profileData.id)
        .order("created_at", { ascending: false });

      if (campaignsData) setCampaigns(campaignsData);

      // Load events
      const { data: eventsData } = await supabase
        .from("events")
        .select("*")
        .order("created_at", { ascending: false });

      if (eventsData) setEvents(eventsData);
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
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
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-800">
      {/* Header */}
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">My Events & Campaigns</h1>
        <p className="text-[#64748b] text-xs font-semibold mt-0.5">History of all events and campaigns you have created.</p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab("events")}
          className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
            tab === "events" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <span className="flex items-center space-x-1.5">
            <Calendar className="w-3.5 h-3.5" />
            <span>Events ({events.length})</span>
          </span>
        </button>
        <button
          onClick={() => setTab("campaigns")}
          className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
            tab === "campaigns" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <span className="flex items-center space-x-1.5">
            <Megaphone className="w-3.5 h-3.5" />
            <span>Campaigns ({campaigns.length})</span>
          </span>
        </button>
      </div>

      {/* Events Tab */}
      {tab === "events" && (
        <div className="space-y-3">
          {events.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
              <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-sm text-slate-500">No events created yet.</p>
            </div>
          ) : (
            events.map((event) => (
              <div key={event.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="text-sm font-extrabold text-slate-900">{event.title}</h3>
                    <div className="flex items-center space-x-3 text-xs text-slate-500">
                      <span className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3" />
                        <span>{event.date}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <MapPin className="w-3 h-3" />
                        <span>{event.location}</span>
                      </span>
                    </div>
                    {event.description && (
                      <p className="text-xs text-slate-500 mt-2 line-clamp-2">{event.description}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                      {event.event_type || "Event"}
                    </span>
                    <p className="text-[10px] text-slate-400 mt-2">{formatDate(event.created_at)}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Campaigns Tab */}
      {tab === "campaigns" && (
        <div className="space-y-3">
          {campaigns.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
              <Megaphone className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-sm text-slate-500">No campaigns launched yet.</p>
            </div>
          ) : (
            campaigns.map((campaign) => (
              <div key={campaign.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="text-sm font-extrabold text-slate-900">{campaign.name}</h3>
                    <p className="text-xs text-slate-500">{campaign.audience_segment}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="flex items-center space-x-2">
                      <span className="flex items-center space-x-1 text-xs text-slate-600">
                        <Users className="w-3 h-3" />
                        <span className="font-bold">{campaign.sent_count}</span>
                        <span className="text-slate-400">sent</span>
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2">{formatDate(campaign.created_at)}</p>
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
