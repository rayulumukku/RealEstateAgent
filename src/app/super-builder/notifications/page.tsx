"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell, Loader2, UserPlus, UserMinus, Clock, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Notification {
  id: string;
  builder_id: string;
  builder_name: string;
  builder_phone: string;
  builder_company: string;
  action: "followed" | "unfollowed";
  is_read: boolean;
  created_at: string;
}

export default function SuperBuilderNotifications() {
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [myId, setMyId] = useState<string>("");

  useEffect(() => {
    loadNotifications();
  }, []);

  // Set up real-time subscription
  useEffect(() => {
    if (!myId) return;

    const channel = supabase
      .channel("follow-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "follow_notifications",
          filter: `super_builder_id=eq.${myId}`,
        },
        (payload) => {
          const newNotif = payload.new as Notification;
          setNotifications((prev) => [newNotif, ...prev]);
          // Update follower count
          if (newNotif.action === "followed") {
            setFollowerCount((c) => c + 1);
          } else {
            setFollowerCount((c) => Math.max(0, c - 1));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [myId]);

  async function loadNotifications() {
    setLoading(true);
    try {
      const meRes = await fetch("/api/me");
      const meData = await meRes.json();
      if (!meData.user) return;
      setMyId(meData.user.id);

      // Get notifications
      const { data: notifs } = await supabase
        .from("follow_notifications")
        .select("*")
        .eq("super_builder_id", meData.user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (notifs) setNotifications(notifs);

      // Get follower count
      const { count } = await supabase
        .from("builder_follows")
        .select("id", { count: "exact", head: true })
        .eq("followed_id", meData.user.id);

      setFollowerCount(count || 0);

      // Mark all as read
      if (notifs && notifs.some((n: any) => !n.is_read)) {
        await fetch("/api/super-builder/notifications", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "mark_all_read" }),
        });
      }
    } catch (err) {
      console.error("Error loading notifications:", err);
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
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
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
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <Bell className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">Notifications</h1>
              <p className="text-sm text-slate-500">Real-time follow/unfollow activity from builders</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 bg-purple-50 border border-purple-200 rounded-xl px-4 py-2">
            <Users className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-extrabold text-purple-700">{followerCount}</span>
            <span className="text-xs text-purple-500 font-bold">Followers</span>
          </div>
        </div>
      </div>

      {/* Live indicator */}
      <div className="flex items-center space-x-2 px-1">
        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Live — updates appear in real time
        </span>
      </div>

      {/* Notifications List */}
      {notifications.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
          <Bell className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-sm text-slate-500">No notifications yet. When builders follow or unfollow you, it will appear here in real time.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className={`bg-white rounded-2xl border shadow-sm p-5 flex items-center justify-between transition ${
                !notif.is_read
                  ? "border-purple-200 bg-purple-50/30"
                  : "border-slate-200"
              }`}
            >
              <div className="flex items-center space-x-4">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    notif.action === "followed"
                      ? "bg-emerald-50"
                      : "bg-red-50"
                  }`}
                >
                  {notif.action === "followed" ? (
                    <UserPlus className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <UserMinus className="w-5 h-5 text-red-500" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    <span className="font-extrabold">{notif.builder_name}</span>
                    {notif.action === "followed"
                      ? " started following you"
                      : " unfollowed you"}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {notif.builder_company ? `${notif.builder_company} · ` : ""}
                    {notif.builder_phone}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="flex items-center space-x-1 text-xs text-slate-400">
                  <Clock className="w-3 h-3" />
                  <span className="font-semibold">{timeAgo(notif.created_at)}</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">{formatTime(notif.created_at)}</p>
                {!notif.is_read && (
                  <span className="inline-block mt-1 px-2 py-0.5 bg-purple-100 text-purple-600 rounded-full text-[9px] font-bold uppercase tracking-wider">
                    New
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
