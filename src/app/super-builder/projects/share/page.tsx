"use client";

import { useEffect, useState } from "react";
import { Building2, Loader2, Users, Check, Share2, Search, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Project {
  id: string;
  name: string;
  city: string;
  location: string;
}

interface Builder {
  id: string;
  name: string;
  phone: string;
  agency_name: string;
  location: string;
}

export default function ShareProjectsPage() {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [builders, setBuilders] = useState<Builder[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [selectedBuilders, setSelectedBuilders] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sharing, setSharing] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const meRes = await fetch("/api/me");
      const meData = await meRes.json();
      if (!meData.user) return;

      // Load my projects
      const { data: projectsData } = await supabase
        .from("projects")
        .select("id, name, city, location")
        .eq("developer_id", meData.user.id)
        .order("created_at", { ascending: false });

      if (projectsData) setProjects(projectsData);

      // Load all builders from the database
      const { data: buildersData } = await supabase
        .from("profiles")
        .select("id, name, phone, agency_name, location")
        .eq("role", "builder")
        .order("name", { ascending: true });

      if (buildersData) setBuilders(buildersData);
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  }

  function toggleBuilder(builderId: string) {
    setSelectedBuilders((prev) =>
      prev.includes(builderId)
        ? prev.filter((id) => id !== builderId)
        : [...prev, builderId]
    );
  }

  async function handleShare() {
    if (!selectedProject) {
      setError("Please select a project to share.");
      return;
    }
    if (selectedBuilders.length === 0) {
      setError("Please select at least one builder.");
      return;
    }

    setSharing(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/super-builder/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: selectedProject,
          builder_ids: selectedBuilders,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Failed to share project.");
      } else {
        setSuccess(`Project shared with ${selectedBuilders.length} builder(s) successfully!`);
        setSelectedBuilders([]);
        setSelectedProject("");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSharing(false);
    }
  }

  const filteredBuilders = builders.filter(
    (b) =>
      b.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.phone?.includes(searchQuery) ||
      b.agency_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
            <Share2 className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Share Projects</h1>
            <p className="text-sm text-slate-500">Select a project and choose builders to share it with</p>
          </div>
        </div>
      </div>

      {/* Step 1: Select Project */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
          Step 1: Select Project
        </h2>
        {projects.length === 0 ? (
          <p className="text-sm text-slate-400">No projects available. Add projects first.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => setSelectedProject(project.id)}
                className={`p-4 rounded-xl border text-left transition ${
                  selectedProject === project.id
                    ? "border-purple-500 bg-purple-50 ring-2 ring-purple-200"
                    : "border-slate-200 hover:border-purple-300 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{project.name}</p>
                    <p className="text-xs text-slate-500">{project.location || project.city}</p>
                  </div>
                  {selectedProject === project.id && (
                    <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Step 2: Select Builders */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
            Step 2: Select Builders ({selectedBuilders.length} selected)
          </h2>
          {selectedBuilders.length > 0 && (
            <button
              onClick={() => setSelectedBuilders([])}
              className="text-xs font-bold text-red-500 hover:text-red-700 uppercase tracking-wider"
            >
              Clear All
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search builders by name, phone, or company..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:border-purple-500 transition"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          )}
        </div>

        {filteredBuilders.length === 0 ? (
          <p className="text-sm text-slate-400">No builders found in the database.</p>
        ) : (
          <div className="max-h-80 overflow-y-auto space-y-2">
            {filteredBuilders.map((builder) => (
              <button
                key={builder.id}
                onClick={() => toggleBuilder(builder.id)}
                className={`w-full p-3 rounded-xl border text-left transition flex items-center justify-between ${
                  selectedBuilders.includes(builder.id)
                    ? "border-purple-500 bg-purple-50"
                    : "border-slate-200 hover:border-purple-300 hover:bg-slate-50"
                }`}
              >
                <div>
                  <p className="text-sm font-bold text-slate-900">{builder.name || "Unnamed"}</p>
                  <p className="text-xs text-slate-500">
                    {builder.agency_name || "—"} &middot; {builder.phone} &middot; {builder.location || "—"}
                  </p>
                </div>
                {selectedBuilders.includes(builder.id) && (
                  <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center shrink-0">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Share Button */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-bold">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-600 font-bold">
          {success}
        </div>
      )}

      <button
        onClick={handleShare}
        disabled={sharing || !selectedProject || selectedBuilders.length === 0}
        className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm rounded-xl shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider flex items-center justify-center space-x-2"
      >
        {sharing ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            <Share2 className="w-4 h-4" />
            <span>Share Project with Selected Builders</span>
          </>
        )}
      </button>
    </div>
  );
}
