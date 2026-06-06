"use client";

import { useEffect, useState } from "react";
import { Building2, Loader2, MapPin, Share2, Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

interface Project {
  id: string;
  name: string;
  location: string;
  city: string;
  price_range: string;
  type: string;
  created_at: string;
  developer_id: string;
  profiles?: { name: string; phone: string } | null;
}

export default function SuperBuilderProjects() {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    setLoading(true);
    try {
      const meRes = await fetch("/api/me");
      const meData = await meRes.json();
      if (!meData.user) return;

      const userId = meData.user.id;
      setCurrentUserId(userId);

      // Get sub-builders of this super builder
      const { data: subBuilders } = await supabase
        .from("profiles")
        .select("id")
        .eq("parent_id", userId)
        .eq("role", "builder");

      const subBuilderIds = subBuilders ? subBuilders.map((sb) => sb.id) : [];
      const developerIds = [userId, ...subBuilderIds];

      const { data: projectsData } = await supabase
        .from("projects")
        .select("*, profiles!projects_developer_id_fkey(name, phone)")
        .in("developer_id", developerIds)
        .order("created_at", { ascending: false });

      if (projectsData) {
        setProjects(projectsData);
      }
    } catch (err) {
      console.error("Error loading projects:", err);
    } finally {
      setLoading(false);
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
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">My Projects</h1>
          <p className="text-sm text-slate-500">All projects you own. Share them with builders from the Share Projects page.</p>
        </div>
        <div className="flex items-center space-x-2">
          <Link
            href="/super-builder/projects/new"
            className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-md transition uppercase tracking-wider flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Project</span>
          </Link>
          <Link
            href="/super-builder/projects/share"
            className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-55 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl shadow-sm transition uppercase tracking-wider flex items-center space-x-2"
          >
            <Share2 className="w-4 h-4 text-slate-500" />
            <span>Share</span>
          </Link>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-sm text-slate-500">No projects yet. Click "Add Project" to create your first project.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((project) => (
            <div key={project.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between hover:shadow-md transition space-y-3">
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">{project.name}</h3>
                    <div className="flex items-center space-x-1 text-xs text-slate-500 mt-1">
                      <MapPin className="w-3 h-3" />
                      <span>{project.location || project.city || "—"}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="px-2.5 py-1 bg-purple-100 text-purple-700 rounded-lg text-[10px] font-extrabold uppercase tracking-wider">
                      {project.type || "Residential"}
                    </span>
                    {project.profiles && project.profiles.name && project.developer_id !== currentUserId && (
                      <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-[9px] font-extrabold">
                        Sub-Builder: {project.profiles.name}
                      </span>
                    )}
                  </div>
                </div>
                {project.price_range && (
                  <p className="text-xs font-semibold text-slate-600 mt-2">{project.price_range}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
