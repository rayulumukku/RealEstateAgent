"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  CheckSquare, BarChart2, LogOut, RefreshCw, User, Building2, Calendar, Activity, Users, Megaphone
} from "lucide-react";
import { performLogout } from "@/components/SessionSync";

export default function AdminSidebar() {
  const pathname = usePathname();

  const menuItems = [
    { name: "Analytics", href: "/admin/dashboard", icon: BarChart2 },
    { name: "Projects", href: "/admin/projects", icon: Building2 },
    { name: "Events", href: "/admin/events", icon: Calendar },
    { name: "Followers", href: "/admin/followers", icon: Users },
    { name: "Broadcasts", href: "/admin/campaigns", icon: Megaphone },
    { name: "Activity", href: "/admin/activity", icon: Activity },
    { name: "Verification", href: "/admin/verification", icon: CheckSquare },
    { name: "Profile", href: "/admin/profile", icon: User },
  ];

  return (
    <div className="w-64 h-screen bg-white border-r border-slate-200 flex flex-col justify-between p-5 text-slate-600 shrink-0">
      <div>
        {/* Brand Logo */}
        <div className="flex items-center space-x-2 px-2 py-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center font-bold text-white shadow-md shadow-emerald-650/20">
            ad
          </div>
          <span className="text-xl font-bold tracking-tight text-[#0f172a] flex items-center">
            admin<span className="text-emerald-500">portal</span>
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
                    ? "bg-emerald-600 text-white shadow-sm" 
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
        {/* Quick Role Switcher for demo */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[10px] font-bold text-[#64748b]">
          <div className="mb-2 flex items-center space-x-1 uppercase tracking-wider text-slate-500 font-extrabold">
            <RefreshCw className="w-3 h-3 text-emerald-500" />
            <span>Portal Switcher</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 font-bold">
            <Link href="/" className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded text-center text-slate-700">
              Landing
            </Link>
            <Link href="/agent/dashboard" className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded text-center text-slate-700">
              Agent Bot
            </Link>
            <Link href="/builder/dashboard" className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded text-center text-slate-700 col-span-2">
              Builder Dashboard
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
