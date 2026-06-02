"use client";

import { useState, useEffect } from "react";
import { Bell, Plus, Loader2, CheckCircle2, Circle, Trash2, X, Clock } from "lucide-react";
import { getAgentReminders, addReminder, toggleReminderComplete, deleteReminder, Reminder } from "./actions";

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    title: "",
    remind_at: "",
    priority: "medium",
  });

  useEffect(() => {
    const phone = localStorage.getItem("agentsapp_logged_in_phone") || "";
    getAgentReminders(phone).then((data) => {
      setReminders(data);
      setLoading(false);
    });
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.remind_at) {
      setMessage("Please fill in title and date/time.");
      return;
    }
    setAdding(true);
    setMessage("");

    const phone = localStorage.getItem("agentsapp_logged_in_phone") || "";
    const result = await addReminder({
      phone,
      title: form.title,
      remind_at: new Date(form.remind_at).toISOString(),
      priority: form.priority,
    });

    if (result.ok) {
      setShowAdd(false);
      setForm({ title: "", remind_at: "", priority: "medium" });
      const refreshed = await getAgentReminders(phone);
      setReminders(refreshed);
    } else {
      setMessage(result.error || "Failed to add reminder");
    }
    setAdding(false);
  };

  const handleToggle = async (id: string, current: boolean) => {
    const result = await toggleReminderComplete(id, !current);
    if (result.ok) {
      setReminders((prev) =>
        prev.map((r) => (r.id === id ? { ...r, is_completed: !current } : r))
      );
    }
  };

  const handleDelete = async (id: string) => {
    const result = await deleteReminder(id);
    if (result.ok) {
      setReminders((prev) => prev.filter((r) => r.id !== id));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#25d366]" />
      </div>
    );
  }

  const pending = reminders.filter((r) => !r.is_completed);
  const completed = reminders.filter((r) => r.is_completed);

  return (
    <div className="space-y-6 text-slate-800">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Reminders</h1>
          <p className="text-[#64748b] text-xs font-semibold mt-0.5">Schedule follow-ups and never miss a call.</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2.5 bg-[#25d366] hover:bg-[#16c47f] text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition"
        >
          <Plus className="w-4 h-4" />
          <span>New Reminder</span>
        </button>
      </div>

      {/* Pending Reminders */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Upcoming ({pending.length})</h2>
        {pending.length === 0 && (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
            <Bell className="w-5 h-5 mx-auto mb-2" />
            No pending reminders. Add one to stay on track.
          </div>
        )}
        {pending.map((r) => (
          <ReminderCard key={r.id} reminder={r} onToggle={handleToggle} onDelete={handleDelete} />
        ))}
      </div>

      {/* Completed */}
      {completed.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Completed ({completed.length})</h2>
          {completed.map((r) => (
            <ReminderCard key={r.id} reminder={r} onToggle={handleToggle} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* Add Reminder Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white p-6 rounded-2xl border border-slate-200 shadow-2xl relative">
            <button onClick={() => setShowAdd(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-lg font-bold text-slate-900 mb-4">New Reminder</h2>

            <form onSubmit={handleAdd} className="space-y-4 text-xs">
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">What to remember</label>
                <input
                  required
                  placeholder="e.g. Call Ramesh about 3BHK Kokapet"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 outline-none focus:border-[#25d366]"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">When to remind</label>
                <input
                  required
                  type="datetime-local"
                  value={form.remind_at}
                  onChange={(e) => setForm({ ...form, remind_at: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 outline-none focus:border-[#25d366]"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Priority</label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 outline-none focus:border-[#25d366]"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              {message && (
                <div className="p-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-bold">{message}</div>
              )}

              <button
                type="submit"
                disabled={adding}
                className="w-full py-3 bg-[#25d366] hover:bg-[#16c47f] text-white font-bold rounded-xl text-xs uppercase tracking-wider transition disabled:opacity-60 flex items-center justify-center space-x-2"
              >
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                <span>{adding ? "Saving..." : "Set Reminder"}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ReminderCard({
  reminder,
  onToggle,
  onDelete,
}: {
  reminder: Reminder;
  onToggle: (id: string, current: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const priorityColors: Record<string, string> = {
    high: "bg-red-50 text-red-600 border-red-200",
    medium: "bg-amber-50 text-amber-600 border-amber-200",
    low: "bg-slate-50 text-slate-500 border-slate-200",
  };

  return (
    <div className={`bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-start space-x-3 ${reminder.is_completed ? "opacity-60" : ""}`}>
      <button
        onClick={() => onToggle(reminder.id, reminder.is_completed)}
        className="mt-0.5 shrink-0"
      >
        {reminder.is_completed ? (
          <CheckCircle2 className="w-5 h-5 text-[#25d366]" />
        ) : (
          <Circle className="w-5 h-5 text-slate-300 hover:text-[#25d366] transition" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className={`font-bold text-sm ${reminder.is_completed ? "line-through text-slate-400" : "text-slate-900"}`}>
          {reminder.title}
        </div>
        <div className="flex items-center space-x-3 mt-1.5 text-[10px] text-slate-500">
          <span className="flex items-center space-x-1">
            <Clock className="w-3 h-3" />
            <span>{reminder.remind_at ? new Date(reminder.remind_at).toLocaleString("en-IN", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }) : reminder.scheduled_time}</span>
          </span>
          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase border ${priorityColors[reminder.priority] || priorityColors.medium}`}>
            {reminder.priority}
          </span>
          {reminder.lead_name && (
            <span className="text-slate-400">→ {reminder.lead_name}</span>
          )}
        </div>
      </div>

      <button
        onClick={() => onDelete(reminder.id)}
        className="shrink-0 text-slate-300 hover:text-red-500 transition"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
