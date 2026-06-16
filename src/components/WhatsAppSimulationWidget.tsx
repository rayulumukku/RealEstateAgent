"use client";

import { useState, useRef, useEffect } from "react";
import { MessageSquare, X } from "lucide-react";
import { getNewSimulatedMessages } from "@/app/auth/actions";
import { HYDERABAD_LOCATIONS } from "@/lib/hyderabadLocations";

export default function WhatsAppSimulationWidget() {
  const [showBotModal, setShowBotModal] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<string[]>([
    "🤖 Bot: Welcome to AgentsApp!\nTry sending 'hi' or 'help' to see what I can do!"
  ]);
  const [showRegForm, setShowRegForm] = useState(false);
  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regAgency, setRegAgency] = useState("");
  const [regLocation, setRegLocation] = useState<string[]>([]);
  const [regInterested, setRegInterested] = useState<string[]>([]);
  const [isLocDropdownOpen, setIsLocDropdownOpen] = useState(false);
  const [isPropDropdownOpen, setIsPropDropdownOpen] = useState(false);
  const chatBodyRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [chatHistory, showBotModal]);

  const fetchFullHistory = async () => {
    try {
      let rawPhone = localStorage.getItem("agentsapp_logged_in_phone");
      if (!rawPhone) {
        rawPhone = localStorage.getItem("agentsapp_sim_phone");
      }
      if (!rawPhone) return;

      const res = await getNewSimulatedMessages(rawPhone, "2000-01-01T00:00:00.000Z");
      if (res.ok && res.messages) {
        const welcomeMsg = "🤖 Bot: Welcome to AgentsApp!\nTry sending 'hi' or 'help' to see what I can do!";
        const msgs = [welcomeMsg];
        res.messages.forEach((msg: any) => {
          if (msg.direction === "inbound") {
            msgs.push(`👤 You: ${msg.content}`);
          } else {
            const botContent = msg.content.startsWith("🤖") ? msg.content : `🤖 Bot:\n${msg.content}`;
            msgs.push(botContent);
          }
        });
        setChatHistory(msgs);
      }
    } catch (err) {
      console.error("Error fetching chat history", err);
    }
  };

  // Load history on mount and poll
  useEffect(() => {
    fetchFullHistory();
    const interval = setInterval(fetchFullHistory, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const promptToSend = chatInput.trim();
    setChatInput("");
    
    // Render user message optimistically
    setChatHistory(prev => [...prev, `👤 You: ${promptToSend}`]);

    try {
      let rawPhone = localStorage.getItem("agentsapp_logged_in_phone");
      
      // If not logged in, generate a stable random phone number for the simulation session
      if (!rawPhone) {
        let simPhone = localStorage.getItem("agentsapp_sim_phone");
        if (!simPhone) {
          const randomNum = Math.floor(10000000 + Math.random() * 90000000);
          simPhone = `+91 99${randomNum}`;
          localStorage.setItem("agentsapp_sim_phone", simPhone);
        }
        rawPhone = simPhone;
      }
      
      const cleanPhone = rawPhone.replace(/\D/g, ""); // "919912345678"
      const userName = localStorage.getItem("agentsapp_logged_in_user") || "Visitor";

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
      // We optimistically show the reply, but it will also be synced by the next poll
      const rawReply = data.reply || "Processed successfully.";
      const botReply = rawReply.startsWith("🤖") ? rawReply : `🤖 Bot: ${rawReply}`;
      setChatHistory(prev => [...prev, botReply]);
    } catch (err: any) {
      setChatHistory(prev => [...prev, `🤖 Bot: ❌ Failed to dispatch webhook: ${err.message}`]);
    }
  };

  return (
    <>
      {/* Floating WhatsApp Action Button */}
      <button 
        onClick={() => setShowBotModal(true)}
        className="fixed bottom-16 lg:bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#25d366] hover:bg-[#16c47f] text-white flex items-center justify-center shadow-2xl shadow-[#25d366]/40 transition animate-bounce"
        style={{ animationDuration: "5s" }}
        title="Open WhatsApp Chat Simulator"
      >
        <MessageSquare className="w-6 h-6" />
      </button>

      {/* WhatsApp Chat Simulation Widget */}
      {showBotModal && (
        <div className="fixed bottom-24 lg:bottom-24 right-6 z-50 w-[380px] max-w-[calc(100vw-32px)] h-[500px] max-h-[calc(100vh-140px)] bg-white rounded-2xl border border-slate-200/90 shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-5 duration-300">
          {/* Header */}
          <div className="bg-[#075e54] text-white px-4 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-[#128c7e] flex items-center justify-center font-bold text-xs shadow-inner">
                WA
              </div>
              <div>
                <div className="font-bold text-xs">agentsapp Bot</div>
                <div className="text-[9px] text-[#4ade80] flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80] inline-block animate-pulse"></span>
                  <span>online · Simulated</span>
                </div>
              </div>
            </div>
            <button 
              onClick={() => setShowBotModal(false)}
              className="text-slate-200 hover:text-white p-1.5 hover:bg-[#128c7e] rounded-lg transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Chat Body */}
          <div ref={chatBodyRef} className="flex-1 p-3 overflow-y-auto bg-[#efeae2] text-[11px] space-y-2">
            {chatHistory.map((msg, i) => {
              const isBot = msg.startsWith("🤖");
              return (
                <div key={i} className={`flex flex-col ${isBot ? "items-start" : "items-end"}`}>
                  <div className={`max-w-[85%] rounded-lg p-2.5 shadow-sm whitespace-pre-line leading-relaxed ${
                    isBot ? "bg-white text-slate-800 rounded-tl-none border border-slate-100" : "bg-[#d9fdd3] text-slate-800 rounded-tr-none font-medium border border-[#c1fac6]"
                  }`}>
                    {msg}
                  </div>
                </div>
              );
            })}

            {showRegForm && (
              <div className="flex flex-col items-start mt-2">
                <div className="max-w-[95%] bg-white text-slate-800 rounded-lg rounded-tl-none border border-slate-200 p-3 shadow-sm w-full space-y-2.5">
                  <div className="font-bold text-xs text-[#25d366] pb-1 border-b border-slate-100">Agent Registration</div>
                  
                  <div className="w-full">
                    <label className="text-[10px] text-slate-500 font-bold mb-0.5 block">Full Name</label>
                    <input type="text" placeholder="e.g. Amit Sharma" value={regName} onChange={e => setRegName(e.target.value)} className="w-full border border-slate-200 rounded-md p-1.5 text-xs outline-none focus:border-[#25d366]" />
                  </div>
                  
                  <div className="w-full">
                    <label className="text-[10px] text-slate-500 font-bold mb-0.5 block">Phone Number</label>
                    <input type="text" placeholder="e.g. 9876543210" value={regPhone} onChange={e => setRegPhone(e.target.value)} className="w-full border border-slate-200 rounded-md p-1.5 text-xs outline-none focus:border-[#25d366]" />
                  </div>
                  
                  <div className="w-full">
                    <label className="text-[10px] text-slate-500 font-bold mb-0.5 block">Agency Name</label>
                    <input type="text" placeholder="e.g. Sunrise Realty" value={regAgency} onChange={e => setRegAgency(e.target.value)} className="w-full border border-slate-200 rounded-md p-1.5 text-xs outline-none focus:border-[#25d366]" />
                  </div>

                  <div className="relative w-full">
                    <label className="text-[10px] text-slate-500 font-bold mb-0.5 block">Location(s)</label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsLocDropdownOpen(!isLocDropdownOpen);
                        if (!isLocDropdownOpen) setIsPropDropdownOpen(false);
                      }}
                      className="w-full border border-slate-200 rounded-md p-1.5 text-xs text-left bg-white outline-none focus:border-[#25d366]"
                    >
                      {regLocation.length > 0 ? (regLocation.length > 2 ? `${regLocation.length} selected` : regLocation.join(", ")) : "Select Areas in Hyderabad"}
                    </button>
                    {isLocDropdownOpen && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-32 overflow-y-auto">
                        {HYDERABAD_LOCATIONS.map(loc => (
                          <label key={loc} className="flex items-center px-2 py-1.5 text-[11px] hover:bg-slate-50 cursor-pointer">
                            <input
                              type="checkbox"
                              className="mr-2"
                              checked={regLocation.includes(loc)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setRegLocation([...regLocation, loc]);
                                } else {
                                  setRegLocation(regLocation.filter(l => l !== loc));
                                }
                              }}
                            />
                            {loc}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="relative w-full">
                    <label className="text-[10px] text-slate-500 font-bold mb-0.5 block">Property Types (Interested In)</label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsPropDropdownOpen(!isPropDropdownOpen);
                        if (!isPropDropdownOpen) setIsLocDropdownOpen(false);
                      }}
                      className="w-full border border-slate-200 rounded-md p-1.5 text-xs text-left bg-white outline-none focus:border-[#25d366]"
                    >
                      {regInterested.length > 0 ? (regInterested.length > 2 ? `${regInterested.length} selected` : regInterested.join(", ")) : "Select Property Types"}
                    </button>
                    {isPropDropdownOpen && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-32 overflow-y-auto">
                        {["Apartment", "Villa", "Plot", "Commercial"].map(prop => (
                          <label key={prop} className="flex items-center px-2 py-1.5 text-[11px] hover:bg-slate-50 cursor-pointer">
                            <input
                              type="checkbox"
                              className="mr-2"
                              checked={regInterested.includes(prop)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setRegInterested([...regInterested, prop]);
                                } else {
                                  setRegInterested(regInterested.filter(p => p !== prop));
                                }
                              }}
                            />
                            {prop}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex space-x-2 pt-1.5">
                    <button 
                      onClick={() => {
                        if (!regName || !regPhone || !regAgency || regLocation.length === 0 || regInterested.length === 0) {
                          alert("Please fill all fields");
                          return;
                        }
                        setShowRegForm(false);
                        const cmd = `aa Register ${regName} phone ${regPhone} agency ${regAgency} location ${regLocation.join(", ")} interested in ${regInterested.join(", ")}`;
                        setChatInput(cmd);
                        setTimeout(() => document.getElementById("chatbot-submit-btn")?.click(), 50);
                      }}
                      className="bg-[#25d366] text-white px-3 py-1.5 rounded font-bold hover:bg-[#16c47f] flex-1 text-center transition"
                    >
                      Submit
                    </button>
                    <button onClick={() => setShowRegForm(false)} className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded font-bold hover:bg-slate-200 transition">
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Suggestion Chips */}
          <div className="bg-[#efeae2] px-3 pb-2.5 flex space-x-1.5 overflow-x-auto shrink-0 scrollbar-thin select-none">
            {[
              { label: "ℹ️ Help", cmd: "help", autoSubmit: true },
              { label: "🆕 Register", cmd: "aa Register [Your Name] phone [Your Phone Number] agency [Your Agency Name] location [Area] interested in [Property Types]", autoSubmit: false },
              { label: "🆕 Add Lead", cmd: "add lead [Name] phone [Number] location [Area] budget [Price]", autoSubmit: false },
              { label: "🔍 Search", cmd: "Search [Location/BHK/Type]", autoSubmit: false },
              { label: "⏰ Set Reminder", cmd: "Remind me to call [Name] time [Date/Time]", autoSubmit: false },
              { label: "📁 Get Brochure", cmd: "Send [Project Name] brochure", autoSubmit: false },
              { label: "🚀 Upcoming Launches", cmd: "Upcoming launches", autoSubmit: true },
              { label: "🎥 Register Webinar", cmd: "Register webinar", autoSubmit: true },
              { label: "📋 My Leads", cmd: "my leads", autoSubmit: true },
              { label: "⚡ Update Status", cmd: "[Lead Name] site visit", autoSubmit: false }
            ].map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  if (item.label.includes("Register") && !item.label.includes("Webinar")) {
                    setShowRegForm(true);
                    setTimeout(() => {
                      if (chatBodyRef.current) {
                        chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
                      }
                    }, 50);
                    return;
                  }

                  setChatInput(item.cmd);
                  
                  if (item.autoSubmit !== false) {
                    setTimeout(() => {
                      document.getElementById("chatbot-submit-btn")?.click();
                    }, 50);
                  } else {
                    setTimeout(() => {
                      document.getElementById("chatbot-input-field")?.focus();
                    }, 50);
                  }
                }}
                className="bg-white/95 active:bg-slate-200 border border-slate-200/60 text-slate-700 text-[9px] font-bold py-1.5 px-3 rounded-full whitespace-nowrap shadow-sm transition hover:scale-105 shrink-0"
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Chat Footer Input */}
          <form onSubmit={handleSendChat} className="p-2 bg-[#f0f2f5] border-t border-slate-200 flex items-center space-x-2 shrink-0">
            <input 
              id="chatbot-input-field"
              type="text"
              placeholder="e.g. add lead Ravi 3BHK"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="flex-1 bg-white border border-slate-200 rounded-full py-2 px-3 text-[11px] text-slate-800 outline-none focus:border-[#25d366] transition shadow-inner"
            />
            <button 
              id="chatbot-submit-btn"
              type="submit"
              className="w-8 h-8 rounded-full bg-[#25d366] text-white flex items-center justify-center text-xs font-bold shrink-0 hover:bg-[#16c47f] shadow-sm transition"
            >
              ➔
            </button>
          </form>
        </div>
      )}
    </>
  );
}
