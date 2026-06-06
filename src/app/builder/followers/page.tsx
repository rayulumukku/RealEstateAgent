"use client";

import { useEffect, useState } from "react";
import { Users, Loader2, MapPin, Clock } from "lucide-react";
import { maskPhone } from "@/lib/mask";

interface Follower {
  id: string;
  agent_id: string;
  created_at: string;
  profiles: { name: string; phone: string; agency_name: string; location: string };
  followedProjects?: string[];
}

export default function BuilderFollowersPage() {
  const [loading, setLoading] = useState(true);
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [assignedAgents, setAssignedAgents] = useState<Follower[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<"followers" | "assigned">("followers");
  const [isSubBuilder, setIsSubBuilder] = useState(false);

  useEffect(() => {
    loadFollowers();
    if (typeof window !== "undefined") {
      const tab = new URLSearchParams(window.location.search).get("tab");
      if (tab === "assigned") {
        setActiveSubTab("assigned");
      }
    }
  }, []);

  async function loadFollowers() {
    setLoading(true);
    try {
      const [res, profileRes] = await Promise.all([
        fetch("/api/agent-follow"),
        fetch("/api/profile")
      ]);

      if (res.ok) {
        const data = await res.json();
        setFollowers(data.followers || []);
        setAssignedAgents(data.assignedAgents || []);
      }

      if (profileRes.ok) {
        const profData = await profileRes.json();
        setIsSubBuilder(!!profData.profile?.parent_id);
      }
    } catch (err) {
      console.error(err);
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

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  const showTabs = isSubBuilder;
  const listToRender = (showTabs && activeSubTab === "assigned") ? assignedAgents : followers;

  return (
    <div className="space-y-6 text-slate-800">
      <div className="border-b border-slate-200 pb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">My Followers</h1>
          <p className="text-[#64748b] text-xs font-semibold mt-0.5">
            {showTabs && activeSubTab === "assigned"
              ? `Agents assigned to you by your Super Builder — ${assignedAgents.length} total`
              : `Agents who are following you — ${followers.length} total`}
          </p>
        </div>
      </div>

      {showTabs && (
        <div className="flex bg-slate-100 p-1 rounded-xl text-[10px] font-bold uppercase tracking-wider w-fit">
          <button
            onClick={() => setActiveSubTab("followers")}
            className={`px-4 py-2 rounded-lg transition shrink-0 ${
              activeSubTab === "followers" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Direct Followers ({followers.length})
          </button>
          <button
            onClick={() => setActiveSubTab("assigned")}
            className={`px-4 py-2 rounded-lg transition shrink-0 ${
              activeSubTab === "assigned" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Assigned by Super Builder ({assignedAgents.length})
          </button>
        </div>
      )}

      {listToRender.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-sm text-slate-500">
            {activeSubTab === "assigned"
              ? "No agents have been assigned to you by your Super Builder yet."
              : "No agents are following you yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {listToRender.map((f) => (
            <div key={f.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center justify-between hover:shadow-md transition">
              <div className="flex items-center space-x-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${activeSubTab === "assigned" ? "bg-purple-100" : "bg-emerald-50"}`}>
                  <Users className={`w-5 h-5 ${activeSubTab === "assigned" ? "text-purple-650" : "text-emerald-600"}`} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-extrabold text-slate-900">{f.profiles?.name || "Agent"}</p>
                    {activeSubTab === "assigned" && (
                      <span className="px-1.5 py-0.5 bg-purple-50 text-purple-650 border border-purple-200 rounded text-[8px] font-extrabold">
                        Assigned
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    {f.profiles?.agency_name || "Independent"} · {maskPhone(f.profiles?.phone)}
                    {f.profiles?.location && (
                      <span className="inline-flex items-center ml-2">
                        <MapPin className="w-3 h-3 mr-0.5" />
                        {f.profiles.location}
                      </span>
                    )}
                  </p>
                  {f.followedProjects && f.followedProjects.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Followed:</span>
                      {f.followedProjects.map((p, idx) => (
                        <span key={idx} className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-0.5 rounded-full font-bold">
                          {p}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-1 text-[10px] text-slate-400">
                <Clock className="w-3 h-3" />
                <span>
                  {activeSubTab === "assigned"
                    ? `Assigned ${timeAgo(f.created_at)}`
                    : `Followed ${timeAgo(f.created_at)}`}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
