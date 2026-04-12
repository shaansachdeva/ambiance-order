import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import type { UserRole } from "@/types";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const user = {
    name: session.user.name || "User",
    role: ((session.user as any).role || "SALES") as UserRole,
    customPermissions: (session.user as any).customPermissions as string[] | null,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar user={user as any} />
      <main className="md:ml-64 pb-20 md:pb-0 pt-14 md:pt-0">
        <div className="p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
