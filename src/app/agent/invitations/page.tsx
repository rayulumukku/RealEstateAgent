"use client";

import { useState, useEffect } from "react";
import { Calendar, MapPin, CheckCircle2, XCircle, Loader2, Clock, Ticket } from "lucide-react";
import { getAgentEvents, respondToInvitation, EventWithInvitation } from "./actions";

export default function InvitationsPage() {
  const [events, setEvents] = useState<EventWithInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  useEffect(() => {
    const phone = localStorage.getItem("agentsapp_logged_in_phone") || "";
    getAgentEvents(phone).then((data) => {
      setEvents(data);
      setLoading(false);
    });
  }, []);

  const handleRespond = async (eventId: string, response: "accepted" | "declined") => {
    setRespondingId(eventId);
    const phone = localStorage.getItem("agentsapp_logged_in_phone") || "";
    const result = await respondToInvitation(phone, eventId, response);
    if (result.ok) {
      setEvents((prev) =>
        prev.map((e) =>
          e.id === eventId ? { ...e, invitation_status: response } : e
        )
      );
    } else {
      alert("Error: " + result.error);
    }
    setRespondingId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#25d366]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-800">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Invitations & Events</h1>
        <p className="text-[#64748b] text-xs font-semibold mt-0.5">
          Accept or decline event invitations. Attend to earn rewards.
        </p>
      </div>

      {events.length === 0 && (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400">
          <Calendar className="w-6 h-6 mx-auto mb-2" />
          <div className="font-bold">No events scheduled</div>
        </div>
      )}

      <div className="space-y-4">
        {events.map((event) => (
          <div
            key={event.id}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4"
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-bold text-base text-slate-900">{event.title}</h3>
                  <span className="text-[9px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-bold uppercase tracking-wider">
                    {event.event_type || "meet"}
                  </span>
                </div>
                <div className="flex items-center space-x-4 mt-2 text-xs text-slate-500">
                  <span className="flex items-center space-x-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{event.date}</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{event.location}</span>
                  </span>
                </div>
                {event.description && (
                  <p className="text-xs text-slate-500 mt-2">{event.description}</p>
                )}
              </div>

              {/* Status badge */}
              {event.invitation_status === "accepted" && (
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[9px] font-bold uppercase border border-emerald-200 flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{event.title.includes("New Project:") ? "Following" : "Accepted"}</span>
                </span>
              )}
              {event.invitation_status === "declined" && (
                <span className="px-2.5 py-1 rounded-full bg-red-50 text-red-600 text-[9px] font-bold uppercase border border-red-200 flex items-center space-x-1">
                  <XCircle className="w-3 h-3" />
                  <span>Declined</span>
                </span>
              )}
              {(!event.invitation_status || event.invitation_status === "pending") && (
                <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 text-[9px] font-bold uppercase border border-amber-200 flex items-center space-x-1">
                  <Clock className="w-3 h-3" />
                  <span>Pending</span>
                </span>
              )}
            </div>

            {/* Action buttons */}
            {event.invitation_status !== "accepted" && event.invitation_status !== "declined" && (
              <div className="flex space-x-3 pt-2 border-t border-slate-100">
                <button
                  onClick={() => handleRespond(event.id, "accepted")}
                  disabled={respondingId === event.id}
                  className="flex-1 py-2.5 bg-[#25d366] hover:bg-[#16c47f] text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 transition disabled:opacity-60"
                >
                  {respondingId === event.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Ticket className="w-3.5 h-3.5" />
                  )}
                  <span>{event.title.includes("New Project:") ? "Follow Project" : "Accept & Get Pass"}</span>
                </button>
                <button
                  onClick={() => handleRespond(event.id, "declined")}
                  disabled={respondingId === event.id}
                  className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-600 font-bold rounded-xl text-xs border border-slate-200 transition disabled:opacity-60"
                >
                  Decline
                </button>
              </div>
            )}

            {/* Change response */}
            {(event.invitation_status === "accepted" || event.invitation_status === "declined") && (
              <div className="pt-2 border-t border-slate-100">
                <button
                  onClick={() =>
                    handleRespond(
                      event.id,
                      event.invitation_status === "accepted" ? "declined" : "accepted"
                    )
                  }
                  disabled={respondingId === event.id}
                  className="text-[10px] text-slate-400 hover:text-slate-600 font-bold uppercase tracking-wider transition"
                >
                  {event.invitation_status === "accepted" 
                    ? (event.title.includes("New Project:") ? "Unfollow" : "Change to Decline") 
                    : (event.title.includes("New Project:") ? "Follow Project" : "Change to Accept")}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
