"use client";

import { useState, useEffect } from "react";
import { 
  Award, Gift, Trophy, Check, 
  HelpCircle, ChevronRight, Sparkles, Copy, MessageSquare,
  Users, UserCheck, ShieldAlert, ArrowRight, Share2, Loader2
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Badge {
  name: string;
  desc: string;
  icon: string;
  unlocked: boolean;
}

interface Coupon {
  id: string;
  title: string;
  code: string;
  sponsor: string;
  expiry: string;
  isClaimed: boolean;
}

interface Referral {
  id: string;
  name: string;
  phone: string;
  status: string;
  pointsAwarded: number;
  date: string;
}

interface LeaderboardUser {
  rank: number;
  name: string;
  points: number;
  location: string;
}

export default function AgentRewards() {
  const [activeTab, setActiveTab] = useState<"rewards" | "refer">("rewards");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Dynamic stats loaded from Supabase
  const [points, setPoints] = useState(1240);
  const [referralsCount, setReferralsCount] = useState(2);
  const [cpId, setCpId] = useState("CP-8402");
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);

  const [badges, setBadges] = useState<Badge[]>([
    { name: "Launch Expert", desc: "RSVPed to 5+ LaunchCP Meets", icon: "🚀", unlocked: true },
    { name: "Webinar Pro", desc: "Attended 3 virtual webinars", icon: "🎓", unlocked: true },
    { name: "Active Partner", desc: "Logged 10+ leads in pipeline", icon: "🤝", unlocked: true },
    { name: "Premium Agent", desc: "Reach 1,500 engagement points", icon: "⭐", unlocked: false },
    { name: "Super Recruiter", desc: "Refer 3+ approved agents", icon: "👑", unlocked: false }
  ]);

  const [coupons, setCoupons] = useState<Coupon[]>([
    { id: "1", title: "₹500 Amazon Gift Voucher", code: "AMZ-9912-GET", sponsor: "Prestige Group", expiry: "June 10, 2026", isClaimed: false },
    { id: "2", title: "₹1,000 Uber Ride Coupon", code: "UBR-COMM-RIDE", sponsor: "Lodha Builders", expiry: "June 25, 2026", isClaimed: true }
  ]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const phone = localStorage.getItem("agentsapp_logged_in_phone") || "+91 98765 43210";
        
        // 1. Fetch current user profile
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("phone", phone)
          .single();

        if (profile) {
          setPoints(profile.points);
          setReferralsCount(profile.referrals_count);
          setCpId(profile.cp_id || "PENDING");

          // Update badges unlock state based on points
          setBadges(prev => prev.map(badge => {
            if (badge.name === "Premium Agent" && profile.points >= 1500) {
              return { ...badge, unlocked: true };
            }
            if (badge.name === "Super Recruiter" && profile.referrals_count >= 3) {
              return { ...badge, unlocked: true };
            }
            return badge;
          }));

          // 2. Fetch referrals made by this profile
          const { data: refList, error: refError } = await supabase
            .from("referrals")
            .select("*")
            .eq("referrer_id", profile.id);

          if (refList) {
            const mappedReferrals: Referral[] = refList.map((r: any) => ({
              id: r.id,
              name: r.referred_name,
              phone: r.referred_phone,
              status: r.status,
              pointsAwarded: r.points_awarded,
              date: r.date
            }));
            setReferrals(mappedReferrals);
          }
        }

        // 3. Fetch leaderboard (all agents sorted by points)
        const { data: lbList, error: lbError } = await supabase
          .from("profiles")
          .select("name, points, location")
          .eq("role", "agent")
          .order("points", { ascending: false });

        if (lbList) {
          const mappedLB: LeaderboardUser[] = lbList.map((user: any, idx: number) => ({
            rank: idx + 1,
            name: user.name,
            points: user.points,
            location: user.location || "Hyderabad"
          }));
          setLeaderboard(mappedLB);
        }
      } catch (err) {
        console.error("Error loading Supabase rewards data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const referralLink = typeof window !== "undefined" 
    ? `${window.location.origin}/?ref=${cpId}`
    : `http://localhost:3000/?ref=${cpId}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClaimCoupon = (id: string) => {
    setCoupons(coupons.map(c => c.id === id ? { ...c, isClaimed: true } : c));
    alert("Coupon code copied to clipboard! Enter it on sponsor site.");
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "approved":
      case "active":
        return "bg-emerald-50 text-[#16c47f] border-emerald-200";
      case "pending kyc":
      case "pending":
        return "bg-amber-50 text-amber-600 border-amber-250";
      case "pending approval":
        return "bg-blue-50 text-blue-600 border-blue-200";
      case "rejected":
        return "bg-red-50 text-red-600 border-red-200";
      default:
        return "bg-slate-50 text-slate-500 border-slate-200";
    }
  };

  const whatsappShareText = encodeURIComponent(
    `Hey! Join agentsapp—the WhatsApp-native real estate OS for agents. Register using my link to unlock premium projects and earn rewards points: ${referralLink}`
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500 font-bold uppercase tracking-wider text-xs space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-[#25d366]" />
        <span>Loading rewards database...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-800">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Rewards & Referrals</h1>
          <p className="text-[#64748b] text-xs font-semibold mt-0.5">
            Gamify pipeline activity. Earn partner points, unlock badges, and refer other agents.
          </p>
        </div>

        {/* Dynamic points balance */}
        <div className="px-4 py-2 bg-gradient-to-r from-[#25d366]/10 to-[#16c47f]/10 border border-[#25d366]/20 rounded-2xl flex items-center space-x-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          <div>
            <div className="text-xs text-slate-500 font-bold leading-none">Your Wallet</div>
            <div className="text-base font-extrabold text-slate-900 mt-0.5">{points} XP</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-white border border-slate-200 p-1 rounded-xl text-xs font-bold w-fit">
        <button
          onClick={() => setActiveTab("rewards")}
          className={`px-4 py-2 rounded-lg transition ${
            activeTab === "rewards" 
              ? "bg-[#25d366] text-white" 
              : "text-slate-500 hover:text-slate-850"
          }`}
        >
          🎁 Rewards & Badges
        </button>
        <button
          onClick={() => setActiveTab("refer")}
          className={`px-4 py-2 rounded-lg transition ${
            activeTab === "refer" 
              ? "bg-[#25d366] text-white" 
              : "text-slate-500 hover:text-slate-850"
          }`}
        >
          🤝 Refer & Earn
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column Content */}
        <div className="lg:col-span-8 space-y-6">
          {activeTab === "rewards" ? (
            <>
              {/* Active Rewards / Coupons */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Earned Vouchers</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {coupons.map(cop => (
                    <div key={cop.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between h-40">
                      <div className="space-y-1">
                        <div className="flex justify-between items-start">
                          <span className="text-[9px] font-extrabold px-2 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-250">
                            {cop.sponsor}
                          </span>
                          <Gift className="w-4 h-4 text-amber-500" />
                        </div>
                        <h4 className="font-bold text-sm text-slate-900 mt-2">{cop.title}</h4>
                        <p className="text-[10px] text-slate-500 font-semibold">Expires: {cop.expiry}</p>
                      </div>

                      <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between text-xs font-bold">
                        {cop.isClaimed ? (
                          <>
                            <span className="text-slate-450 text-[10px] line-through font-semibold">{cop.code}</span>
                            <span className="text-slate-400 text-[10px]">Claimed</span>
                          </>
                        ) : (
                          <>
                            <span className="text-slate-700 text-xs font-extrabold">{cop.code}</span>
                            <button 
                              onClick={() => handleClaimCoupon(cop.id)}
                              className="px-3 py-1 bg-[#25d366] hover:bg-[#16c47f] text-white rounded-lg text-[10px]"
                            >
                              Claim Code
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Badges list */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Partner Badges</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {badges.map(bad => (
                    <div 
                      key={bad.name} 
                      className={`p-4 rounded-xl border flex items-center space-x-3.5 ${
                        bad.unlocked 
                          ? "bg-white border-slate-200" 
                          : "bg-slate-50 border-slate-200/60 opacity-55"
                      }`}
                    >
                      <span className="text-2xl">{bad.icon}</span>
                      <div>
                        <h4 className="font-bold text-xs text-slate-900">{bad.name}</h4>
                        <p className="text-[9px] text-slate-500 leading-normal mt-0.5">{bad.desc}</p>
                        <span className={`text-[8px] font-bold block mt-1 uppercase tracking-wider ${bad.unlocked ? "text-[#16c47f]" : "text-slate-400"}`}>
                          {bad.unlocked ? "Unlocked ✓" : "Locked"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Refer and Earn Tab */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                
                {/* Visual Intro */}
                <div className="p-5 bg-gradient-to-br from-[#25d366]/5 to-[#16c47f]/5 border border-[#25d366]/10 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="space-y-1.5 text-center md:text-left">
                    <div className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-[#25d366]/10 text-xs font-bold text-[#16c47f]">
                      <Sparkles className="w-3 h-3 text-[#25d366]" />
                      <span>Grow the Agent Network</span>
                    </div>
                    <h3 className="font-extrabold text-slate-900 text-base">Invite agents and earn +500 points!</h3>
                    <p className="text-[11px] text-slate-550 max-w-md font-semibold leading-relaxed text-slate-500">
                      When a new agent signs up using your link, completes KYC documents, and gets approved by Ops, you instantly get 500 engagement points.
                    </p>
                  </div>
                  
                  <div className="text-4xl">🤝</div>
                </div>

                {/* Link Generator and Sharing */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                      Your Unique Referral URL Link
                    </label>
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        readOnly
                        value={referralLink}
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 outline-none font-semibold truncate"
                      />
                      <button 
                        onClick={handleCopyLink}
                        className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-250 text-slate-655 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition shrink-0"
                      >
                        {copied ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-500" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            <span>Copy Link</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Share to WhatsApp */}
                  <a 
                    href={`https://api.whatsapp.com/send?text=${whatsappShareText}`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-3 bg-[#25d366] hover:bg-[#16c47f] text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center space-x-2 transition uppercase tracking-wider"
                  >
                    <MessageSquare className="w-4 h-4 text-white shrink-0 fill-white" />
                    <span>Share Invitation via WhatsApp</span>
                  </a>
                </div>

                {/* Referral Funnel Visual Tracker */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <h4 className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">
                    Referral Funnel Pipeline
                  </h4>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <div className="text-xl font-extrabold text-slate-900">18</div>
                      <div className="text-[8px] uppercase font-bold text-slate-450 tracking-wider mt-1 text-slate-400">Referred Clicks</div>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <div className="text-xl font-extrabold text-slate-900">5</div>
                      <div className="text-[8px] uppercase font-bold text-slate-450 tracking-wider mt-1 text-slate-400">Registrations</div>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <div className="text-xl font-extrabold text-slate-900">
                        {referrals.filter(r => r.status.toLowerCase().includes("pending")).length}
                      </div>
                      <div className="text-[8px] uppercase font-bold text-slate-450 tracking-wider mt-1 text-slate-400">KYC Under Review</div>
                    </div>
                    <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                      <div className="text-xl font-extrabold text-[#16c47f]">
                        {referrals.filter(r => r.status.toLowerCase() === "approved" || r.status.toLowerCase() === "active").length}
                      </div>
                      <div className="text-[8px] uppercase font-bold text-emerald-650 tracking-wider mt-1 text-emerald-600">Attributed CPs</div>
                    </div>
                  </div>
                </div>

                {/* Referrals List Table */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <h4 className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">
                    Your Referred Agents
                  </h4>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
                          <th className="py-2.5 font-bold">Agent Name</th>
                          <th className="py-2.5 font-bold">Registration Date</th>
                          <th className="py-2.5 font-bold">Onboarding Status</th>
                          <th className="py-2.5 font-bold text-right">Points Earned</th>
                        </tr>
                      </thead>
                      <tbody>
                        {referrals.map((ref) => (
                          <tr key={ref.id} className="border-b border-slate-100/70 hover:bg-slate-50/50">
                            <td className="py-3 font-bold text-slate-900">
                              <div>{ref.name}</div>
                              <div className="text-[9px] text-slate-400 font-semibold">{ref.phone}</div>
                            </td>
                            <td className="py-3 text-slate-500 font-semibold">{ref.date}</td>
                            <td className="py-3">
                              <span className={`px-2 py-0.5 rounded text-[8px] uppercase font-extrabold border ${getStatusColor(ref.status)}`}>
                                {ref.status}
                              </span>
                            </td>
                            <td className="py-3 text-right font-extrabold text-slate-700">
                              {ref.pointsAwarded > 0 ? `+${ref.pointsAwarded} XP` : "0 XP"}
                            </td>
                          </tr>
                        ))}
                        {referrals.length === 0 && (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-slate-400 font-semibold">
                              You haven't referred any agents yet. Share your link to get started!
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            </>
          )}
        </div>

        {/* Right Column - Leaderboard */}
        <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span>Agent Leaderboard</span>
          </h3>

          <div className="space-y-4">
            {leaderboard.map((agent) => (
              <div 
                key={agent.rank} 
                className={`p-3.5 rounded-xl border flex justify-between items-center text-xs ${
                  agent.name === "Sreenivas Rao" 
                    ? "bg-[#25d366]/5 border-[#25d366]/40" 
                    : "bg-slate-50 border-slate-200/80"
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${
                    agent.rank === 1 ? "bg-amber-100 text-amber-700" :
                    agent.rank === 2 ? "bg-emerald-100 text-[#16c47f]" :
                    "bg-slate-200 text-slate-600"
                  }`}>
                    #{agent.rank}
                  </span>
                  <div>
                    <div className="font-bold text-slate-900">{agent.name}</div>
                    <div className="text-[9px] text-slate-400 mt-0.5">{agent.location}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-extrabold text-slate-800">{agent.points} pts</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
