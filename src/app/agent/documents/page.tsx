"use client";

import { useState, useEffect } from "react";
import { FileText, Eye, Send, Loader2 } from "lucide-react";
import { getBrochureStats, recordBrochureView, BrochureStats } from "./actions";

export default function DocumentsPage() {
  const [docs, setDocs] = useState<BrochureStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBrochureStats().then((data) => {
      setDocs(data);
      setLoading(false);
    });
  }, []);

  const handleView = async (docId: string) => {
    await recordBrochureView(docId);
    setDocs((prev) =>
      prev.map((d) => (d.id === docId ? { ...d, view_count: d.view_count + 1 } : d))
    );
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
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Documents & Brochures</h1>
        <p className="text-[#64748b] text-xs font-semibold mt-0.5">
          Track brochure sends and views via WhatsApp.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-semibold">
            <thead className="bg-slate-50 text-slate-400 uppercase tracking-wider text-[9px]">
              <tr>
                <th className="px-4 py-3 text-left">Document</th>
                <th className="px-4 py-3 text-left">Project</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-center">Sent via WA</th>
                <th className="px-4 py-3 text-center">Views</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {docs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    <FileText className="w-5 h-5 mx-auto mb-2" />
                    No documents available.
                  </td>
                </tr>
              )}
              {docs.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50/50 transition">
                  <td className="px-4 py-3 font-bold text-slate-900">{doc.name}</td>
                  <td className="px-4 py-3 text-slate-600">{doc.project_name || "—"}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-bold">
                      {doc.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="flex items-center justify-center space-x-1 text-slate-600">
                      <Send className="w-3 h-3" />
                      <span>{doc.send_count}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="flex items-center justify-center space-x-1 text-slate-600">
                      <Eye className="w-3 h-3" />
                      <span>{doc.view_count}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleView(doc.id)}
                      className="px-2.5 py-1 bg-[#25d366] hover:bg-[#16c47f] text-white text-[9px] font-bold rounded-lg transition"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
