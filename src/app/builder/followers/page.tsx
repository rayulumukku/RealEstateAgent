"use client";

import { useEffect, useState } from "react";
import { Users, Loader2, MapPin, Clock } from "lucide-react";

interface Follower {
  id: string;
  agent_id: string;
  created_at: string;
  profiles: { name: string; phone: string; agency_name: string; location: string };
}

export default function BuilderFollowersPage() {
  const [loading, setLoading] = useState(true);
  const [followers, setFollowers] = useState<Follower[]>([]);

  useEffect(() => { loadFollowers(); }, []);

  async function loadFollowers() {
    setLoading(true);
    try {
      const res = await fetch("/api/agent-follow");
      if (res.ok) { const data = await res.json(); setFollowers(data.followers || []); }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  function timeAgo(dateStr: string) { const diff = Date.now() - new Date(dateStr).getTime(); const mins = Math.floor(diff / 60000); if (mins < 60) return `${mins}m ago`; const hours = Math.floor(mins / 60); if (hours < 24) return `${hours}h ago`; const days = Math.floor(hours / 24); return `${days}d ago`; }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="space-y-6 text-slate-800">
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">My Followers</h1>
        <p className="text-[#64748b] text-xs font-semibold mt-0.5">Agents who are following you — {followers.length} total</p>
      </div>

      {followers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center"><Users className="w-12 h-12 text-slate-300 mx-auto mb-4" /><p className="text-sm text-slate-500">No agents are following you yet.</p></div>
      ) : (
        <div className="space-y-3">
          {followers.map((f) => (
            <div key={f.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center justify-between hover:shadow-md transition">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center"><Users className="w-5 h-5 text-emerald-600" /></div>
                <div>
                  <p className="text-sm font-extrabold text-slate-900">{f.profiles?.name || "Agent"}</p>
                  <p className="text-xs text-slate-500">{f.profiles?.agency_name || "Independent"} · {f.profiles?.phone}{f.profiles?.location && <span className="inline-flex items-center ml-2"><MapPin className="w-3 h-3 mr-0.5" />{f.profiles.location}</span>}</p>
                </div>
              </div>
              <div className="flex items-center space-x-1 text-[10px] text-slate-400"><Clock className="w-3 h-3" /><span>Followed {timeAgo(f.created_at)}</span></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
