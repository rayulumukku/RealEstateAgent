"use client";

import { useEffect, useState } from "react";
import { Crown, Loader2, UserPlus, UserMinus, Search, X, Building2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface SuperBuilder {
  id: string;
  name: string;
  phone: string;
  agency_name: string;
  location: string;
  isFollowing: boolean;
}

export default function SuperBuildersPage() {
  const [loading, setLoading] = useState(true);
  const [superBuilders, setSuperBuilders] = useState<SuperBuilder[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [myId, setMyId] = useState<string>("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const meRes = await fetch("/api/me");
      const meData = await meRes.json();
      if (!meData.user) return;
      setMyId(meData.user.id);

      // Fetch all super builders
      const { data: sbProfiles } = await supabase
        .from("profiles")
        .select("id, name, phone, agency_name, location")
        .eq("role", "super_builder")
        .order("name", { ascending: true });

      // Fetch my current follows
      const { data: myFollows } = await supabase
        .from("builder_follows")
        .select("followed_id")
        .eq("follower_id", meData.user.id);

      const followedIds = new Set((myFollows || []).map((f: any) => f.followed_id));

      const mapped: SuperBuilder[] = (sbProfiles || []).map((sb: any) => ({
        id: sb.id,
        name: sb.name || "Unnamed",
        phone: sb.phone || "",
        agency_name: sb.agency_name || "",
        location: sb.location || "",
        isFollowing: followedIds.has(sb.id),
      }));

      setSuperBuilders(mapped);
    } catch (err) {
      console.error("Error loading super builders:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleFollow(superBuilderId: string, isCurrentlyFollowing: boolean) {
    setTogglingId(superBuilderId);
    try {
      const res = await fetch("/api/builder-follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          super_builder_id: superBuilderId,
          action: isCurrentlyFollowing ? "unfollow" : "follow",
        }),
      });

      const data = await res.json();
      if (res.ok && !data.error) {
        setSuperBuilders((prev) =>
          prev.map((sb) =>
            sb.id === superBuilderId ? { ...sb, isFollowing: !isCurrentlyFollowing } : sb
          )
        );
      } else {
        alert(data.error || "Failed to update follow status.");
      }
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setTogglingId(null);
    }
  }

  const filteredBuilders = superBuilders.filter(
    (sb) =>
      sb.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sb.agency_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sb.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const followingCount = superBuilders.filter((sb) => sb.isFollowing).length;

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
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <Crown className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">Super Builders</h1>
              <p className="text-sm text-slate-500">
                {superBuilders.length} super builder{superBuilders.length !== 1 ? "s" : ""} available
                &middot; You follow {followingCount}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name, company, or location..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:border-indigo-500 transition"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        )}
      </div>

      {/* Super Builders List */}
      {filteredBuilders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
          <Crown className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-sm text-slate-500">
            {superBuilders.length === 0
              ? "No super builders found in the system."
              : "No results match your search."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredBuilders.map((sb) => (
            <div
              key={sb.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center justify-between hover:shadow-md transition"
            >
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center">
                  <Crown className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-slate-900">{sb.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {sb.agency_name || "—"}
                    {sb.location ? ` · ${sb.location}` : ""}
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleToggleFollow(sb.id, sb.isFollowing)}
                disabled={togglingId === sb.id}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition flex items-center space-x-2 ${
                  sb.isFollowing
                    ? "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                    : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md"
                } disabled:opacity-50`}
              >
                {togglingId === sb.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : sb.isFollowing ? (
                  <>
                    <UserMinus className="w-3.5 h-3.5" />
                    <span>Unfollow</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Follow</span>
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
