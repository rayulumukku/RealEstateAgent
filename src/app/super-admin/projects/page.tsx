"use client";

import { useState, useEffect } from "react";
import { Building2, Loader2, MapPin, Users, Crown, Clock, Search, X, ChevronDown, ChevronUp, Pencil, Trash2, Plus, Save } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface ProjectWithDetails { id: string; name: string; location: string; city: string; price_range: string; type: string; created_at: string; developer_id: string; developer_name: string; developer_role: string; developer_phone: string; shares: { builder_name: string; builder_phone: string; builder_company: string; status: string; shared_at: string }[]; }
interface BuilderOption { id: string; name: string; phone: string; role: string; }

export default function SuperAdminProjectsPage() {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<ProjectWithDetails[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [filterRole, setFilterRole] = useState<"all" | "builder" | "super_builder">("all");
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", location: "", city: "", price_range: "", type: "" });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ developer_id: "", name: "", location: "", city: "", price_range: "", type: "Residential" });
  const [creating, setCreating] = useState(false);
  const [builders, setBuilders] = useState<BuilderOption[]>([]);

  useEffect(() => { loadProjects(); loadBuilders(); }, []);

  async function loadBuilders() { const { data } = await supabase.from("profiles").select("id, name, phone, role").in("role", ["builder", "super_builder"]).order("name"); if (data) setBuilders(data); }

  async function loadProjects() {
    setLoading(true);
    try {
      const { data: p } = await supabase.from("projects").select("*, profiles!projects_developer_id_fkey(name, role, phone)").order("created_at", { ascending: false });
      const { data: s } = await supabase.from("project_shares").select("*, profiles!project_shares_builder_id_fkey(name, phone, agency_name)").order("created_at", { ascending: false });
      const sharesMap = new Map<string, any[]>();
      if (s) for (const share of s) { const ex = sharesMap.get(share.project_id) || []; ex.push({ builder_name: share.profiles?.name || "Unknown", builder_phone: share.profiles?.phone || "", builder_company: share.profiles?.agency_name || "", status: share.status, shared_at: share.created_at }); sharesMap.set(share.project_id, ex); }
      if (p) setProjects(p.map((proj: any) => ({ id: proj.id, name: proj.name, location: proj.location || "", city: proj.city || "", price_range: proj.price_range || "", type: proj.type || "Residential", created_at: proj.created_at, developer_id: proj.developer_id, developer_name: proj.profiles?.name || "Unknown", developer_role: proj.profiles?.role || "builder", developer_phone: proj.profiles?.phone || "", shares: sharesMap.get(proj.id) || [] })));
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }

  function startEdit(project: ProjectWithDetails) { setEditingProject(project.id); setEditForm({ name: project.name, location: project.location, city: project.city, price_range: project.price_range, type: project.type }); }
  async function handleSaveEdit() { if (!editingProject) return; setSaving(true); const res = await fetch("/api/admin/manage", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "project", id: editingProject, updates: editForm }) }); const data = await res.json(); if (res.ok && data.ok) { setEditingProject(null); await loadProjects(); } else alert(data.error || "Failed."); setSaving(false); }
  async function handleDelete(id: string, name: string) { if (!window.confirm(`DELETE "${name}"? Cannot be undone.`)) return; setDeletingId(id); const res = await fetch("/api/admin/manage", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "project", id }) }); const data = await res.json(); if (res.ok && data.ok) await loadProjects(); else alert(data.error || "Failed."); setDeletingId(null); }
  async function handleCreate() { if (!createForm.developer_id || !createForm.name) { alert("Builder and name required."); return; } setCreating(true); const res = await fetch("/api/admin/manage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "project", data: createForm }) }); const data = await res.json(); if (res.ok && data.ok) { setShowCreate(false); setCreateForm({ developer_id: "", name: "", location: "", city: "", price_range: "", type: "Residential" }); await loadProjects(); } else alert(data.error || "Failed."); setCreating(false); }

  const filtered = projects.filter((p) => { const s = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.developer_name.toLowerCase().includes(searchQuery.toLowerCase()) || p.location.toLowerCase().includes(searchQuery.toLowerCase()); return s && (filterRole === "all" || p.developer_role === filterRole); });
  function timeAgo(d: string) { const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000); return days === 0 ? "Today" : days === 1 ? "Yesterday" : `${days}d ago`; }
  function formatDate(d: string) { return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-red-500" /></div>;

  return (
    <div className="space-y-6 text-slate-800">
      <div className="flex items-center justify-between border-b border-slate-200 pb-5">
        <div><h1 className="text-2xl font-extrabold text-slate-900">All Projects (Super Admin)</h1><p className="text-[#64748b] text-xs font-semibold mt-0.5">Create, edit, or delete ANY project — no restrictions.</p></div>
        <button onClick={() => setShowCreate(!showCreate)} className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-md transition uppercase tracking-wider flex items-center space-x-2"><Plus className="w-4 h-4" /><span>Create Project</span></button>
      </div>

      {showCreate && (
        <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Create Project on behalf of any Builder/Super Builder</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5"><label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Assign to *</label><select value={createForm.developer_id} onChange={(e) => setCreateForm({ ...createForm, developer_id: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-sm outline-none"><option value="">Select...</option>{builders.map(b => <option key={b.id} value={b.id}>{b.name} ({b.role === "super_builder" ? "SB" : "B"}) - {b.phone}</option>)}</select></div>
            <div className="space-y-1.5"><label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Name *</label><input type="text" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-sm outline-none" /></div>
            <div className="space-y-1.5"><label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Location</label><input type="text" value={createForm.location} onChange={(e) => setCreateForm({ ...createForm, location: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-sm outline-none" /></div>
            <div className="space-y-1.5"><label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">City</label><input type="text" value={createForm.city} onChange={(e) => setCreateForm({ ...createForm, city: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-sm outline-none" /></div>
            <div className="space-y-1.5"><label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Price Range</label><input type="text" value={createForm.price_range} onChange={(e) => setCreateForm({ ...createForm, price_range: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-sm outline-none" /></div>
            <div className="space-y-1.5"><label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Type</label><select value={createForm.type} onChange={(e) => setCreateForm({ ...createForm, type: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-sm outline-none"><option>Residential</option><option>Commercial</option><option>Villa</option><option>Plot</option><option>Mixed</option></select></div>
          </div>
          <div className="flex space-x-3"><button onClick={handleCreate} disabled={creating} className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl disabled:opacity-50 uppercase">{creating ? "Creating..." : "Create"}</button><button onClick={() => setShowCreate(false)} className="px-5 py-2.5 text-slate-500 font-bold text-xs uppercase">Cancel</button></div>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search..." className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none" />{searchQuery && <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-slate-400" /></button>}</div>
        <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl">{(["all", "builder", "super_builder"] as const).map(r => <button key={r} onClick={() => setFilterRole(r)} className={`px-3 py-2 rounded-lg text-xs font-bold uppercase ${filterRole === r ? "bg-white text-red-700 shadow-sm" : "text-slate-500"}`}>{r === "all" ? "All" : r === "builder" ? "Builders" : "Super Builders"}</button>)}</div>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center"><Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" /><p className="text-sm text-slate-500">No projects found.</p></div> : filtered.map(project => (
          <div key={project.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {editingProject === project.id ? (
              <div className="p-5 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-red-600">Editing</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-sm outline-none" placeholder="Name" />
                  <input type="text" value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-sm outline-none" placeholder="Location" />
                  <input type="text" value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-sm outline-none" placeholder="City" />
                  <input type="text" value={editForm.price_range} onChange={(e) => setEditForm({ ...editForm, price_range: e.target.value })} className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-sm outline-none" placeholder="Price" />
                  <select value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })} className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-sm outline-none"><option>Residential</option><option>Commercial</option><option>Villa</option><option>Plot</option><option>Mixed</option></select>
                </div>
                <div className="flex space-x-3"><button onClick={handleSaveEdit} disabled={saving} className="px-4 py-2 bg-red-600 text-white font-bold text-xs rounded-xl disabled:opacity-50 flex items-center space-x-1.5"><Save className="w-3.5 h-3.5" /><span>{saving ? "Saving..." : "Save"}</span></button><button onClick={() => setEditingProject(null)} className="px-4 py-2 text-slate-500 font-bold text-xs">Cancel</button></div>
              </div>
            ) : (
              <>
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 cursor-pointer flex-1" onClick={() => setExpandedProject(expandedProject === project.id ? null : project.id)}>
                      <div className="flex items-center space-x-2"><h3 className="text-sm font-extrabold text-slate-900">{project.name}</h3><span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${project.developer_role === "super_builder" ? "bg-purple-50 text-purple-600" : "bg-indigo-50 text-indigo-600"}`}>{project.developer_role === "super_builder" ? "Super Builder" : "Builder"}</span></div>
                      <div className="flex items-center space-x-3 text-xs text-slate-500"><span className="flex items-center space-x-1"><MapPin className="w-3 h-3" /><span>{project.location || project.city || "—"}</span></span>{project.price_range && <span className="font-bold text-emerald-600">{project.price_range}</span>}</div>
                      <div className="text-xs text-slate-500">By: <span className="font-bold text-slate-800">{project.developer_role === "super_builder" && "👑 "}{project.developer_name}</span> ({project.developer_phone})</div>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0">
                      <div className="text-right mr-2"><div className="flex items-center space-x-1 text-xs text-slate-500"><Users className="w-3 h-3" /><span className="font-bold">{project.shares.filter((s: any) => s.status === "active").length}</span></div><p className="text-[10px] text-slate-400">{timeAgo(project.created_at)}</p></div>
                      <button onClick={() => startEdit(project)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(project.id, project.name)} disabled={deletingId === project.id} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50">{deletingId === project.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}</button>
                      <button onClick={() => setExpandedProject(expandedProject === project.id ? null : project.id)} className="p-2 text-slate-400">{expandedProject === project.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button>
                    </div>
                  </div>
                </div>
                {expandedProject === project.id && (
                  <div className="border-t border-slate-100 p-5 bg-slate-50/50">
                    {project.shares.length === 0 ? <p className="text-xs text-slate-400">No builders shared.</p> : (
                      <div className="space-y-2"><h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3">Builders ({project.shares.length})</h4>
                        {project.shares.map((share, idx) => (<div key={idx} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200"><div><p className="text-xs font-bold text-slate-900">{share.builder_name}</p><p className="text-[10px] text-slate-500">{share.builder_company ? `${share.builder_company} · ` : ""}{share.builder_phone}</p></div><div className="text-right"><span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${share.status === "active" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>{share.status}</span><p className="text-[10px] text-slate-400 mt-1"><Clock className="w-2.5 h-2.5 inline mr-0.5" />{formatDate(share.shared_at)}</p></div></div>))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
