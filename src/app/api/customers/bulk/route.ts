import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/customers/bulk  { action: "delete", ids: [...] }
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = (session.user as any).role;
  if (userRole !== "ADMIN") {
    return NextResponse.json({ error: "Only admins can perform bulk actions" }, { status: 403 });
  }

  try {
    const { action, ids } = await request.json();

    if (!ids?.length) {
      return NextResponse.json({ error: "ids are required" }, { status: 400 });
    }

    if (action === "delete") {
      let deleted = 0;
      let deactivated = 0;

      for (const id of ids) {
        const orderCount = await prisma.order.count({ where: { customerId: id } });
        if (orderCount > 0) {
          await prisma.customer.update({ where: { id }, data: { active: false } });
          deactivated++;
        } else {
          await prisma.customer.delete({ where: { id } });
          deleted++;
        }
      }

      return NextResponse.json({ deleted, deactivated });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Bulk customer action error:", error);
    return NextResponse.json({ error: "Failed to perform bulk action" }, { status: 500 });
  }
}
