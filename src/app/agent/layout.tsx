"use client";

import { useEffect, useState, useRef } from "react";
import AgentSidebar from "@/components/AgentSidebar";
import AgentBottomNav from "@/components/AgentBottomNav";
import SessionSync from "@/components/SessionSync";
import WarningPopup from "@/components/WarningPopup";
import { Clock, XCircle, Loader2, Upload, CheckCircle2, FileText } from "lucide-react";
import { performLogout } from "@/components/SessionSync";

type AgentStatus = "loading" | "approved" | "pending" | "docs_required" | "docs_uploaded" | "rejected";

interface UploadedDoc {
  doc_type: string;
  file_name: string;
  uploaded_at: string;
}

export default function AgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [status, setStatus] = useState<AgentStatus>("loading");
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");

  const reraRef = useRef<HTMLInputElement>(null);
  const panRef = useRef<HTMLInputElement>(null);
  const aadhaarRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkStatus();
  }, []);

  async function checkStatus() {
    try {
      const res = await fetch("/api/profile");
      if (res.ok) {
        const data = await res.json();
        if (data.profile) {
          const s = data.profile.status;
          if (s === "approved") setStatus("approved");
          else if (s === "rejected") setStatus("rejected");
          else if (s === "docs_required") {
            setStatus("docs_required");
            loadDocs();
          } else if (s === "docs_uploaded") {
            setStatus("docs_uploaded");
            loadDocs();
          } else {
            setStatus("pending");
          }
        } else {
          setStatus("pending");
        }
      } else {
        setStatus("approved");
      }
    } catch {
      setStatus("approved");
    }
  }

  async function loadDocs() {
    try {
      const res = await fetch("/api/verification-docs");
      if (res.ok) {
        const data = await res.json();
        setUploadedDocs(data.docs || []);
      }
    } catch { /* ignore */ }
  }

  async function handleUpload(docType: string, file: File) {
    setUploading(docType);
    setUploadError("");
    setUploadSuccess("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("doc_type", docType);

    try {
      const res = await fetch("/api/verification-docs", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setUploadError(data.error || "Upload failed");
      } else {
        setUploadSuccess(`${docType.replace("_", " ")} uploaded successfully!`);
        await loadDocs();
        // If all docs uploaded, update status
        if (data.allUploaded) {
          setStatus("docs_uploaded");
        }
      }
    } catch {
      setUploadError("Network error. Please try again.");
    } finally {
      setUploading(null);
    }
  }

  function isDocUploaded(docType: string) {
    return uploadedDocs.some(d => d.doc_type === docType);
  }

  // Loading state
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-screen bg-[#f8fafc]">
        <Loader2 className="w-8 h-8 animate-spin text-[#25d366]" />
      </div>
    );
  }

  // Pending approval (no docs requested yet)
  if (status === "pending") {
    return (
      <div className="flex items-center justify-center h-screen bg-[#f8fafc] p-6">
        <SessionSync />
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-xl p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto">
            <Clock className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-900">Approval Pending</h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            Your registration has been submitted successfully. Please wait while our admin team reviews your profile.
          </p>
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 font-semibold">
            This usually takes a few hours. You will be able to access the app once approved.
          </div>
          <button
            onClick={() => performLogout()}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition uppercase tracking-wider"
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  // Docs Required — show upload form
  if (status === "docs_required") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f8fafc] p-6">
        <SessionSync />
        <div className="max-w-lg w-full bg-white rounded-2xl border border-slate-200 shadow-xl p-8 space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Upload className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-extrabold text-slate-900">Document Verification Required</h1>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              Admin has requested you to upload the following documents for verification. Please upload all 3 documents to proceed.
            </p>
          </div>

          {/* Upload Cards */}
          <div className="space-y-4">
            {/* RERA Certificate */}
            <div className={`p-4 rounded-xl border ${isDocUploaded("rera_certificate") ? "border-emerald-200 bg-emerald-50/30" : "border-slate-200 bg-slate-50"}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {isDocUploaded("rera_certificate") ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <FileText className="w-5 h-5 text-slate-400" />
                  )}
                  <div>
                    <div className="text-xs font-bold text-slate-900">RERA Certificate</div>
                    <div className="text-[10px] text-slate-500">PDF or Image, max 5MB</div>
                  </div>
                </div>
                {isDocUploaded("rera_certificate") ? (
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-1 rounded">Uploaded</span>
                ) : (
                  <>
                    <input ref={reraRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleUpload("rera_certificate", e.target.files[0]); }} />
                    <button
                      onClick={() => reraRef.current?.click()}
                      disabled={uploading === "rera_certificate"}
                      className="px-3 py-1.5 bg-[#25d366] hover:bg-[#16c47f] text-white text-[10px] font-bold rounded-lg transition disabled:opacity-50"
                    >
                      {uploading === "rera_certificate" ? "Uploading..." : "Upload"}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* PAN Card */}
            <div className={`p-4 rounded-xl border ${isDocUploaded("pan_card") ? "border-emerald-200 bg-emerald-50/30" : "border-slate-200 bg-slate-50"}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {isDocUploaded("pan_card") ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <FileText className="w-5 h-5 text-slate-400" />
                  )}
                  <div>
                    <div className="text-xs font-bold text-slate-900">PAN Card</div>
                    <div className="text-[10px] text-slate-500">PDF or Image, max 5MB</div>
                  </div>
                </div>
                {isDocUploaded("pan_card") ? (
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-1 rounded">Uploaded</span>
                ) : (
                  <>
                    <input ref={panRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleUpload("pan_card", e.target.files[0]); }} />
                    <button
                      onClick={() => panRef.current?.click()}
                      disabled={uploading === "pan_card"}
                      className="px-3 py-1.5 bg-[#25d366] hover:bg-[#16c47f] text-white text-[10px] font-bold rounded-lg transition disabled:opacity-50"
                    >
                      {uploading === "pan_card" ? "Uploading..." : "Upload"}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Aadhaar Card */}
            <div className={`p-4 rounded-xl border ${isDocUploaded("aadhaar_card") ? "border-emerald-200 bg-emerald-50/30" : "border-slate-200 bg-slate-50"}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {isDocUploaded("aadhaar_card") ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <FileText className="w-5 h-5 text-slate-400" />
                  )}
                  <div>
                    <div className="text-xs font-bold text-slate-900">Aadhaar Card</div>
                    <div className="text-[10px] text-slate-500">PDF or Image, max 5MB</div>
                  </div>
                </div>
                {isDocUploaded("aadhaar_card") ? (
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-1 rounded">Uploaded</span>
                ) : (
                  <>
                    <input ref={aadhaarRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleUpload("aadhaar_card", e.target.files[0]); }} />
                    <button
                      onClick={() => aadhaarRef.current?.click()}
                      disabled={uploading === "aadhaar_card"}
                      className="px-3 py-1.5 bg-[#25d366] hover:bg-[#16c47f] text-white text-[10px] font-bold rounded-lg transition disabled:opacity-50"
                    >
                      {uploading === "aadhaar_card" ? "Uploading..." : "Upload"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {uploadError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-bold">{uploadError}</div>
          )}
          {uploadSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-600 font-bold flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{uploadSuccess}</span>
            </div>
          )}

          <div className="text-center">
            <button
              onClick={() => performLogout()}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition uppercase tracking-wider"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Docs Uploaded — waiting for admin to verify
  if (status === "docs_uploaded") {
    return (
      <div className="flex items-center justify-center h-screen bg-[#f8fafc] p-6">
        <SessionSync />
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-xl p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-900">Documents Submitted</h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            All documents have been uploaded successfully. The admin team is reviewing your documents. You will get access to the dashboard once verified.
          </p>
          <div className="space-y-2 text-left">
            {uploadedDocs.map((doc) => (
              <div key={doc.doc_type} className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center space-x-2 text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="font-bold text-slate-700 capitalize">{doc.doc_type.replace(/_/g, " ")}</span>
                <span className="text-slate-400">— {doc.file_name}</span>
              </div>
            ))}
          </div>
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700 font-semibold">
            Admin is reviewing your documents. Please wait for approval.
          </div>
          <button
            onClick={() => performLogout()}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition uppercase tracking-wider"
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  // Rejected
  if (status === "rejected") {
    return (
      <div className="flex items-center justify-center h-screen bg-[#f8fafc] p-6">
        <SessionSync />
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-xl p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
            <XCircle className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-900">Registration Rejected</h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            Unfortunately, your agent registration has been rejected by the admin team. If you believe this is a mistake, please contact support.
          </p>
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold">
            You cannot access the agent dashboard. Please contact the admin for more information.
          </div>
          <button
            onClick={() => performLogout()}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition uppercase tracking-wider"
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  // Approved — show normal layout
  return (
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden text-slate-800">
      <SessionSync />
      <WarningPopup />
      <div className="hidden lg:block shrink-0">
        <AgentSidebar />
      </div>
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-20 lg:pb-8">
          {children}
        </main>
        <AgentBottomNav />
      </div>
    </div>
  );
}
