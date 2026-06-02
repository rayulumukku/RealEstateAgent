"use client";

import { useState, useEffect } from "react";
import { 
  Megaphone, Smartphone, HelpCircle, FileText, 
  Plus, Check, Sparkles, Send, AlertTriangle, Calendar, MapPin, X, Users
} from "lucide-react";
import Link from "next/link";
import { launchCampaignAction } from "./actions";
import { HYDERABAD_LOCATIONS } from "@/lib/hyderabadLocations";
import { supabase } from "@/lib/supabase";

export default function CampaignBuilder() {
  const [campaignName, setCampaignName] = useState("Skyline Heights Launch");
  const [filters, setFilters] = useState(["Verified Agents"]);
  const [message, setMessage] = useState(
    "Dear Partner,\n\nJoin us for the exclusive launch of Skyline Heights on 30th May at 11:00 AM at Kokapet, Hyderabad.\n\nExciting offers and high commission structures await you!\n\nLimited seats, RSVP now."
  );
  const [eventDate, setEventDate] = useState("30th May 2026, 11:00 AM");
  const [eventLocation, setEventLocation] = useState("Kokapet, Hyderabad");
  const [attachedFile, setAttachedFile] = useState("Skyline_Heights_Brochure.pdf");
  const [newFilter, setNewFilter] = useState("");
  const [sending, setSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);
  const [sentCount, setSentCount] = useState(0);

  // Location-based filtering
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [locationSearch, setLocationSearch] = useState("");
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [estimatedReach, setEstimatedReach] = useState(0);

  // Audience filters options from schema spec
  const [verifyFilter, setVerifyFilter] = useState(true);

  useEffect(() => {
    fetchEstimatedReach();
  }, [selectedLocations]);

  async function fetchEstimatedReach() {
    try {
      let query = supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "agent")
        .eq("status", "approved");

      if (selectedLocations.length > 0) {
        query = query.in("location", selectedLocations);
      }

      const { count } = await query;
      setEstimatedReach(count || 0);
    } catch {
      setEstimatedReach(0);
    }
  }

  const handleAddFilter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFilter) return;
    setFilters([...filters, newFilter]);
    setNewFilter("");
  };

  const handleRemoveFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  const toggleLocation = (loc: string) => {
    setSelectedLocations((prev) =>
      prev.includes(loc) ? prev.filter((l) => l !== loc) : [...prev, loc]
    );
  };

  const filteredLocations = HYDERABAD_LOCATIONS.filter((loc) =>
    loc.toLowerCase().includes(locationSearch.toLowerCase())
  );

  const handleLaunchCampaign = async () => {
    setSending(true);
    
    const phone = localStorage.getItem("agentsapp_logged_in_phone") || "";
    const audienceStr = selectedLocations.length > 0 
      ? `Locations: ${selectedLocations.join(", ")} - ${filters.join(", ")}`
      : `All Hyderabad - ${filters.join(", ")}`;

    const res = await launchCampaignAction(
      phone,
      campaignName,
      audienceStr,
      "Rich Media",
      eventDate,
      eventLocation,
      message,
      selectedLocations.length > 0 ? selectedLocations : undefined
    );

    setSending(false);
    
    if (res.ok) {
      setSentSuccess(true);
      setSentCount(res.sentCount || 0);
      setTimeout(() => {
        setSentSuccess(false);
      }, 5000);
    } else {
      alert("Failed to launch campaign: " + res.error);
    }
  };

  return (
    <div className="space-y-6 text-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Campaign Studio</h1>
          <p className="text-[#64748b] text-xs font-semibold mt-0.5">Broadcast WhatsApp templates to agents filtered by location.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Form Panel */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 space-y-6 shadow-sm">
          
          {/* Package Limit Meter */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex justify-between items-center text-xs font-bold text-slate-500">
              <span className="uppercase tracking-wider">Package Quota Usage</span>
              <span className="text-slate-800">12 / 15 Campaigns</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
              <div className="bg-indigo-500 h-full" style={{ width: "80%" }}></div>
            </div>
            
            <div className="p-2 bg-amber-50 rounded border border-amber-200 text-[10px] text-amber-700 flex items-center space-x-1.5 font-bold">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Overage Alert: Additional broadcasts will be charged at ₹0.50 per msg.</span>
            </div>
          </div>

          <form className="space-y-4 text-xs font-semibold text-slate-400">
            {/* Campaign Name */}
            <div className="space-y-1.5">
              <label className="block uppercase tracking-wider text-[10px]">Campaign Name</label>
              <input 
                type="text" 
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="e.g. Skyline Heights Launch"
                className="w-full bg-slate-50 border border-slate-200 focus:border-[#25d366] rounded-xl py-2.5 px-3 text-slate-800 outline-none text-sm font-medium transition"
              />
            </div>

            {/* Location-Based Agent Filter */}
            <div className="space-y-2">
              <label className="block uppercase tracking-wider text-[10px]">
                Filter Agents by Location (Hyderabad Areas)
              </label>
              <p className="text-[10px] text-slate-400 -mt-1">
                Select specific areas — only agents from these locations will receive the invitation.
                Leave empty to send to ALL agents.
              </p>

              {/* Selected Locations Tags */}
              {selectedLocations.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {selectedLocations.map((loc) => (
                    <span key={loc} className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200 text-[11px] font-bold">
                      <MapPin className="w-3 h-3" />
                      <span>{loc}</span>
                      <button 
                        type="button" 
                        onClick={() => toggleLocation(loc)}
                        className="text-indigo-400 hover:text-indigo-600 ml-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <button 
                    type="button"
                    onClick={() => setSelectedLocations([])}
                    className="text-[10px] text-red-500 hover:text-red-700 font-bold uppercase tracking-wider px-2 py-1"
                  >
                    Clear All
                  </button>
                </div>
              )}

              {/* Location Search & Dropdown */}
              <div className="relative">
                <input
                  type="text"
                  value={locationSearch}
                  onChange={(e) => { setLocationSearch(e.target.value); setShowLocationDropdown(true); }}
                  onFocus={() => setShowLocationDropdown(true)}
                  placeholder="Search area... (e.g. Madhapur, Gachibowli, Kokapet)"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl py-2.5 px-3 text-slate-800 outline-none text-xs font-medium transition"
                />
                {showLocationDropdown && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {filteredLocations.length === 0 ? (
                      <div className="p-3 text-xs text-slate-400">No areas found</div>
                    ) : (
                      filteredLocations.map((loc) => (
                        <button
                          key={loc}
                          type="button"
                          onClick={() => { toggleLocation(loc); setLocationSearch(""); }}
                          className={`w-full text-left px-3 py-2 text-xs font-medium hover:bg-slate-50 transition flex items-center justify-between ${
                            selectedLocations.includes(loc) ? "bg-indigo-50 text-indigo-700" : "text-slate-700"
                          }`}
                        >
                          <span className="flex items-center space-x-2">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span>{loc}</span>
                          </span>
                          {selectedLocations.includes(loc) && (
                            <Check className="w-3.5 h-3.5 text-indigo-600" />
                          )}
                        </button>
                      ))
                    )}
                    <button
                      type="button"
                      onClick={() => setShowLocationDropdown(false)}
                      className="w-full text-center py-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider border-t border-slate-100 hover:bg-slate-50"
                    >
                      Close
                    </button>
                  </div>
                )}
              </div>

              {/* Estimated Reach */}
              <div className="flex items-center space-x-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                <Users className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-emerald-700">
                  Estimated Reach: {estimatedReach} agent{estimatedReach !== 1 ? "s" : ""}
                  {selectedLocations.length > 0 ? ` in ${selectedLocations.length} area${selectedLocations.length !== 1 ? "s" : ""}` : " (all areas)"}
                </span>
              </div>
            </div>

            {/* Additional Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-600">
              <div className="space-y-1.5 pt-1">
                <label className="flex items-center space-x-2 cursor-pointer font-bold">
                  <input 
                    type="checkbox" 
                    checked={verifyFilter} 
                    onChange={(e) => setVerifyFilter(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <span>Verified Agents Only</span>
                </label>
              </div>
            </div>

            {/* Specific Filters */}
            <div className="space-y-1.5">
              <label className="block uppercase tracking-wider text-[10px]">Additional Tags</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {filters.map((f, i) => (
                  <span key={i} className="inline-flex items-center space-x-1.5 px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200">
                    <span>{f}</span>
                    <button 
                      type="button" 
                      onClick={() => handleRemoveFilter(i)}
                      className="text-indigo-400 hover:text-indigo-600"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              
              <div className="flex gap-2">
                <input 
                  type="text"
                  placeholder="e.g. Kokapet specialist"
                  value={newFilter}
                  onChange={(e) => setNewFilter(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-200 focus:border-[#25d366] rounded-xl py-2 px-3 text-slate-800 outline-none text-xs font-medium transition"
                />
                <button 
                  type="button"
                  onClick={handleAddFilter}
                  className="px-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition text-xs font-bold"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Event Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block uppercase tracking-wider text-[10px]">Event Date & Time</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <Calendar className="w-4 h-4 text-slate-400" />
                  </div>
                  <input 
                    type="text" 
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    placeholder="e.g. 30th May, 11:00 AM"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-[#25d366] rounded-xl py-2.5 pl-9 pr-3 text-slate-800 outline-none text-sm font-medium transition"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block uppercase tracking-wider text-[10px]">Event Location</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <MapPin className="w-4 h-4 text-slate-400" />
                  </div>
                  <input 
                    type="text" 
                    value={eventLocation}
                    onChange={(e) => setEventLocation(e.target.value)}
                    placeholder="e.g. Kokapet, Hyderabad"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-[#25d366] rounded-xl py-2.5 pl-9 pr-3 text-slate-800 outline-none text-sm font-medium transition"
                  />
                </div>
              </div>
            </div>

            {/* Message Body Template */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center mb-1">
                <label className="uppercase tracking-wider text-[10px]">Message Template Copy</label>
                <span className="text-[10px] text-[#16c47f] font-bold flex items-center space-x-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>AI Helper (Hinglish)</span>
                </span>
              </div>
              <textarea 
                rows={6}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write your campaign details..."
                className="w-full bg-slate-50 border border-slate-200 focus:border-[#25d366] rounded-xl py-2.5 px-3 text-slate-800 outline-none text-sm font-medium transition"
              />
            </div>

            {/* Attachment */}
            <div className="space-y-1.5">
              <label className="block uppercase tracking-wider text-[10px]">Attached Project Brochure</label>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div className="flex items-center space-x-2 text-slate-700">
                  <FileText className="w-5 h-5 text-indigo-500 shrink-0" />
                  <span className="text-xs font-bold">{attachedFile || "No file attached"}</span>
                </div>
                <button 
                  type="button" 
                  onClick={() => setAttachedFile(attachedFile ? "" : "Skyline_Heights_Brochure.pdf")}
                  className="text-[10px] hover:text-[#16c47f] font-bold"
                >
                  {attachedFile ? "Remove" : "Attach File"}
                </button>
              </div>
            </div>

            {/* Success Notification Banner */}
            {sentSuccess && (
              <div className="p-4 bg-brand-green/10 border border-[#25d366]/30 rounded-xl text-[#16c47f] text-xs flex items-center space-x-2">
                <Check className="w-4 h-4" />
                <span>Campaign &ldquo;{campaignName}&rdquo; launched to {sentCount} agents!</span>
              </div>
            )}

            {/* Actions */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-[9px] text-slate-400 uppercase tracking-wider">Filtered Reach</div>
                <div className="text-sm font-extrabold text-slate-900">{estimatedReach} Agents</div>
              </div>

              <div className="flex gap-2 text-sm font-bold">
                <Link href="/builder/dashboard" className="px-4 py-2.5 bg-transparent text-slate-500 hover:text-slate-800 rounded-xl transition flex items-center">
                  Cancel
                </Link>
                <button 
                  type="button"
                  onClick={handleLaunchCampaign}
                  disabled={sending}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition flex items-center space-x-2"
                >
                  {sending ? "Sending..." : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Launch Campaign</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Right Phone Mockup Panel */}
        <div className="lg:col-span-5 flex justify-center">
          <div className="w-[300px] h-[580px] rounded-[40px] border-[6px] border-slate-800 bg-[#07090e] shadow-2xl overflow-hidden relative flex flex-col shrink-0">
            {/* Phone Notch */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-5 bg-slate-850 rounded-b-xl z-20"></div>

            {/* Header */}
            <div className="bg-[#075e54] pt-7 pb-2.5 px-4 flex items-center space-x-2 text-white shrink-0">
              <div className="w-7 h-7 rounded-full bg-[#128c7e] flex items-center justify-center font-bold text-xs">
                🏢
              </div>
              <div>
                <div className="font-bold text-[10px]">Builder Broadcast</div>
                <div className="text-[7px] text-[#4ade80]">
                  {selectedLocations.length > 0 ? `To: ${selectedLocations.slice(0, 3).join(", ")}${selectedLocations.length > 3 ? "..." : ""}` : "To: All Agents"}
                </div>
              </div>
            </div>

            {/* Chat Body */}
            <div className="flex-1 p-3 overflow-y-auto bg-[#efeae2] text-[10px] space-y-3">
              <div className="flex flex-col items-start">
                <div className="max-w-[90%] rounded-xl p-2.5 bg-white text-slate-800 rounded-tl-none shadow-sm space-y-2">
                  
                  {/* Rich file attachment */}
                  {attachedFile && (
                    <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-[9px] text-slate-500">
                      <div className="flex items-center space-x-1.5">
                        <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                        <span className="truncate max-w-[120px] font-bold">{attachedFile}</span>
                      </div>
                      <span className="shrink-0 text-slate-400 text-[8px]">PDF</span>
                    </div>
                  )}

                  {/* Message body */}
                  <div className="whitespace-pre-line leading-relaxed">
                    {message || "Drafting message preview..."}
                  </div>

                  {/* Template replies */}
                  <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1.5">
                    <button type="button" className="w-full py-1.5 text-center font-bold text-[9px] text-brand-green-hover bg-slate-50 border border-slate-200 rounded hover:bg-slate-100 transition">
                      RSVP Now
                    </button>
                    <button type="button" className="w-full py-1.5 text-center font-bold text-[9px] text-brand-green-hover bg-slate-50 border border-slate-200 rounded hover:bg-slate-100 transition">
                      View Details
                    </button>
                  </div>
                </div>
                <span className="text-[8px] text-slate-400 mt-1 px-1 font-semibold">19:25</span>
              </div>
            </div>

            {/* Footer */}
            <div className="p-2 bg-[#f0f2f5] text-[8px] text-center text-slate-500 shrink-0 border-t border-slate-200">
              ⚡ GallaBox WhatsApp API Template Preview
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
