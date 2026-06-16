"use client";

import Link from "next/link";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { 
  Check, ArrowRight, Sparkles, Smartphone, 
  Users, Building, MessageSquare, Calendar, 
  Award, ShieldCheck, Zap, Laptop, Shield,
  Layers, Volume2, Gift, CheckCircle2, ChevronRight 
} from "lucide-react";
import WhatsAppSimulationWidget from "@/components/WhatsAppSimulationWidget";

function LandingContent() {
  const [activeChatMsg, setActiveChatMsg] = useState(0);
  const searchParams = useSearchParams();
  const refCode = searchParams.get("ref");

  const loginUrl = refCode ? `/auth/login?ref=${refCode}` : `/auth/login`;
  const loginBuilderUrl = refCode ? `/auth/login?role=builder&ref=${refCode}` : `/auth/login?role=builder`;

  // Auto-redirect if already logged in
  useEffect(() => {
    // Quick localStorage check (instant, no network round-trip)
    try {
      const sessionActive = localStorage.getItem("agentsapp_session_active");
      const storedRole = localStorage.getItem("agentsapp_logged_in_role");
      if (sessionActive === "1" && storedRole) {
        const dashboard =
          storedRole === "super_admin" ? "/super-admin/dashboard" :
          storedRole === "super_builder" ? "/super-builder/dashboard" :
          storedRole === "builder" ? "/builder/dashboard" :
          storedRole === "admin" || storedRole === "verification" || storedRole === "operations" ? "/admin/dashboard" :
          "/agent/dashboard";
        window.location.assign(dashboard);
        return;
      }
    } catch { /* private mode */ }

    // Server-side fallback (cookie-based)
    async function checkSession() {
      try {
        const res = await fetch("/api/me");
        if (!res.ok) return;
        const data = await res.json();
        if (data.user) {
          const dashboard =
            data.user.role === "super_admin" ? "/super-admin/dashboard" :
            data.user.role === "super_builder" ? "/super-builder/dashboard" :
            data.user.role === "builder" ? "/builder/dashboard" :
            data.user.role === "admin" || data.user.role === "verification" || data.user.role === "operations" ? "/admin/dashboard" :
            "/agent/dashboard";
          window.location.assign(dashboard);
        }
      } catch { /* ignore */ }
    }
    checkSession();
  }, []);

  const simulatedChat = [
    { sender: "user", text: "Add lead Ramesh looking for 3BHK Kokapet under 2cr" },
    { 
      sender: "bot", 
      text: "✅ Lead Added!\n👤 Name: Ramesh\n🏠 Requirement: 3 BHK\n📍 Location: Kokapet\n💰 Budget: < ₹2.00 Cr\n\n🔍 I found 3 matching projects. Tap below to send details:",
      isCard: true,
      cardTitle: "Skyline Heights, Kokapet",
      cardDetails: "3 BHK · ₹1.82 Cr Onwards · 12 Units Available"
    },
    { sender: "user", text: "Show plots in Gachibowli with water connection" },
    { 
      sender: "bot", 
      text: "🔍 Found 2 Plots in Gachibowli:\n\n1. Green Meadows (Plot 42)\n📐 Size: 2400 sqft\n💧 Water & Electricity: Yes\n💰 Price: ₹1.40 Cr\n\n2. Gachibowli Enclave (Plot 18)\n📐 Size: 3000 sqft\n💧 Water & Electricity: Yes\n💰 Price: ₹1.75 Cr" 
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveChatMsg((prev) => (prev + 1) % (simulatedChat.length + 1));
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] flex flex-col justify-between font-sans antialiased">
      {/* Dynamic welcome referral banner */}
      {refCode && (
        <div className="bg-[#25d366] text-white text-center py-2 px-4 text-xs font-bold flex items-center justify-center space-x-2 shrink-0 animate-in slide-in-from-top-10 duration-500 shadow-sm border-b border-[#25d366]/20">
          <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
          <span>Special Invite: You've been referred by Partner {refCode}! Get premium features +500 points on onboarding.</span>
        </div>
      )}

      {/* 1. Navbar */}
      <header className="glass-panel sticky top-0 z-50 px-6 py-4 flex items-center justify-between border-b border-slate-200/80 bg-white/80">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-[#25d366] flex items-center justify-center font-bold text-white shadow-md">
            a
          </div>
          <span className="text-xl font-bold tracking-tight text-[#0f172a]">
            agents<span className="text-[#16c47f]">app</span>
          </span>
        </div>

        <nav className="hidden lg:flex items-center space-x-8 text-xs font-bold text-[#64748b] uppercase tracking-wider">
          <a href="#metrics" className="hover:text-[#16c47f] transition">Metrics</a>
          <a href="#builder-features" className="hover:text-[#16c47f] transition">Builder Suite</a>
          <a href="#agent-features" className="hover:text-[#16c47f] transition">Agent App</a>
          <a href="#inventory" className="hover:text-[#16c47f] transition">Inventory</a>
          <a href="#webinar" className="hover:text-[#16c47f] transition">Webinars</a>
          <a href="#rewards" className="hover:text-[#16c47f] transition">Rewards</a>
          <a href="#pricing" className="hover:text-[#16c47f] transition">Pricing</a>
        </nav>

        <div className="flex items-center space-x-4">
          <Link href={loginUrl} className="text-xs font-bold text-[#64748b] hover:text-[#16c47f] transition uppercase tracking-wider">
            Login
          </Link>
          <Link href={loginUrl} className="glow-button px-4 py-2 bg-[#25d366] hover:bg-[#16c47f] text-white font-bold text-xs rounded-lg transition-all flex items-center space-x-1 shadow-sm">
            <span>Start Free</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative px-6 py-16 md:py-24 max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left column info */}
        <div className="lg:col-span-7 space-y-6">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#25d366]/10 border border-[#25d366]/30 text-xs font-bold text-[#16c47f]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Light-Theme Premium SaaS Platform</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-none text-[#0f172a]">
            Your Real Estate Business on <span className="text-[#25d366]">WhatsApp</span>
          </h1>

          <p className="text-[#64748b] text-base md:text-lg max-w-xl leading-relaxed">
            Manage clients, inventory, webinars, launches, campaigns, and engagement directly through WhatsApp. Realtime distribution infrastructure for builders and agents.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 pt-2">
            <Link href={loginUrl} className="glow-button px-7 py-3.5 bg-[#25d366] hover:bg-[#16c47f] text-white font-bold text-sm rounded-xl transition flex items-center justify-center space-x-2">
              <span>Start Free Now</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href={loginBuilderUrl} className="px-7 py-3.5 bg-white border border-slate-200 hover:border-slate-300 text-[#0f172a] font-bold text-sm rounded-xl transition flex items-center justify-center">
              <span>Book Builder Demo</span>
            </Link>
          </div>
        </div>

        {/* Right column visual - Phone Mockup */}
        <div className="lg:col-span-5 flex justify-center relative">
          {/* Subtle green glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-[#25d366]/10 blur-[100px] rounded-full -z-10"></div>

          <div className="w-[300px] h-[580px] rounded-[40px] border-[8px] border-slate-900 bg-white shadow-2xl overflow-hidden relative flex flex-col">
            {/* Phone Notch */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-5 bg-slate-900 rounded-b-xl z-20"></div>

            {/* Chat header */}
            <div className="bg-[#075e54] pt-7 pb-2.5 px-4 flex items-center space-x-2 text-white shrink-0">
              <div className="w-7 h-7 rounded-full bg-[#128c7e] flex items-center justify-center font-bold text-xs">
                A
              </div>
              <div>
                <div className="font-bold text-[11px]">agentsapp Bot</div>
                <div className="text-[8px] text-[#4ade80] flex items-center space-x-1">
                  <span className="w-1 h-1 rounded-full bg-[#4ade80] inline-block animate-ping"></span>
                  <span>Active Agent Hub</span>
                </div>
              </div>
            </div>

            {/* Messages body */}
            <div className="flex-1 p-3 space-y-3 overflow-y-auto bg-[#efeae2] text-[10px] text-slate-800">
              {simulatedChat.map((msg, i) => {
                if (i >= activeChatMsg && activeChatMsg !== 0) return null;
                const isBot = msg.sender === "bot";
                
                return (
                  <div key={i} className={`flex flex-col ${isBot ? "items-start" : "items-end"}`}>
                    <div className={`max-w-[85%] rounded-lg p-2 shadow-sm whitespace-pre-line ${
                      isBot ? "bg-white text-slate-800 rounded-tl-none" : "bg-[#d9fdd3] text-slate-800 rounded-tr-none"
                    }`}>
                      {msg.text}

                      {msg.isCard && (
                        <div className="mt-2 p-1.5 bg-[#f8fafc] rounded border border-slate-200/80 space-y-1">
                          <div className="font-bold text-xs text-[#16c47f]">{msg.cardTitle}</div>
                          <div className="text-[8px] text-slate-500">{msg.cardDetails}</div>
                          <button className="w-full py-1 text-center font-bold text-[8px] text-white bg-[#25d366] rounded hover:bg-[#16c47f] transition">
                            Share Card
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Simulated Chat Input */}
            <div className="p-2 bg-[#f0f2f5] flex items-center space-x-2 shrink-0 border-t border-slate-200">
              <div className="flex-1 bg-white rounded-full py-1 px-3 text-[9px] text-slate-400 border border-slate-200">
                Type 'Show Inventory'...
              </div>
              <div className="w-6 h-6 rounded-full bg-[#25d366] flex items-center justify-center text-white text-[10px]">
                🎤
              </div>
            </div>
          </div>

          {/* Floating UI Badges */}
          <div className="absolute -left-8 top-12 glass-panel p-2.5 rounded-xl border border-slate-200 shadow-lg flex items-center space-x-2.5 w-44">
            <span className="text-sm">⏰</span>
            <div>
              <div className="text-[9px] font-bold text-[#0f172a]">AI Follow-Up Nudge</div>
              <div className="text-[7px] text-[#64748b]">Call Rajesh about Site Visit</div>
            </div>
          </div>

          <div className="absolute -right-6 bottom-24 glass-panel p-2.5 rounded-xl border border-slate-200 shadow-lg flex items-center space-x-2.5 w-44">
            <span className="text-sm">🏆</span>
            <div>
              <div className="text-[9px] font-bold text-[#0f172a]">Active Badges</div>
              <div className="text-[7px] text-[#64748b]">Launch Expert Unlocked</div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Trust Metrics Section */}
      <section id="metrics" className="bg-white border-y border-slate-200 py-10 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-6 gap-6 text-center">
          <div>
            <div className="text-2xl md:text-3xl font-extrabold text-[#0f172a]">12,000+</div>
            <div className="text-[10px] uppercase font-bold text-[#64748b] tracking-wider mt-1">Active Agents</div>
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-extrabold text-[#0f172a]">250+</div>
            <div className="text-[10px] uppercase font-bold text-[#64748b] tracking-wider mt-1">Builders</div>
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-extrabold text-[#16c47f]">92%</div>
            <div className="text-[10px] uppercase font-bold text-[#64748b] tracking-wider mt-1">Campaign Read Rate</div>
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-extrabold text-[#0f172a]">45,000+</div>
            <div className="text-[10px] uppercase font-bold text-[#64748b] tracking-wider mt-1">Webinar Joins</div>
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-extrabold text-[#0f172a]">1.5 Lakhs</div>
            <div className="text-[10px] uppercase font-bold text-[#64748b] tracking-wider mt-1">Launch RSVPs</div>
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-extrabold text-[#0f172a]">3M+</div>
            <div className="text-[10px] uppercase font-bold text-[#64748b] tracking-wider mt-1">Inventory Views</div>
          </div>
        </div>
      </section>

      {/* 4. Builder Features Section */}
      <section id="builder-features" className="py-16 px-6 max-w-7xl mx-auto space-y-12">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-[#0f172a]">Developer Distribution Suite</h2>
          <p className="text-[#64748b] text-sm mt-2">Circulate inventory and launch campaigns directly into agents' personal chat threads.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-3 hover:border-[#16c47f] transition">
            <div className="w-10 h-10 rounded-lg bg-[#25d366]/10 text-[#16c47f] flex items-center justify-center font-bold">📢</div>
            <h3 className="font-bold text-[#0f172a]">Campaign Studio</h3>
            <p className="text-slate-500 text-xs leading-relaxed">Send rich media templates with attached PDF price sheets and RERA approvals to verified agent segments.</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-3 hover:border-[#16c47f] transition">
            <div className="w-10 h-10 rounded-lg bg-indigo-550/10 text-indigo-500 flex items-center justify-center font-bold">📊</div>
            <h3 className="font-bold text-[#0f172a]">Realtime Analytics</h3>
            <p className="text-slate-500 text-xs leading-relaxed">Track read receipts, flyer clicks, brochure downloads, and webinar signups to evaluate campaign ROI.</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-3 hover:border-[#16c47f] transition">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center font-bold">👥</div>
            <h3 className="font-bold text-[#0f172a]">Verified Agent Directory</h3>
            <p className="text-slate-500 text-xs leading-relaxed">Search operating areas, specialization config, and activity score before targeting campaigns.</p>
          </div>
        </div>
      </section>

      {/* 5. Agent Features Section */}
      <section id="agent-features" className="bg-white py-16 px-6 border-y border-slate-200">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h2 className="text-2xl md:text-3xl font-bold text-[#0f172a]">Agents: Run Your Business from WhatsApp</h2>
            <p className="text-[#64748b] text-sm leading-relaxed">
              No new apps to install or training needed. Simply message the bot to run your client pipeline and check builder projects.
            </p>
            
            <div className="space-y-3 text-xs font-semibold">
              <div className="flex items-center space-x-2">
                <Check className="w-4 h-4 text-[#25d366]" />
                <span>Text or voice-note commands to log client leads</span>
              </div>
              <div className="flex items-center space-x-2">
                <Check className="w-4 h-4 text-[#25d366]" />
                <span>Automatic follow-up reminders pushed to WhatsApp</span>
              </div>
              <div className="flex items-center space-x-2">
                <Check className="w-4 h-4 text-[#25d366]" />
                <span>Download brochures and layouts with one-tap requests</span>
              </div>
            </div>
          </div>
          <div className="bg-[#f8fafc] p-6 rounded-2xl border border-slate-200 shadow-inner space-y-4">
            <div className="text-[10px] uppercase font-bold text-[#64748b] tracking-wider">Example Bot Command Interaction</div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="text-slate-400 font-bold">Agent:</div>
              <div className="p-2 bg-[#d9fdd3] rounded-lg rounded-tr-none self-end max-w-fit font-medium">Add new client Ravi Kumar budget 1.8cr Kokapet</div>
              <div className="text-slate-400 font-bold pt-2">agentsapp Bot:</div>
              <div className="p-2 bg-slate-100 rounded-lg rounded-tl-none max-w-fit">✅ Lead Ravi Kumar created in pipeline (Kokapet, Budget: ₹1.80 Cr). Tap below to link match recommendations.</div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Inventory Intelligence Section */}
      <section id="inventory" className="py-16 px-6 max-w-7xl mx-auto space-y-12">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-[#0f172a]">Extensible Dynamic Inventory Engine</h2>
          <p className="text-[#64748b] text-sm mt-2">Dynamic schema structure supporting plots, villas, commercial spaces, and apartments.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <span className="text-2xl">🚜</span>
            <div className="font-bold text-sm">Plots & Lands</div>
            <div className="text-[10px] text-slate-500">Dimensions, Road width, Approval types</div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <span className="text-2xl">🏡</span>
            <div className="font-bold text-sm">Villas & Mansions</div>
            <div className="text-[10px] text-slate-500">Private pool, Built-up area, Smart home</div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <span className="text-2xl">🏢</span>
            <div className="font-bold text-sm">Apartments</div>
            <div className="text-[10px] text-slate-500">Super built-up area, Floors, Balconies</div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <span className="text-2xl">🏬</span>
            <div className="font-bold text-sm">Commercial</div>
            <div className="text-[10px] text-slate-500">Frontage, Parking count, Office types</div>
          </div>
        </div>
      </section>

      {/* 7. Webinar & Launch Ecosystem Section */}
      <section id="webinar" className="bg-white py-16 px-6 border-y border-slate-200">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="bg-[#f8fafc] p-6 rounded-2xl border border-slate-200 space-y-4">
            <div className="p-4 bg-white rounded-xl border border-slate-200 flex justify-between items-center text-xs">
              <div>
                <div className="font-bold text-slate-800">Prestige Highrise webinar</div>
                <div className="text-[10px] text-[#25d366] font-bold mt-0.5">Reward: Unlocks ₹500 voucher</div>
              </div>
              <button className="px-3 py-1.5 bg-[#25d366] hover:bg-[#16c47f] text-white font-bold rounded-lg text-[10px] transition">
                Register Meet
              </button>
            </div>
            <div className="p-4 bg-white rounded-xl border border-slate-200 flex justify-between items-center text-xs">
              <div>
                <div className="font-bold text-slate-800">Skyline Heights Launch</div>
                <div className="text-[10px] text-slate-500 mt-0.5">June 15 · CP Meet</div>
              </div>
              <span className="text-[10px] bg-emerald-100 text-emerald-600 font-bold px-2 py-0.5 rounded">
                QR Pass Generated
              </span>
            </div>
          </div>
          <div className="space-y-4">
            <h2 className="text-2xl md:text-3xl font-bold text-[#0f172a]">CP Launch & Webinar Infrastructure</h2>
            <p className="text-[#64748b] text-sm leading-relaxed">
              Verify attendance to virtual sessions automatically. Reward participating agents with voucher coupons or unlocked premium listings access instantly to incentivize action.
            </p>
          </div>
        </div>
      </section>

      {/* 8. AI Workflow Features Section */}
      <section className="py-16 px-6 max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        <div className="space-y-4">
          <h2 className="text-2xl md:text-3xl font-bold text-[#0f172a]">Whisper Voice-Note Intent Parsing</h2>
          <p className="text-[#64748b] text-sm leading-relaxed">
            Real estate agents operate on the move. Rather than typing out forms, they can record short voice messages in Hinglish. Our backend transcribes via Whisper API and parses intent via GPT-4o automatically.
          </p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center space-x-2.5 text-xs text-slate-400">
            <Volume2 className="w-5 h-5 text-[#25d366] animate-pulse" />
            <span className="font-bold">Voice Transcription Transcript</span>
          </div>
          <p className="text-xs italic bg-slate-50 p-3 rounded-lg border border-slate-200 text-slate-700 leading-relaxed font-semibold">
            "Srinivas, mark Amit flat site visit done and remind me call builder commission invoice on Monday."
          </p>
          <div className="text-[10px] text-brand-green-light font-bold flex items-center">
            <CheckCircle2 className="w-4 h-4 mr-1 shrink-0" />
            <span>Successfully updated lead status & scheduled Monday reminder task</span>
          </div>
        </div>
      </section>

      {/* 9. Rewards & Engagement Section */}
      <section id="rewards" className="bg-white py-16 px-6 border-y border-slate-200">
        <div className="max-w-7xl mx-auto text-center space-y-12">
          <div className="max-w-2xl mx-auto space-y-2">
            <h2 className="text-2xl md:text-3xl font-bold text-[#0f172a]">Agent Rewards & Engagement</h2>
            <p className="text-[#64748b] text-sm">Gamifying agent pipeline activity. Earn rewards points and badges (No cash wallet system).</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="p-5 bg-[#f8fafc] border border-slate-200 rounded-2xl text-center space-y-2">
              <span className="text-2xl">🥇</span>
              <div className="font-bold text-sm text-[#0f172a]">Monthly Leaderboard</div>
              <div className="text-[10px] text-[#64748b]">Top operating partners rankings</div>
            </div>
            <div className="p-5 bg-[#f8fafc] border border-slate-200 rounded-2xl text-center space-y-2">
              <span className="text-2xl">🎫</span>
              <div className="font-bold text-sm text-[#0f172a]">Sponsor Vouchers</div>
              <div className="text-[10px] text-[#64748b]">Claim Amazon gift cards</div>
            </div>
            <div className="p-5 bg-[#f8fafc] border border-slate-200 rounded-2xl text-center space-y-2">
              <span className="text-2xl">⚡</span>
              <div className="font-bold text-sm text-[#0f172a]">Badges Unlocked</div>
              <div className="text-[10px] text-[#64748b]">Launch Expert & Webinar Pro</div>
            </div>
            <div className="p-5 bg-[#f8fafc] border border-slate-200 rounded-2xl text-center space-y-2">
              <span className="text-2xl">🔓</span>
              <div className="font-bold text-sm text-[#0f172a]">Feature Access</div>
              <div className="text-[10px] text-[#64748b]">Unlock premium search listings</div>
            </div>
          </div>
        </div>
      </section>

      {/* 10. Subscription Plans Section */}
      <section id="pricing" className="py-16 px-6 max-w-7xl mx-auto space-y-12">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-[#0f172a]">Developer Pricing Plans</h2>
          <p className="text-[#64748b] text-sm mt-2">Transparent package limits and overage usage charges. Zero agent CRM fees.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm hover:border-[#16c47f] transition flex flex-col justify-between h-80">
            <div>
              <div className="font-bold text-xs uppercase tracking-wider text-[#64748b]">Starter</div>
              <div className="text-2xl font-extrabold text-[#0f172a] mt-2">₹15,000<span className="text-xs text-[#64748b]">/mo</span></div>
              <div className="text-xs text-slate-500 mt-4 space-y-1.5">
                <div>· 5 Active Campaigns/mo</div>
                <div>· 1 Event RSVP tracking</div>
                <div>· Standard support channel</div>
              </div>
            </div>
            <Link href={loginBuilderUrl} className="w-full py-2 bg-slate-900 text-white font-bold text-xs rounded-lg text-center hover:bg-slate-800 transition">
              Get Started
            </Link>
          </div>

          <div className="bg-white p-6 rounded-2xl border-2 border-[#25d366] shadow-md hover:scale-102 transition flex flex-col justify-between h-80 relative">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#25d366] text-white text-[8px] uppercase tracking-wider font-extrabold px-3 py-1 rounded-full">
              Most Popular
            </span>
            <div>
              <div className="font-bold text-xs uppercase tracking-wider text-[#16c47f]">Growth</div>
              <div className="text-2xl font-extrabold text-[#0f172a] mt-2">₹25,000<span className="text-xs text-[#64748b]">/mo</span></div>
              <div className="text-xs text-slate-500 mt-4 space-y-1.5">
                <div>· 15 Active Campaigns/mo</div>
                <div>· 5 Event RSVPs & Webinar modules</div>
                <div>· Priority Slack support</div>
              </div>
            </div>
            <Link href={loginBuilderUrl} className="w-full py-2 bg-[#25d366] text-white font-bold text-xs rounded-lg text-center hover:bg-[#16c47f] transition">
              Get Started
            </Link>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm hover:border-[#16c47f] transition flex flex-col justify-between h-80">
            <div>
              <div className="font-bold text-xs uppercase tracking-wider text-[#64748b]">Enterprise</div>
              <div className="text-2xl font-extrabold text-[#0f172a] mt-2">Custom Pricing</div>
              <div className="text-xs text-slate-500 mt-4 space-y-1.5">
                <div>· Unlimited WhatsApp broadcasts</div>
                <div>· Custom dynamic field setups</div>
                <div>· Dedicated account manager</div>
              </div>
            </div>
            <Link href={loginBuilderUrl} className="w-full py-2 bg-slate-900 text-white font-bold text-xs rounded-lg text-center hover:bg-slate-800 transition">
              Contact Sales
            </Link>
          </div>
        </div>
      </section>

      {/* 11. Final CTA Section */}
      <section className="bg-white py-16 px-6 border-t border-slate-200 text-center">
        <div className="max-w-2xl mx-auto space-y-6">
          <h2 className="text-3xl font-extrabold text-[#0f172a]">Ready to Supercharge Your Real Estate Distribution?</h2>
          <p className="text-[#64748b] text-sm">
            Empower your agents with WhatsApp-first tools and run spam-free direct developer campaigns instantly.
          </p>
          <div className="flex justify-center space-x-4">
            <Link href={loginUrl} className="glow-button px-6 py-3 bg-[#25d366] hover:bg-[#16c47f] text-white font-bold text-xs rounded-xl shadow-lg transition">
              Start Free (For Agents)
            </Link>
            <Link href={loginBuilderUrl} className="px-6 py-3 bg-slate-950 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition">
              Get Builder Suite
            </Link>
          </div>
        </div>
      </section>

      {/* 12. Footer */}
      <footer className="bg-white py-8 px-6 border-t border-slate-200/80 text-center text-xs text-[#64748b]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div>© 2026 AgentsApp · Confidential and Proprietary</div>
          <div className="flex space-x-6 font-semibold">
            <a href="mailto:hello@agentsapp.in" className="hover:text-[#16c47f] transition">hello@agentsapp.in</a>
            <span>+91 98765 43210</span>
            <a href="https://agentsapp.in" target="_blank" rel="noreferrer" className="hover:text-[#16c47f] transition">agentsapp.in</a>
          </div>
        </div>
      </footer>
      
      {/* Bot Simulator for Registration */}
      <WhatsAppSimulationWidget />
    </div>
  );
}

export default function LandingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f8fafc] flex items-center justify-center font-sans antialiased text-xs text-slate-500 uppercase font-bold tracking-wider">Loading agentsapp...</div>}>
      <LandingContent />
    </Suspense>
  );
}
