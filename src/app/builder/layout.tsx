"use client";

import { useEffect, useState, useRef } from "react";
import BuilderSidebar from "@/components/BuilderSidebar";
import SessionSync from "@/components/SessionSync";
import WarningPopup from "@/components/WarningPopup";
import { Clock, XCircle, Loader2, Upload, CheckCircle2, Building2 } from "lucide-react";
import { performLogout } from "@/components/SessionSync";

type BuilderStatus = "loading" | "approved" | "pending" | "docs_required" | "docs_uploaded" | "rejected";

export default function BuilderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [status, setStatus] = useState<BuilderStatus>("loading");
  const [kycSubmitted, setKycSubmitted] = useState(false);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);

  // KYC form fields
  const [projectName, setProjectName] = useState("");
  const [location, setLocation] = useState("");
  const [city, setCity] = useState("");
  const [priceEstimate, setPriceEstimate] = useState("");
  const [companyDetails, setCompanyDetails] = useState("");
  const [brochureFile, setBrochureFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const brochureRef = useRef<HTMLInputElement>(null);

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
          else if (s === "rejected") {
            setStatus("rejected");
            setRejectionReason(data.profile.rejection_reason || null);
          }
          else if (s === "docs_required") setStatus("docs_required");
          else if (s === "docs_uploaded") setStatus("docs_uploaded");
          else setStatus("pending");

          // Check if KYC was already submitted
          const kycRes = await fetch("/api/builder-kyc");
          if (kycRes.ok) {
            const kycData = await kycRes.json();
            if (kycData.kyc) setKycSubmitted(true);
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

  async function handleKycSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!projectName || !city || !companyDetails) {
      setError("Please fill in Project Name, City, and Company Details.");
      return;
    }
    setSubmitting(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("project_name", projectName);
      formData.append("location", location);
      formData.append("city", city);
      formData.append("price_estimate", priceEstimate);
      formData.append("company_details", companyDetails);
      if (brochureFile) {
        formData.append("brochure", brochureFile);
      }

      const res = await fetch("/api/builder-kyc", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Submission failed.");
      } else {
        setKycSubmitted(true);
        setStatus("docs_uploaded");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Loading
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-screen bg-[#070b13]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  // Pending — show KYC form
  if (status === "pending" || status === "docs_required") {
    if (kycSubmitted) {
      return (
        <div className="flex items-center justify-center h-screen bg-[#070b13] p-6">
          <SessionSync />
          <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-xl p-8 text-center space-y-6">
            <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto">
              <Clock className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-extrabold text-slate-900">Under Review</h1>
            <p className="text-sm text-slate-500">Your project details have been submitted. Admin is reviewing your application.</p>
            <button onClick={() => performLogout()} className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition uppercase tracking-wider">Logout</button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center min-h-screen bg-[#070b13] p-6">
        <SessionSync />
        <div className="max-w-lg w-full bg-white rounded-2xl border border-slate-200 shadow-xl p-8 space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-extrabold text-slate-900">Builder Verification</h1>
            <p className="text-sm text-slate-500 mt-2">Submit your project and company details for admin approval.</p>
          </div>

          <form onSubmit={handleKycSubmit} className="space-y-4 text-xs font-semibold text-slate-400">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block uppercase tracking-wider text-[10px]">Project Name *</label>
                <input type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="e.g. Skyline Heights" className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl py-2.5 px-3 text-slate-800 outline-none text-sm font-medium transition" />
              </div>
              <div className="space-y-1.5">
                <label className="block uppercase tracking-wider text-[10px]">City *</label>
                <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Hyderabad" className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl py-2.5 px-3 text-slate-800 outline-none text-sm font-medium transition" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block uppercase tracking-wider text-[10px]">Location / Area</label>
                <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Kokapet, Gachibowli" className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl py-2.5 px-3 text-slate-800 outline-none text-sm font-medium transition" />
              </div>
              <div className="space-y-1.5">
                <label className="block uppercase tracking-wider text-[10px]">Price Estimate</label>
                <input type="text" value={priceEstimate} onChange={(e) => setPriceEstimate(e.target.value)} placeholder="e.g. ₹1.5 Cr - ₹3 Cr" className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl py-2.5 px-3 text-slate-800 outline-none text-sm font-medium transition" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block uppercase tracking-wider text-[10px]">Company Details *</label>
              <textarea rows={3} value={companyDetails} onChange={(e) => setCompanyDetails(e.target.value)} placeholder="Describe your company, years in business, past projects..." className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl py-2.5 px-3 text-slate-800 outline-none text-sm font-medium transition resize-none" />
            </div>

            <div className="space-y-1.5">
              <label className="block uppercase tracking-wider text-[10px]">Company Brochure (PDF)</label>
              <div className={`p-4 rounded-xl border border-dashed ${brochureFile ? "border-indigo-300 bg-indigo-50/30" : "border-slate-300 bg-slate-50"} text-center cursor-pointer hover:bg-slate-100 transition`} onClick={() => brochureRef.current?.click()}>
                <input ref={brochureRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => { if (e.target.files?.[0]) setBrochureFile(e.target.files[0]); }} />
                {brochureFile ? (
                  <div className="flex items-center justify-center space-x-2 text-indigo-600">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-xs font-bold">{brochureFile.name}</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center space-y-1 text-slate-400">
                    <Upload className="w-5 h-5" />
                    <span className="text-[10px] font-bold">Click to upload brochure</span>
                  </div>
                )}
              </div>
            </div>

            {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-bold">{error}</div>}

            <div className="pt-2 flex justify-between items-center">
              <button type="button" onClick={() => performLogout()} className="text-xs text-slate-500 hover:text-slate-700 font-bold uppercase tracking-wider">Logout</button>
              <button type="submit" disabled={submitting} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition disabled:opacity-60 uppercase tracking-wider">
                {submitting ? "Submitting..." : "Submit for Approval"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Docs uploaded — waiting for approval
  if (status === "docs_uploaded") {
    return (
      <div className="flex items-center justify-center h-screen bg-[#070b13] p-6">
        <SessionSync />
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-xl p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-900">Application Submitted</h1>
          <p className="text-sm text-slate-500">Your project details and company brochure have been submitted. Admin is reviewing your application.</p>
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700 font-semibold">
            You will get access to the Builder Dashboard once approved by admin.
          </div>
          <button onClick={() => performLogout()} className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition uppercase tracking-wider">Logout</button>
        </div>
      </div>
    );
  }

  // Rejected
  if (status === "rejected") {
    return (
      <div className="flex items-center justify-center h-screen bg-[#070b13] p-6">
        <SessionSync />
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-xl p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
            <XCircle className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-900">Application Rejected</h1>
          <p className="text-sm text-slate-500">Your builder application has been rejected. Please contact support for more info.</p>
          {rejectionReason && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-left">
              <h3 className="text-xs font-bold text-red-800 uppercase tracking-wider mb-1">Reason for Rejection</h3>
              <p className="text-sm text-red-700 font-medium">{rejectionReason}</p>
            </div>
          )}
          <button onClick={() => performLogout()} className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition uppercase tracking-wider">Logout</button>
        </div>
      </div>
    );
  }

  // Approved — show normal layout
  return (
    <div className="flex h-screen bg-[#070b13] overflow-hidden">
      <SessionSync />
      <WarningPopup />
      <BuilderSidebar />
      <main className="flex-1 overflow-y-auto p-8 text-slate-100">
        {children}
      </main>
    </div>
  );
}
