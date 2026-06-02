"use client";

import { useEffect, useState } from "react";
import { Building2, Loader2, MapPin } from "lucide-react";
import { getFollowedProjects } from "./actions";

interface Project {
  id: string;
  name: string;
  location: string;
  price_range: string;
  type: string;
  created_at: string;
}

export default function FollowingProjectsPage() {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    const phone = localStorage.getItem("agentsapp_logged_in_phone") || "";
    if (phone) {
      getFollowedProjects(phone).then((data) => {
        setProjects(data);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  function timeAgo(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "Just now";
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  }

  return (
    <div className="max-w-5xl space-y-6 text-slate-800">
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Following Projects</h1>
        <p className="text-[#64748b] text-xs font-semibold mt-0.5">Projects you are currently following for updates.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-[#25d366] animate-spin" />
        </div>
      ) : projects.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-900">Not Following Any Projects</h3>
          <p className="text-sm text-slate-500 mt-1 mb-6">Discover new projects in the Launches section.</p>
          <a href="/agent/launches" className="px-5 py-2.5 bg-[#25d366] hover:bg-[#16c47f] text-white font-bold text-sm rounded-xl transition">
            Browse Launches
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div key={project.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-100 flex-1">
                <div className="flex justify-between items-start mb-2">
                  <span className="px-2 py-1 bg-[#25d366]/10 text-[#16c47f] rounded text-[9px] font-bold uppercase tracking-wide">
                    {project.type}
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold">{timeAgo(project.created_at)}</span>
                </div>
                <h3 className="text-lg font-extrabold text-slate-900 leading-tight mb-2">
                  {project.name}
                </h3>
                <div className="flex items-center text-xs text-slate-500 font-medium">
                  <MapPin className="w-3.5 h-3.5 mr-1" />
                  {project.location}
                </div>
              </div>
              <div className="bg-slate-50 p-4 flex justify-between items-center">
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Est. Price</div>
                  <div className="text-sm font-extrabold text-slate-900 mt-0.5">
                    {project.price_range || "N/A"}
                  </div>
                </div>
                <button className="px-3 py-1.5 bg-white border border-slate-200 hover:border-[#25d366] text-slate-600 rounded-lg text-xs font-bold transition">
                  View Updates
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
