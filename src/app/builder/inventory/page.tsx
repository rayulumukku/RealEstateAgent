"use client";

import { useState, useEffect } from "react";
import { Plus, Building, Loader2, CheckCircle2, X, FileSpreadsheet, Pencil, Sparkles, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import {
  getInventoryUnits,
  getBuilderProjects,
  addInventoryUnit,
  updateUnitStatus,
  updateInventoryUnit,
  updateProjectUnitsFromExcel,
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

  // Edit State
  const [showEdit, setShowEdit] = useState(false);
  const [editingUnit, setEditingUnit] = useState<InventoryUnit | null>(null);
  const [editingForm, setEditingForm] = useState({
    id: "",
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
  const [updating, setUpdating] = useState(false);

  // Bulk Excel Upload State
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [excelProjectId, setExcelProjectId] = useState("");
  const [excelFileName, setExcelFileName] = useState("");
  const [excelParsing, setExcelParsing] = useState(false);
  const [excelUnits, setExcelUnits] = useState<any[]>([]);
  const [excelSaving, setExcelSaving] = useState(false);

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

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  useEffect(() => {
    const phone = localStorage.getItem("agentsapp_logged_in_phone") || "";
    Promise.all([getInventoryUnits(phone), getBuilderProjects(phone)]).then(
      ([unitsData, projectsData]) => {
        setUnits(unitsData);
        setProjects(projectsData);
        setLoading(false);
      }
    );

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      setSelectedProjectId(params.get("project_id"));
    }
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      setForm(prev => ({ ...prev, project_id: selectedProjectId }));
      setExcelProjectId(selectedProjectId);
    }
  }, [selectedProjectId]);

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

  const openEdit = (unit: InventoryUnit) => {
    setEditingUnit(unit);
    setEditingForm({
      id: unit.id,
      unit_name: unit.unit_name,
      status: unit.status,
      floor_number: unit.floor_number !== null ? String(unit.floor_number) : "",
      tower: unit.tower || "",
      facing: unit.facing || "",
      carpet_area_sqft: unit.carpet_area_sqft !== null ? String(unit.carpet_area_sqft) : "",
      price: unit.price !== null ? String(unit.price) : "",
      bhk_type: unit.bhk_type || "",
      possession_date: unit.possession_date || "",
    });
    setShowEdit(true);
    setMessage("");
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    setMessage("");

    const phone = localStorage.getItem("agentsapp_logged_in_phone") || "";
    const result = await updateInventoryUnit({
      id: editingForm.id,
      unit_name: editingForm.unit_name,
      status: editingForm.status,
      floor_number: editingForm.floor_number ? parseInt(editingForm.floor_number) : undefined,
      tower: editingForm.tower || undefined,
      facing: editingForm.facing || undefined,
      carpet_area_sqft: editingForm.carpet_area_sqft ? parseInt(editingForm.carpet_area_sqft) : undefined,
      price: editingForm.price ? parseFloat(editingForm.price) : undefined,
      bhk_type: editingForm.bhk_type || undefined,
      possession_date: editingForm.possession_date || undefined,
    });

    if (result.ok) {
      setShowEdit(false);
      setEditingUnit(null);
      // Refresh
      const refreshed = await getInventoryUnits(phone);
      setUnits(refreshed);
    } else {
      setMessage(result.error || "Failed to update unit");
    }
    setUpdating(false);
  };

  const handleExcelFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setExcelFileName(selectedFile.name);
      setExcelParsing(true);

      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: "binary" });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws);
          
          const parsed = data.map((row: any) => {
            const getVal = (patterns: string[]) => {
              const key = Object.keys(row).find(k => 
                patterns.some(p => k.toLowerCase().replace(/[\s_-]/g, "").includes(p))
              );
              return key ? row[key] : null;
            };

            const unitName = getVal(["apartment", "unitname", "unitno", "flat", "plot", "name", "number"]) || "Unit";
            const block = getVal(["block", "tower"]);
            const floorNo = getVal(["floorno", "floor"]);
            const facing = getVal(["facing"]);
            const sqft = getVal(["sqft", "area", "size", "sft"]);
            const price = getVal(["price", "cost", "value"]);
            const bhkVal = getVal(["bhk", "bhktype"]);
            const statusRaw = getVal(["status", "availability"]) || "available";

            let status = "available";
            const sLower = String(statusRaw).toLowerCase();
            if (sLower.includes("book")) status = "booked";
            else if (sLower.includes("sold") || sLower.includes("close")) status = "sold";
            else if (sLower.includes("block")) status = "blocked";
            else if (sLower.includes("hold")) status = "hold";

            return {
              unit_name: String(unitName),
              status: status,
              floor_number: floorNo ? parseInt(String(floorNo)) : null,
              tower: block ? String(block) : null,
              facing: facing ? String(facing) : null,
              carpet_area_sqft: sqft ? parseInt(String(sqft)) : null,
              price: price ? parseFloat(String(price)) : null,
              bhk_type: bhkVal ? String(bhkVal) : null,
              details: row
            };
          });

          setExcelUnits(parsed);
        } catch (err) {
          console.error("Error parsing Excel:", err);
          alert("Error parsing Excel file.");
        } finally {
          setExcelParsing(false);
        }
      };
      reader.readAsBinaryString(selectedFile);
    }
  };

  const handleExcelSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!excelProjectId || excelUnits.length === 0) {
      alert("Please select a project and upload a valid Excel file.");
      return;
    }

    setExcelSaving(true);
    const phone = localStorage.getItem("agentsapp_logged_in_phone") || "";
    try {
      const result = await updateProjectUnitsFromExcel(excelProjectId, excelUnits);
      if (result.ok) {
        setShowExcelModal(false);
        setExcelProjectId("");
        setExcelFileName("");
        setExcelUnits([]);
        
        // Refresh
        const refreshed = await getInventoryUnits(phone);
        setUnits(refreshed);
      } else {
        alert(result.error || "Failed to update units from Excel.");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while saving units.");
    } finally {
      setExcelSaving(false);
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
      {/* SCREEN 1: Projects Selection Grid */}
      {!selectedProjectId ? (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Inventory Management</h1>
            <p className="text-[#64748b] text-xs font-semibold mt-0.5">Select a project below to manage its units and upload inventory sheets.</p>
          </div>

          {projects.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400">
              <Building className="w-8 h-8 mx-auto mb-2 text-slate-350" />
              <div className="font-bold text-slate-700">No Projects Found</div>
              <p className="text-xs text-slate-500 mt-1">Please create a project first under "Add Project" to manage its inventory.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => {
                const projectUnits = units.filter(u => u.project_id === project.id);
                const total = projectUnits.length;
                const available = projectUnits.filter(u => u.status === "available").length;
                const booked = projectUnits.filter(u => u.status === "booked").length;
                const sold = projectUnits.filter(u => u.status === "sold").length;
                const blocked = projectUnits.filter(u => u.status === "blocked" || u.status === "hold").length;

                return (
                  <div
                    key={project.id}
                    onClick={() => {
                      setSelectedProjectId(project.id);
                      if (typeof window !== "undefined") {
                        const newUrl = `${window.location.pathname}?project_id=${project.id}`;
                        window.history.replaceState({}, "", newUrl);
                      }
                    }}
                    className="group bg-white p-6 rounded-2xl border border-slate-200 hover:border-indigo-400 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-150 flex items-center justify-center text-indigo-650 group-hover:bg-indigo-600 group-hover:text-white transition duration-200">
                          <Building className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                          Project
                        </span>
                      </div>

                      <h3 className="font-extrabold text-slate-900 text-base tracking-tight group-hover:text-indigo-650 transition duration-200">
                        {project.name}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 font-semibold">
                        {project.location}
                      </p>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100 space-y-3">
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Units</span>
                        <span className="text-lg font-black text-slate-900">{total}</span>
                      </div>

                      {total > 0 && (
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                          <div style={{ width: `${(available/total)*100}%` }} className="bg-emerald-500" title="Available"></div>
                          <div style={{ width: `${(booked/total)*100}%` }} className="bg-amber-500" title="Booked"></div>
                          <div style={{ width: `${((sold + blocked)/total)*100}%` }} className="bg-red-500" title="Sold/Blocked"></div>
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] font-extrabold tracking-tight pt-1">
                        <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg">
                          <div>{available}</div>
                          <div className="text-[8px] text-emerald-500 uppercase">Available</div>
                        </div>
                        <div className="p-1.5 bg-amber-50 text-amber-700 rounded-lg">
                          <div>{booked}</div>
                          <div className="text-[8px] text-amber-500 uppercase">Booked</div>
                        </div>
                        <div className="p-1.5 bg-slate-50 text-slate-700 rounded-lg">
                          <div>{sold + blocked}</div>
                          <div className="text-[8px] text-slate-400 uppercase">Sold/Blk</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <button
              onClick={() => {
                setSelectedProjectId(null);
                if (typeof window !== "undefined") {
                  window.history.replaceState({}, "", window.location.pathname);
                }
              }}
              className="mb-3 px-3.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs rounded-xl transition flex items-center space-x-1"
            >
              <span>← Back to Projects</span>
            </button>
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  {projects.find(p => p.id === selectedProjectId)?.name || "Project"} Inventory
                </h1>
                <p className="text-[#64748b] text-xs font-semibold mt-0.5">
                  Location: {projects.find(p => p.id === selectedProjectId)?.location || ""} · Manage project units & upload spreadsheets.
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowExcelModal(true)}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload Excel</span>
                </button>
                <button
                  onClick={() => setShowAdd(true)}
                  className="px-4 py-2.5 bg-[#25d366] hover:bg-[#16c47f] text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Unit</span>
                </button>
              </div>
            </div>
          </div>

          {/* Units Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-semibold">
                <thead className="bg-slate-50 text-slate-400 uppercase tracking-wider text-[9px]">
                  <tr>
                    <th className="px-4 py-3 text-left">Unit</th>
                    <th className="px-4 py-3 text-left">BHK</th>
                    <th className="px-4 py-3 text-left">Floor</th>
                    <th className="px-4 py-3 text-left">Area</th>
                    <th className="px-4 py-3 text-left">Price</th>
                    <th className="px-4 py-3 text-left">Facing</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {units.filter(u => u.project_id === selectedProjectId).length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                        <Building className="w-5 h-5 mx-auto mb-2" />
                        No units added yet for this project.
                      </td>
                    </tr>
                  )}
                  {units.filter(u => u.project_id === selectedProjectId).map((unit) => (
                    <tr key={unit.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-4 py-3 font-bold text-slate-900">{unit.unit_name}</td>
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
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openEdit(unit)}
                          className="p-1 text-slate-400 hover:text-indigo-650 transition inline-block"
                          title="Edit Unit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

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
                    disabled
                    value={form.project_id}
                    onChange={(e) => setForm({ ...form, project_id: e.target.value })}
                    className="w-full bg-slate-100 border border-slate-200 rounded-xl py-2 px-3 text-slate-500 outline-none cursor-not-allowed"
                  >
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

      {/* Edit Unit Modal */}
      {showEdit && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white p-6 rounded-2xl border border-slate-200 shadow-2xl relative text-slate-800">
            <button
              onClick={() => setShowEdit(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-lg font-bold text-slate-900 mb-4">Edit Unit Details</h2>

            <form onSubmit={handleEdit} className="space-y-3 text-xs">
              <div className="space-y-1.5">
                <label className="block text-[9px] font-bold text-slate-400 uppercase">Unit Name</label>
                <input
                  required
                  placeholder="e.g. Flat 402, Block A"
                  value={editingForm.unit_name}
                  onChange={(e) => setEditingForm({ ...editingForm, unit_name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 outline-none text-sm font-medium"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">BHK Type</label>
                  <select
                    value={editingForm.bhk_type}
                    onChange={(e) => setEditingForm({ ...editingForm, bhk_type: e.target.value })}
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
                    value={editingForm.floor_number}
                    onChange={(e) => setEditingForm({ ...editingForm, floor_number: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-slate-800 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Tower</label>
                  <input
                    placeholder="e.g. Tower A"
                    value={editingForm.tower}
                    onChange={(e) => setEditingForm({ ...editingForm, tower: e.target.value })}
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
                    value={editingForm.carpet_area_sqft}
                    onChange={(e) => setEditingForm({ ...editingForm, carpet_area_sqft: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-slate-800 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Price (₹)</label>
                  <input
                    type="number"
                    placeholder="e.g. 18200000"
                    value={editingForm.price}
                    onChange={(e) => setEditingForm({ ...editingForm, price: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-slate-800 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Facing</label>
                  <select
                    value={editingForm.facing}
                    onChange={(e) => setEditingForm({ ...editingForm, facing: e.target.value })}
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Possession Date</label>
                  <input
                    type="date"
                    value={editingForm.possession_date}
                    onChange={(e) => setEditingForm({ ...editingForm, possession_date: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-slate-800 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Status</label>
                  <select
                    value={editingForm.status}
                    onChange={(e) => setEditingForm({ ...editingForm, status: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-slate-800 outline-none font-bold text-slate-900"
                  >
                    <option value="available">Available</option>
                    <option value="booked">Booked</option>
                    <option value="sold">Sold</option>
                    <option value="blocked">Blocked</option>
                    <option value="hold">Hold</option>
                  </select>
                </div>
              </div>

              {message && (
                <div className="p-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-bold">
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={updating}
                className="w-full py-3 bg-indigo-650 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition disabled:opacity-60 flex items-center justify-center space-x-2 shadow-md shadow-indigo-600/25"
              >
                {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>{updating ? "Saving Changes..." : "Save Changes"}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Excel Upload Modal */}
      {showExcelModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white p-6 rounded-2xl border border-slate-200 shadow-2xl relative text-slate-800">
            <button
              onClick={() => {
                setShowExcelModal(false);
                setExcelProjectId("");
                setExcelFileName("");
                setExcelUnits([]);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-lg font-bold text-slate-900 mb-2 flex items-center space-x-2">
              <FileSpreadsheet className="w-5 h-5 text-indigo-500" />
              <span>Bulk Excel Update</span>
            </h2>
            <p className="text-[11px] text-slate-400 mb-4">
              Upload an Excel file to replace the entire inventory units list of the selected project. This will delete all current units for the selected project and replace them.
            </p>

            <form onSubmit={handleExcelSave} className="space-y-4 text-xs">
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Target Project</label>
                <select
                  disabled
                  value={excelProjectId}
                  onChange={(e) => setExcelProjectId(e.target.value)}
                  className="w-full bg-slate-100 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-500 outline-none cursor-not-allowed text-sm font-medium"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.location})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-[9px] font-bold text-slate-400 uppercase">Excel File (.xlsx, .xls, .csv)</label>
                <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl p-6 transition text-center cursor-pointer relative bg-slate-50/50">
                  <input
                    type="file"
                    required
                    accept=".xlsx,.xls,.csv"
                    onChange={handleExcelFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <div className="space-y-2 flex flex-col items-center">
                    <FileSpreadsheet className="w-8 h-8 text-slate-400" />
                    <div>
                      <p className="text-xs font-bold text-slate-700">
                        {excelFileName ? excelFileName : "Click to select or drag Excel file here"}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Supports standard columns (Unit Name, Block, Floor, Facing, Sqft, Price, BHK)
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {excelParsing && (
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] text-slate-500 font-bold flex items-center space-x-1.5 justify-center">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                  <span>Parsing Excel columns...</span>
                </div>
              )}

              {!excelParsing && excelUnits.length > 0 && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-250 rounded-xl text-[10px] text-emerald-700 font-bold flex items-center space-x-1.5 justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Successfully parsed {excelUnits.length} inventory units from Excel!</span>
                </div>
              )}

              <button
                type="submit"
                disabled={excelSaving || excelUnits.length === 0 || !excelProjectId}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition disabled:opacity-60 flex items-center justify-center space-x-2 shadow-md shadow-indigo-600/20"
              >
                {excelSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>{excelSaving ? "Updating Inventory..." : "Replace & Save Inventory"}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
