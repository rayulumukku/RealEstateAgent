"use client";

import { useEffect, useState } from "react";
import { Building2, Loader2, MapPin, Search, X } from "lucide-react";
import { getFollowedProjects } from "./actions";
import { getProjectInventoryUnits } from "@/app/builder/inventory/actions";

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

  // Units Modal state
  const [selectedProjectUnits, setSelectedProjectUnits] = useState<any[]>([]);
  const [unitsModalProject, setUnitsModalProject] = useState<Project | null>(null);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [unitsSearch, setUnitsSearch] = useState("");

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

  async function openUnitsModal(project: Project) {
    setUnitsModalProject(project);
    setLoadingUnits(true);
    try {
      const units = await getProjectInventoryUnits(project.id);
      setSelectedProjectUnits(units);
    } catch (err) {
      console.error("Error loading units:", err);
      alert("Error loading inventory units.");
    } finally {
      setLoadingUnits(false);
    }
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
          <p className="text-sm text-slate-500 mt-1 mb-6">Discover new projects in the Invitations section.</p>
          <a href="/agent/invitations" className="px-5 py-2.5 bg-[#25d366] hover:bg-[#16c47f] text-white font-bold text-sm rounded-xl transition">
            Browse Invitations
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
                <div className="flex space-x-2">
                  <button 
                    onClick={() => openUnitsModal(project)}
                    className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-650 rounded-lg text-xs font-bold transition"
                  >
                    Units
                  </button>
                  <button className="px-3 py-1.5 bg-white border border-slate-200 hover:border-[#25d366] text-slate-600 rounded-lg text-xs font-bold transition">
                    View Updates
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Units Modal */}
      {unitsModalProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">{unitsModalProject.name} Inventory</h3>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">{unitsModalProject.location} · {selectedProjectUnits.length} total units</p>
              </div>
              <button 
                onClick={() => setUnitsModalProject(null)} 
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filters */}
            <div className="p-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  value={unitsSearch} 
                  onChange={(e) => setUnitsSearch(e.target.value)} 
                  placeholder="Search units by name, facing, block..." 
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs text-slate-800 outline-none transition" 
                />
                {unitsSearch && (
                  <button onClick={() => setUnitsSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
              {loadingUnits ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 font-bold text-xs uppercase tracking-wider space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                  <span>Loading Units...</span>
                </div>
              ) : selectedProjectUnits.length === 0 ? (
                <div className="p-12 text-center text-slate-400 font-bold bg-white rounded-xl border border-slate-200">
                  <Building2 className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <span>No units added to this project yet.</span>
                </div>
              ) : (() => {
                const filtered = selectedProjectUnits.filter((u) => {
                  const query = unitsSearch.toLowerCase();
                  const matchName = String(u.unit_name).toLowerCase().includes(query);
                  const matchFacing = String(u.facing || "").toLowerCase().includes(query);
                  const matchTower = String(u.tower || "").toLowerCase().includes(query);
                  const matchStatus = String(u.status || "").toLowerCase().includes(query);
                  return matchName || matchFacing || matchTower || matchStatus;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="p-12 text-center text-slate-400 font-bold bg-white rounded-xl border border-slate-200">
                      <span>No units match your search.</span>
                    </div>
                  );
                }

                return (
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                    <table className="w-full text-left text-xs font-semibold text-slate-500 border-collapse">
                      <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-200 text-[10px] text-slate-400 uppercase tracking-wider">
                          <th className="p-3">Unit / Plot</th>
                          <th className="p-3">Block / Tower</th>
                          <th className="p-3">Floor</th>
                          <th className="p-3">Facing</th>
                          <th className="p-3">Area (Sqft)</th>
                          <th className="p-3">Other Details</th>
                          <th className="p-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filtered.map((u) => {
                          const statusColors: Record<string, string> = {
                            available: "bg-emerald-50 text-emerald-600 border border-emerald-200",
                            booked: "bg-amber-50 text-amber-600 border border-amber-200",
                            sold: "bg-red-50 text-red-650 border border-red-200",
                            blocked: "bg-slate-100 text-slate-500 border border-slate-200",
                            hold: "bg-amber-100/50 text-amber-800 border border-amber-200",
                          };

                          // Find any extra details (excluding known keys)
                          const knownKeys = ["apartment", "unitname", "unitno", "flat", "plot", "name", "number", "block", "tower", "floorno", "floor", "facing", "sqft", "area", "size", "sft", "price", "cost", "value", "status", "availability"];
                          const extraDetails = Object.entries(u.details || {})
                            .filter(([k]) => !knownKeys.some(p => k.toLowerCase().replace(/[\s_-]/g, "").includes(p)))
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(", ");

                          return (
                            <tr key={u.id} className="hover:bg-slate-50/30 transition text-slate-700">
                              <td className="p-3 font-bold text-slate-900">{u.unit_name}</td>
                              <td className="p-3">{u.tower || "—"}</td>
                              <td className="p-3">{u.floor_number !== null ? u.floor_number : "—"}</td>
                              <td className="p-3">{u.facing || "—"}</td>
                              <td className="p-3">{u.carpet_area_sqft ? `${u.carpet_area_sqft} sqft` : "—"}</td>
                              <td className="p-3 text-[10px] text-slate-400 font-medium max-w-xs truncate" title={extraDetails}>
                                {extraDetails || "—"}
                              </td>
                              <td className="p-3 text-right">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide inline-block ${statusColors[u.status.toLowerCase()] || "bg-slate-50"}`}>
                                  {u.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
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
