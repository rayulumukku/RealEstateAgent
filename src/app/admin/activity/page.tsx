"use client";

import { useState, useEffect } from "react";
import { Loader2, UserPlus, UserMinus, Building2, Calendar, Share2, Crown, Clock, Users, Megaphone, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface ActivityItem {
  id: string;
  type: "project_created" | "event_created" | "builder_shared" | "builder_removed" | "follow" | "unfollow" | "campaign_launched";
  actor_name: string;
  actor_role: string;
  actor_phone: string;
  target_name?: string;
  project_name?: string;
  event_name?: string;
  created_at: string;
}

export default function AdminActivityPage() {
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  useEffect(() => {
    loadActivity();
  }, []);

  async function loadActivity() {
    setLoading(true);
    try {
      const allActivities: ActivityItem[] = [];

      // 1. Projects created
      const { data: projects } = await supabase
        .from("projects")
        .select("id, name, created_at, profiles!projects_developer_id_fkey(name, role, phone)")
        .order("created_at", { ascending: false })
        .limit(30);

      if (projects) {
        for (const p of projects) {
          const prof = p.profiles as any;
          allActivities.push({
            id: `proj-${p.id}`,
            type: "project_created",
            actor_name: prof?.name || "Unknown",
            actor_role: prof?.role || "builder",
            actor_phone: prof?.phone || "",
            project_name: p.name,
            created_at: p.created_at,
          });
        }
      }

      // 2. Events created (general)
      const { data: events } = await supabase
        .from("events")
        .select("id, title, created_at")
        .order("created_at", { ascending: false })
        .limit(20);

      // Get campaigns to find creators
      const { data: campaigns } = await supabase
        .from("campaigns")
        .select("name, created_at, profiles!campaigns_builder_id_fkey(name, role, phone)")
        .order("created_at", { ascending: false })
        .limit(20);

      if (campaigns) {
        for (const c of campaigns) {
          const prof = c.profiles as any;
          allActivities.push({
            id: `camp-${c.name}-${c.created_at}`,
            type: "campaign_launched",
            actor_name: prof?.name || "Builder",
            actor_role: prof?.role || "builder",
            actor_phone: prof?.phone || "",
            event_name: c.name,
            created_at: c.created_at,
          });
        }
      }

      // 3. Super builder events
      const { data: sbEvents } = await supabase
        .from("super_builder_events")
        .select("id, title, target_audience, created_at, profiles!super_builder_events_created_by_fkey(name, role, phone)")
        .order("created_at", { ascending: false })
        .limit(20);

      if (sbEvents) {
        for (const e of sbEvents) {
          const prof = e.profiles as any;
          allActivities.push({
            id: `sbe-${e.id}`,
            type: "event_created",
            actor_name: prof?.name || "Super Builder",
            actor_role: "super_builder",
            actor_phone: prof?.phone || "",
            event_name: e.title,
            target_name: e.target_audience,
            created_at: e.created_at,
          });
        }
      }

      // 4. Project shares (builder joined/removed)
      const { data: shares } = await supabase
        .from("project_shares")
        .select("id, status, created_at, updated_at, projects(name), profiles!project_shares_builder_id_fkey(name, phone, role), profiles!project_shares_shared_by_fkey(name)")
        .order("created_at", { ascending: false })
        .limit(30);

      if (shares) {
        for (const s of shares) {
          const builder = (s as any)["profiles!project_shares_builder_id_fkey"];
          const sharedBy = (s as any)["profiles!project_shares_shared_by_fkey"];
          allActivities.push({
            id: `share-${s.id}`,
            type: s.status === "active" ? "builder_shared" : "builder_removed",
            actor_name: sharedBy?.name || "Super Builder",
            actor_role: "super_builder",
            actor_phone: "",
            target_name: builder?.name || "Builder",
            project_name: (s.projects as any)?.name || "Project",
            created_at: s.updated_at || s.created_at,
          });
        }
      }

      // 5. Follow/unfollow notifications
      const { data: follows } = await supabase
        .from("follow_notifications")
        .select("id, builder_name, builder_phone, action, created_at, profiles!follow_notifications_super_builder_id_fkey(name)")
        .order("created_at", { ascending: false })
        .limit(30);

      if (follows) {
        for (const f of follows) {
          const sb = (f as any)["profiles!follow_notifications_super_builder_id_fkey"];
          allActivities.push({
            id: `follow-${f.id}`,
            type: f.action === "followed" ? "follow" : "unfollow",
            actor_name: f.builder_name,
            actor_role: "builder",
            actor_phone: f.builder_phone,
            target_name: sb?.name || "Super Builder",
            created_at: f.created_at,
          });
        }
      }

      // Sort by time descending
      allActivities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setActivities(allActivities.slice(0, 100));
    } catch (err) {
      console.error("Error loading activity:", err);
    } finally {
      setLoading(false);
    }
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return "Just now";
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  }

  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getIcon(type: string) {
    switch (type) {
      case "project_created": return <Building2 className="w-4 h-4 text-blue-600" />;
      case "event_created": return <Calendar className="w-4 h-4 text-purple-600" />;
      case "campaign_launched": return <Megaphone className="w-4 h-4 text-indigo-600" />;
      case "builder_shared": return <UserPlus className="w-4 h-4 text-emerald-600" />;
      case "builder_removed": return <UserMinus className="w-4 h-4 text-red-500" />;
      case "follow": return <UserPlus className="w-4 h-4 text-purple-600" />;
      case "unfollow": return <UserMinus className="w-4 h-4 text-orange-500" />;
      default: return <Users className="w-4 h-4 text-slate-400" />;
    }
  }

  function getIconBg(type: string) {
    switch (type) {
      case "project_created": return "bg-blue-50";
      case "event_created": return "bg-purple-50";
      case "campaign_launched": return "bg-indigo-50";
      case "builder_shared": return "bg-emerald-50";
      case "builder_removed": return "bg-red-50";
      case "follow": return "bg-purple-50";
      case "unfollow": return "bg-orange-50";
      default: return "bg-slate-50";
    }
  }

  function getMessage(item: ActivityItem) {
    switch (item.type) {
      case "project_created":
        return <><span className="font-extrabold">{item.actor_name}</span> <span className="text-slate-400">({item.actor_role === "super_builder" ? "Super Builder" : "Builder"})</span> created project <span className="font-bold text-blue-600">{item.project_name}</span></>;
      case "event_created":
        return <><span className="font-extrabold">{item.actor_name}</span> <span className="text-purple-500">(Super Builder)</span> created event <span className="font-bold text-purple-600">{item.event_name}</span> for <span className="font-bold">{item.target_name === "both" ? "builders & agents" : item.target_name}</span></>;
      case "campaign_launched":
        return <><span className="font-extrabold">{item.actor_name}</span> <span className="text-slate-400">(Builder)</span> launched campaign <span className="font-bold text-indigo-600">{item.event_name}</span></>;
      case "builder_shared":
        return <><span className="font-extrabold">{item.actor_name}</span> added <span className="font-bold text-emerald-600">{item.target_name}</span> to project <span className="font-bold">{item.project_name}</span></>;
      case "builder_removed":
        return <><span className="font-extrabold">{item.actor_name}</span> removed <span className="font-bold text-red-500">{item.target_name}</span> from project <span className="font-bold">{item.project_name}</span></>;
      case "follow":
        return <><span className="font-extrabold">{item.actor_name}</span> <span className="text-slate-400">(Builder)</span> started following <span className="font-bold text-purple-600">{item.target_name}</span></>;
      case "unfollow":
        return <><span className="font-extrabold">{item.actor_name}</span> <span className="text-slate-400">(Builder)</span> unfollowed <span className="font-bold text-orange-500">{item.target_name}</span></>;
      default:
        return <span>{item.actor_name}</span>;
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Platform Activity</h1>
          <p className="text-[#64748b] text-xs font-semibold mt-0.5">
            Full timeline of everything happening — project creation, events, shares, follows, and more.
          </p>
        </div>
        <button
          onClick={loadActivity}
          className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs rounded-xl transition flex items-center space-x-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Activity Summary */}
      <div className="grid grid-cols-3 md:grid-cols-7 gap-3">
        {[
          { label: "Projects", count: activities.filter((a) => a.type === "project_created").length, color: "text-blue-600" },
          { label: "Events", count: activities.filter((a) => a.type === "event_created").length, color: "text-purple-600" },
          { label: "Campaigns", count: activities.filter((a) => a.type === "campaign_launched").length, color: "text-indigo-600" },
          { label: "Shared", count: activities.filter((a) => a.type === "builder_shared").length, color: "text-emerald-600" },
          { label: "Removed", count: activities.filter((a) => a.type === "builder_removed").length, color: "text-red-500" },
          { label: "Follows", count: activities.filter((a) => a.type === "follow").length, color: "text-purple-600" },
          { label: "Unfollows", count: activities.filter((a) => a.type === "unfollow").length, color: "text-orange-500" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white p-3 rounded-xl border border-slate-200 text-center">
            <p className={`text-lg font-extrabold ${stat.color}`}>{stat.count}</p>
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Activity Feed */}
      {activities.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
          <Clock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-sm text-slate-500">No activity on the platform yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {activities.length} activity items — most recent first
            </p>
          </div>
          <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
            {activities.map((item) => (
              <div key={item.id} className="px-5 py-3.5 hover:bg-slate-50/50 transition flex items-center space-x-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${getIconBg(item.type)}`}>
                  {getIcon(item.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-700 leading-relaxed">{getMessage(item)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] font-semibold text-slate-400">{timeAgo(item.created_at)}</p>
                  <p className="text-[9px] text-slate-300">{formatTime(item.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
