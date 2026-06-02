"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { respondToInvitation } from "@/app/agent/launches/actions";

export default function FollowProjectPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState("Loading project details...");

  useEffect(() => {
    async function processFollow() {
      const projectId = searchParams.get("project_id");
      if (!projectId) {
        setStatus("Invalid project link.");
        return;
      }

      const phone = localStorage.getItem("agentsapp_logged_in_phone");
      if (!phone) {
        // If not logged in, redirect to login
        router.push("/?redirect=/agent/follow?project_id=" + projectId);
        return;
      }

      setStatus("Following project...");
      
      // We use the event RSVP system under the hood where event.id = project.id
      const result = await respondToInvitation(phone, projectId, "accepted");
      
      if (result.ok) {
        setStatus("Successfully followed! Redirecting...");
        setTimeout(() => {
          router.push("/agent/following");
        }, 1500);
      } else {
        setStatus("Failed to follow project: " + result.error);
      }
    }

    processFollow();
  }, [searchParams, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 text-slate-800 p-4">
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xl max-w-sm w-full text-center space-y-4">
        <div className="w-16 h-16 bg-[#25d366]/10 rounded-full flex items-center justify-center mx-auto mb-2">
          <Loader2 className="w-8 h-8 text-[#25d366] animate-spin" />
        </div>
        <h2 className="text-xl font-extrabold tracking-tight">Processing Link</h2>
        <p className="text-sm font-semibold text-slate-500">{status}</p>
      </div>
    </div>
  );
}
