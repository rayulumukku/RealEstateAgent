"use client";

import { useEffect, useState } from "react";
import { Building2, Loader2, MapPin, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { deleteProjectAction } from "./actions";

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

      // Then get their projects
      const { data: projectsData } = await supabase
        .from("projects")
        .select("*")
        .eq("developer_id", profileData.id)
        .order("created_at", { ascending: false });

      if (projectsData) {
        setProjects(projectsData);
      }
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
                <button className="px-3 py-1.5 bg-white border border-slate-200 hover:border-indigo-300 text-indigo-600 rounded-lg text-xs font-bold transition">
                  View Units
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
