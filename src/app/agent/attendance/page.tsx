"use client";

import { useState } from "react";
import { QrCode, CheckCircle2, Loader2, Camera } from "lucide-react";
import { markAttendance } from "./actions";

export default function AttendancePage() {
  const [qrCode, setQrCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrCode.trim()) return;

    setLoading(true);
    setResult(null);

    const phone = localStorage.getItem("agentsapp_logged_in_phone") || "";
    const res = await markAttendance(phone, qrCode.trim());

    setResult({
      ok: res.ok,
      message: res.ok ? "Attendance marked successfully!" : res.error || "Failed to mark attendance",
    });
    setLoading(false);
  };

  return (
    <div className="space-y-6 text-slate-800">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">QR Attendance</h1>
        <p className="text-[#64748b] text-xs font-semibold mt-0.5">
          Scan or enter the QR code at events/webinars to log your attendance.
        </p>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm max-w-md">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-12 h-12 bg-[#25d366]/10 rounded-xl flex items-center justify-center">
            <QrCode className="w-6 h-6 text-[#25d366]" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-slate-900">Mark Your Attendance</h2>
            <p className="text-[10px] text-slate-500">Enter the event QR code shown at the venue</p>
          </div>
        </div>

        <form onSubmit={handleScan} className="space-y-4">
          <div>
            <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Event QR Code</label>
            <div className="relative">
              <Camera className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Enter or paste QR code value..."
                value={qrCode}
                onChange={(e) => setQrCode(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-slate-800 text-xs font-semibold outline-none focus:border-[#25d366]"
              />
            </div>
          </div>

          {result && (
            <div className={`p-3 rounded-xl text-xs font-bold flex items-center space-x-2 ${
              result.ok
                ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                : "bg-red-50 text-red-600 border border-red-200"
            }`}>
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{result.message}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !qrCode.trim()}
            className="w-full py-3 bg-[#25d366] hover:bg-[#16c47f] text-white font-bold rounded-xl text-xs uppercase tracking-wider transition disabled:opacity-60 flex items-center justify-center space-x-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>{loading ? "Marking..." : "Mark Attendance"}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
