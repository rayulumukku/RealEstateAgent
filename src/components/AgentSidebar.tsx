"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Home, Users, Briefcase, FileText, Bell, Building2,
  Settings, LogOut, RefreshCw, Milestone, Award, Bookmark
} from "lucide-react";
import { performLogout } from "@/components/SessionSync";

export default function AgentSidebar() {
  const pathname = usePathname();

  const menuItems = [
    { name: "Home", href: "/agent/dashboard", icon: Home },
    { name: "Leads", href: "/agent/pipeline", icon: Users },
    { name: "Inventory", href: "/agent/inventory", icon: Briefcase },
    { name: "Launches", href: "/agent/launches", icon: Milestone },
    { name: "Builders", href: "/agent/builders", icon: Building2 },
    { name: "Following Projects", href: "/agent/following", icon: Bookmark },
    { name: "Documents", href: "/agent/documents", icon: FileText },
    { name: "Reminders", href: "/agent/reminders", icon: Bell },
    { name: "Rewards", href: "/agent/rewards", icon: Award },
    { name: "Profile", href: "/agent/profile", icon: Settings },
  ];

  return (
    <div className="w-64 h-screen bg-white border-r border-slate-200 flex flex-col justify-between p-5 text-slate-600 shrink-0">
      <div>
        {/* Brand Logo */}
        <div className="flex items-center space-x-2 px-2 py-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-[#25d366] flex items-center justify-center font-bold text-white shadow-md shadow-[#25d366]/20">
            R
          </div>
          <span className="text-xl font-bold tracking-tight text-[#0f172a] flex items-center">
            real<span className="text-[#16c47f]">connect</span>
          </span>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1">
          {menuItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                  isActive 
                    ? "bg-[#25d366]/10 text-[#16c47f]" 
                    : "hover:bg-slate-50 hover:text-[#0f172a]"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-[#16c47f]" : "text-slate-400"}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Sidebar Footer & Role Switcher */}
      <div className="space-y-4">
        {/* Quick Role Switcher for demo */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[10px] font-bold text-[#64748b]">
          <div className="mb-2 flex items-center space-x-1 uppercase tracking-wider text-slate-500 font-extrabold">
            <RefreshCw className="w-3 h-3 text-[#16c47f]" />
            <span>Portal Switcher</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 font-bold">
            <Link href="/" className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded text-center text-slate-700">
              Landing
            </Link>
            <Link href="/builder/dashboard" className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded text-center text-slate-700">
              Builder
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
