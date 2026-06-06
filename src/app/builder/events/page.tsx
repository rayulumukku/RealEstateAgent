"use client";

import { useEffect, useState } from "react";
import { Calendar, MapPin, Loader2, Megaphone, Users, Clock, Building2, Search, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getFollowersForEntity, FollowerInfo } from "../projects/actions";
import { maskPhone } from "@/lib/mask";

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

  // Followers modal state
  const [followersModal, setFollowersModal] = useState<{ entityId: string; entityType: "project" | "event" | "campaign"; entityName: string } | null>(null);
  const [loadingFollowers, setLoadingFollowers] = useState(false);
  const [followersList, setFollowersList] = useState<FollowerInfo[]>([]);
  const [followersSearch, setFollowersSearch] = useState("");

  async function openFollowersModal(id: string, type: "event" | "campaign", name: string) {
    setFollowersModal({ entityId: id, entityType: type, entityName: name });
    setLoadingFollowers(true);
    setFollowersSearch("");
    try {
      const res = await getFollowersForEntity(id, type, name);
      if (res.ok && res.followers) {
        setFollowersList(res.followers);
      } else {
        alert(res.error || "Failed to load followers.");
      }
    } catch (err) {
      console.error("Error loading followers:", err);
    } finally {
      setLoadingFollowers(false);
    }
  }

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
                    <button
                      onClick={() => openFollowersModal(event.id, "event", event.title)}
                      className="mt-3 px-2.5 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-600 hover:bg-indigo-100 font-bold text-[10px] rounded-lg transition uppercase tracking-wider flex items-center space-x-1 ml-auto"
                    >
                      <Users className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Followers</span>
                    </button>
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
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-bold">{campaign.sent_count}</span>
                        <span className="text-slate-400">sent</span>
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2">{formatDate(campaign.created_at)}</p>
                    <button
                      onClick={() => openFollowersModal(campaign.id, "campaign", campaign.name)}
                      className="mt-3 px-2.5 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-600 hover:bg-indigo-100 font-bold text-[10px] rounded-lg transition uppercase tracking-wider flex items-center space-x-1 ml-auto"
                    >
                      <Users className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Followers</span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Followers Modal */}
      {followersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden text-slate-800">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">{followersModal.entityName} Followers</h3>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                  Agents following this {followersModal.entityType === "campaign" ? "campaign" : "event"}
                </p>
              </div>
              <button 
                onClick={() => setFollowersModal(null)} 
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-slate-100 bg-white">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  value={followersSearch} 
                  onChange={(e) => setFollowersSearch(e.target.value)} 
                  placeholder="Search followers by name, agency, location..." 
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs text-slate-800 outline-none transition" 
                />
                {followersSearch && (
                  <button onClick={() => setFollowersSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
              {loadingFollowers ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 font-bold text-xs uppercase tracking-wider space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                  <span>Loading Followers...</span>
                </div>
              ) : followersList.length === 0 ? (
                <div className="p-12 text-center text-slate-400 font-bold bg-white rounded-xl border border-slate-200">
                  <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <span>No agents are following this yet.</span>
                </div>
              ) : (() => {
                const filtered = followersList.filter((f) => {
                  const query = followersSearch.toLowerCase();
                  return (
                    f.name.toLowerCase().includes(query) ||
                    f.agency_name.toLowerCase().includes(query) ||
                    f.location.toLowerCase().includes(query)
                  );
                });

                if (filtered.length === 0) {
                  return (
                    <div className="p-12 text-center text-slate-400 font-bold bg-white rounded-xl border border-slate-200">
                      <span>No followers match your search.</span>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2">
                    {filtered.map((f) => (
                      <div key={f.agent_id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between hover:shadow-sm transition">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600 font-bold text-sm shrink-0">
                            {f.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900">{f.name}</p>
                            <p className="text-[10px] text-slate-500">
                              {f.agency_name} · {maskPhone(f.phone)}
                              {f.location && (
                                <span className="inline-flex items-center ml-2">
                                  <MapPin className="w-3 h-3 mr-0.5 text-slate-400" />
                                  {f.location}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-400 flex items-center space-x-1 font-semibold">
                          <Clock className="w-3 h-3 text-slate-350" />
                          <span>Joined {timeAgo(f.followed_at)}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
