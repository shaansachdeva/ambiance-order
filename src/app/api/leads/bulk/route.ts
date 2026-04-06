import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/leads/bulk  { action: "delete", ids: [...] }
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = (session.user as any).role;
  if (!["ADMIN", "SALES"].includes(userRole)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  try {
    const { action, ids } = await request.json();

    if (!ids?.length) {
      return NextResponse.json({ error: "ids are required" }, { status: 400 });
    }

    if (action === "delete") {
      // SALES can only delete their own leads; ADMIN can delete any
      const userId = (session.user as any).id;

      let where: any = { id: { in: ids } };
      if (userRole === "SALES") {
        where.salesPersonId = userId;
      }

      const result = await prisma.lead.deleteMany({ where });
      return NextResponse.json({ deleted: result.count });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Bulk lead action error:", error);
    return NextResponse.json({ error: "Failed to perform bulk action" }, { status: 500 });
  }
}
