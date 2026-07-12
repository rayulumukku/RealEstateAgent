"use client";

import { useState, useEffect } from "react";
import { Bell, Plus, Loader2, CheckCircle2, Circle, Trash2, X, Clock, Calendar as CalendarIcon, List } from "lucide-react";
import { getAgentReminders, addReminder, toggleReminderComplete, deleteReminder, Reminder } from "./actions";

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  
  // Calendar state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Bell className="w-6 h-6 text-indigo-600" />
            <span>Reminders</span>
          </h1>
          <p className="text-[#64748b] text-xs font-semibold mt-0.5">Schedule follow-ups and never miss a call.</p>
        </div>
        
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          {/* View Toggle */}
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-lg flex items-center justify-center transition-all ${viewMode === "list" ? "bg-white shadow-sm text-indigo-600" : "text-slate-400 hover:text-slate-600"}`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={`p-1.5 rounded-lg flex items-center justify-center transition-all ${viewMode === "calendar" ? "bg-white shadow-sm text-indigo-600" : "text-slate-400 hover:text-slate-600"}`}
              title="Calendar View"
            >
              <CalendarIcon className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setShowAdd(true)}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-[#25d366] hover:bg-[#16c47f] text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>New Reminder</span>
          </button>
        </div>
      </div>

      {viewMode === "list" ? (
        <>
          {/* Pending Reminders */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Upcoming ({pending.length})</h2>
            {pending.length === 0 && (
              <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
                <Bell className="w-5 h-5 mx-auto mb-2 opacity-50" />
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
        </>
      ) : (
        <CalendarView 
          reminders={reminders} 
          currentDate={currentDate}
          setCurrentDate={setCurrentDate}
          onToggle={handleToggle}
          onDelete={handleDelete}
        />
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

    </div>
  );
}

// ----------------------------------------------------------------------
// Calendar View Component
// ----------------------------------------------------------------------
function CalendarView({ 
  reminders, 
  currentDate, 
  setCurrentDate,
  onToggle,
  onDelete
}: { 
  reminders: Reminder[];
  currentDate: Date;
  setCurrentDate: (d: Date) => void;
  onToggle: (id: string, current: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const today = new Date();

  // Helper to check if a reminder falls on a specific calendar day
  const getRemindersForDay = (day: number) => {
    return reminders.filter(r => {
      // If it has a strict ISO date (from manual UI entry)
      if (r.remind_at) {
        const d = new Date(r.remind_at);
        return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
      }
      // If it's a string from WhatsApp like "Tomorrow, 10:00 AM" or "Today, 5:00 PM"
      if (r.scheduled_time) {
        const lowerTime = r.scheduled_time.toLowerCase();
        
        // Very basic matching for today/tomorrow text for demo purposes
        if (lowerTime.includes("today")) {
          return day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
        }
        if (lowerTime.includes("tomorrow")) {
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          return day === tomorrow.getDate() && month === tomorrow.getMonth() && year === tomorrow.getFullYear();
        }
        
        // If we can't parse it easily, we just don't show it in the strict calendar grid
        return false;
      }
      return false;
    });
  };

  const selectedDayReminders = selectedDate ? getRemindersForDay(selectedDate.getDate()) : [];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Calendar Header */}
        <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50/50">
          <button onClick={prevMonth} className="p-2 hover:bg-slate-200 rounded-lg text-slate-600 transition">
            ←
          </button>
          <h2 className="text-sm font-black text-slate-800 tracking-wide uppercase">
            {monthNames[month]} {year}
          </h2>
          <button onClick={nextMonth} className="p-2 hover:bg-slate-200 rounded-lg text-slate-600 transition">
            →
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="p-4">
          <div className="grid grid-cols-7 gap-2 mb-2">
            {days.map(d => (
              <div key={d} className="text-center text-[10px] font-bold text-slate-400 uppercase">
                {d}
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="p-2" />
            ))}
            
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
              const isSelected = selectedDate?.getDate() === day && selectedDate?.getMonth() === month;
              const dayReminders = getRemindersForDay(day);
              const pendingCount = dayReminders.filter(r => !r.is_completed).length;
              
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDate(new Date(year, month, day))}
                  className={`
                    min-h-[60px] p-1 rounded-xl border flex flex-col items-center justify-start transition-all relative
                    ${isSelected ? "border-indigo-500 bg-indigo-50 shadow-sm" : "border-slate-100 hover:border-slate-300 hover:bg-slate-50"}
                    ${isToday && !isSelected ? "bg-emerald-50/50 border-emerald-200" : ""}
                  `}
                >
                  <span className={`text-xs font-bold ${isToday ? "text-emerald-600" : isSelected ? "text-indigo-700" : "text-slate-700"}`}>
                    {day}
                  </span>
                  
                  {dayReminders.length > 0 && (
                    <div className="mt-1 flex flex-wrap justify-center gap-1">
                      {pendingCount > 0 ? (
                        <span className="w-2 h-2 rounded-full bg-amber-500" title={`${pendingCount} pending`} />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-[#25d366]" title="All completed" />
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected Date Reminders */}
      {selectedDate && (
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Reminders for {selectedDate.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
            </h3>
            <button onClick={() => setSelectedDate(null)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          
          {selectedDayReminders.length === 0 ? (
            <div className="text-center text-slate-400 text-xs py-4 font-semibold">
              No reminders scheduled for this date.
            </div>
          ) : (
            <div className="space-y-3">
              {selectedDayReminders.map(r => (
                <ReminderCard key={r.id} reminder={r} onToggle={onToggle} onDelete={onDelete} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
