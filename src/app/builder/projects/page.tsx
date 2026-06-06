"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Loader2, MapPin, Trash2, Users, Search, X, Clock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { deleteProjectAction, getFollowersForEntity, FollowerInfo } from "./actions";
import { maskPhone } from "@/lib/mask";

interface Project {
  id: string;
  name: string;
  location: string;
  city: string;
  price_range: string;
  type: string;
  created_at: string;
}

export default function BuilderProjects() {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Followers modal state
  const [followersModal, setFollowersModal] = useState<{ entityId: string; entityType: "project" | "event" | "campaign"; entityName: string } | null>(null);
  const [loadingFollowers, setLoadingFollowers] = useState(false);
  const [followersList, setFollowersList] = useState<FollowerInfo[]>([]);
  const [followersSearch, setFollowersSearch] = useState("");

  async function openFollowersModal(id: string, name: string) {
    setFollowersModal({ entityId: id, entityType: "project", entityName: name });
    setLoadingFollowers(true);
    setFollowersSearch("");
    try {
      const res = await getFollowersForEntity(id, "project");
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
    loadProjects();
  }, []);

  async function loadProjects() {
    setLoading(true);
    try {
      const phone = localStorage.getItem("agentsapp_logged_in_phone");
      if (!phone) return;

      // First get the builder profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id")
        .eq("phone", phone)
        .single();

      if (!profileData) return;

      // Fetch owned projects
      let combinedProjects: any[] = [];
      const { data: ownedProjects } = await supabase
        .from("projects")
        .select("*")
        .eq("developer_id", profileData.id)
        .order("created_at", { ascending: false });

      if (ownedProjects) {
        combinedProjects = [...ownedProjects];
      }

      // Fetch projects shared by Super Builder
      const { data: sharesData } = await supabase
        .from("project_shares")
        .select("project_id, projects(*)")
        .eq("builder_id", profileData.id)
        .eq("status", "active");

      if (sharesData) {
        sharesData.forEach((s: any) => {
          if (s.projects && !combinedProjects.some(p => p.id === s.projects.id)) {
            combinedProjects.push(s.projects);
          }
        });
      }

      // Sort combined projects by created_at desc
      combinedProjects.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setProjects(combinedProjects);
    } catch (err) {
      console.error("Error loading builder projects:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(projectId: string, projectName: string) {
    if (!window.confirm(`Are you sure you want to delete the project "${projectName}"? This action cannot be undone.`)) {
      return;
    }

    setDeletingId(projectId);
    const res = await deleteProjectAction(projectId);
    
    if (res.ok) {
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    } else {
      alert("Failed to delete project: " + res.error);
    }
    setDeletingId(null);
  }

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
      {/* Header */}
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">My Projects</h1>
        <p className="text-[#64748b] text-xs font-semibold mt-0.5">Manage and view all projects created by your company.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        </div>
      ) : projects.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-900">No Projects Found</h3>
          <p className="text-sm text-slate-500 mt-1 mb-6">You haven't created any projects yet.</p>
          <a href="/builder/projects/new" className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition">
            Add Your First Project
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div key={project.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-100 flex-1">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded text-[9px] font-bold uppercase tracking-wide">
                      {project.type}
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold">{timeAgo(project.created_at)}</span>
                  </div>
                  <button 
                    onClick={() => handleDelete(project.id, project.name)}
                    disabled={deletingId === project.id}
                    className="p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-lg transition disabled:opacity-50"
                    title="Delete Project"
                  >
                    {deletingId === project.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <h3 className="text-lg font-extrabold text-slate-900 leading-tight mb-2">
                  {project.name}
                </h3>
                <div className="flex items-center text-xs text-slate-500 font-medium">
                  <MapPin className="w-3.5 h-3.5 mr-1" />
                  {project.location}, {project.city}
                </div>
              </div>
              <div className="bg-slate-50 p-4 flex justify-between items-center">
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Est. Price</div>
                  <div className="text-sm font-extrabold text-[#16c47f] mt-0.5">
                    {project.price_range || "N/A"}
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button 
                    onClick={() => openFollowersModal(project.id, project.name)}
                    className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-650 rounded-lg text-xs font-bold transition flex items-center space-x-1"
                  >
                    <Users className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Followers</span>
                  </button>
                  <Link
                    href={`/builder/inventory?project_id=${project.id}`}
                    className="px-3 py-1.5 bg-white border border-slate-200 hover:border-indigo-300 text-indigo-600 rounded-lg text-xs font-bold transition flex items-center justify-center"
                  >
                    View Units
                  </Link>
                </div>
              </div>
            </div>
          ))}
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
                <p className="text-xs text-slate-500 font-semibold mt-0.5">Agents following this project</p>
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
                  <span>No agents are following this project yet.</span>
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
