"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart2, Users, Building2, Calendar, Shield, LogOut, RefreshCw, ShieldAlert, AlertTriangle } from "lucide-react";
import { performLogout } from "@/components/SessionSync";

export default function SuperAdminSidebar() {
  const pathname = usePathname();

  const menuItems = [
    { name: "Dashboard", href: "/super-admin/dashboard", icon: BarChart2 },
    { name: "Users", href: "/super-admin/users", icon: Users },
    { name: "Warnings", href: "/super-admin/warnings", icon: AlertTriangle },
    { name: "Projects", href: "/super-admin/projects", icon: Building2 },
    { name: "Events", href: "/super-admin/events", icon: Calendar },
    { name: "Verification", href: "/admin/verification", icon: ShieldAlert },
  ];

  return (
    <div className="w-64 h-screen bg-white border-r border-slate-200 flex flex-col justify-between p-5 text-slate-600 shrink-0">
      <div>
        <div className="flex items-center space-x-2 px-2 py-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center font-bold text-white shadow-md shadow-red-600/20">
            <Shield className="w-4 h-4" />
          </div>
          <span className="text-xl font-bold tracking-tight text-[#0f172a] flex items-center">
            super<span className="text-red-500">admin</span>
          </span>
        </div>

        <nav className="space-y-1">
          {menuItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                  isActive ? "bg-red-50 text-red-700 shadow-sm" : "hover:bg-slate-50 hover:text-[#0f172a]"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="space-y-4">
        <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-[10px] font-bold text-red-700">
          <div className="flex items-center space-x-1 mb-1">
            <Shield className="w-3 h-3" />
            <span className="uppercase tracking-wider">Highest Authority</span>
          </div>
          <p className="text-[9px] text-red-500 font-semibold">You can suspend/delete any user including admins.</p>
        </div>

        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[10px] font-bold text-[#64748b]">
          <div className="mb-2 flex items-center space-x-1 uppercase tracking-wider text-slate-500 font-extrabold">
            <RefreshCw className="w-3 h-3 text-red-500" />
            <span>Portal Switcher</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 font-bold">
            <Link href="/admin/dashboard" className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded text-center text-slate-700">Admin</Link>
            <Link href="/builder/dashboard" className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded text-center text-slate-700">Builder</Link>
            <Link href="/agent/dashboard" className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded text-center text-slate-700">Agent</Link>
            <Link href="/super-builder/dashboard" className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded text-center text-slate-700">S.Builder</Link>
          </div>
        </div>

        <div className="border-t border-slate-200 pt-3">
          <button onClick={() => performLogout()} className="flex items-center space-x-3 px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-red-500 transition w-full text-left">
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
}
