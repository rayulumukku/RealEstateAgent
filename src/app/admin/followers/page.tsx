"use client";

import { useState, useEffect } from "react";
import { Users, Loader2, Building2, Crown, Search, X, MapPin, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface BuilderWithFollowers {
  id: string;
  name: string;
  phone: string;
  agency_name: string;
  role: string;
  follower_count: number;
  followers: { name: string; phone: string; agency_name: string; location: string; created_at: string }[];
}

export default function AdminFollowersPage() {
  const [loading, setLoading] = useState(true);
  const [builders, setBuilders] = useState<BuilderWithFollowers[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const { data: profiles } = await supabase.from("profiles").select("id, name, phone, agency_name, role").in("role", ["builder", "super_builder"]).order("name", { ascending: true });
      const { data: follows } = await supabase.from("agent_follows_builder").select("*, profiles!agent_follows_builder_agent_id_fkey(name, phone, agency_name, location)").order("created_at", { ascending: false });

      const followerMap = new Map<string, any[]>();
      if (follows) for (const f of follows) { const ex = followerMap.get(f.builder_id) || []; ex.push({ name: f.profiles?.name || "Agent", phone: f.profiles?.phone || "", agency_name: f.profiles?.agency_name || "", location: f.profiles?.location || "", created_at: f.created_at }); followerMap.set(f.builder_id, ex); }

      if (profiles) {
        const mapped: BuilderWithFollowers[] = profiles.map((p: any) => ({ id: p.id, name: p.name || "Unnamed", phone: p.phone, agency_name: p.agency_name || "", role: p.role, follower_count: (followerMap.get(p.id) || []).length, followers: followerMap.get(p.id) || [] }));
        mapped.sort((a, b) => b.follower_count - a.follower_count);
        setBuilders(mapped);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  const filtered = builders.filter(b => b.name.toLowerCase().includes(searchQuery.toLowerCase()) || b.phone.includes(searchQuery) || b.agency_name.toLowerCase().includes(searchQuery.toLowerCase()));
  const totalFollows = builders.reduce((s, b) => s + b.follower_count, 0);
  function timeAgo(d: string) { const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000); return days === 0 ? "Today" : days === 1 ? "Yesterday" : `${days}d ago`; }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>;

  return (
    <div className="space-y-6 text-slate-800">
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Agent → Builder Follows</h1>
        <p className="text-[#64748b] text-xs font-semibold mt-0.5">Which agents are following which builders. {totalFollows} total follows.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm"><p className="text-2xl font-extrabold text-slate-900">{builders.length}</p><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Builders</p></div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm"><p className="text-2xl font-extrabold text-emerald-600">{totalFollows}</p><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Follows</p></div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm"><p className="text-2xl font-extrabold text-purple-600">{builders.filter(b => b.follower_count > 0).length}</p><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">With Followers</p></div>
      </div>

      <div className="relative"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search builder..." className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-emerald-500" />{searchQuery && <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-slate-400" /></button>}</div>

      <div className="space-y-3">
        {filtered.map((builder) => (
          <div key={builder.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 cursor-pointer hover:bg-slate-50/50 transition" onClick={() => setExpandedId(expandedId === builder.id ? null : builder.id)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${builder.role === "super_builder" ? "bg-purple-50" : "bg-indigo-50"}`}>{builder.role === "super_builder" ? <Crown className="w-5 h-5 text-purple-500" /> : <Building2 className="w-5 h-5 text-indigo-500" />}</div>
                  <div><p className="text-sm font-extrabold text-slate-900">{builder.name}</p><p className="text-[10px] text-slate-500">{builder.agency_name || "—"} · {builder.phone}</p></div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="text-right"><p className="text-lg font-extrabold text-emerald-600">{builder.follower_count}</p><p className="text-[9px] text-slate-400 font-bold uppercase">followers</p></div>
                  {builder.follower_count > 0 && (expandedId === builder.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />)}
                </div>
              </div>
            </div>
            {expandedId === builder.id && builder.followers.length > 0 && (
              <div className="border-t border-slate-100 p-5 bg-slate-50/50 space-y-2">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3">Following Agents ({builder.followers.length})</h4>
                {builder.followers.map((agent, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200">
                    <div><p className="text-xs font-bold text-slate-900">{agent.name}</p><p className="text-[10px] text-slate-500">{agent.agency_name || "Independent"} · {agent.phone}{agent.location && <span className="inline-flex items-center ml-2"><MapPin className="w-2.5 h-2.5 mr-0.5" />{agent.location}</span>}</p></div>
                    <span className="text-[10px] text-slate-400">{timeAgo(agent.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
