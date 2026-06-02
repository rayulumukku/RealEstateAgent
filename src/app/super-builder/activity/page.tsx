"use client";

import { useEffect, useState } from "react";
import { Loader2, UserPlus, UserMinus, Clock, Users, Building2, Calendar } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface ActivityItem {
  id: string;
  type: "joined" | "removed" | "followed" | "unfollowed";
  builder_name: string;
  builder_phone: string;
  builder_company: string;
  project_name?: string;
  created_at: string;
}

export default function SuperBuilderActivityPage() {
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [myId, setMyId] = useState("");

  useEffect(() => {
    loadActivity();
  }, []);

  // Real-time subscription for new activity
  useEffect(() => {
    if (!myId) return;

    const channel = supabase
      .channel("activity-feed")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "follow_notifications",
          filter: `super_builder_id=eq.${myId}`,
        },
        () => {
          loadActivity();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_shares",
          filter: `shared_by=eq.${myId}`,
        },
        () => {
          loadActivity();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [myId]);

  async function loadActivity() {
    setLoading(true);
    try {
      const meRes = await fetch("/api/me");
      const meData = await meRes.json();
      if (!meData.user) return;
      setMyId(meData.user.id);

      const userId = meData.user.id;
      const allActivities: ActivityItem[] = [];

      // 1. Get project share activity (joined/removed)
      const { data: shares } = await supabase
        .from("project_shares")
        .select("*, projects(name), profiles!project_shares_builder_id_fkey(name, phone, agency_name)")
        .eq("shared_by", userId)
        .order("created_at", { ascending: false })
        .limit(30);

      if (shares) {
        for (const share of shares) {
          allActivities.push({
            id: `share-${share.id}`,
            type: share.status === "active" ? "joined" : "removed",
            builder_name: share.profiles?.name || "Unknown",
            builder_phone: share.profiles?.phone || "",
            builder_company: share.profiles?.agency_name || "",
            project_name: share.projects?.name || "Project",
            created_at: share.updated_at || share.created_at,
          });
        }
      }

      // 2. Get follow/unfollow notifications
      const { data: notifs } = await supabase
        .from("follow_notifications")
        .select("*")
        .eq("super_builder_id", userId)
        .order("created_at", { ascending: false })
        .limit(30);

      if (notifs) {
        for (const notif of notifs) {
          allActivities.push({
            id: `notif-${notif.id}`,
            type: notif.action as "followed" | "unfollowed",
            builder_name: notif.builder_name,
            builder_phone: notif.builder_phone,
            builder_company: notif.builder_company,
            created_at: notif.created_at,
          });
        }
      }

      // Sort by time descending
      allActivities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setActivities(allActivities.slice(0, 50));
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
    return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
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
      case "joined": return <UserPlus className="w-5 h-5 text-emerald-600" />;
      case "removed": return <UserMinus className="w-5 h-5 text-red-500" />;
      case "followed": return <UserPlus className="w-5 h-5 text-purple-600" />;
      case "unfollowed": return <UserMinus className="w-5 h-5 text-orange-500" />;
      default: return <Users className="w-5 h-5 text-slate-400" />;
    }
  }

  function getIconBg(type: string) {
    switch (type) {
      case "joined": return "bg-emerald-50";
      case "removed": return "bg-red-50";
      case "followed": return "bg-purple-50";
      case "unfollowed": return "bg-orange-50";
      default: return "bg-slate-50";
    }
  }

  function getMessage(item: ActivityItem) {
    switch (item.type) {
      case "joined": return <><span className="font-extrabold">{item.builder_name}</span> was added to <span className="font-bold text-purple-600">{item.project_name}</span></>;
      case "removed": return <><span className="font-extrabold">{item.builder_name}</span> was removed from <span className="font-bold text-red-500">{item.project_name}</span></>;
      case "followed": return <><span className="font-extrabold">{item.builder_name}</span> started following you</>;
      case "unfollowed": return <><span className="font-extrabold">{item.builder_name}</span> unfollowed you</>;
      default: return <span>{item.builder_name}</span>;
    }
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
            <Clock className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Builder Activity Timeline</h1>
            <p className="text-sm text-slate-500">Track when builders joined, were removed, followed, or unfollowed</p>
          </div>
        </div>
      </div>

      {/* Live indicator */}
      <div className="flex items-center space-x-2 px-1">
        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Live — new activity appears automatically
        </span>
      </div>

      {/* Timeline */}
      {activities.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-sm text-slate-500">No activity yet. Share projects with builders or wait for follows.</p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-200" />

          <div className="space-y-4">
            {activities.map((item) => (
              <div key={item.id} className="relative flex items-start space-x-4 pl-2">
                {/* Timeline dot */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 z-10 ${getIconBg(item.type)}`}>
                  {getIcon(item.type)}
                </div>

                {/* Content */}
                <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                  <p className="text-sm text-slate-700">{getMessage(item)}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {item.builder_company ? `${item.builder_company} · ` : ""}{item.builder_phone}
                  </p>
                  <div className="flex items-center space-x-1 text-[10px] text-slate-400 mt-2">
                    <Clock className="w-3 h-3" />
                    <span className="font-semibold">{timeAgo(item.created_at)}</span>
                    <span className="text-slate-300 mx-1">·</span>
                    <span>{formatTime(item.created_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
