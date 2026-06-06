"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2, BarChart3, Users, Share2,
  LogOut, RefreshCw, Crown, Bell, Calendar, Clock, User
} from "lucide-react";
import { performLogout } from "@/components/SessionSync";

export default function SuperBuilderSidebar() {
  const pathname = usePathname();

  const menuItems = [
    { name: "Dashboard", href: "/super-builder/dashboard", icon: BarChart3 },
    { name: "My Projects", href: "/super-builder/projects", icon: Building2 },
    { name: "Share Projects", href: "/super-builder/projects/share", icon: Share2 },
    { name: "Create Events", href: "/super-builder/events", icon: Calendar },
    { name: "Manage Builders", href: "/super-builder/builders", icon: Users },
    { name: "Activity", href: "/super-builder/activity", icon: Clock },
    { name: "Notifications", href: "/super-builder/notifications", icon: Bell },
    { name: "Profile", href: "/super-builder/profile", icon: User },
  ];

  return (
    <div className="w-64 h-screen bg-white border-r border-slate-200 flex flex-col justify-between p-5 text-slate-600 shrink-0">
      <div>
        {/* Brand Logo */}
        <div className="flex items-center space-x-2 px-2 py-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center font-bold text-white shadow-md shadow-purple-600/20">
            <Crown className="w-4 h-4" />
          </div>
          <span className="text-xl font-bold tracking-tight text-[#0f172a] flex items-center">
            super<span className="text-purple-500">builder</span>
          </span>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1">
          {menuItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                  isActive
                    ? "bg-purple-50 text-purple-700 shadow-sm"
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

      {/* Sidebar Footer */}
      <div className="space-y-4">
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[10px] font-bold text-[#64748b]">
          <div className="mb-2 flex items-center space-x-1 uppercase tracking-wider text-slate-500 font-extrabold">
            <RefreshCw className="w-3 h-3 text-purple-500" />
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
              Admin
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
