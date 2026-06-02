"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, Shield } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Warning {
  id: string;
  message: string;
  created_at: string;
}

export default function WarningPopup() {
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [agreed, setAgreed] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [userRole, setUserRole] = useState<string>("");

  const fetchWarnings = useCallback(async () => {
    try {
      const res = await fetch("/api/warnings");
      if (res.ok) {
        const data = await res.json();
        if (data.warnings && data.warnings.length > 0) {
          setWarnings(data.warnings);
        }
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    // Get user info
    async function getUser() {
      try {
        const res = await fetch("/api/me");
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setUserId(data.user.id);
            setUserRole(data.user.role);
          }
        }
      } catch {}
    }
    getUser();
    fetchWarnings();

    // Poll every 5 seconds for new warnings
    const interval = setInterval(fetchWarnings, 5000);
    return () => clearInterval(interval);
  }, [fetchWarnings]);

  // Real-time subscription for instant delivery
  useEffect(() => {
    if (!userId || !userRole) return;

    const channel = supabase
      .channel("warnings-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "warnings",
        },
        () => {
          // New warning inserted — re-fetch to check if it applies to us
          fetchWarnings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, userRole, fetchWarnings]);

  async function handleAcknowledge() {
    if (!agreed) return;
    const currentWarning = warnings[currentIndex];
    if (!currentWarning) return;

    setAcknowledging(true);
    try {
      const res = await fetch("/api/warnings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ warning_id: currentWarning.id }),
      });

      if (res.ok) {
        // Move to next warning or close
        const remaining = warnings.filter((_, i) => i !== currentIndex);
        setWarnings(remaining);
        setCurrentIndex(0);
        setAgreed(false);
      }
    } catch {
      // retry on next poll
    } finally {
      setAcknowledging(false);
    }
  }

  // Don't render anything if no warnings or if super_admin
  if (warnings.length === 0 || userRole === "super_admin") return null;

  const currentWarning = warnings[currentIndex];
  if (!currentWarning) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl border-2 border-red-300 overflow-hidden animate-in fade-in">
        {/* Header */}
        <div className="bg-red-600 px-6 py-4 flex items-center space-x-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-white">⚠️ Warning from System Bot</h2>
            <p className="text-[10px] text-red-100 font-semibold uppercase tracking-wider">Action Required — Please Read Carefully</p>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Warning Message */}
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm text-slate-900 font-semibold leading-relaxed whitespace-pre-wrap">
              {currentWarning.message}
            </p>
          </div>

          {/* Timestamp */}
          <p className="text-[10px] text-slate-400 font-semibold text-center">
            Issued: {new Date(currentWarning.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>

          {/* Multiple warnings indicator */}
          {warnings.length > 1 && (
            <div className="text-center">
              <span className="px-3 py-1 bg-amber-50 border border-amber-200 rounded-lg text-[10px] font-bold text-amber-700">
                {warnings.length} warning{warnings.length !== 1 ? "s" : ""} pending
              </span>
            </div>
          )}

          {/* Agreement Checkbox */}
          <label className="flex items-start space-x-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 w-5 h-5 rounded border-2 border-red-300 text-red-600 focus:ring-red-500 cursor-pointer"
            />
            <span className="text-xs font-semibold text-slate-700 leading-relaxed group-hover:text-slate-900 transition">
              I have read and understood this warning. I agree to comply with the instructions above.
            </span>
          </label>

          {/* Understood Button */}
          <button
            onClick={handleAcknowledge}
            disabled={!agreed || acknowledging}
            className={`w-full py-3.5 rounded-xl font-bold text-sm uppercase tracking-wider transition flex items-center justify-center space-x-2 ${
              agreed
                ? "bg-red-600 hover:bg-red-700 text-white shadow-md cursor-pointer"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            } disabled:opacity-60`}
          >
            {acknowledging ? (
              <span>Processing...</span>
            ) : (
              <>
                <Shield className="w-4 h-4" />
                <span>I Understand</span>
              </>
            )}
          </button>

          {!agreed && (
            <p className="text-[10px] text-red-500 font-bold text-center">
              You must check the agreement box before proceeding.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
