"use client";

import { useState, useEffect } from "react";
import { Building2, Loader2, MapPin, Users, Crown, Clock, Search, X, ChevronDown, ChevronUp, Pencil, Trash2, Plus, Save, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getProjectInventoryUnits } from "@/app/builder/inventory/actions";
import * as XLSX from "xlsx";

interface ProjectWithDetails {
  id: string;
  name: string;
  location: string;
  city: string;
  price_range: string;
  type: string;
  created_at: string;
  developer_id: string;
  developer_name: string;
  developer_role: string;
  developer_phone: string;
  shares: { builder_name: string; builder_phone: string; builder_company: string; status: string; shared_at: string }[];
  unitStats?: { total: number; available: number; booked: number; sold: number; blocked: number; hold: number };
}

interface BuilderOption {
  id: string;
  name: string;
  phone: string;
  role: string;
}

export default function AdminProjectsPage() {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<ProjectWithDetails[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [filterRole, setFilterRole] = useState<"all" | "builder" | "super_builder">("all");

  // Edit state
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", location: "", city: "", price_range: "", type: "" });
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Create state
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ developer_id: "", name: "", location: "", city: "", price_range: "", type: "Residential" });
  const [creating, setCreating] = useState(false);
  const [builders, setBuilders] = useState<BuilderOption[]>([]);

  // Units Modal state
  const [selectedProjectUnits, setSelectedProjectUnits] = useState<any[]>([]);
  const [unitsModalProject, setUnitsModalProject] = useState<ProjectWithDetails | null>(null);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [unitsSearch, setUnitsSearch] = useState("");

  useEffect(() => {
    loadProjects();
    loadBuilders();
  }, []);

  async function loadBuilders() {
    const { data } = await supabase
      .from("profiles")
      .select("id, name, phone, role")
      .in("role", ["builder", "super_builder"])
      .order("name", { ascending: true });
    if (data) setBuilders(data);
  }

  async function openUnitsModal(project: ProjectWithDetails) {
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

  function handleDownloadExcel() {
    if (!unitsModalProject || !selectedProjectUnits || selectedProjectUnits.length === 0) return;
    
    // Format the data for the Excel sheet
    const dataToExport = selectedProjectUnits.map((u) => {
      // Find any extra details (excluding known keys)
      const knownKeys = ["apartment", "unitname", "unitno", "flat", "plot", "name", "number", "block", "tower", "floorno", "floor", "facing", "sqft", "area", "size", "sft", "price", "cost", "value", "status", "availability"];
      const extraDetails = Object.entries(u.details || {})
        .filter(([k]) => !knownKeys.some(p => k.toLowerCase().replace(/[\s_-]/g, "").includes(p)))
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");

      return {
        "Unit / Plot": u.unit_name,
        "Block / Tower": u.tower || "—",
        "Floor": u.floor_number !== null ? u.floor_number : "—",
        "Facing": u.facing || "—",
        "Area (Sqft)": u.carpet_area_sqft || "—",
        "Price": u.price || "—",
        "BHK Type": u.bhk_type || "—",
        "Status": u.status,
        "Other Details": extraDetails || "—"
      };
    });

    // Create a worksheet
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);

    // Create a workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory");

    // Generate buffer and trigger download
    XLSX.writeFile(workbook, `${unitsModalProject.name.replace(/[^a-zA-Z0-9]/g, "_")}_inventory.xlsx`);
  }

  async function loadProjects() {
    setLoading(true);
    try {
      const { data: projectsData } = await supabase
        .from("projects")
        .select("*, profiles!projects_developer_id_fkey(name, role, phone)")
        .order("created_at", { ascending: false });

      const { data: sharesData } = await supabase
        .from("project_shares")
        .select("*, profiles!project_shares_builder_id_fkey(name, phone, agency_name)")
        .order("created_at", { ascending: false });

      const { data: unitsData } = await supabase
        .from("inventory_units")
        .select("project_id, status");

      const sharesMap = new Map<string, any[]>();
      if (sharesData) {
        for (const share of sharesData) {
          const existing = sharesMap.get(share.project_id) || [];
          existing.push({
            builder_name: share.profiles?.name || "Unknown",
            builder_phone: share.profiles?.phone || "",
            builder_company: share.profiles?.agency_name || "",
            status: share.status,
            shared_at: share.created_at,
          });
          sharesMap.set(share.project_id, existing);
        }
      }

      const unitsMap = new Map<string, { total: number; available: number; booked: number; sold: number; blocked: number; hold: number }>();
      if (unitsData) {
        for (const u of unitsData) {
          const stats = unitsMap.get(u.project_id) || { total: 0, available: 0, booked: 0, sold: 0, blocked: 0, hold: 0 };
          stats.total++;
          const s = (u.status || "available").toLowerCase();
          if (s === "available") stats.available++;
          else if (s === "booked") stats.booked++;
          else if (s === "sold") stats.sold++;
          else if (s === "blocked") stats.blocked++;
          else if (s === "hold") stats.hold++;
          unitsMap.set(u.project_id, stats);
        }
      }

      if (projectsData) {
        setProjects(projectsData.map((p: any) => ({
          id: p.id,
          name: p.name,
          location: p.location || "",
          city: p.details?.city || p.city || "",
          price_range: p.price_range || "",
          type: p.type || "Residential",
          created_at: p.created_at,
          developer_id: p.developer_id,
          developer_name: p.profiles?.name || "Unknown",
          developer_role: p.profiles?.role || "builder",
          developer_phone: p.profiles?.phone || "",
          shares: sharesMap.get(p.id) || [],
          unitStats: unitsMap.get(p.id) || { total: 0, available: 0, booked: 0, sold: 0, blocked: 0, hold: 0 }
        })));
      }
    } catch (err) {
      console.error("Error loading projects:", err);
    } finally {
      setLoading(false);
    }
  }

  function startEdit(project: ProjectWithDetails) {
    setEditingProject(project.id);
    setEditForm({ name: project.name, location: project.location, city: project.city, price_range: project.price_range, type: project.type });
  }

  async function handleSaveEdit() {
    if (!editingProject) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/manage", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "project", id: editingProject, updates: editForm }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setEditingProject(null);
        await loadProjects();
      } else {
        alert(data.error || "Failed to update project.");
      }
    } catch {
      alert("Network error.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(projectId: string, projectName: string) {
    if (!window.confirm(`Are you sure you want to DELETE "${projectName}"? This will also remove all shares. This cannot be undone.`)) return;
    setDeletingId(projectId);
    try {
      const res = await fetch("/api/admin/manage", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "project", id: projectId }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        await loadProjects();
      } else {
        alert(data.error || "Failed to delete.");
      }
    } catch {
      alert("Network error.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleCreate() {
    if (!createForm.developer_id || !createForm.name) {
      alert("Builder/Super Builder and Project Name are required.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "project", data: createForm }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setShowCreate(false);
        setCreateForm({ developer_id: "", name: "", location: "", city: "", price_range: "", type: "Residential" });
        await loadProjects();
      } else {
        alert(data.error || "Failed to create.");
      }
    } catch {
      alert("Network error.");
    } finally {
      setCreating(false);
    }
  }

  const filteredProjects = projects.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.developer_name.toLowerCase().includes(searchQuery.toLowerCase()) || p.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = filterRole === "all" || p.developer_role === filterRole;
    return matchesSearch && matchesRole;
  });

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    return `${days}d ago`;
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>;
  }

  return (
    <div className="space-y-6 text-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">All Projects</h1>
          <p className="text-[#64748b] text-xs font-semibold mt-0.5">Edit, delete, or create projects on behalf of any builder or super builder.</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition uppercase tracking-wider flex items-center space-x-2">
          <Plus className="w-4 h-4" />
          <span>Create Project</span>
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Create Project on Behalf of Builder/Super Builder</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Assign to *</label>
              <select value={createForm.developer_id} onChange={(e) => setCreateForm({ ...createForm, developer_id: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500">
                <option value="">Select builder/super builder...</option>
                {builders.map((b) => (
                  <option key={b.id} value={b.id}>{b.name} ({b.role === "super_builder" ? "Super Builder" : "Builder"}) - {b.phone}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Project Name *</label>
              <input type="text" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} placeholder="e.g. Skyline Heights" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Location</label>
              <input type="text" value={createForm.location} onChange={(e) => setCreateForm({ ...createForm, location: e.target.value })} placeholder="e.g. Kokapet" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">City</label>
              <input type="text" value={createForm.city} onChange={(e) => setCreateForm({ ...createForm, city: e.target.value })} placeholder="e.g. Hyderabad" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Price Range</label>
              <input type="text" value={createForm.price_range} onChange={(e) => setCreateForm({ ...createForm, price_range: e.target.value })} placeholder="e.g. ₹1.5 Cr - ₹3 Cr" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Type</label>
              <select value={createForm.type} onChange={(e) => setCreateForm({ ...createForm, type: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500">
                <option>Residential</option>
                <option>Commercial</option>
                <option>Villa</option>
                <option>Plot</option>
                <option>Mixed</option>
              </select>
            </div>
          </div>
          <div className="flex space-x-3 pt-2">
            <button onClick={handleCreate} disabled={creating} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition disabled:opacity-50 uppercase tracking-wider">{creating ? "Creating..." : "Create Project"}</button>
            <button onClick={() => setShowCreate(false)} className="px-5 py-2.5 text-slate-500 hover:text-slate-800 font-bold text-xs uppercase tracking-wider">Cancel</button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm"><p className="text-2xl font-extrabold text-slate-900">{projects.length}</p><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total</p></div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm"><p className="text-2xl font-extrabold text-slate-900">{projects.filter(p => p.developer_role === "builder").length}</p><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">By Builders</p></div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm"><p className="text-2xl font-extrabold text-purple-600">{projects.filter(p => p.developer_role === "super_builder").length}</p><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">By Super Builders</p></div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm"><p className="text-2xl font-extrabold text-emerald-600">{projects.reduce((acc, p) => acc + p.shares.filter(s => s.status === "active").length, 0)}</p><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Shares</p></div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search project name, developer, or location..." className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:border-emerald-500 transition" />
          {searchQuery && <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-slate-400" /></button>}
        </div>
        <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl">
          {(["all", "builder", "super_builder"] as const).map((role) => (
            <button key={role} onClick={() => setFilterRole(role)} className={`px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition ${filterRole === role ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500"}`}>{role === "all" ? "All" : role === "builder" ? "Builders" : "Super Builders"}</button>
          ))}
        </div>
      </div>

      {/* Projects List */}
      <div className="space-y-3">
        {filteredProjects.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center"><Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" /><p className="text-sm text-slate-500">No projects match your filters.</p></div>
        ) : (
          filteredProjects.map((project) => (
            <div key={project.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Editing Mode */}
              {editingProject === project.id ? (
                <div className="p-5 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600">Editing Project</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} placeholder="Name" className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
                    <input type="text" value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} placeholder="Location" className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
                    <input type="text" value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} placeholder="City" className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
                    <input type="text" value={editForm.price_range} onChange={(e) => setEditForm({ ...editForm, price_range: e.target.value })} placeholder="Price Range" className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
                    <select value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })} className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500">
                      <option>Residential</option><option>Commercial</option><option>Villa</option><option>Plot</option><option>Mixed</option>
                    </select>
                  </div>
                  <div className="flex space-x-3">
                    <button onClick={handleSaveEdit} disabled={saving} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition disabled:opacity-50 flex items-center space-x-1.5"><Save className="w-3.5 h-3.5" /><span>{saving ? "Saving..." : "Save"}</span></button>
                    <button onClick={() => setEditingProject(null)} className="px-4 py-2 text-slate-500 hover:text-slate-800 font-bold text-xs">Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Project Header */}
                  <div className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 cursor-pointer flex-1" onClick={() => setExpandedProject(expandedProject === project.id ? null : project.id)}>
                        <div className="flex items-center space-x-2">
                          <h3 className="text-sm font-extrabold text-slate-900">{project.name}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${project.developer_role === "super_builder" ? "bg-purple-50 text-purple-600" : "bg-indigo-50 text-indigo-600"}`}>{project.developer_role === "super_builder" ? "Super Builder" : "Builder"}</span>
                        </div>
                        <div className="flex items-center space-x-3 text-xs text-slate-500">
                          <span className="flex items-center space-x-1"><MapPin className="w-3 h-3" /><span>{project.location || project.city || "—"}</span></span>
                          {project.price_range && <span className="font-bold text-emerald-600">{project.price_range}</span>}
                        </div>
                        <div className="flex items-center space-x-2 text-xs text-slate-500">
                          <span>Created by:</span>
                          <span className="font-bold text-slate-800 flex items-center space-x-1">{project.developer_role === "super_builder" && <Crown className="w-3 h-3 text-purple-500" />}<span>{project.developer_name}</span></span>
                          <span className="text-slate-400">({project.developer_phone})</span>
                        </div>
                        {project.unitStats && project.unitStats.total > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-500 mt-1.5">
                            <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-bold uppercase text-[9px] tracking-wider">
                              {project.unitStats.total} units
                            </span>
                            {project.unitStats.available > 0 && (
                              <span className="text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider">
                                {project.unitStats.available} Available
                              </span>
                            )}
                            {project.unitStats.booked > 0 && (
                              <span className="text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider">
                                {project.unitStats.booked} Booked
                              </span>
                            )}
                            {project.unitStats.sold > 0 && (
                              <span className="text-red-600 font-bold bg-red-50 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider">
                                {project.unitStats.sold} Sold
                              </span>
                            )}
                            {project.unitStats.blocked > 0 && (
                              <span className="text-slate-600 font-bold bg-slate-50 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider">
                                {project.unitStats.blocked} Blocked
                              </span>
                            )}
                            {project.unitStats.hold > 0 && (
                              <span className="text-amber-700 font-bold bg-amber-100/50 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider">
                                {project.unitStats.hold} Hold
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 shrink-0">
                        <div className="text-right mr-3">
                          <div className="flex items-center space-x-1 text-xs text-slate-500"><Users className="w-3 h-3" /><span className="font-bold">{project.shares.filter(s => s.status === "active").length}</span></div>
                          <p className="text-[10px] text-slate-400">{timeAgo(project.created_at)}</p>
                        </div>
                        <button 
                          onClick={() => openUnitsModal(project)} 
                          className="px-3 py-1 bg-indigo-50 border border-indigo-250 text-indigo-650 hover:bg-indigo-100 font-bold text-[10px] rounded-lg transition uppercase tracking-wider flex items-center space-x-1 shrink-0"
                          title="View Inventory Units"
                        >
                          <Building2 className="w-3 h-3 text-indigo-500" />
                          <span>Units</span>
                        </button>
                        <button onClick={() => startEdit(project)} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition" title="Edit"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(project.id, project.name)} disabled={deletingId === project.id} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50" title="Delete">{deletingId === project.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}</button>
                        <button onClick={() => setExpandedProject(expandedProject === project.id ? null : project.id)} className="p-2 text-slate-400 hover:text-slate-600">{expandedProject === project.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded */}
                  {expandedProject === project.id && (
                    <div className="border-t border-slate-100 p-5 bg-slate-50/50">
                      {project.shares.length === 0 ? (
                        <p className="text-xs text-slate-400">No builders shared.</p>
                      ) : (
                        <div className="space-y-2">
                          <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3">Builders with Access ({project.shares.length})</h4>
                          {project.shares.map((share, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200">
                              <div><p className="text-xs font-bold text-slate-900">{share.builder_name}</p><p className="text-[10px] text-slate-500">{share.builder_company ? `${share.builder_company} · ` : ""}{share.builder_phone}</p></div>
                              <div className="text-right"><span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${share.status === "active" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>{share.status}</span><p className="text-[10px] text-slate-400 mt-1"><Clock className="w-2.5 h-2.5 inline mr-0.5" />{formatDate(share.shared_at)}</p></div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          ))
        )}
      </div>

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
              {selectedProjectUnits.length > 0 && (
                <button
                  onClick={handleDownloadExcel}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition uppercase tracking-wider flex items-center justify-center space-x-2 shrink-0"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Download Excel</span>
                </button>
              )}
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
                            sold: "bg-red-50 text-red-600 border border-red-200",
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
