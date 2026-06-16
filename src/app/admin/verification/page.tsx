"use client";

import { useState, useEffect } from "react";
import { 
  Check, X, FileText, ShieldAlert, 
  ArrowRight, ShieldCheck, Eye, Loader2, Award, Upload, Download, ExternalLink
} from "lucide-react";
import { getVerificationRequests, approveAgentAction, rejectAgentAction, requestDocsAction, toggleReraApprovalAction, updateBuilderCreditsAction } from "./actions";

interface AgentRequest {
  id: string;
  name: string;
  agency: string;
  phone: string;
  email: string;
  rera: string;
  isReraApproved?: boolean;
  role: string;
  status: "Pending" | "Docs Required" | "Docs Uploaded" | "Approved" | "Rejected";
  rejectionReason?: string;
  assignedCpId?: string;
  referredBy?: string | null;
  uploadedDocs: { doc_type: string; file_name: string; file_url: string; uploaded_at: string }[];
  builderKyc?: { project_name: string; location: string; city: string; price_estimate: string; company_details: string; brochure_url: string; brochure_file_name: string } | null;
  credits?: number;
}

export default function VerificationQueue() {
  const [requests, setRequests] = useState<AgentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("Pending");
  const [selectedRequest, setSelectedRequest] = useState<AgentRequest | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [approveSuccessId, setApproveSuccessId] = useState<string | null>(null);

  const [creditsInput, setCreditsInput] = useState<string>("0");
  const [updatingCredits, setUpdatingCredits] = useState(false);

  useEffect(() => {
    if (selectedRequest) {
      setCreditsInput(String(selectedRequest.credits || 0));
    } else {
      setCreditsInput("0");
    }
  }, [selectedRequest]);

  async function loadRequests() {
    setLoading(true);
    try {
      const res = await getVerificationRequests();
      if (res.success && res.profiles) {
        // Fetch uploaded docs for all agents
        const docsRes = await fetch("/api/verification-docs?agent_id=all");
        let allDocs: any[] = [];
        if (docsRes.ok) {
          const docsData = await docsRes.json();
          allDocs = docsData.docs || [];
        }

        // Fetch builder KYC data
        const kycRes = await fetch("/api/builder-kyc?builder_id=all");
        let allKyc: any[] = [];
        if (kycRes.ok) {
          const kycData = await kycRes.json();
          allKyc = kycData.kycList || [];
        }

        const mapped: AgentRequest[] = res.profiles.map((p: any) => {
          const matchingRef = res.referrals?.find((r: any) => r.referred_phone === p.phone);
          const referredBy = matchingRef?.profiles ? (matchingRef.profiles as any).cp_id : null;

          let statusStr: AgentRequest["status"] = "Pending";
          if (p.status === "approved") statusStr = "Approved";
          else if (p.status === "rejected") statusStr = "Rejected";
          else if (p.status === "docs_required") statusStr = "Docs Required";
          else if (p.status === "docs_uploaded") statusStr = "Docs Uploaded";

          const agentDocs = allDocs.filter((d: any) => d.agent_id === p.id);
          const builderKyc = allKyc.find((k: any) => k.builder_id === p.id);

          return {
            id: p.id,
            name: p.name,
            agency: p.agency_name || (p.role === "builder" ? "Builder" : "Independent Agent"),
            phone: p.phone,
            email: p.email || "No Email",
            rera: p.rera_number || "N/A",
            isReraApproved: p.is_rera_approved || false,
            role: p.role,
            status: statusStr,
            rejectionReason: p.rejection_reason,
            assignedCpId: p.cp_id,
            referredBy,
            uploadedDocs: agentDocs,
            builderKyc: builderKyc || null,
            credits: p.credits || 0,
          };
        });
        setRequests(mapped);
      }
    } catch (err) {
      console.error("Error loading verification requests:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();
  }, []);

  const tabs = ["Pending", "Docs Required", "Docs Uploaded", "Approved", "RERA Approved", "Rejected"];
  const filteredRequests = requests.filter(r => {
    if (activeTab === "RERA Approved") {
      return r.status === "Approved" && r.isReraApproved;
    }
    return r.status === activeTab;
  });

  const getTabCount = (tab: string) => {
    if (tab === "RERA Approved") {
      return requests.filter(r => r.status === "Approved" && r.isReraApproved).length;
    }
    return requests.filter(r => r.status === tab).length;
  };

  const handleRequestDocs = async (id: string) => {
    setLoading(true);
    try {
      const res = await requestDocsAction(id);
      if (!res.success) throw new Error(res.error || "Failed");

      const req = requests.find(r => r.id === id);
      if (req?.phone) {
        try {
          await fetch("/api/whatsapp/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phone: req.phone,
              text: `📄 *Document Verification Required*\n\nPlease log in to AgentsApp and upload the following documents for verification:\n\n1. RERA Certificate\n2. PAN Card\n3. Aadhaar Card\n\nOnce uploaded, our team will review and approve your profile.`
            })
          });
        } catch { /* ignore */ }
      }

      setSelectedRequest(null);
      await loadRequests();
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string, name: string) => {
    setLoading(true);
    try {
      const currentReq = requests.find(r => r.id === id);
      if (!currentReq) throw new Error("Request not found");

      const res = await approveAgentAction(id, currentReq.phone, name);
      if (!res.success) throw new Error(res.error || "Approval failed");

      const generatedId = res.generatedId || "";

      if (currentReq.phone) {
        try {
          await fetch("/api/whatsapp/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phone: currentReq.phone,
              text: `🎉 *Congratulations ${name}!* Your agentsapp Channel Partner verification has been approved. Your new CP ID is *${generatedId}*. Welcome aboard!`
            })
          });
        } catch { /* ignore */ }
      }

      setApproveSuccessId(generatedId);
      setSelectedRequest(null);
      await loadRequests();
      setTimeout(() => setApproveSuccessId(null), 4500);
    } catch (err: any) {
      alert("Error approving Agent: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenReject = (req: AgentRequest) => {
    setSelectedRequest(req);
    setShowRejectModal(true);
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest || !rejectReason) return;
    setLoading(true);
    try {
      const res = await rejectAgentAction(selectedRequest.id, selectedRequest.phone, rejectReason);
      if (!res.success) throw new Error(res.error || "Rejection failed");

      if (selectedRequest.phone) {
        try {
          await fetch("/api/whatsapp/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phone: selectedRequest.phone,
              text: `❌ *Verification Update:* Your agentsapp agent verification was rejected.\n\n📝 Reason: *${rejectReason}*\n\nPlease contact support if you have questions.`
            })
          });
        } catch { /* ignore */ }
      }

      setShowRejectModal(false);
      setRejectReason("");
      setSelectedRequest(null);
      await loadRequests();
    } catch (err: any) {
      alert("Error rejecting agent: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-slate-800">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">CP Verification Portal</h1>
        <p className="text-[#64748b] text-xs font-semibold mt-0.5">Approve agent registrations, request documents, and assign CP IDs.</p>
      </div>

      {/* Tabs */}
      <div className="flex bg-white border border-slate-200 p-1 rounded-xl text-xs font-bold overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setSelectedRequest(null); }}
            className={`px-3 py-2 rounded-lg transition shrink-0 ${
              activeTab === tab ? "bg-[#25d366] text-white" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab} ({getTabCount(tab)})
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center space-x-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
          <Loader2 className="w-4 h-4 animate-spin text-[#25d366]" />
          <span>Syncing...</span>
        </div>
      )}

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left - cards */}
        <div className="lg:col-span-5 space-y-4">
          {filteredRequests.map(req => (
            <div
              key={req.id}
              onClick={() => setSelectedRequest(req)}
              className={`bg-white p-5 rounded-2xl border transition-all cursor-pointer shadow-sm ${
                selectedRequest?.id === req.id ? "border-[#25d366] ring-1 ring-[#25d366]/40" : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-sm text-slate-900">{req.name}</h4>
                  <div className="text-xs text-slate-500 mt-0.5 font-semibold">{req.agency}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{req.phone} · <span className="capitalize font-bold">{req.role}</span></div>
                  {req.referredBy && (
                    <div className="mt-1 inline-flex items-center px-2 py-0.5 rounded bg-[#25d366]/10 text-[9px] text-[#16c47f] font-bold">
                      Referred by: {req.referredBy}
                    </div>
                  )}
                </div>
                <div className="text-right flex flex-col items-end gap-1.5 shrink-0">
                  {req.role === "builder" && (
                    <span className="text-[9px] bg-indigo-50 border border-indigo-200 text-indigo-600 px-2 py-0.5 rounded font-bold">
                      {req.credits ?? 0} Credits
                    </span>
                  )}
                  {req.status === "Approved" && (
                    <span className="text-[9px] bg-emerald-50 border border-emerald-200 text-emerald-600 px-2 py-0.5 rounded font-bold">{req.assignedCpId}</span>
                  )}
                  {req.status === "Approved" && req.isReraApproved && (
                    <span className="text-[9px] bg-indigo-50 border border-indigo-200 text-indigo-650 px-2 py-0.5 rounded font-bold">RERA Approved</span>
                  )}
                  {req.status === "Docs Uploaded" && (
                    <span className="text-[9px] bg-blue-50 border border-blue-200 text-blue-600 px-2 py-0.5 rounded font-bold">Docs Ready</span>
                  )}
                  {req.status === "Docs Required" && (
                    <span className="text-[9px] bg-amber-50 border border-amber-200 text-amber-600 px-2 py-0.5 rounded font-bold">Awaiting Docs</span>
                  )}
                  {req.status === "Rejected" && (
                    <span className="text-[9px] bg-red-50 border border-red-200 text-red-600 px-2 py-0.5 rounded font-bold">Rejected</span>
                  )}
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center text-xs font-bold">
                <span className="text-slate-400">{req.uploadedDocs.length} docs uploaded</span>
                <span className="text-[#16c47f] flex items-center">
                  Review <ArrowRight className="w-3 h-3 ml-1" />
                </span>
              </div>
            </div>
          ))}

          {!loading && filteredRequests.length === 0 && (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400">
              <ShieldCheck className="w-8 h-8 mx-auto mb-2" />
              <div className="font-bold">No agents in this queue.</div>
            </div>
          )}
        </div>

        {/* Right - detail pane */}
        <div className="lg:col-span-7">
          {selectedRequest ? (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-md space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{selectedRequest.name}</h3>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">Agency: {selectedRequest.agency}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Phone: {selectedRequest.phone} · Email: {selectedRequest.email}</p>
                  <p className="text-xs text-[#16c47f] font-bold mt-1 uppercase">RERA: {selectedRequest.rera}</p>
                </div>

                {selectedRequest.status === "Approved" && (
                  <div className="flex items-center space-x-2 bg-slate-50 p-2 rounded-xl border border-slate-200 shadow-sm shrink-0">
                    <label className="flex items-center space-x-2 text-xs font-bold text-slate-700 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={selectedRequest.isReraApproved || false}
                        onChange={async (e) => {
                          const checked = e.target.checked;
                          // Optimistic update
                          setRequests(prev => prev.map(r => r.id === selectedRequest.id ? { ...r, isReraApproved: checked } : r));
                          setSelectedRequest(prev => prev ? { ...prev, isReraApproved: checked } : null);

                          const res = await toggleReraApprovalAction(selectedRequest.id, checked);
                          if (!res.success) {
                            // Revert on failure
                            setRequests(prev => prev.map(r => r.id === selectedRequest.id ? { ...r, isReraApproved: !checked } : r));
                            setSelectedRequest(prev => prev ? { ...prev, isReraApproved: !checked } : null);
                            alert("Failed to update RERA approval status: " + res.error);
                          } else {
                            // Send WhatsApp Notification
                            if (selectedRequest.phone) {
                              try {
                                await fetch("/api/whatsapp/send", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    phone: selectedRequest.phone,
                                    text: checked 
                                      ? `✅ *RERA Approved:* Your RERA registration has been verified and approved by AgentsApp.`
                                      : `❌ *RERA Rejected/Unapproved:* Your RERA registration could not be verified. Please update it from your profile or contact support.`
                                  })
                                });
                              } catch { /* ignore */ }
                            }
                          }
                        }}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-350 cursor-pointer"
                      />
                      <span>RERA Approved</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Uploaded Documents */}
              {selectedRequest.uploadedDocs.length > 0 && (
                <div className="space-y-3">
                  <div className="text-[9px] uppercase font-extrabold text-slate-400 tracking-wider">Uploaded Documents ({selectedRequest.uploadedDocs.length})</div>
                  <div className="space-y-2">
                    {selectedRequest.uploadedDocs.map((doc, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center text-xs font-bold">
                        <div className="flex items-center space-x-2 text-slate-700">
                          <FileText className="w-4 h-4 text-emerald-500 shrink-0" />
                          <div>
                            <div className="capitalize">{doc.doc_type.replace(/_/g, " ")}</div>
                            <div className="text-[9px] text-slate-400 font-normal">{doc.file_name}</div>
                          </div>
                        </div>
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-[10px] flex items-center space-x-1 transition"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedRequest.uploadedDocs.length === 0 && !selectedRequest.builderKyc && selectedRequest.status !== "Approved" && selectedRequest.status !== "Rejected" && (
                <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-400">
                  No documents or project details uploaded yet.
                </div>
              )}

              {/* Builder KYC Details */}
              {selectedRequest.builderKyc && (
                <div className="space-y-3">
                  <div className="text-[9px] uppercase font-extrabold text-slate-400 tracking-wider">Builder Project Details</div>
                  <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-200 space-y-2 text-xs">
                    <div className="flex justify-between"><span className="text-slate-500">Project:</span><span className="font-bold text-slate-900">{selectedRequest.builderKyc.project_name}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">City:</span><span className="font-bold text-slate-900">{selectedRequest.builderKyc.city}</span></div>
                    {selectedRequest.builderKyc.location && <div className="flex justify-between"><span className="text-slate-500">Location:</span><span className="font-bold text-slate-900">{selectedRequest.builderKyc.location}</span></div>}
                    {selectedRequest.builderKyc.price_estimate && <div className="flex justify-between"><span className="text-slate-500">Price Estimate:</span><span className="font-bold text-slate-900">{selectedRequest.builderKyc.price_estimate}</span></div>}
                    <div className="pt-2 border-t border-indigo-100">
                      <div className="text-slate-500 mb-1">Company Details:</div>
                      <p className="text-slate-800 font-medium">{selectedRequest.builderKyc.company_details}</p>
                    </div>
                    {selectedRequest.builderKyc.brochure_url && (
                      <div className="pt-2 border-t border-indigo-100">
                        <a href={selectedRequest.builderKyc.brochure_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-bold hover:bg-indigo-700 transition">
                          <Download className="w-3.5 h-3.5" />
                          <span>Download Brochure ({selectedRequest.builderKyc.brochure_file_name})</span>
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Builder Credits Administration */}
              {selectedRequest.role === "builder" && (
                <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-200 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs uppercase font-extrabold text-indigo-900 tracking-wider">Builder Credits Settings</span>
                    <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg">
                      Current: {selectedRequest.credits || 0} Credits
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input 
                        type="number"
                        min="0"
                        value={creditsInput}
                        onChange={(e) => setCreditsInput(e.target.value)}
                        placeholder="Set credits (e.g. 50)"
                        className="w-full bg-white border border-slate-205 focus:border-indigo-500 rounded-xl py-2 px-3 text-xs font-semibold text-slate-800 outline-none transition"
                      />
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button 
                        type="button"
                        onClick={() => {
                          const val = Math.max(0, (parseInt(creditsInput) || 0) + 100);
                          setCreditsInput(String(val));
                        }}
                        className="px-2.5 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition"
                      >
                        +100
                      </button>
                      <button 
                        type="button"
                        onClick={() => {
                          const val = Math.max(0, (parseInt(creditsInput) || 0) - 100);
                          setCreditsInput(String(val));
                        }}
                        className="px-2.5 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition"
                      >
                        -100
                      </button>
                      <button
                        type="button"
                        disabled={updatingCredits}
                        onClick={async () => {
                          setUpdatingCredits(true);
                          const creditsVal = parseInt(creditsInput) || 0;
                          const res = await updateBuilderCreditsAction(selectedRequest.id, creditsVal);
                          setUpdatingCredits(false);
                          if (res.success) {
                            // Update local state
                            setRequests(prev => prev.map(r => r.id === selectedRequest.id ? { ...r, credits: creditsVal } : r));
                            setSelectedRequest(prev => prev ? { ...prev, credits: creditsVal } : null);
                            alert("Credits updated successfully!");
                          } else {
                            alert("Failed to update credits: " + res.error);
                          }
                        }}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition disabled:opacity-70 flex items-center space-x-1"
                      >
                        {updatingCredits && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        <span>Update Credits</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Rejection reason */}
              {selectedRequest.status === "Rejected" && selectedRequest.rejectionReason && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold">
                  <div className="font-bold">Rejection Reason:</div>
                  <p className="mt-1">{selectedRequest.rejectionReason}</p>
                </div>
              )}

              {/* Actions based on status */}
              {selectedRequest.status === "Pending" && (
                <div className="pt-2 grid grid-cols-3 gap-3 font-bold text-xs">
                  <button
                    onClick={() => handleRequestDocs(selectedRequest.id)}
                    className="py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl transition flex flex-col items-center space-y-1"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Request Docs</span>
                  </button>
                  <button
                    onClick={() => handleOpenReject(selectedRequest)}
                    className="py-3 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl transition"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleApprove(selectedRequest.id, selectedRequest.name)}
                    className="py-3 bg-[#25d366] hover:bg-[#16c47f] text-white rounded-xl shadow-md transition"
                  >
                    Approve
                  </button>
                </div>
              )}

              {selectedRequest.status === "Docs Required" && (
                <div className="pt-2 grid grid-cols-2 gap-3 font-bold text-xs">
                  <button
                    onClick={() => handleOpenReject(selectedRequest)}
                    className="py-3 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl transition"
                  >
                    Reject
                  </button>
                  <button disabled className="py-3 bg-slate-100 text-slate-400 border border-slate-200 rounded-xl cursor-not-allowed">
                    Waiting for Docs...
                  </button>
                </div>
              )}

              {selectedRequest.status === "Docs Uploaded" && (
                <div className="pt-2 grid grid-cols-2 gap-3 font-bold text-xs">
                  <button
                    onClick={() => handleOpenReject(selectedRequest)}
                    className="py-3 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl transition"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleApprove(selectedRequest.id, selectedRequest.name)}
                    className="py-3 bg-[#25d366] hover:bg-[#16c47f] text-white rounded-xl shadow-md transition"
                  >
                    Verify & Approve
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white p-8 rounded-2xl border border-dashed border-slate-200 text-center text-slate-400">
              <ShieldCheck className="w-8 h-8 mx-auto mb-2 animate-bounce" />
              <div className="font-bold text-slate-700">Select an Agent</div>
              <p className="text-xs text-slate-500 mt-1">Click a card on the left to review.</p>
            </div>
          )}
        </div>
      </div>

      {/* Success toast */}
      {approveSuccessId && (
        <div className="fixed bottom-6 right-6 z-50 p-4 bg-white border-2 border-[#25d366] text-[#16c47f] rounded-xl shadow-2xl flex items-center space-x-2 text-xs font-bold">
          <Award className="w-5 h-5 text-[#25d366]" />
          <span>Verified! CP ID: {approveSuccessId}</span>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white p-6 rounded-2xl border border-slate-200 shadow-2xl relative">
            <button onClick={() => setShowRejectModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-50">
              <X className="w-4 h-4" />
            </button>
            <h2 className="text-lg font-bold text-slate-900 mb-2 flex items-center space-x-2">
              <ShieldAlert className="w-5 h-5 text-red-500" />
              <span>Reject Application</span>
            </h2>
            <p className="text-xs text-slate-500 mb-4">Explain why. The agent will see this message.</p>
            <form onSubmit={handleConfirmReject} className="space-y-4">
              <textarea
                rows={4}
                required
                placeholder="e.g. RERA certificate is illegible. Please upload a clear copy."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-[#25d366] rounded-xl py-2.5 px-3 text-slate-800 placeholder-slate-400 outline-none text-sm transition"
              />
              <div className="flex justify-end gap-2 text-sm font-bold">
                <button type="button" onClick={() => setShowRejectModal(false)} className="px-4 py-2.5 text-slate-500 hover:text-slate-800 rounded-xl">Cancel</button>
                <button type="submit" className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-lg">Reject</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
