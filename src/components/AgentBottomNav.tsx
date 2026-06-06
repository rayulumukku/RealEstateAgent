"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Home, Users, Briefcase, Calendar, 
  Award, User, MessageSquare, X 
} from "lucide-react";
import { useState } from "react";

export default function AgentBottomNav() {
  const pathname = usePathname();
  const [showBotModal, setShowBotModal] = useState(false);
  const [chatHistory, setChatHistory] = useState<string[]>([
    "🤖 Bot: Welcome Sreenivas! How can I help you today? You can write in natural English or Hinglish.",
  ]);
  const [chatInput, setChatInput] = useState("");

  const menuItems = [
    { name: "Home", href: "/agent/dashboard", icon: Home },
    { name: "Leads", href: "/agent/pipeline", icon: Users },
    { name: "Inventory", href: "/agent/inventory", icon: Briefcase },
    { name: "Events", href: "/agent/invitations", icon: Calendar },
    { name: "Rewards", href: "/agent/rewards", icon: Award },
    { name: "Profile", href: "/agent/profile", icon: User },
  ];

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput) return;

    const userMsg = `👤 You: ${chatInput}`;
    const promptToSend = chatInput;
    
    // Render user message optimistically
    setChatHistory(prev => [...prev, userMsg]);
    setChatInput("");

    try {
      const rawPhone = localStorage.getItem("agentsapp_logged_in_phone") || "+91 98765 43210";
      const cleanPhone = rawPhone.replace(/\D/g, ""); // "919876543210"
      const userName = localStorage.getItem("agentsapp_logged_in_user") || "Sreenivas Rao";

      // POST to the live local whatsapp webhook API
      const response = await fetch("/api/whatsapp/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          object: "whatsapp_business_account",
          entry: [
            {
              id: "sandbox-entry",
              changes: [
                {
                  field: "messages",
                  value: {
                    messaging_product: "whatsapp",
                    metadata: {
                      display_phone_number: "919999999999",
                      phone_number_id: "bot-phone-id"
                    },
                    contacts: [
                      {
                        profile: {
                          name: userName
                        },
                        wa_id: cleanPhone
                      }
                    ],
                    messages: [
                      {
                        from: cleanPhone,
                        id: `wamid.sandbox_${Date.now()}`,
                        timestamp: Math.floor(Date.now() / 1000).toString(),
                        text: {
                          body: promptToSend
                        },
                        type: "text"
                      }
                    ]
                  }
                }
              ]
            }
          ]
        })
      });

      const data = await response.json();
      const botReply = data.reply || "🤖 Bot: Processed webhook action successfully.";
      setChatHistory(prev => [...prev, botReply]);
    } catch (err: any) {
      setChatHistory(prev => [...prev, `🤖 Bot: ❌ Failed to dispatch webhook: ${err.message}`]);
    }
  };

  return (
    <>
      {/* Bottom Nav Bar - Mobile Only */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200/90 py-2 px-3 flex justify-around items-center shadow-lg">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link 
              key={item.name} 
              href={item.href}
              className={`flex flex-col items-center space-y-1 text-[#64748b] hover:text-[#16c47f] transition ${
                isActive ? "text-[#25d366]" : ""
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="text-[9px] font-bold tracking-tight">{item.name}</span>
            </Link>
          );
        })}
      </div>

      {/* Floating WhatsApp Action Button */}
      <button 
        onClick={() => setShowBotModal(true)}
        className="fixed bottom-16 lg:bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-[#25d366] hover:bg-[#16c47f] text-white flex items-center justify-center shadow-xl shadow-[#25d366]/35 transition animate-bounce"
        style={{ animationDuration: "5s" }}
        title="Open WhatsApp Chat Simulator"
      >
        <MessageSquare className="w-5 h-5" />
      </button>

      {/* WhatsApp Chat Simulation Modal */}
      {showBotModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm glass-panel rounded-2xl border border-slate-200 shadow-2xl overflow-hidden relative flex flex-col h-[450px] animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-[#075e54] text-white px-4 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-full bg-[#128c7e] flex items-center justify-center font-bold text-xs">
                  WA
                </div>
                <div>
                  <div className="font-bold text-xs">agentsapp Bot</div>
                  <div className="text-[8px] text-[#4ade80]">online · GallaBox API</div>
                </div>
              </div>
              <button 
                onClick={() => setShowBotModal(false)}
                className="text-slate-200 hover:text-white p-1 hover:bg-[#128c7e] rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Chat Body */}
            <div className="flex-1 p-3 overflow-y-auto bg-[#efeae2] text-[10px] space-y-2">
              {chatHistory.map((msg, i) => {
                const isBot = msg.startsWith("🤖");
                return (
                  <div key={i} className={`flex flex-col ${isBot ? "items-start" : "items-end"}`}>
                    <div className={`max-w-[85%] rounded-lg p-2.5 shadow-sm whitespace-pre-line leading-relaxed ${
                      isBot ? "bg-white text-slate-800 rounded-tl-none" : "bg-[#d9fdd3] text-slate-800 rounded-tr-none font-medium"
                    }`}>
                      {msg}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick Suggestion Chips */}
            <div className="bg-[#efeae2] px-3 pb-2.5 flex space-x-1.5 overflow-x-auto shrink-0 scrollbar-thin select-none">
              {[
                { label: "ℹ️ Help", cmd: "help" },
                { label: "🆕 Add Ravi (3BHK)", cmd: "Add Ravi looking for 3BHK" },
                { label: "🏢 East-facing Plots", cmd: "Show east-facing plots" },
                { label: "⏰ Remind Tomorrow", cmd: "Remind me tomorrow to call Ramesh" },
                { label: "📁 Skyline Brochure", cmd: "Send Skyline brochure" },
                { label: "🚀 Upcoming Launches", cmd: "Upcoming launches" },
                { label: "🎥 Register Webinar", cmd: "Register webinar" },
                { label: "📋 My Leads", cmd: "my leads" },
                { label: "⚡ Status Site Visit", cmd: "Amit site visit" }
              ].map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setChatInput(item.cmd)}
                  className="bg-white/95 active:bg-slate-200 border border-slate-200/60 text-slate-700 text-[8px] font-bold py-1 px-2.5 rounded-full whitespace-nowrap shadow-sm transition hover:scale-105 shrink-0"
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Chat Footer Input */}
            <form onSubmit={handleSendChat} className="p-2 bg-[#f0f2f5] border-t border-slate-200 flex items-center space-x-2 shrink-0">
              <input 
                type="text"
                placeholder="e.g. add lead Ravi 3BHK"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1 bg-white border border-slate-200 rounded-full py-1.5 px-3 text-[10px] text-slate-800 outline-none focus:border-[#25d366] transition"
              />
              <button 
                type="submit"
                className="w-7 h-7 rounded-full bg-[#25d366] text-white flex items-center justify-center text-xs font-bold shrink-0 hover:bg-[#16c47f]"
              >
                ➔
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
