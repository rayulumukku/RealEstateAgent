"use client";

import { useState, useEffect } from "react";
import { Plus, Building, Loader2, CheckCircle2, X } from "lucide-react";
import {
  getInventoryUnits,
  getBuilderProjects,
  addInventoryUnit,
  updateUnitStatus,
  InventoryUnit,
  BuilderProject,
} from "./actions";

export default function BuilderInventoryPage() {
  const [units, setUnits] = useState<InventoryUnit[]>([]);
  const [projects, setProjects] = useState<BuilderProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState("");

  // Form state
  const [form, setForm] = useState({
    project_id: "",
    unit_name: "",
    status: "available",
    floor_number: "",
    tower: "",
    facing: "",
    carpet_area_sqft: "",
    price: "",
    bhk_type: "",
    possession_date: "",
  });

  useEffect(() => {
    const phone = localStorage.getItem("agentsapp_logged_in_phone") || "";
    Promise.all([getInventoryUnits(phone), getBuilderProjects(phone)]).then(
      ([unitsData, projectsData]) => {
        setUnits(unitsData);
        setProjects(projectsData);
        setLoading(false);
      }
    );
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setMessage("");

    const phone = localStorage.getItem("agentsapp_logged_in_phone") || "";
    const result = await addInventoryUnit({
      phone,
      project_id: form.project_id,
      unit_name: form.unit_name,
      status: form.status,
      floor_number: form.floor_number ? parseInt(form.floor_number) : undefined,
      tower: form.tower || undefined,
      facing: form.facing || undefined,
      carpet_area_sqft: form.carpet_area_sqft ? parseInt(form.carpet_area_sqft) : undefined,
      price: form.price ? parseFloat(form.price) : undefined,
      bhk_type: form.bhk_type || undefined,
      possession_date: form.possession_date || undefined,
    });

    if (result.ok) {
      setShowAdd(false);
      setForm({ project_id: "", unit_name: "", status: "available", floor_number: "", tower: "", facing: "", carpet_area_sqft: "", price: "", bhk_type: "", possession_date: "" });
      // Refresh
      const refreshed = await getInventoryUnits(phone);
      setUnits(refreshed);
    } else {
      setMessage(result.error || "Failed to add unit");
    }
    setAdding(false);
  };

  const handleStatusChange = async (unitId: string, newStatus: string) => {
    const result = await updateUnitStatus(unitId, newStatus);
    if (result.ok) {
      setUnits((prev) =>
        prev.map((u) => (u.id === unitId ? { ...u, status: newStatus } : u))
      );
    }
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Inventory Management</h1>
          <p className="text-[#64748b] text-xs font-semibold mt-0.5">Add, update, and manage your project units.</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2.5 bg-[#25d366] hover:bg-[#16c47f] text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add Unit</span>
        </button>
      </div>

      {/* Units Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-semibold">
            <thead className="bg-slate-50 text-slate-400 uppercase tracking-wider text-[9px]">
              <tr>
                <th className="px-4 py-3 text-left">Unit</th>
                <th className="px-4 py-3 text-left">Project</th>
                <th className="px-4 py-3 text-left">BHK</th>
                <th className="px-4 py-3 text-left">Floor</th>
                <th className="px-4 py-3 text-left">Area</th>
                <th className="px-4 py-3 text-left">Price</th>
                <th className="px-4 py-3 text-left">Facing</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {units.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    <Building className="w-5 h-5 mx-auto mb-2" />
                    No units added yet. Click "Add Unit" to get started.
                  </td>
                </tr>
              )}
              {units.map((unit) => (
                <tr key={unit.id} className="hover:bg-slate-50/50 transition">
                  <td className="px-4 py-3 font-bold text-slate-900">{unit.unit_name}</td>
                  <td className="px-4 py-3 text-slate-600">{unit.project_name}</td>
                  <td className="px-4 py-3">{unit.bhk_type || "—"}</td>
                  <td className="px-4 py-3">{unit.floor_number ?? "—"}</td>
                  <td className="px-4 py-3">{unit.carpet_area_sqft ? `${unit.carpet_area_sqft} sqft` : "—"}</td>
                  <td className="px-4 py-3">{unit.price ? `₹${(unit.price / 10000000).toFixed(2)} Cr` : "—"}</td>
                  <td className="px-4 py-3">{unit.facing || "—"}</td>
                  <td className="px-4 py-3">
                    <select
                      value={unit.status}
                      onChange={(e) => handleStatusChange(unit.id, e.target.value)}
                      className={`px-2 py-0.5 rounded text-[9px] font-bold border outline-none ${
                        unit.status === "available"
                          ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                          : unit.status === "booked"
                          ? "bg-amber-50 text-amber-600 border-amber-200"
                          : "bg-red-50 text-red-600 border-red-200"
                      }`}
                    >
                      <option value="available">Available</option>
                      <option value="booked">Booked</option>
                      <option value="sold">Sold</option>
                      <option value="blocked">Blocked</option>
                      <option value="hold">Hold</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Unit Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white p-6 rounded-2xl border border-slate-200 shadow-2xl relative">
            <button
              onClick={() => setShowAdd(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-lg font-bold text-slate-900 mb-4">Add New Unit</h2>

            <form onSubmit={handleAdd} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Project</label>
                  <select
                    required
                    value={form.project_id}
                    onChange={(e) => setForm({ ...form, project_id: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-slate-800 outline-none"
                  >
                    <option value="">Select project</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.location})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Unit Name</label>
                  <input
                    required
                    placeholder="e.g. Flat 402, Block A"
                    value={form.unit_name}
                    onChange={(e) => setForm({ ...form, unit_name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-slate-800 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">BHK Type</label>
                  <select
                    value={form.bhk_type}
                    onChange={(e) => setForm({ ...form, bhk_type: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-slate-800 outline-none"
                  >
                    <option value="">Select</option>
                    <option value="1 BHK">1 BHK</option>
                    <option value="2 BHK">2 BHK</option>
                    <option value="3 BHK">3 BHK</option>
                    <option value="4 BHK">4 BHK</option>
                    <option value="5+ BHK">5+ BHK</option>
                    <option value="Plot">Plot</option>
                    <option value="Villa">Villa</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Floor</label>
                  <input
                    type="number"
                    placeholder="e.g. 4"
                    value={form.floor_number}
                    onChange={(e) => setForm({ ...form, floor_number: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-slate-800 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Tower</label>
                  <input
                    placeholder="e.g. Tower A"
                    value={form.tower}
                    onChange={(e) => setForm({ ...form, tower: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-slate-800 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Carpet Area (sqft)</label>
                  <input
                    type="number"
                    placeholder="e.g. 1850"
                    value={form.carpet_area_sqft}
                    onChange={(e) => setForm({ ...form, carpet_area_sqft: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-slate-800 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Price (₹)</label>
                  <input
                    type="number"
                    placeholder="e.g. 18200000"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-slate-800 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Facing</label>
                  <select
                    value={form.facing}
                    onChange={(e) => setForm({ ...form, facing: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-slate-800 outline-none"
                  >
                    <option value="">Select</option>
                    <option value="East">East</option>
                    <option value="West">West</option>
                    <option value="North">North</option>
                    <option value="South">South</option>
                    <option value="North-East">North-East</option>
                    <option value="South-East">South-East</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Possession Date</label>
                <input
                  type="date"
                  value={form.possession_date}
                  onChange={(e) => setForm({ ...form, possession_date: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-slate-800 outline-none"
                />
              </div>

              {message && (
                <div className="p-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-bold">
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={adding}
                className="w-full py-3 bg-[#25d366] hover:bg-[#16c47f] text-white font-bold rounded-xl text-xs uppercase tracking-wider transition disabled:opacity-60 flex items-center justify-center space-x-2"
              >
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>{adding ? "Adding..." : "Add Unit to Inventory"}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
