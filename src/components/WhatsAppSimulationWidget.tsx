"use client";

import { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Calendar } from "lucide-react";
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
  
  // Add Lead Form State
  const [showAddLeadForm, setShowAddLeadForm] = useState(false);
  const [addLeadName, setAddLeadName] = useState("");
  const [addLeadPhone, setAddLeadPhone] = useState("");
  const [addLeadLocation, setAddLeadLocation] = useState("");
  const [addLeadBudget, setAddLeadBudget] = useState("");

  const [showDocsMenu, setShowDocsMenu] = useState(false);
  const chatBodyRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const fileName = file.name;
    const isImage = file.type.startsWith("image/");
    const msgType = isImage ? "image" : "document";

    setChatHistory(prev => [...prev, `👤 You: [Sent a ${msgType}: ${fileName}]`]);

    try {
      let rawPhone = localStorage.getItem("agentsapp_logged_in_phone");
      if (!rawPhone) {
        let simPhone = localStorage.getItem("agentsapp_sim_phone");
        if (!simPhone) {
          const randomNum = Math.floor(10000000 + Math.random() * 90000000);
          simPhone = `+91 99${randomNum}`;
          localStorage.setItem("agentsapp_sim_phone", simPhone);
        }
        rawPhone = simPhone;
      }
      
      const cleanPhone = rawPhone.replace(/\D/g, "");

      // Actually upload the file to Supabase via our new simulator upload API
      const formData = new FormData();
      formData.append("file", file);
      formData.append("phone", cleanPhone);

      const uploadRes = await fetch("/api/upload-simulator", {
        method: "POST",
        body: formData,
      });
      const uploadData = await uploadRes.json();

      if (!uploadRes.ok || !uploadData.url) {
        throw new Error(uploadData.error || "Upload failed");
      }

      const fileUrl = uploadData.url;

      const messagePayload: any = {
        from: cleanPhone,
        id: `wamid.sandbox_${Date.now()}`,
        timestamp: Math.floor(Date.now() / 1000).toString(),
        type: msgType
      };

      if (isImage) {
        messagePayload.image = { link: fileUrl, caption: fileName };
      } else {
        messagePayload.document = { link: fileUrl, filename: fileName };
      }

      const userName = localStorage.getItem("agentsapp_logged_in_user") || "Visitor";

      const response = await fetch("/api/whatsapp/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          object: "whatsapp_business_account",
          entry: [{
            id: "sandbox-entry",
            changes: [{
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: { display_phone_number: "919999999999", phone_number_id: "bot-phone-id" },
                contacts: [{ profile: { name: userName }, wa_id: cleanPhone }],
                messages: [messagePayload]
              }
            }]
          }]
        })
      });

      const data = await response.json();
      const rawReply = data.reply || "File processed successfully.";
      const botReply = rawReply.startsWith("🤖") ? rawReply : `🤖 Bot: ${rawReply}`;
      setChatHistory(prev => [...prev, botReply]);

      // Reset file input
      e.target.value = '';
    } catch (err: any) {
      setChatHistory(prev => [...prev, `🤖 Bot: ❌ Failed to send file: ${err.message}`]);
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

            {showAddLeadForm && (
              <div className="flex flex-col items-start mt-2">
                <div className="max-w-[95%] bg-white text-slate-800 rounded-lg rounded-tl-none border border-slate-200 p-3 shadow-sm w-full space-y-2.5">
                  <div className="font-bold text-xs text-[#25d366] pb-1 border-b border-slate-100">Add New Lead</div>
                  
                  <div className="w-full">
                    <label className="text-[10px] text-slate-500 font-bold mb-0.5 block">Lead Name</label>
                    <input type="text" placeholder="e.g. Ravi" value={addLeadName} onChange={e => setAddLeadName(e.target.value)} className="w-full border border-slate-200 rounded-md p-1.5 text-xs outline-none focus:border-[#25d366]" />
                  </div>
                  
                  <div className="w-full">
                    <label className="text-[10px] text-slate-500 font-bold mb-0.5 block">Phone Number</label>
                    <input type="text" placeholder="e.g. 9876543210" value={addLeadPhone} onChange={e => setAddLeadPhone(e.target.value)} className="w-full border border-slate-200 rounded-md p-1.5 text-xs outline-none focus:border-[#25d366]" />
                  </div>
                  
                  <div className="flex space-x-2 w-full">
                    <div className="flex-1">
                      <label className="text-[10px] text-slate-500 font-bold mb-0.5 block">Location</label>
                      <input type="text" placeholder="e.g. Kokapet" value={addLeadLocation} onChange={e => setAddLeadLocation(e.target.value)} className="w-full border border-slate-200 rounded-md p-1.5 text-xs outline-none focus:border-[#25d366]" />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] text-slate-500 font-bold mb-0.5 block">Budget</label>
                      <input type="text" placeholder="e.g. 2Cr" value={addLeadBudget} onChange={e => setAddLeadBudget(e.target.value)} className="w-full border border-slate-200 rounded-md p-1.5 text-xs outline-none focus:border-[#25d366]" />
                    </div>
                  </div>

                  <div className="flex space-x-2 pt-1.5">
                    <button 
                      onClick={() => {
                        if (!addLeadName || !addLeadPhone || !addLeadLocation || !addLeadBudget) {
                          alert("Name, Phone, Location, and Budget are all required");
                          return;
                        }
                        if (addLeadPhone.replace(/\D/g, "").length < 10) {
                          alert("Please enter a valid 10-digit phone number");
                          return;
                        }
                        setShowAddLeadForm(false);
                        const cmd = `add lead ${addLeadName} phone ${addLeadPhone} location ${addLeadLocation} budget ${addLeadBudget}`;
                        setChatInput(cmd);
                        setTimeout(() => document.getElementById("chatbot-submit-btn")?.click(), 50);
                        
                        // Reset form
                        setAddLeadName("");
                        setAddLeadPhone("");
                        setAddLeadLocation("");
                        setAddLeadBudget("");
                      }}
                      className="bg-[#25d366] text-white px-3 py-1.5 rounded font-bold hover:bg-[#16c47f] flex-1 text-center transition"
                    >
                      Add Lead
                    </button>
                    <button onClick={() => setShowAddLeadForm(false)} className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded font-bold hover:bg-slate-200 transition">
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
              { label: "🆕 Add Lead", cmd: "add a client ", autoSubmit: false },
              { label: "🔍 Search Properties", cmd: "search for a 3bhk flat in kompally", autoSubmit: true },
              { label: "🏢 Search Projects", cmd: "find projects by myhome", autoSubmit: true },
              { label: "⏰ Reminders", cmd: "reminders", autoSubmit: true },
              { label: "⏰ Set Reminder", cmd: "Remind me to call  time ", autoSubmit: false },
              { label: "📁 Get Brochure", cmd: "Send ProjectName brochure", autoSubmit: false },
              { label: "📋 My Leads", cmd: "my leads", autoSubmit: true },
              { label: "📍 Leads in Kokapet", cmd: "my leads in kokapet", autoSubmit: true },
              { label: "💰 Leads under 2Cr", cmd: "my leads under 2cr", autoSubmit: true }
            ].map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  if (item.label.includes("Register") && !item.label.includes("Webinar")) {
                    setShowRegForm(true);
                    setShowAddLeadForm(false);
                    setTimeout(() => {
                      if (chatBodyRef.current) {
                        chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
                      }
                    }, 50);
                    return;
                  }



                  if (item.label.includes("Set Reminder")) {
                    setChatInput("Remind me to  time ");
                    setTimeout(() => {
                      try {
                        const picker = document.getElementById("bot-datetime-picker") as HTMLInputElement;
                        if (picker && typeof picker.showPicker === 'function') {
                          picker.showPicker();
                        } else if (picker) {
                          picker.click();
                        }
                      } catch (e) {
                        console.error(e);
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
          <form onSubmit={handleSendChat} className="p-2 bg-[#f0f2f5] border-t border-slate-200 flex items-center space-x-2 shrink-0 relative">
            <input 
              type="file" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={(e) => {
                setShowDocsMenu(false);
                handleFileUpload(e);
              }}
              accept="image/*,.pdf,.doc,.docx"
            />
            
            {showDocsMenu && (
              <div className="absolute bottom-12 left-2 bg-white border border-slate-200 rounded-lg shadow-xl w-40 overflow-hidden z-20 animate-in fade-in slide-in-from-bottom-2">
                <button 
                  type="button" 
                  onClick={() => {
                    setShowDocsMenu(false);
                    setChatInput("my docs");
                    setTimeout(() => document.getElementById("chatbot-submit-btn")?.click(), 50);
                  }}
                  className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 border-b border-slate-100 font-medium"
                >
                  📄 View Documents
                </button>
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 font-medium"
                >
                  📤 Upload File
                </button>
              </div>
            )}

            <button 
              type="button" 
              onClick={() => setShowDocsMenu(!showDocsMenu)}
              className="px-3 h-8 rounded-full bg-white text-slate-600 hover:text-slate-800 text-[11px] font-bold shrink-0 shadow-sm transition border border-slate-200"
            >
              Documents
            </button>
            <div className="relative shrink-0 flex items-center justify-center">
              <button 
                type="button" 
                title="Pick Date & Time"
                className="w-8 h-8 rounded-full bg-white text-slate-600 hover:text-slate-800 flex items-center justify-center shadow-sm transition border border-slate-200"
              >
                <Calendar className="w-3.5 h-3.5" />
              </button>
              <input 
                id="bot-datetime-picker"
                type="datetime-local" 
                title="Pick Date & Time"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) return;
                  const d = new Date(val);
                  const formatted = d.toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
                  if (!chatInput.toLowerCase().includes("time")) {
                    setChatInput(prev => prev ? `${prev} time ${formatted}` : `Remind me to  time ${formatted}`);
                  } else {
                    setChatInput(prev => `${prev.trim()} ${formatted}`);
                  }
                  e.target.value = ''; // Reset so they can select the same date again if needed
                }}
              />
            </div>
            <input 
              id="chatbot-input-field"
              type="text"
              placeholder="e.g. add lead Ravi 3BHK"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onClick={() => setShowDocsMenu(false)}
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
