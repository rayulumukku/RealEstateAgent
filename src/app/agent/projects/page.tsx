"use client";

import { useState, useEffect } from "react";
import { Heart, HeartOff, FileText, MapPin, Loader2, Building, ChevronDown, ChevronUp } from "lucide-react";
import {
  getProjectsWithFollowStatus,
  toggleFollowProject,
  getProjectDocuments,
  ProjectWithFollow,
  ProjectDocument,
} from "./actions";

export default function AgentProjectsPage() {
  const [projects, setProjects] = useState<ProjectWithFollow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "following">("all");
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [docs, setDocs] = useState<ProjectDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  useEffect(() => {
    const phone = localStorage.getItem("agentsapp_logged_in_phone") || "";
    getProjectsWithFollowStatus(phone).then((data) => {
      setProjects(data);
      setLoading(false);
    });
  }, []);

  const handleToggleFollow = async (projectId: string, currentlyFollowing: boolean) => {
    const phone = localStorage.getItem("agentsapp_logged_in_phone") || "";
    const result = await toggleFollowProject(phone, projectId, !currentlyFollowing);
    if (result.ok) {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId ? { ...p, is_following: !currentlyFollowing } : p
        )
      );
    }
  };

  const handleExpandDocs = async (projectId: string) => {
    if (expandedProject === projectId) {
      setExpandedProject(null);
      setDocs([]);
      return;
    }
    setExpandedProject(projectId);
    setDocsLoading(true);
    const projectDocs = await getProjectDocuments(projectId);
    setDocs(projectDocs);
    setDocsLoading(false);
  };

  const filtered = filter === "following" ? projects.filter((p) => p.is_following) : projects;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#25d366]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-800">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Projects</h1>
        <p className="text-[#64748b] text-xs font-semibold mt-0.5">
          Follow projects to get updates. Click to see related documents.
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex space-x-2">
        <button
          onClick={() => setFilter("all")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
            filter === "all" ? "bg-slate-900 text-white" : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          All Projects ({projects.length})
        </button>
        <button
          onClick={() => setFilter("following")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
            filter === "following" ? "bg-[#25d366] text-white" : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          Following ({projects.filter((p) => p.is_following).length})
        </button>
      </div>

      {/* Projects List */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400">
            <Building className="w-6 h-6 mx-auto mb-2" />
            <div className="font-bold">{filter === "following" ? "Not following any projects yet" : "No projects available"}</div>
          </div>
        )}

        {filtered.map((project) => (
          <div key={project.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-lg">
                  {project.type === "plot" ? "🚜" : project.type === "villa" ? "🏡" : "🏢"}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">{project.name}</h3>
                  <div className="flex items-center space-x-2 text-[10px] text-slate-500 mt-0.5">
                    <span className="flex items-center space-x-0.5">
                      <MapPin className="w-3 h-3" />
                      <span>{project.location}</span>
                    </span>
                    <span>·</span>
                    <span>{project.price_range}</span>
                    <span>·</span>
                    <span>{project.type}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {/* Documents button */}
                <button
                  onClick={() => handleExpandDocs(project.id)}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-[10px] font-bold text-slate-600 flex items-center space-x-1 transition"
                >
                  <FileText className="w-3 h-3" />
                  <span>{project.documents_count} docs</span>
                  {expandedProject === project.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>

                {/* Follow button */}
                <button
                  onClick={() => handleToggleFollow(project.id, project.is_following)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center space-x-1 transition ${
                    project.is_following
                      ? "bg-[#25d366]/10 text-[#16c47f] border border-[#25d366]/30 hover:bg-red-50 hover:text-red-500 hover:border-red-200"
                      : "bg-slate-50 text-slate-500 border border-slate-200 hover:bg-[#25d366]/10 hover:text-[#16c47f] hover:border-[#25d366]/30"
                  }`}
                >
                  {project.is_following ? <HeartOff className="w-3 h-3" /> : <Heart className="w-3 h-3" />}
                  <span>{project.is_following ? "Unfollow" : "Follow"}</span>
                </button>
              </div>
            </div>

            {/* Expanded Documents Section */}
            {expandedProject === project.id && (
              <div className="border-t border-slate-100 p-4 bg-slate-50/50">
                {docsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                  </div>
                ) : docs.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-2">No documents for this project yet.</p>
                ) : (
                  <div className="space-y-2">
                    {docs.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200">
                        <div className="flex items-center space-x-2">
                          <FileText className="w-4 h-4 text-[#25d366]" />
                          <div>
                            <div className="text-xs font-bold text-slate-800">{doc.name}</div>
                            <div className="text-[9px] text-slate-400">{doc.type}</div>
                          </div>
                        </div>
                        <a
                          href={doc.url === "#" ? "#" : doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 bg-[#25d366] hover:bg-[#16c47f] text-white text-[9px] font-bold rounded-lg transition"
                        >
                          Download
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
