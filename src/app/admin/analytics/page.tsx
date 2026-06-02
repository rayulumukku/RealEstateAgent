"use client";

import { useState, useEffect } from "react";
import { getAdminAnalytics, AdminAnalytics } from "./actions";
import { Users, FileText, Calendar, Bell, Building, TrendingUp, Loader2 } from "lucide-react";

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminAnalytics().then((result) => {
      setData(result);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#25d366]" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6 text-slate-800">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Platform Analytics</h1>
        <p className="text-[#64748b] text-xs font-semibold mt-0.5">Real-time platform metrics and agent activity.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard icon={<Users className="w-5 h-5" />} label="Total Agents" value={data.total_agents} />
        <StatCard icon={<Building className="w-5 h-5" />} label="Total Builders" value={data.total_builders} />
        <StatCard icon={<TrendingUp className="w-5 h-5" />} label="Total Leads" value={data.total_leads} />
        <StatCard icon={<Bell className="w-5 h-5" />} label="Reminders" value={data.total_reminders} />
        <StatCard icon={<Calendar className="w-5 h-5" />} label="Events" value={data.total_events} />
        <StatCard icon={<FileText className="w-5 h-5" />} label="Documents" value={data.total_documents} />
      </div>

      {/* Agent Activity Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">Agent Activity</h2>
          <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Leads added per agent and their activity status</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs font-semibold">
            <thead className="bg-slate-50 text-slate-400 uppercase tracking-wider text-[9px]">
              <tr>
                <th className="px-4 py-3 text-left">Agent</th>
                <th className="px-4 py-3 text-left">Agency</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-center">Leads</th>
                <th className="px-4 py-3 text-center">Reminders</th>
                <th className="px-4 py-3 text-left">Last Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.agents.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    No agents registered yet.
                  </td>
                </tr>
              )}
              {data.agents.map((agent) => (
                <tr key={agent.id} className="hover:bg-slate-50/50 transition">
                  <td className="px-4 py-3">
                    <div className="font-bold text-slate-900">{agent.name}</div>
                    <div className="text-[10px] text-slate-400">{agent.phone}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{agent.agency_name || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                      agent.status === "approved"
                        ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                        : agent.status === "pending"
                        ? "bg-amber-50 text-amber-600 border border-amber-200"
                        : "bg-red-50 text-red-600 border border-red-200"
                    }`}>
                      {agent.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-slate-900">{agent.leads_count}</td>
                  <td className="px-4 py-3 text-center text-slate-600">{agent.reminders_count}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {agent.last_active
                      ? new Date(agent.last_active).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "No activity"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex items-center space-x-2 text-slate-400 mb-2">
        {icon}
        <span className="text-[9px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-extrabold text-slate-900">{value}</div>
    </div>
  );
}
