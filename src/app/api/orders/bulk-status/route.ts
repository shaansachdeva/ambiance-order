import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = (session.user as any).role as string;
  const userId = (session.user as any).id as string;

  // Only ADMIN, PRODUCTION, DISPATCH can bulk update
  if (!["ADMIN", "PRODUCTION", "DISPATCH"].includes(userRole)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { orderIds, status, notes } = body;

    if (!orderIds?.length || !status) {
      return NextResponse.json({ error: "orderIds and status are required" }, { status: 400 });
    }

    // Get current orders
    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds } },
      select: { id: true, status: true },
    });

    // Update all orders and create status logs in a transaction
    const operations: any[] = [];
    for (const order of orders) {
      if (order.status !== status) {
        operations.push(
          prisma.order.update({
            where: { id: order.id },
            data: { status },
          })
        );
        operations.push(
          prisma.orderStatusLog.create({
            data: {
              orderId: order.id,
              fromStatus: order.status,
              toStatus: status,
              notes: notes || "Bulk status update",
              changedById: userId,
            },
          })
        );
      }
    }

    if (operations.length > 0) {
      await prisma.$transaction(operations);
    }

    return NextResponse.json({
      updated: orders.filter((o) => o.status !== status).length,
    });
  } catch (error) {
    console.error("Error bulk updating status:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
