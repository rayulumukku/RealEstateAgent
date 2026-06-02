"use client";

import { useEffect, useState } from "react";
import { Building2, Loader2, MapPin, Share2 } from "lucide-react";
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
}

export default function SuperBuilderProjects() {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    setLoading(true);
    try {
      const meRes = await fetch("/api/me");
      const meData = await meRes.json();
      if (!meData.user) return;

      const { data: projectsData } = await supabase
        .from("projects")
        .select("*")
        .eq("developer_id", meData.user.id)
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
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">My Projects</h1>
          <p className="text-sm text-slate-500">All projects you own. Share them with builders from the Share Projects page.</p>
        </div>
        <Link
          href="/super-builder/projects/share"
          className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-md transition uppercase tracking-wider flex items-center space-x-2"
        >
          <Share2 className="w-4 h-4" />
          <span>Share</span>
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-sm text-slate-500">No projects yet. Add projects from the Builder portal.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((project) => (
            <div key={project.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">{project.name}</h3>
                  <div className="flex items-center space-x-1 text-xs text-slate-500 mt-1">
                    <MapPin className="w-3 h-3" />
                    <span>{project.location || project.city || "—"}</span>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-purple-50 text-purple-600 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                  {project.type || "Residential"}
                </span>
              </div>
              {project.price_range && (
                <p className="text-xs font-semibold text-slate-600">{project.price_range}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
