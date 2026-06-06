"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  User, ShieldCheck, 
  CheckCircle2, Award, Loader2
} from "lucide-react";

interface ProfileData {
  id: string;
  name: string;
  agency_name: string;
  phone: string;
  email: string;
  rera_number: string;
  status: string;
  cp_id: string;
  location: string;
  points: number;
  role: string;
  is_rera_approved?: boolean;
}

export default function AgentProfile() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Editable fields
  const [name, setName] = useState("");
  const [agency, setAgency] = useState("");
  const [email, setEmail] = useState("");
  const [rera, setRera] = useState("");
  const [location, setLocation] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  // Track if anything changed from the loaded profile
  const hasChanges = useMemo(() => {
    if (!profile) return false;
    return (
      name !== (profile.name || "") ||
      agency !== (profile.agency_name || "") ||
      email !== (profile.email || "") ||
      rera !== (profile.rera_number || "") ||
      location !== (profile.location || "")
    );
  }, [name, agency, email, rera, location, profile]);

  async function loadProfile() {
    setLoading(true);
    try {
      const res = await fetch("/api/me");
      if (!res.ok) return;
      const meData = await res.json();
      if (!meData.user) return;

      // Fetch full profile from server
      const profileRes = await fetch(`/api/profile`);
      if (profileRes.ok) {
        const data = await profileRes.json();
        if (data.profile) {
          setProfile(data.profile);
          setName(data.profile.name || "");
          setAgency(data.profile.agency_name || "");
          setEmail(data.profile.email || "");
          setRera(data.profile.rera_number || "");
          setLocation(data.profile.location || "");
        }
      }
    } catch (err) {
      console.error("Failed to load profile:", err);
    } finally {
      setLoading(false);
    }
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
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
          agency_name: agency,
          email,
          rera_number: rera,
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
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-[#25d366]" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6 text-slate-800">
      {/* Header */}
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Agent Profile</h1>
        <p className="text-[#64748b] text-xs font-semibold mt-0.5">Your profile data from the database. Edit and save to update.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left - Profile details form */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
            <User className="w-4 h-4 text-[#25d366]" />
            <span>Profile Details</span>
          </h3>

          <form onSubmit={handleSaveProfile} className="space-y-4 text-xs font-semibold text-slate-400">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block uppercase tracking-wider text-[10px]">Full Name</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#25d366] rounded-xl py-2.5 px-3 text-slate-800 outline-none text-sm font-medium transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block uppercase tracking-wider text-[10px]">Agency Name</label>
                <input 
                  type="text" 
                  value={agency}
                  onChange={(e) => setAgency(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#25d366] rounded-xl py-2.5 px-3 text-slate-800 outline-none text-sm font-medium transition"
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
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#25d366] rounded-xl py-2.5 px-3 text-slate-800 outline-none text-sm font-medium transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="block uppercase tracking-wider text-[10px]">RERA Registration</label>
                  {profile?.is_rera_approved && (
                    <span className="text-[9px] bg-indigo-50 text-indigo-600 border border-indigo-200 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Approved</span>
                  )}
                </div>
                <input 
                  type="text" 
                  value={rera}
                  onChange={(e) => setRera(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#25d366] rounded-xl py-2.5 px-3 text-slate-800 outline-none text-sm font-medium transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block uppercase tracking-wider text-[10px]">Location</label>
                <input 
                  type="text" 
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#25d366] rounded-xl py-2.5 px-3 text-slate-800 outline-none text-sm font-medium transition"
                />
              </div>
            </div>

            {message && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-600 text-xs flex items-center space-x-2 font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>{message}</span>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-bold">
                {error}
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button 
                type="submit"
                disabled={saving || !hasChanges}
                className={`px-5 py-2.5 font-bold rounded-xl shadow-md transition text-white ${hasChanges ? "bg-[#25d366] hover:bg-[#16c47f]" : "bg-slate-300 cursor-not-allowed"}`}
              >
                {saving ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </form>
        </div>

        {/* Right - CP Status */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="text-xs text-slate-400 uppercase font-bold tracking-wider">Verification Status</div>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <ShieldCheck className={`w-10 h-10 shrink-0 ${profile?.status === "approved" ? "text-[#16c47f]" : "text-amber-500"}`} />
                <div>
                  <div className="text-base font-bold text-slate-900">
                    {profile?.status === "approved" ? "Approved" : "Pending Verification"}
                  </div>
                  <div className="text-[10px] text-slate-500 font-semibold">
                    {profile?.status === "approved" ? "Your profile is verified" : "Awaiting admin review"}
                  </div>
                </div>
              </div>

              {profile?.cp_id && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="text-[8px] text-slate-400 uppercase font-bold tracking-wider">CP ID</div>
                    <div className="text-sm font-extrabold text-slate-900 mt-0.5 tracking-wider">{profile.cp_id}</div>
                  </div>
                  <Award className="w-5 h-5 text-[#25d366]" />
                </div>
              )}

              {profile?.is_rera_approved ? (
                <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-[8px] text-indigo-500 uppercase font-bold tracking-wider">RERA Verification</div>
                    <div className="text-sm font-extrabold text-indigo-700 mt-0.5 tracking-wider">RERA Approved</div>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                </div>
              ) : (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-[8px] text-slate-400 uppercase font-bold tracking-wider">RERA Verification</div>
                    <div className="text-sm font-bold text-slate-500 mt-0.5">Not RERA Approved</div>
                  </div>
                </div>
              )}

              {profile?.points !== undefined && profile.points > 0 && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[8px] text-slate-400 uppercase font-bold tracking-wider">Reward Points</div>
                  <div className="text-lg font-extrabold text-slate-900 mt-0.5">{profile.points} XP</div>
                </div>
              )}

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-[8px] text-slate-400 uppercase font-bold tracking-wider">Role</div>
                <div className="text-sm font-bold text-slate-900 mt-0.5 capitalize">{profile?.role || "agent"}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
