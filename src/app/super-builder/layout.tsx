"use client";

import { useEffect, useState } from "react";
import SuperBuilderSidebar from "@/components/SuperBuilderSidebar";
import SessionSync from "@/components/SessionSync";
import WarningPopup from "@/components/WarningPopup";
import { Loader2 } from "lucide-react";

export default function SuperBuilderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const res = await fetch("/api/me");
      if (res.ok) {
        const data = await res.json();
        if (data.user && data.user.role === "super_builder") {
          setAuthorized(true);
        }
      }
    } catch {
      // will be redirected by proxy
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#070b13]">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#070b13]">
        <div className="text-center text-white">
          <p className="text-lg font-bold">Access Denied</p>
          <p className="text-sm text-slate-400 mt-2">You need Super Builder access to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#070b13] overflow-hidden">
      <SessionSync />
      <WarningPopup />
      <SuperBuilderSidebar />
      <main className="flex-1 overflow-y-auto p-8 text-slate-100">
        {children}
      </main>
    </div>
  );
}
