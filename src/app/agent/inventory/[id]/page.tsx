"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft, MapPin, BadgeCheck, FileText,
  Share2, CheckCircle2, ChevronRight, Building,
  X, Grid, ShieldCheck,
} from "lucide-react";

interface Unit {
  unitNumber: string;
  bhk: string;
  sqft: number;
  price: string;
  status: "Available" | "Blocked" | "Sold";
  facing: string;
}

interface ProjectDetail {
  id: string;
  name: string;
  location: string;
  city: string;
  builder: string;
  rera: string;
  priceRange: string;
  startingPrice: string;
  config: string;
  possession: string;
  totalLand: string;
  structures: string;
  overview: string;
  amenities: string[];
  floorplans: { name: string; size: string; rooms: string }[];
  pricing: { configuration: string; size: string; price: string }[];
  units: Unit[];
}

// Project catalogue keyed by the same ids used on the inventory list page.
// This will be replaced with a Supabase query in a follow-up PR; for now
// the detail screen at least respects the id from the URL.
const PROJECTS: Record<string, ProjectDetail> = {
  "skyline-heights": {
    id: "skyline-heights",
    name: "Skyline Heights",
    location: "Kokapet",
    city: "Hyderabad",
    builder: "Prestige Group",
    rera: "P02400003512",
    priceRange: "₹1.82 Cr - ₹2.75 Cr",
    startingPrice: "₹1.82 Cr*",
    config: "3 & 4 BHK",
    possession: "Dec 2026",
    totalLand: "8.5 Acres",
    structures: "4 Towers (G+32)",
    overview:
      "Skyline Heights in Kokapet, Hyderabad is a premium gated community designed for modern luxury living. Featuring high-end 3 and 4 BHK residential apartments, the development offers world-class amenities, excellent connectivity to the financial district, and gorgeous views of the Gandipet lake. Built using advanced Mivan technology for superior construction quality.",
    amenities: [
      "Clubhouse", "Swimming Pool", "Gymnasium", "Children Play Area",
      "24/7 Multi-tier Security", "100% Power Backup", "Indoor Games Room",
      "Jogging Track", "Multipurpose Hall", "Landscaped Gardens",
    ],
    floorplans: [
      { name: "3 BHK Type A", size: "1850 Sqft", rooms: "3 BHK + 3 Baths" },
      { name: "3 BHK Type B", size: "2150 Sqft", rooms: "3 BHK + 3 Baths + Servant" },
      { name: "4 BHK Type A", size: "2600 Sqft", rooms: "4 BHK + 4 Baths + Home Theatre" },
    ],
    pricing: [
      { configuration: "3 BHK", size: "1850 Sqft", price: "₹1.82 Cr Onwards" },
      { configuration: "3 BHK + Lounge", size: "2150 Sqft", price: "₹2.12 Cr Onwards" },
      { configuration: "4 BHK", size: "2600 Sqft", price: "₹2.55 Cr Onwards" },
    ],
    units: [
      { unitNumber: "A-302", bhk: "3 BHK", sqft: 1850, price: "₹1.82 Cr", status: "Available", facing: "East" },
      { unitNumber: "A-504", bhk: "3 BHK", sqft: 1850, price: "₹1.84 Cr", status: "Available", facing: "West" },
      { unitNumber: "A-801", bhk: "3 BHK", sqft: 2150, price: "₹2.15 Cr", status: "Blocked", facing: "North" },
      { unitNumber: "B-204", bhk: "4 BHK", sqft: 2600, price: "₹2.55 Cr", status: "Available", facing: "East" },
      { unitNumber: "B-1202", bhk: "4 BHK", sqft: 2600, price: "₹2.62 Cr", status: "Sold", facing: "North-East" },
    ],
  },
  "green-meadows": {
    id: "green-meadows",
    name: "Green Meadows Plots",
    location: "Gachibowli",
    city: "Hyderabad",
    builder: "GMR Infra",
    rera: "P02400004210",
    priceRange: "₹1.40 Cr - ₹1.95 Cr",
    startingPrice: "₹1.40 Cr*",
    config: "Open Plots",
    possession: "Ready",
    totalLand: "12 Acres",
    structures: "Gated layout, 84 plots",
    overview:
      "Green Meadows is a fully-developed plotted layout in Gachibowli with concrete roads, perimeter fencing, underground electrical cabling, and 24/7 security. Located 6 km from the Financial District, with multiple corner and east-facing options available.",
    amenities: [
      "Concrete Roads", "Underground Electricity", "Perimeter Fencing",
      "24/7 Security", "Children's Park", "Avenue Plantation",
    ],
    floorplans: [
      { name: "200 Sq Yards", size: "1800 Sqft", rooms: "Standard plot" },
      { name: "267 Sq Yards", size: "2400 Sqft", rooms: "Premium plot" },
      { name: "333 Sq Yards", size: "3000 Sqft", rooms: "Corner plot" },
    ],
    pricing: [
      { configuration: "200 Sq Yards", size: "1800 Sqft", price: "₹1.40 Cr Onwards" },
      { configuration: "267 Sq Yards", size: "2400 Sqft", price: "₹1.65 Cr Onwards" },
      { configuration: "333 Sq Yards", size: "3000 Sqft", price: "₹1.95 Cr Onwards" },
    ],
    units: [
      { unitNumber: "Plot 18", bhk: "Plot", sqft: 3000, price: "₹1.95 Cr", status: "Available", facing: "North" },
      { unitNumber: "Plot 42", bhk: "Plot", sqft: 2400, price: "₹1.65 Cr", status: "Available", facing: "East" },
      { unitNumber: "Plot 51", bhk: "Plot", sqft: 1800, price: "₹1.40 Cr", status: "Blocked", facing: "South" },
    ],
  },
  "luxury-haven": {
    id: "luxury-haven",
    name: "Prestige Villa Haven",
    location: "Jubilee Hills",
    city: "Hyderabad",
    builder: "Prestige Group",
    rera: "P02400005891",
    priceRange: "₹4.50 Cr - ₹7.20 Cr",
    startingPrice: "₹4.50 Cr*",
    config: "4 & 5 BHK Villas",
    possession: "Mar 2027",
    totalLand: "5.2 Acres",
    structures: "24 Independent Villas",
    overview:
      "Ultra-luxury villas in Jubilee Hills with private pools, smart home automation, and 4200+ sqft built-up areas. Each villa includes a private garden, dedicated lift, and home theatre.",
    amenities: [
      "Private Pool per Villa", "Smart Home Automation", "Dedicated Villa Lift",
      "Home Theatre", "Private Garden", "Concierge Services",
    ],
    floorplans: [
      { name: "4 BHK Villa", size: "4200 Sqft", rooms: "4 BHK + 5 Baths + Theatre" },
      { name: "5 BHK Villa", size: "5800 Sqft", rooms: "5 BHK + 6 Baths + Pool" },
    ],
    pricing: [
      { configuration: "4 BHK Villa", size: "4200 Sqft", price: "₹4.50 Cr Onwards" },
      { configuration: "5 BHK Villa", size: "5800 Sqft", price: "₹7.20 Cr Onwards" },
    ],
    units: [
      { unitNumber: "Villa 04", bhk: "4 BHK", sqft: 4200, price: "₹4.50 Cr", status: "Available", facing: "East" },
      { unitNumber: "Villa 11", bhk: "5 BHK", sqft: 5800, price: "₹7.20 Cr", status: "Blocked", facing: "North" },
      { unitNumber: "Villa 18", bhk: "5 BHK", sqft: 5800, price: "₹7.40 Cr", status: "Sold", facing: "East" },
    ],
  },
  "hitech-square": {
    id: "hitech-square",
    name: "Hitech Square Commercial",
    location: "Hitech City",
    city: "Hyderabad",
    builder: "L&T Realty",
    rera: "P02400007021",
    priceRange: "₹5.50 Cr - ₹12.00 Cr",
    startingPrice: "₹5.50 Cr*",
    config: "Office Floors & Retail",
    possession: "Sep 2026",
    totalLand: "3.8 Acres",
    structures: "1 Tower (G+22) + Retail Podium",
    overview:
      "Grade-A commercial tower in the heart of Hitech City with 60-foot frontage, 25 dedicated parking bays per floor, LEED Gold certification, and high-speed elevators.",
    amenities: [
      "Grade-A Lobby", "25 Parking Bays / Floor", "LEED Gold Certified",
      "High-speed Elevators", "Backup Power", "F&B Podium",
    ],
    floorplans: [
      { name: "Office Floor", size: "12,000 Sqft", rooms: "Open-plan office" },
      { name: "Retail Unit", size: "1,200 Sqft", rooms: "Ground-floor retail" },
    ],
    pricing: [
      { configuration: "Retail Unit", size: "1,200 Sqft", price: "₹5.50 Cr Onwards" },
      { configuration: "Office Floor", size: "12,000 Sqft", price: "₹12.00 Cr Onwards" },
    ],
    units: [
      { unitNumber: "GF-04", bhk: "Retail", sqft: 1200, price: "₹5.50 Cr", status: "Available", facing: "East" },
      { unitNumber: "L-08", bhk: "Office Floor", sqft: 12000, price: "₹12.00 Cr", status: "Available", facing: "North" },
    ],
  },
};

export default function ProjectDetails() {
  const params = useParams();
  const id = (params?.id as string) || "";

  const [activeTab, setActiveTab] = useState<"overview" | "amenities" | "floorplans" | "pricing">("overview");
  const [showUnitsModal, setShowUnitsModal] = useState(false);

  const project = PROJECTS[id];

  // Graceful fallback when the id is unknown — no more silently-wrong page.
  if (!project) {
    return (
      <div className="space-y-6 text-slate-800">
        <div>
          <Link
            href="/agent/inventory"
            className="inline-flex items-center space-x-2 text-slate-400 hover:text-slate-700 transition text-xs font-bold uppercase tracking-wider"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Search</span>
          </Link>
        </div>
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-500">
          <Building className="w-6 h-6 mx-auto mb-3 text-slate-400" />
          <div className="font-bold text-slate-800">Project not found</div>
          <p className="text-xs mt-1">
            We could not find a project with id <code className="px-1.5 py-0.5 rounded bg-slate-100">{id || "(none)"}</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-800">

      {/* Back button */}
      <div>
        <Link
          href="/agent/inventory"
          className="inline-flex items-center space-x-2 text-slate-400 hover:text-slate-700 transition text-xs font-bold uppercase tracking-wider"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Search</span>
        </Link>
      </div>

      {/* Project Header Title & Status */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center space-x-3 mb-1.5">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{project.name}</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-[#25d366]/10 text-[#16c47f] text-[9px] font-bold uppercase tracking-wider flex items-center border border-[#25d366]/20">
              <BadgeCheck className="w-3.5 h-3.5 mr-1" />
              <span>RERA Approved</span>
            </span>
          </div>
          <p className="text-slate-500 text-xs flex items-center font-semibold">
            <MapPin className="w-4 h-4 text-slate-400 mr-1" />
            <span>{project.location}, {project.city} · RERA: {project.rera}</span>
          </p>
        </div>

        <button className="px-4 py-2 bg-white border border-slate-250 hover:bg-slate-50 text-slate-700 rounded-xl flex items-center space-x-1.5 text-xs font-bold transition">
          <Share2 className="w-4 h-4" />
          <span>Share details</span>
        </button>
      </div>

      {/* Main Core Panel Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left - Hero Image */}
        <div className="lg:col-span-8 space-y-4">
          <div className="w-full h-80 md:h-[350px] rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-8xl shadow-sm relative select-none">
            🏢
            <div className="absolute bottom-4 left-4 bg-slate-900/80 text-white px-3.5 py-1.5 rounded-lg text-[10px] font-bold">
              Front elevation image template
            </div>
          </div>

          {/* Gallery thumbs */}
          <div className="grid grid-cols-4 gap-3">
            <div className="h-14 rounded-xl border-2 border-[#25d366] bg-white flex items-center justify-center text-xl select-none cursor-pointer">🏢</div>
            <div className="h-14 rounded-xl border border-slate-200 bg-white hover:border-slate-350 flex items-center justify-center text-xl select-none cursor-pointer">🏊</div>
            <div className="h-14 rounded-xl border border-slate-200 bg-white hover:border-slate-350 flex items-center justify-center text-xl select-none cursor-pointer">💪</div>
            <div className="h-14 rounded-xl border border-slate-200 bg-white hover:border-slate-350 flex items-center justify-center text-xl select-none cursor-pointer">🏡</div>
          </div>
        </div>

        {/* Right - Buying / Action Widget */}
        <div className="lg:col-span-4">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Starting From</div>
              <div className="text-3xl font-extrabold text-slate-900 mt-1">{project.startingPrice}</div>
              <div className="text-xs text-slate-500 mt-2 font-semibold">
                Config: <span className="text-[#0f172a] font-bold">{project.config}</span> ·
                Possession: <span className="text-[#0f172a] font-bold">{project.possession}</span>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-6 space-y-3">
              <button
                onClick={() => setShowUnitsModal(true)}
                className="w-full py-3.5 bg-[#25d366] hover:bg-[#16c47f] text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center space-x-2"
              >
                <Grid className="w-4 h-4" />
                <span>View Live Unit Inventory</span>
              </button>

              <button className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5 transition">
                <FileText className="w-4 h-4" />
                <span>Download PDF Brochure</span>
              </button>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-[10px] text-slate-500 space-y-1.5 font-semibold">
              <div className="font-extrabold text-slate-850 flex items-center">
                <ShieldCheck className="w-3.5 h-3.5 text-[#25d366] mr-1.5" />
                <span>Channel Partner Agent Perks:</span>
              </div>
              <div>· 2.5% Payout on spot booking.</div>
              <div>· CP Meet Invitation pass included.</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Section */}
      <div className="space-y-4">
        <div className="flex border-b border-slate-200 text-xs font-bold uppercase tracking-wider">
          {[
            { id: "overview", label: "Project Overview" },
            { id: "amenities", label: "Amenities" },
            { id: "floorplans", label: "Floor Plans" },
            { id: "pricing", label: "Pricing Sheet" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as "overview" | "amenities" | "floorplans" | "pricing")}
              className={`pb-3 px-4 border-b-2 transition ${
                activeTab === tab.id
                  ? "border-[#25d366] text-[#16c47f]"
                  : "border-transparent text-slate-400 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 text-slate-600 shadow-sm">
          {activeTab === "overview" && (
            <div className="space-y-4">
              <p className="leading-relaxed text-xs font-semibold">{project.overview}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 text-[10px] font-bold">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-slate-400">Developer</div>
                  <div className="text-xs font-extrabold text-slate-800 mt-0.5">{project.builder}</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-slate-400">Total Land</div>
                  <div className="text-xs font-extrabold text-slate-800 mt-0.5">{project.totalLand}</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-slate-400">Structures</div>
                  <div className="text-xs font-extrabold text-slate-800 mt-0.5">{project.structures}</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-slate-400">RERA ID</div>
                  <div className="text-xs font-extrabold text-[#16c47f] mt-0.5">{project.rera}</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "amenities" && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {project.amenities.map((item) => (
                <div key={item} className="flex items-center space-x-2 text-xs font-bold text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-[#25d366] shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === "floorplans" && (
            <div className="space-y-3">
              {project.floorplans.map((item, idx) => (
                <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200 hover:bg-slate-100/50 transition flex justify-between items-center text-xs">
                  <div>
                    <div className="font-bold text-slate-800">{item.name}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{item.rooms}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-700">{item.size}</div>
                    <button className="text-[10px] text-[#16c47f] font-bold hover:underline flex items-center mt-1">
                      <span>View layout PDF</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "pricing" && (
            <div className="overflow-hidden border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs font-semibold">
                <thead className="bg-slate-50 text-slate-400 uppercase tracking-wider text-[9px]">
                  <tr>
                    <th className="px-4 py-3">Configuration</th>
                    <th className="px-4 py-3">Carpet Area Size</th>
                    <th className="px-4 py-3">Tentative Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {project.pricing.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition">
                      <td className="px-4 py-3.5 font-bold text-slate-900">{row.configuration}</td>
                      <td className="px-4 py-3.5">{row.size}</td>
                      <td className="px-4 py-3.5 font-extrabold text-[#16c47f]">{row.price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Available Units Modal */}
      {showUnitsModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white p-6 rounded-2xl border border-slate-200 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 text-slate-800">
            <button
              onClick={() => setShowUnitsModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-655 p-1 rounded-lg hover:bg-slate-50 transition"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-xl font-bold text-slate-900 mb-2 flex items-center space-x-2">
              <Building className="w-5 h-5 text-[#25d366]" />
              <span>Available Units List</span>
            </h2>
            <p className="text-xs text-slate-500 mb-6">Real-time availability status for bookings.</p>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs font-semibold">
                <thead className="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider text-[9px]">
                  <tr>
                    <th className="px-4 py-3">Unit No.</th>
                    <th className="px-4 py-3">Config</th>
                    <th className="px-4 py-3">Size</th>
                    <th className="px-4 py-3">Facing</th>
                    <th className="px-4 py-3">Price</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {project.units.map((unit) => (
                    <tr key={unit.unitNumber} className="hover:bg-slate-50/50 transition">
                      <td className="px-4 py-3.5 font-bold text-slate-900">{unit.unitNumber}</td>
                      <td className="px-4 py-3.5">{unit.bhk}</td>
                      <td className="px-4 py-3.5">{unit.sqft} Sqft</td>
                      <td className="px-4 py-3.5">{unit.facing}</td>
                      <td className="px-4 py-3.5 font-bold">{unit.price}</td>
                      <td className="px-4 py-3.5">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          unit.status === "Available" ? "bg-emerald-50 text-emerald-600 border border-emerald-200" :
                          unit.status === "Blocked" ? "bg-amber-50 text-amber-600 border border-amber-200" :
                          "bg-red-50 text-red-655 border border-red-200"
                        }`}>
                          {unit.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-5 flex justify-end">
              <button
                onClick={() => setShowUnitsModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
