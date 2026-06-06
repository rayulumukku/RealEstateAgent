"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Search, SlidersHorizontal, MapPin, Building, 
  Download, ArrowRight, CheckCircle, Info, Loader2
} from "lucide-react";
import { getAgentInventoryProjects, DBProject } from "./actions";

export default function InventorySearch() {
  const [projects, setProjects] = useState<DBProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"All" | "Plot" | "Villa" | "Apartment" | "Commercial">("All");
  const [filterFacing, setFilterFacing] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    getAgentInventoryProjects().then((data) => {
      setProjects(data);
      setLoading(false);
    });
  }, []);

  // Filters logic
  const filteredProjects = projects.filter(project => {
    const matchesSearch = 
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.builder.toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchesType = filterType === "All" || project.type === filterType;
    const matchesFacing = filterFacing === "" || project.facing === filterFacing;

    return matchesSearch && matchesType && matchesFacing;
  });

  const handleDownloadBrochure = (id: string, name: string) => {
    setDownloadingId(id);
    setTimeout(() => {
      setDownloadingId(null);
      alert(`Brochure for "${name}" downloaded! Saved in Vault.`);
    }, 1200);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#25d366]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-800">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Inventory Search</h1>
        <p className="text-[#64748b] text-xs font-semibold mt-0.5">Explore Plots, Villas, Apartments, and Commercial layouts.</p>
      </div>

      {/* Filters Panel */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search by location, builder, project name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 focus:border-[#25d366] rounded-xl py-2.5 pl-11 pr-4 text-slate-800 placeholder-slate-400 outline-none text-xs transition"
          />
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-semibold">
          <div>
            <select 
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="w-full bg-white border border-slate-200 text-slate-600 rounded-xl py-2 px-3 outline-none focus:border-[#25d366] transition"
            >
              <option value="All">All Property Types</option>
              <option value="Plot">Plots & Lands</option>
              <option value="Villa">Villas</option>
              <option value="Apartment">Apartments</option>
              <option value="Commercial">Commercial</option>
            </select>
          </div>

          <div>
            <select 
              value={filterFacing}
              onChange={(e) => setFilterFacing(e.target.value)}
              className="w-full bg-white border border-slate-200 text-slate-600 rounded-xl py-2 px-3 outline-none focus:border-[#25d366] transition"
            >
              <option value="">Facing (Any)</option>
              <option value="East">East</option>
              <option value="West">West</option>
              <option value="North">North</option>
            </select>
          </div>

          <div>
            <select className="w-full bg-white border border-slate-200 text-slate-600 rounded-xl py-2 px-3 outline-none focus:border-[#25d366] transition">
              <option>Price Limit (Any)</option>
              <option>&lt; ₹1.5 Cr</option>
              <option>₹1.5 Cr - ₹3.0 Cr</option>
              <option>&gt; ₹3.0 Cr</option>
            </select>
          </div>

          <button className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl flex items-center justify-center space-x-2 transition">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>More Filters</span>
          </button>
        </div>
      </div>

      {/* Grid list of properties */}
      <div className="space-y-4">
        {filteredProjects.map((project) => (
          <div 
            key={project.id}
            className="bg-white p-5 rounded-2xl border border-slate-200/80 hover:border-[#25d366]/40 transition shadow-sm flex flex-col md:flex-row justify-between gap-5 relative overflow-hidden"
          >
            {project.isPremium && (
              <span className="absolute top-0 right-0 bg-[#25d366] text-white text-[8px] font-extrabold px-3 py-1 rounded-bl-xl uppercase tracking-wider">
                Premium
              </span>
            )}

            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-3xl select-none">
                {project.type === "Plot" ? "🚜" : project.type === "Villa" ? "🏡" : project.type === "Commercial" ? "🏬" : "🏢"}
              </div>

              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <h3 className="font-bold text-base text-slate-900">{project.name}</h3>
                  <span className="text-[9px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-bold uppercase tracking-wider">{project.builder}</span>
                </div>

                <div className="text-[11px] text-slate-500 flex items-center">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 mr-0.5" />
                  <span>{project.location} · {project.type}</span>
                </div>

                {/* Specific attributes displays */}
                <div className="flex flex-wrap gap-1.5 pt-2 text-[9px] font-bold">
                  {project.type === "Plot" && (
                    <>
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded">Road: {project.roadWidth}</span>
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded">Facing: {project.facing}</span>
                      <span className="bg-[#25d366]/10 text-[#16c47f] px-2 py-0.5 rounded">{project.fencing ? "Fenced" : "No Fence"}</span>
                    </>
                  )}
                  {project.type === "Villa" && (
                    <>
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded">Built-up: {project.builtUp}</span>
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{project.pool ? "Private Pool" : ""}</span>
                      <span className="bg-[#25d366]/10 text-[#16c47f] px-2 py-0.5 rounded">{project.smartHome ? "Smart Home" : ""}</span>
                    </>
                  )}
                  {project.type === "Apartment" && (
                    <>
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{project.tower}</span>
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded">Balconies: {project.balconyCount}</span>
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded">Facing: {project.facing}</span>
                    </>
                  )}
                  {project.type === "Commercial" && (
                    <>
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded">Frontage: {project.frontage}</span>
                      <span className="bg-[#25d366]/10 text-[#16c47f] px-2 py-0.5 rounded">Parking: {project.parking}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Price and CTA footer */}
            <div className="flex md:flex-col justify-between items-center md:items-end gap-3 md:justify-center border-t md:border-t-0 border-slate-100 pt-4 md:pt-0 shrink-0">
              <div className="text-left md:text-right">
                <div className="text-[8px] text-slate-400 uppercase tracking-wider font-semibold">Starting price</div>
                <div className="text-base font-extrabold text-slate-900">{project.price}</div>
                <div className="text-[10px] text-[#16c47f] font-bold mt-0.5">{project.availableUnits} units available</div>
              </div>

              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => handleDownloadBrochure(project.id, project.name)}
                  disabled={downloadingId === project.id}
                  className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200 flex items-center space-x-1 text-xs font-bold transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{downloadingId === project.id ? "Saving..." : "Brochure"}</span>
                </button>

                <Link 
                  href={`/agent/inventory/${project.id}`}
                  className="px-4 py-2 bg-[#25d366] hover:bg-[#16c47f] text-white font-bold rounded-xl flex items-center space-x-1 text-xs shadow-sm transition"
                >
                  <span>View Details</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        ))}

        {filteredProjects.length === 0 && (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400">
            <Info className="w-6 h-6 mx-auto mb-2 text-slate-500" />
            <div className="font-bold">No inventory matches search filters</div>
          </div>
        )}
      </div>
    </div>
  );
}
