"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import WhatsAppSimulationWidget from "./WhatsAppSimulationWidget";
import { 
  Home, Users, Briefcase, Calendar, 
  Award, User 
} from "lucide-react";

export default function AgentBottomNav() {
  const pathname = usePathname();
  // Hooks for the bot widget have been extracted to WhatsAppSimulationWidget.tsx

  const menuItems = [
    { name: "Home", href: "/agent/dashboard", icon: Home },
    { name: "Leads", href: "/agent/pipeline", icon: Users },
    { name: "Inventory", href: "/agent/inventory", icon: Briefcase },
    { name: "Events", href: "/agent/invitations", icon: Calendar },
    { name: "Rewards", href: "/agent/rewards", icon: Award },
    { name: "Profile", href: "/agent/profile", icon: User },
  ];

  return (
    <>
      {/* Bottom Nav Bar - Mobile Only */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200/90 py-2 px-3 flex justify-around items-center shadow-lg">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link 
              key={item.name} 
              href={item.href}
              className={`flex flex-col items-center space-y-1 text-[#64748b] hover:text-[#16c47f] transition ${
                isActive ? "text-[#25d366]" : ""
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="text-[9px] font-bold tracking-tight">{item.name}</span>
            </Link>
          );
        })}
      </div>

      <WhatsAppSimulationWidget />
    </>
  );
}
