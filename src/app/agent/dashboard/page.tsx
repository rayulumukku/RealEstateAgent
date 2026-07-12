"use client";

import { useState, useEffect } from "react";
import { 
  Calendar, Eye, ChevronRight, FileText, 
  MapPin, CheckCircle2, Clock, Building, 
  ArrowUpRight, Award, Sparkles, MessageSquare,
  Gift, ShieldCheck, Users, HelpCircle, Loader2
} from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface Profile {
  id: string;
  name: string;
  phone: string;
  status: string;
  points: number;
  cp_id: string;
}

interface FollowUp {
  name: string;
  requirement: string;
  location: string;
  time: string;
  priority: string;
  color: string;
}

interface ProjectItem {
  id: string;
  name: string;
  type: string;
  location: string;
  price: string;
  units: number;
}

interface WebinarItem {
  title: string;
  time: string;
  reward: string;
}

export default function AgentDashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [recentInventory, setRecentInventory] = useState<ProjectItem[]>([]);
  const [webinars, setWebinars] = useState<WebinarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchNudge, setMatchNudge] = useState<any>(null);
  
  // Mock CP Invitations
  const [pendingInvites, setPendingInvites] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("mock_agent_invites") || "[]";
      try {
        const parsed = JSON.parse(stored);
        setPendingInvites(parsed);
      } catch (e) {}
    }
  }, []);

  const handleAcceptInvite = (builderId: string) => {
    // 1. Remove from pending invites
    const updatedInvites = pendingInvites.filter(id => id !== builderId);
    setPendingInvites(updatedInvites);
    localStorage.setItem("mock_agent_invites", JSON.stringify(updatedInvites));

    // 2. Set connected status
    if (profile?.id) {
      const connections = JSON.parse(localStorage.getItem("mock_cp_connections") || "{}");
      connections[profile.id] = "connected"; // Note: simple mock structure
      localStorage.setItem("mock_cp_connections", JSON.stringify(connections));
    }
    alert("Invitation Accepted! You are now a Verified Channel Partner for this Builder.");
  };

  const handleRejectInvite = (builderId: string) => {
    const updatedInvites = pendingInvites.filter(id => id !== builderId);
    setPendingInvites(updatedInvites);
    localStorage.setItem("mock_agent_invites", JSON.stringify(updatedInvites));
    
    // Clear invite status
    if (profile?.id) {
      const connections = JSON.parse(localStorage.getItem("mock_cp_connections") || "{}");
      delete connections[profile.id];
      localStorage.setItem("mock_cp_connections", JSON.stringify(connections));
    }
  };

  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true);
      try {
        const phone = localStorage.getItem("agentsapp_logged_in_phone") || "+91 98765 43210";
        
        // 1. Fetch user profile
        const { data: userProfile } = await supabase
          .from("profiles")
          .select("*")
          .eq("phone", phone)
          .single();

        if (userProfile) {
          setProfile({
            id: userProfile.id,
            name: userProfile.name,
            phone: userProfile.phone,
            status: userProfile.status,
            points: userProfile.points,
            cp_id: userProfile.cp_id || "Pending CP"
          });

          // 2. Fetch reminders/follow-ups for this agent
          const { data: remindersList } = await supabase
            .from("reminders")
            .select("*, leads(name, requirement, location)")
            .eq("agent_id", userProfile.id)
            .eq("is_completed", false);

          if (remindersList) {
            const mappedFollowUps: FollowUp[] = remindersList.map((r: any) => {
              const leadName = r.leads?.name || "Task Follow-up";
              const req = r.leads?.requirement || "General";
              const loc = r.leads?.location || "CP Hub";
              
              let pColor = "bg-amber-500";
              if (r.priority === "high") pColor = "bg-red-500";
              if (r.priority === "low") pColor = "bg-slate-400";

              return {
                name: leadName,
                requirement: req,
                location: loc,
                time: r.scheduled_time,
                priority: r.priority,
                color: pColor
              };
            });
            setFollowUps(mappedFollowUps);
          }

          // 3. Fetch leads for AI nudge match
          const { data: leads } = await supabase
            .from("leads")
            .select("*")
            .eq("agent_id", userProfile.id)
            .limit(2);
          
          if (leads && leads.length > 0) {
            setMatchNudge({
              leadName: leads[0].name,
              req: leads[0].requirement,
              loc: leads[0].location
            });
          }
        }

        // 4. Fetch recent projects/inventory from Supabase
        const { data: projectsList } = await supabase
          .from("projects")
          .select("id, name, location, price_range, type")
          .limit(3);

        if (projectsList) {
          const mappedInventory: ProjectItem[] = projectsList.map((p: any) => ({
            id: p.id,
            name: p.name,
            type: p.type === "plot" ? "Plot" : p.type === "villa" ? "Villa" : "Apartment",
            location: p.location,
            price: p.price_range,
            units: 12 // Default mock units
          }));
          setRecentInventory(mappedInventory);
        }

        // 5. Fetch webinars
        const { data: webList } = await supabase
          .from("webinars")
          .select("title, scheduled_time, reward")
          .limit(1);

        if (webList) {
          const mappedWebinars = webList.map((w: any) => ({
            title: w.title,
            time: w.scheduled_time,
            reward: w.reward || "Voucher Reward"
          }));
          setWebinars(mappedWebinars);
        }

      } catch (err) {
        console.error("Error loading dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500 font-bold uppercase tracking-wider text-xs space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-[#25d366]" />
        <span>Syncing dashboard data...</span>
      </div>
    );
  }

  const agentFirstName = profile?.name ? profile.name.split(" ")[0] : "Agent";

  return (
    <div className="space-y-6 text-slate-800">
      
      {/* Greeting Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Good Morning, {agentFirstName} 👋</h1>
          <p className="text-[#64748b] text-xs font-semibold mt-0.5">WhatsApp-native Agent OS. Everything is running smoothly.</p>
        </div>
        
        {/* Profile Card */}
        <div className="flex items-center space-x-3 bg-white p-1.5 pr-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-[#25d366]/10 text-[#16c47f] flex items-center justify-center font-bold text-xs">
            {profile?.name ? profile.name.charAt(0) : "S"}
          </div>
          <div>
            <div className="text-xs font-extrabold text-[#0f172a]">{profile?.name || "Loading..."}</div>
            <div className="text-[9px] text-[#16c47f] font-extrabold flex items-center space-x-1 uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-[#25d366] inline-block animate-pulse"></span>
              <span>{profile?.status === "approved" ? "Verified Agent" : "Verification Pending"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column - Core Operational Widgets */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Quick Actions Row */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Quick Actions</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-bold">
              <Link href="/agent/pipeline" className="p-3 bg-slate-50 hover:bg-[#25d366]/5 rounded-xl border border-slate-200 text-slate-700 flex flex-col items-center text-center transition">
                <span className="text-lg mb-1">👤</span>
                <span>Add Lead</span>
              </Link>
              <Link href="/agent/inventory" className="p-3 bg-slate-50 hover:bg-[#25d366]/5 rounded-xl border border-slate-200 text-slate-700 flex flex-col items-center text-center transition">
                <span className="text-lg mb-1">🔍</span>
                <span>Search Inventory</span>
              </Link>
              <Link href="/agent/documents" className="p-3 bg-slate-50 hover:bg-[#25d366]/5 rounded-xl border border-slate-200 text-slate-700 flex flex-col items-center text-center transition">
                <span className="text-lg mb-1">📄</span>
                <span>Share Brochure</span>
              </Link>
              <Link href="/agent/reminders" className="p-3 bg-slate-50 hover:bg-[#25d366]/5 rounded-xl border border-slate-200 text-slate-700 flex flex-col items-center text-center transition">
                <span className="text-lg mb-1">⏰</span>
                <span>Set Reminder</span>
              </Link>
            </div>
          </div>

          {/* Follow-ups & Hot Leads */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                    <span>Follow-ups Today</span>
                    {followUps.length > 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block animate-ping"></span>
                    )}
                  </h3>
                  <Link href="/agent/reminders" className="text-[10px] text-[#16c47f] font-bold uppercase hover:underline">View</Link>
                </div>
                <div className="space-y-2.5">
                  {followUps.map((item, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                      <div>
                        <div className="font-bold text-slate-800">{item.name}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{item.requirement} · {item.location}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-slate-700">{item.time}</div>
                        <span className={`inline-block w-1.5 h-1.5 rounded-full ${item.color} mt-1`}></span>
                      </div>
                    </div>
                  ))}
                  {followUps.length === 0 && (
                    <div className="py-6 text-center text-slate-400 font-semibold">
                      No reminders scheduled for today!
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">AI Recommendations</h3>
                {matchNudge ? (
                  <div className="p-3 bg-[#25d366]/5 border border-[#25d366]/20 rounded-xl text-xs space-y-2">
                    <div className="flex items-center space-x-1 text-[#16c47f] font-bold">
                      <Sparkles className="w-4 h-4" />
                      <span>Inventory Match Nudge</span>
                    </div>
                    <p className="text-slate-600 leading-relaxed text-[11px] font-semibold">
                      {matchNudge.leadName} ({matchNudge.req} {matchNudge.loc}) matches builder units in your directory. Tap to share brochure passes.
                    </p>
                    <Link href="/agent/inventory" className="text-[10px] font-bold text-[#16c47f] hover:underline flex items-center">
                      <span>Send details to client</span>
                      <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                    </Link>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-center text-slate-400 py-8 font-semibold">
                    <Sparkles className="w-4 h-4 mx-auto mb-1 text-slate-300" />
                    No active match recommendations yet. Log a lead requirement to trigger matcher nudges!
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Recent Inventory */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Recent Inventory</h3>
            <div className="space-y-3">
              {recentInventory.map((item, idx) => (
                <div key={idx} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 hover:border-[#16c47f]/40 transition flex justify-between items-center text-xs">
                  <div className="flex items-center space-x-2.5">
                    <span className="text-xl">{item.type === "Plot" ? "🚜" : "🏢"}</span>
                    <div>
                      <div className="font-bold text-slate-800">{item.name}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{item.location} · {item.type}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-[#16c47f]">{item.price}</div>
                    <div className="text-[9px] text-slate-500 mt-0.5">{item.units} Units left</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column - webinars, launch countdowns & rewards engagement */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Rewards Summary engagement points */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="text-xs text-slate-400 uppercase font-bold tracking-wider">Rewards Summary</div>
            <div className="flex justify-between items-center">
              <div>
                <div className="text-3xl font-extrabold text-slate-900">{profile?.points || 0}</div>
                <div className="text-[9px] text-[#16c47f] font-bold uppercase tracking-wider mt-0.5">Engagement Points</div>
              </div>
              <div className="w-10 h-10 rounded-full bg-[#25d366]/10 text-[#16c47f] flex items-center justify-center font-bold text-sm">
                🏆
              </div>
            </div>
            
            {/* Target Progress slider */}
            <div className="space-y-1.5 pt-2">
              <div className="flex justify-between text-[10px] text-slate-500 font-bold">
                <span>Fast Responder Badge</span>
                <span>{profile?.points || 0} / 1500 XP</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-[#25d366] h-full" 
                  style={{ width: `${Math.min(100, ((profile?.points || 0) / 1500) * 100)}%` }}
                ></div>
              </div>
            </div>
            
            <Link href="/agent/rewards" className="w-full py-2 bg-slate-950 hover:bg-slate-800 text-white font-bold text-[10px] rounded-lg text-center flex items-center justify-center transition">
              <span>View Rewards Vault</span>
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </div>

          {/* Upcoming webinars & countdowns */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1">
              <span>Upcoming Webinars</span>
              <span className="w-2 h-2 rounded-full bg-[#25d366] inline-block animate-ping"></span>
            </h3>

            {webinars.map((meet, idx) => (
              <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 text-xs">
                <div>
                  <div className="font-bold text-slate-800">{meet.title}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{meet.time}</div>
                </div>
                <div className="p-2 bg-emerald-50 rounded border border-[#25d366]/20 text-[9px] text-[#16c47f] font-bold flex items-center">
                  <Gift className="w-3.5 h-3.5 mr-1" />
                  <span>{meet.reward}</span>
                </div>
                
                <button 
                  onClick={() => alert("Registration confirmed! A pass code and magic link has been shared via WhatsApp.")}
                  className="w-full py-2 bg-[#25d366] hover:bg-[#16c47f] text-white font-bold text-[10px] rounded-lg transition"
                >
                  Register RSVP
                </button>
              </div>
            ))}
            {webinars.length === 0 && (
              <div className="py-4 text-center text-slate-400 font-semibold text-xs border border-dashed rounded-xl">
                No webinars scheduled.
              </div>
            )}
          </div>

          {/* Builder Invitations Widget */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1">
              <span>CP Invitations</span>
              {pendingInvites.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block animate-ping"></span>
              )}
            </h3>

            {pendingInvites.length > 0 ? (
              <div className="space-y-3">
                {pendingInvites.map((id, idx) => (
                  <div key={idx} className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-3 text-xs">
                    <div>
                      <div className="font-bold text-slate-800">Builder Invitation</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Wants you to join as a Channel Partner.</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => handleAcceptInvite(id)}
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] rounded-lg transition"
                      >
                        Accept
                      </button>
                      <button 
                        onClick={() => handleRejectInvite(id)}
                        className="w-full py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-[10px] rounded-lg transition"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-4 text-center text-slate-400 font-semibold text-xs border border-dashed rounded-xl">
                No pending builder invitations.
              </div>
            )}
          </div>

          {/* CP verification summary badge */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-3.5">
            <ShieldCheck className="w-8 h-8 text-[#16c47f] shrink-0" />
            <div>
              <div className="text-xs font-bold text-slate-900">
                {profile?.status === "approved" ? "RERA Approved profile" : "Verification Status Pending"}
              </div>
              <div className="text-[9px] text-slate-500">ID: {profile?.cp_id || "PENDING"} · Active Partner status</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
