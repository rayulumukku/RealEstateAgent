"use client";

import { useState, useEffect, useRef } from "react";
import {
  FileText, Eye, Upload, Loader2, Trash2, X,
  FileUp, File, ExternalLink, Plus
} from "lucide-react";
import {
  getAgentDocuments,
  uploadAgentDocument,
  deleteAgentDocument,
  recordBrochureView,
  AgentDocument,
} from "./actions";

const DOC_TYPES = ["Brochure", "Price List", "Agreement", "Site Plan", "Floor Plan", "Other"];

export default function DocumentsPage() {
  const [docs, setDocs] = useState<AgentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [phone, setPhone] = useState("");

  // Upload form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docType, setDocType] = useState("Brochure");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const p = localStorage.getItem("agentsapp_logged_in_phone") || "";
    setPhone(p);
    if (p) {
      getAgentDocuments(p).then((data) => {
        setDocs(data);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  const handleView = async (docId: string) => {
    await recordBrochureView(docId);
    setDocs((prev) =>
      prev.map((d) => (d.id === docId ? { ...d, view_count: d.view_count + 1 } : d))
    );
  };

  const handleDelete = async (docId: string, docName: string) => {
    if (!window.confirm(`Delete "${docName}"? This cannot be undone.`)) return;
    setDeletingId(docId);
    const res = await deleteAgentDocument(docId, phone);
    if (res.ok) {
      setDocs((prev) => prev.filter((d) => d.id !== docId));
    } else {
      alert("Failed to delete: " + res.error);
    }
    setDeletingId(null);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadError("Please select a file.");
      return;
    }
    setUploading(true);
    setUploadError("");

    // Convert to base64
    const reader = new FileReader();
    reader.readAsDataURL(selectedFile);
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      const res = await uploadAgentDocument(
        phone,
        selectedFile.name,
        docType,
        base64,
        selectedFile.type
      );

      if (res.ok) {
        // Refresh list
        const updated = await getAgentDocuments(phone);
        setDocs(updated);
        setShowUploadModal(false);
        setSelectedFile(null);
        setDocType("Brochure");
      } else {
        setUploadError(res.error || "Upload failed.");
      }
      setUploading(false);
    };
    reader.onerror = () => {
      setUploadError("Failed to read file.");
      setUploading(false);
    };
  };

  function timeAgo(dateString: string) {
    const diff = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  return (
    <div className="space-y-6 text-slate-800">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">My Documents</h1>
          <p className="text-[#64748b] text-xs font-semibold mt-0.5">
            Upload and manage your personal brochures & project documents.
          </p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center space-x-2 px-4 py-2.5 bg-[#25d366] hover:bg-[#16c47f] text-white font-bold text-xs rounded-xl transition shadow-sm shadow-[#25d366]/30"
        >
          <Plus className="w-4 h-4" />
          <span>Upload Document</span>
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-[#25d366]" />
          </div>
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <FileUp className="w-10 h-10 mb-3 text-slate-300" />
            <p className="font-bold text-slate-600 text-sm">No documents yet</p>
            <p className="text-xs mt-1 mb-5">Upload your first brochure or document to get started.</p>
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-5 py-2.5 bg-[#25d366] hover:bg-[#16c47f] text-white font-bold text-xs rounded-xl transition"
            >
              Upload Document
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-semibold">
              <thead className="bg-slate-50 text-slate-400 uppercase tracking-wider text-[9px]">
                <tr>
                  <th className="px-4 py-3 text-left">Document</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-center">Views</th>
                  <th className="px-4 py-3 text-left">Uploaded</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {docs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center shrink-0">
                          <File className="w-4 h-4 text-indigo-500" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 truncate max-w-[180px]">{doc.name}</div>
                          {doc.project_name && (
                            <div className="text-[10px] text-slate-400 font-medium">{doc.project_name}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-bold uppercase">
                        {doc.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="flex items-center justify-center space-x-1 text-slate-600">
                        <Eye className="w-3 h-3" />
                        <span>{doc.view_count}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{timeAgo(doc.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center space-x-2">
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => handleView(doc.id)}
                          className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg transition"
                          title="Open"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <button
                          onClick={() => handleDelete(doc.id, doc.name)}
                          disabled={deletingId === doc.id}
                          className="p-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg transition disabled:opacity-50"
                          title="Delete"
                        >
                          {deletingId === doc.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Upload className="w-5 h-5 text-[#25d366]" />
                <h2 className="text-base font-extrabold text-slate-900">Upload Document</h2>
              </div>
              <button
                onClick={() => { setShowUploadModal(false); setSelectedFile(null); setUploadError(""); }}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* File Drop Area */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 hover:border-[#25d366] rounded-xl p-8 text-center cursor-pointer transition group"
              >
                <FileText className="w-10 h-10 text-slate-300 group-hover:text-[#25d366] mx-auto mb-2 transition" />
                {selectedFile ? (
                  <div>
                    <p className="font-bold text-slate-800 text-sm truncate">{selectedFile.name}</p>
                    <p className="text-xs text-slate-400 mt-1">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                ) : (
                  <div>
                    <p className="font-bold text-slate-600 text-sm">Click to choose a file</p>
                    <p className="text-xs text-slate-400 mt-1">PDF, DOC, DOCX, XLSX, JPG, PNG</p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.xlsx,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setSelectedFile(f);
                    setUploadError("");
                  }}
                />
              </div>

              {/* Document Type */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Document Type</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-[#25d366]"
                >
                  {DOC_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {uploadError && (
                <p className="text-xs text-red-500 font-semibold bg-red-50 px-3 py-2 rounded-lg">{uploadError}</p>
              )}

              <button
                onClick={handleUpload}
                disabled={uploading || !selectedFile}
                className="w-full py-3 bg-[#25d366] hover:bg-[#16c47f] text-white font-bold text-sm rounded-xl transition flex items-center justify-center space-x-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Upload Document</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
