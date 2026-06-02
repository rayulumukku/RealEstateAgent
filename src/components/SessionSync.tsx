"use client";

import { useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/app/auth/actions";

// ---------------------------------------------------------------------------
// SessionSync — Cross-tab session synchronization
//
// Features:
// 1. BroadcastChannel: Instantly notifies all same-origin tabs of logout.
// 2. localStorage sentinel: A fallback for browsers/contexts where
//    BroadcastChannel isn't available (e.g. older Safari, some WebViews).
//    Writing to localStorage fires a "storage" event in OTHER tabs.
// 3. Visibility check: When a tab regains focus, it checks if the session
//    sentinel still exists. If it was removed (logout in another tab while
//    this tab was in the background), it redirects to login.
//
// Usage: Render <SessionSync /> inside any authenticated layout.
// ---------------------------------------------------------------------------

const CHANNEL_NAME = "agentsapp_session_sync";
const STORAGE_KEY = "agentsapp_session_active";
const LOGOUT_EVENT = "logout";

export function broadcastLogout() {
  // 1. BroadcastChannel (instant, same-origin)
  try {
    const bc = new BroadcastChannel(CHANNEL_NAME);
    bc.postMessage({ type: LOGOUT_EVENT });
    bc.close();
  } catch {
    // BroadcastChannel not available — rely on localStorage fallback.
  }

  // 2. localStorage sentinel removal (fires "storage" event in other tabs)
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private browsing — ignore.
  }
}

export async function performLogout() {
  // Clear localStorage auth keys
  try {
    localStorage.removeItem("agentsapp_logged_in_phone");
    localStorage.removeItem("agentsapp_logged_in_user");
    localStorage.removeItem("agentsapp_logged_in_role");
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }

  // Broadcast to other tabs BEFORE the server call (so they react immediately)
  broadcastLogout();

  // Server action clears the httpOnly cookie
  await logout();

  // Redirect this tab
  window.location.assign("/auth/login");
}

export default function SessionSync() {
  const router = useRouter();
  const channelRef = useRef<BroadcastChannel | null>(null);

  const handleLogoutSignal = useCallback(() => {
    // Another tab logged out — clear local state and redirect.
    try {
      localStorage.removeItem("agentsapp_logged_in_phone");
      localStorage.removeItem("agentsapp_logged_in_user");
      localStorage.removeItem("agentsapp_logged_in_role");
    } catch {
      // ignore
    }
    window.location.assign("/auth/login");
  }, []);

  useEffect(() => {
    // Mark session as active (for the visibility-change check and storage event)
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }

    // --- BroadcastChannel listener ---
    try {
      const bc = new BroadcastChannel(CHANNEL_NAME);
      bc.onmessage = (event) => {
        if (event.data?.type === LOGOUT_EVENT) {
          handleLogoutSignal();
        }
      };
      channelRef.current = bc;
    } catch {
      // Not supported — localStorage fallback covers this.
    }

    // --- localStorage "storage" event (fires in OTHER tabs only) ---
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue === null) {
        // Key was removed → another tab logged out.
        handleLogoutSignal();
      }
    };
    window.addEventListener("storage", handleStorage);

    // --- Visibility change: check sentinel when tab regains focus ---
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        try {
          const active = localStorage.getItem(STORAGE_KEY);
          if (!active) {
            handleLogoutSignal();
          }
        } catch {
          // ignore
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      channelRef.current?.close();
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [handleLogoutSignal]);

  // This component renders nothing — it's purely behavioral.
  return null;
}
