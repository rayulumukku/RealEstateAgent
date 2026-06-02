"use client";

import { useEffect, useState } from "react";
import { Building2, Loader2, UserPlus, UserMinus, Search, X, MapPin, Crown } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Builder {
  id: string;
  name: string;
  phone: string;
  agency_name: string;
  location: string;
  role: string;
  isFollowing: boolean;
}

export default function AgentBuildersPage() {
  const [loading, setLoading] = useState(true);
  const [builders, setBuilders] = useState<Builder[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const { data: profiles } = await supabase.from("profiles").select("id, name, phone, agency_name, location, role").in("role", ["builder", "super_builder"]).order("name", { ascending: true });
      const res = await fetch("/api/agent-follow");
      const followData = await res.json();
      const followingIds = new Set<string>(followData.following || []);
      if (profiles) setBuilders(profiles.map((b: any) => ({ ...b, isFollowing: followingIds.has(b.id) })));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function handleToggleFollow(builderId: string, isFollowing: boolean) {
    setTogglingId(builderId);
    try {
      const res = await fetch("/api/agent-follow", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ builder_id: builderId, action: isFollowing ? "unfollow" : "follow" }) });
      const data = await res.json();
      if (res.ok && data.ok) setBuilders(prev => prev.map(b => b.id === builderId ? { ...b, isFollowing: !isFollowing } : b));
      else alert(data.error || "Failed.");
    } catch { alert("Network error."); }
    finally { setTogglingId(null); }
  }

  const filtered = builders.filter(b => b.name?.toLowerCase().includes(searchQuery.toLowerCase()) || b.agency_name?.toLowerCase().includes(searchQuery.toLowerCase()) || b.location?.toLowerCase().includes(searchQuery.toLowerCase()));
  const followingCount = builders.filter(b => b.isFollowing).length;

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-[#25d366]" /></div>;

  return (
    <div className="space-y-6 text-slate-800">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Builders</h1>
        <p className="text-[#64748b] text-xs font-semibold mt-0.5">{builders.length} builders available · You follow {followingCount}</p>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by name, company, or location..." className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:border-[#25d366] transition" />
        {searchQuery && <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-slate-400" /></button>}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center"><Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" /><p className="text-sm text-slate-500">No builders found.</p></div>
      ) : (
        <div className="space-y-3">
          {filtered.map((builder) => (
            <div key={builder.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center justify-between hover:shadow-md transition">
              <div className="flex items-center space-x-4">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${builder.role === "super_builder" ? "bg-purple-50" : "bg-indigo-50"}`}>
                  {builder.role === "super_builder" ? <Crown className="w-5 h-5 text-purple-500" /> : <Building2 className="w-5 h-5 text-indigo-500" />}
                </div>
                <div>
                  <p className="text-sm font-extrabold text-slate-900 flex items-center space-x-1.5">
                    <span>{builder.name || "Unnamed"}</span>
                    {builder.role === "super_builder" && <span className="px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded text-[8px] font-bold uppercase">Super</span>}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{builder.agency_name || "—"}{builder.location && <span className="inline-flex items-center ml-2"><MapPin className="w-3 h-3 mr-0.5" />{builder.location}</span>}</p>
                </div>
              </div>
              <button onClick={() => handleToggleFollow(builder.id, builder.isFollowing)} disabled={togglingId === builder.id} className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition flex items-center space-x-2 ${builder.isFollowing ? "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200" : "bg-[#25d366] text-white hover:bg-[#16c47f] shadow-md"} disabled:opacity-50`}>
                {togglingId === builder.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : builder.isFollowing ? <><UserMinus className="w-3.5 h-3.5" /><span>Unfollow</span></> : <><UserPlus className="w-3.5 h-3.5" /><span>Follow</span></>}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
