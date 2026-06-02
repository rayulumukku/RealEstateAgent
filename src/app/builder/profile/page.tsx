"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  User, Building2, CheckCircle2, Loader2
} from "lucide-react";

interface ProfileData {
  id: string;
  name: string;
  agency_name: string;
  phone: string;
  email: string;
  location: string;
  status: string;
  role: string;
  points: number;
  created_at: string;
}

export default function BuilderProfile() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  // Track if anything changed
  const hasChanges = useMemo(() => {
    if (!profile) return false;
    return (
      name !== (profile.name || "") ||
      company !== (profile.agency_name || "") ||
      email !== (profile.email || "") ||
      location !== (profile.location || "")
    );
  }, [name, company, email, location, profile]);

  async function loadProfile() {
    setLoading(true);
    try {
      const res = await fetch("/api/profile");
      if (res.ok) {
        const data = await res.json();
        if (data.profile) {
          setProfile(data.profile);
          setName(data.profile.name || "");
          setCompany(data.profile.agency_name || "");
          setEmail(data.profile.email || "");
          setLocation(data.profile.location || "");
        }
      }
    } catch (err) {
      console.error("Failed to load profile:", err);
    } finally {
      setLoading(false);
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasChanges) return;
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          agency_name: company,
          email,
          location,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Failed to save profile.");
      } else {
        setMessage("Profile saved successfully!");
        setProfile(data.profile);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6 text-slate-800">
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Builder Profile</h1>
        <p className="text-[#64748b] text-xs font-semibold mt-0.5">Your company details. Edit and save to update.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
            <User className="w-4 h-4 text-indigo-500" />
            <span>Profile Details</span>
          </h3>

          <form onSubmit={handleSave} className="space-y-4 text-xs font-semibold text-slate-400">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block uppercase tracking-wider text-[10px]">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl py-2.5 px-3 text-slate-800 outline-none text-sm font-medium transition"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block uppercase tracking-wider text-[10px]">Company / Developer Name</label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl py-2.5 px-3 text-slate-800 outline-none text-sm font-medium transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block uppercase tracking-wider text-[10px]">Phone Number</label>
                <input
                  type="tel"
                  disabled
                  value={profile?.phone || ""}
                  className="w-full bg-slate-100 border border-slate-200 text-slate-500 rounded-xl py-2.5 px-3 outline-none text-sm font-medium cursor-not-allowed"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block uppercase tracking-wider text-[10px]">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl py-2.5 px-3 text-slate-800 outline-none text-sm font-medium transition"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block uppercase tracking-wider text-[10px]">Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl py-2.5 px-3 text-slate-800 outline-none text-sm font-medium transition"
              />
            </div>

            {message && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-600 text-xs flex items-center space-x-2 font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>{message}</span>
              </div>
            )}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-bold">{error}</div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={saving || !hasChanges}
                className={`px-5 py-2.5 font-bold rounded-xl shadow-md transition text-white ${hasChanges ? "bg-indigo-600 hover:bg-indigo-700" : "bg-slate-300 cursor-not-allowed"}`}
              >
                {saving ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </form>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="text-xs text-slate-400 uppercase font-bold tracking-wider">Account Info</div>
            <div className="flex items-center space-x-3">
              <Building2 className="w-10 h-10 text-indigo-500 shrink-0" />
              <div>
                <div className="text-base font-bold text-slate-900">{profile?.agency_name || "Builder"}</div>
                <div className="text-[10px] text-slate-500 font-semibold capitalize">Role: {profile?.role}</div>
              </div>
            </div>
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div className="text-[8px] text-slate-400 uppercase font-bold tracking-wider">Status</div>
              <div className={`text-sm font-bold mt-0.5 capitalize ${profile?.status === "approved" ? "text-emerald-600" : "text-amber-600"}`}>
                {profile?.status || "pending"}
              </div>
            </div>
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div className="text-[8px] text-slate-400 uppercase font-bold tracking-wider">Joined</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">
                {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "N/A"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
