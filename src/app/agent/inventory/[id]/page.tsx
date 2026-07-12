"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft, MapPin, BadgeCheck, FileText,
  Share2, CheckCircle2, ChevronRight, Building,
  X, Grid, ShieldCheck, Loader2,
} from "lucide-react";
import { getAgentInventoryProjectDetail, ProjectDetail } from "../actions";

export default function ProjectDetails() {
  const params = useParams();
  const id = (params?.id as string) || "";

  const [activeTab, setActiveTab] = useState<"overview" | "amenities" | "floorplans" | "pricing">("overview");
  const [showUnitsModal, setShowUnitsModal] = useState(false);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getAgentInventoryProjectDetail(id).then((data) => {
      setProject(data);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 bg-[#f8fafc] min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-[#25d366]" />
      </div>
    );
  }

  // Graceful fallback when the id is unknown — no more silently-wrong page.
  if (!project) {
    return (
      <div className="space-y-6 text-slate-800">
        <div>
          <Link
            href="/agent/inventory"
            className="inline-flex items-center space-x-2 text-slate-400 hover:text-slate-700 transition text-xs font-bold uppercase tracking-wider"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Search</span>
          </Link>
        </div>
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-500">
          <Building className="w-6 h-6 mx-auto mb-3 text-slate-400" />
          <div className="font-bold text-slate-800">Project not found</div>
          <p className="text-xs mt-1">
            We could not find a project with id <code className="px-1.5 py-0.5 rounded bg-slate-100">{id || "(none)"}</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-800">

      {/* Back button */}
      <div>
        <Link
          href="/agent/inventory"
          className="inline-flex items-center space-x-2 text-slate-400 hover:text-slate-700 transition text-xs font-bold uppercase tracking-wider"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Search</span>
        </Link>
      </div>

      {/* Project Header Title & Status */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center space-x-3 mb-1.5">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{project.name}</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-[#25d366]/10 text-[#16c47f] text-[9px] font-bold uppercase tracking-wider flex items-center border border-[#25d366]/20">
              <BadgeCheck className="w-3.5 h-3.5 mr-1" />
              <span>RERA Approved</span>
            </span>
          </div>
          <p className="text-slate-500 text-xs flex items-center font-semibold">
            <MapPin className="w-4 h-4 text-slate-400 mr-1" />
            <span>{project.location}, {project.city} · RERA: {project.rera}</span>
          </p>
        </div>

        <button className="px-4 py-2 bg-white border border-slate-250 hover:bg-slate-50 text-slate-700 rounded-xl flex items-center space-x-1.5 text-xs font-bold transition">
          <Share2 className="w-4 h-4" />
          <span>Share details</span>
        </button>
      </div>

      {/* Main Core Panel Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left - Hero Image */}
        <div className="lg:col-span-8 space-y-4">
          <div className="w-full h-80 md:h-[350px] rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-8xl shadow-sm relative select-none">
            🏢
            <div className="absolute bottom-4 left-4 bg-slate-900/80 text-white px-3.5 py-1.5 rounded-lg text-[10px] font-bold">
              Front elevation image template
            </div>
          </div>

          {/* Gallery thumbs */}
          <div className="grid grid-cols-4 gap-3">
            <div className="h-14 rounded-xl border-2 border-[#25d366] bg-white flex items-center justify-center text-xl select-none cursor-pointer">🏢</div>
            <div className="h-14 rounded-xl border border-slate-200 bg-white hover:border-slate-350 flex items-center justify-center text-xl select-none cursor-pointer">🏊</div>
            <div className="h-14 rounded-xl border border-slate-200 bg-white hover:border-slate-350 flex items-center justify-center text-xl select-none cursor-pointer">💪</div>
            <div className="h-14 rounded-xl border border-slate-200 bg-white hover:border-slate-350 flex items-center justify-center text-xl select-none cursor-pointer">🏡</div>
          </div>
        </div>

        {/* Right - Buying / Action Widget */}
        <div className="lg:col-span-4">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Starting From</div>
              <div className="text-3xl font-extrabold text-slate-900 mt-1">{project.startingPrice}</div>
              <div className="text-xs text-slate-500 mt-2 font-semibold">
                Config: <span className="text-[#0f172a] font-bold">{project.config}</span> ·
                Possession: <span className="text-[#0f172a] font-bold">{project.possession}</span>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-6 space-y-3">
              <button
                onClick={() => setShowUnitsModal(true)}
                className="w-full py-3.5 bg-[#25d366] hover:bg-[#16c47f] text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center space-x-2"
              >
                <Grid className="w-4 h-4" />
                <span>View Live Unit Inventory</span>
              </button>

              <a 
                href={project.brochureUrl || "#"} 
                download
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5 transition"
              >
                <FileText className="w-4 h-4" />
                <span>Download PDF Brochure</span>
              </a>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-[10px] text-slate-500 space-y-1.5 font-semibold">
              <div className="font-extrabold text-slate-850 flex items-center">
                <ShieldCheck className="w-3.5 h-3.5 text-[#25d366] mr-1.5" />
                <span>Channel Partner Agent Perks:</span>
              </div>
              <div>· 2.5% Payout on spot booking.</div>
              <div>· CP Meet Invitation pass included.</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Section */}
      <div className="space-y-4">
        <div className="flex border-b border-slate-200 text-xs font-bold uppercase tracking-wider">
          {[
            { id: "overview", label: "Project Overview" },
            { id: "amenities", label: "Amenities" },
            { id: "floorplans", label: "Floor Plans" },
            { id: "pricing", label: "Pricing Sheet" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as "overview" | "amenities" | "floorplans" | "pricing")}
              className={`pb-3 px-4 border-b-2 transition ${
                activeTab === tab.id
                  ? "border-[#25d366] text-[#16c47f]"
                  : "border-transparent text-slate-400 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 text-slate-600 shadow-sm">
          {activeTab === "overview" && (
            <div className="space-y-4">
              <p className="leading-relaxed text-xs font-semibold">{project.overview}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 text-[10px] font-bold">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-slate-400">Developer</div>
                  <div className="text-xs font-extrabold text-slate-800 mt-0.5">{project.builder}</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-slate-400">Total Land</div>
                  <div className="text-xs font-extrabold text-slate-800 mt-0.5">{project.totalLand}</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-slate-400">Structures</div>
                  <div className="text-xs font-extrabold text-slate-800 mt-0.5">{project.structures}</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-slate-400">RERA ID</div>
                  <div className="text-xs font-extrabold text-[#16c47f] mt-0.5">{project.rera}</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "amenities" && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {project.amenities.map((item) => (
                <div key={item} className="flex items-center space-x-2 text-xs font-bold text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-[#25d366] shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === "floorplans" && (
            <div className="space-y-3">
              {project.floorplans.map((item, idx) => (
                <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200 hover:bg-slate-100/50 transition flex justify-between items-center text-xs">
                  <div>
                    <div className="font-bold text-slate-800">{item.name}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{item.rooms}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-700">{item.size}</div>
                    <button className="text-[10px] text-[#16c47f] font-bold hover:underline flex items-center mt-1">
                      <span>View layout PDF</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "pricing" && (
            <div className="overflow-hidden border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs font-semibold">
                <thead className="bg-slate-50 text-slate-400 uppercase tracking-wider text-[9px]">
                  <tr>
                    <th className="px-4 py-3">Configuration</th>
                    <th className="px-4 py-3">Carpet Area Size</th>
                    <th className="px-4 py-3">Tentative Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {project.pricing.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition">
                      <td className="px-4 py-3.5 font-bold text-slate-900">{row.configuration}</td>
                      <td className="px-4 py-3.5">{row.size}</td>
                      <td className="px-4 py-3.5 font-extrabold text-[#16c47f]">{row.price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Available Units Modal */}
      {showUnitsModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl max-h-[85vh] bg-white p-6 rounded-2xl border border-slate-200 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 text-slate-800 flex flex-col overflow-hidden">
            <button
              onClick={() => setShowUnitsModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-655 p-1 rounded-lg hover:bg-slate-50 transition"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-xl font-bold text-slate-900 mb-2 flex items-center space-x-2">
              <Building className="w-5 h-5 text-[#25d366]" />
              <span>Available Units List</span>
            </h2>
            <p className="text-xs text-slate-500 mb-6">Real-time availability status for bookings.</p>

            <div className="flex-1 overflow-auto border border-slate-200 rounded-xl min-h-0">
              <table className="w-full text-left text-xs font-semibold">
                <thead className="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider text-[9px]">
                  <tr>
                    <th className="px-4 py-3">Unit No.</th>
                    <th className="px-4 py-3">Config</th>
                    <th className="px-4 py-3">Size</th>
                    <th className="px-4 py-3">Facing</th>
                    <th className="px-4 py-3">Price</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {project.units.map((unit) => (
                    <tr key={unit.unitNumber} className="hover:bg-slate-50/50 transition">
                      <td className="px-4 py-3.5 font-bold text-slate-900">{unit.unitNumber}</td>
                      <td className="px-4 py-3.5">{unit.bhk}</td>
                      <td className="px-4 py-3.5">{unit.sqft} Sqft</td>
                      <td className="px-4 py-3.5">{unit.facing}</td>
                      <td className="px-4 py-3.5 font-bold">{unit.price}</td>
                      <td className="px-4 py-3.5">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          unit.status === "Available" ? "bg-emerald-50 text-emerald-600 border border-emerald-200" :
                          unit.status === "Blocked" ? "bg-amber-50 text-amber-600 border border-amber-200" :
                          "bg-red-50 text-red-655 border border-red-200"
                        }`}>
                          {unit.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-5 flex justify-end">
              <button
                onClick={() => setShowUnitsModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
