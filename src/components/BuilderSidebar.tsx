"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Building2, PlusCircle, Megaphone, Calendar,
  LogOut, RefreshCw, BarChart3, Users, User, Crown, Layers, Coins, FileText
} from "lucide-react";
import { performLogout } from "@/components/SessionSync";

export default function BuilderSidebar() {
  const pathname = usePathname();
  const [credits, setCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubBuilder, setIsSubBuilder] = useState(false);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch("/api/profile");
        if (res.ok) {
          const data = await res.json();
          if (data.profile) {
            setCredits(data.profile.credits ?? 0);
            setIsSubBuilder(!!data.profile.parent_id);
          }
        }
      } catch (err) {
        console.error("Error fetching builder profile for credits:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, []);

  const menuItems = [
    { name: "Overview", href: "/builder/dashboard", icon: BarChart3 },
    { name: "My Projects", href: "/builder/projects", icon: Building2 },
    { name: "My Inventory", href: "/builder/inventory", icon: Layers },
    { name: "Documents", href: "/builder/documents", icon: FileText },
    { name: "Add Project", href: "/builder/projects/new", icon: PlusCircle },
    { name: "Campaigns", href: "/builder/campaigns", icon: Megaphone },
    { name: "My Events", href: "/builder/events", icon: Calendar },
    { name: "My Followers", href: "/builder/followers", icon: Users },
    ...(isSubBuilder ? [{ name: "Assigned Agents", href: "/builder/followers?tab=assigned", icon: Crown }] : []),
    { name: "Agent Directory", href: "/builder/agents", icon: Users },
    { name: "Profile", href: "/builder/profile", icon: User },
  ];

  return (
    <div className="w-64 h-screen bg-white border-r border-slate-200 flex flex-col justify-between p-5 text-slate-600 shrink-0">
      <div>
        {/* Brand Logo */}
        <div className="flex items-center space-x-2 px-2 py-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-md shadow-indigo-650/20">
            b
          </div>
          <span className="text-xl font-bold tracking-tight text-[#0f172a] flex items-center">
            builder<span className="text-indigo-500">hub</span>
          </span>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1">
          {menuItems.map((item) => {
            const isActive = item.href === "/builder/projects" 
              ? pathname === "/builder/projects"
              : item.href === "/builder/dashboard"
                ? pathname === "/builder/dashboard"
                : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                  isActive 
                    ? "bg-indigo-50 text-indigo-600 shadow-sm" 
                    : "hover:bg-slate-50 hover:text-[#0f172a]"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Sidebar Footer & Role Switcher */}
      <div className="space-y-4">
        {/* Credits Widget */}
        <div className="p-4 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-650/20 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase font-extrabold text-indigo-200 tracking-wider">Account Credits</span>
            <Coins className="w-4 h-4 text-indigo-200 animate-pulse" />
          </div>
          <div className="flex items-baseline space-x-1.5">
            {loading ? (
              <span className="h-6 w-16 bg-indigo-500/50 rounded animate-pulse inline-block"></span>
            ) : (
              <span className="text-xl font-extrabold tracking-tight">
                {credits !== null ? credits.toLocaleString() : "0"}
              </span>
            )}
            <span className="text-[10px] font-semibold text-indigo-200 uppercase tracking-wider">Credits</span>
          </div>
          <div className="text-[9px] text-indigo-100/80 leading-normal">
            Cost: 1 credit per targeted agent. Keep credits topped up via admin.
          </div>
        </div>

        {/* Quick Role Switcher for demo */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[10px] font-bold text-[#64748b]">
          <div className="mb-2 flex items-center space-x-1 uppercase tracking-wider text-slate-500 font-extrabold">
            <RefreshCw className="w-3 h-3 text-indigo-500" />
            <span>Portal Switcher</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 font-bold">
            <Link href="/" className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded text-center text-slate-700">
              Landing
            </Link>
            <Link href="/agent/dashboard" className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded text-center text-slate-700">
              Agent Bot
            </Link>
            <Link href="/admin/dashboard" className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded text-center text-slate-700 col-span-2">
              Verification / Admin
            </Link>
          </div>
        </div>

        <div className="border-t border-slate-200 pt-3">
          <button
            onClick={() => performLogout()}
            className="flex items-center space-x-3 px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-red-500 transition w-full text-left"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
}
