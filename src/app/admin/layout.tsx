import AdminSidebar from "@/components/AdminSidebar";
import SessionSync from "@/components/SessionSync";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-[#070b13] overflow-hidden">
      <SessionSync />
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto p-8 text-slate-100">
        {children}
      </main>
    </div>
  );
}
