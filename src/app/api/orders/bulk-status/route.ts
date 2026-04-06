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

    // Get current orders with their items
    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds } },
      select: { id: true, status: true, items: { select: { status: true } } },
    });

    // If targeting READY_FOR_DISPATCH or DISPATCHED, skip orders with blocked items
    let ordersToUpdate = orders.filter((o) => o.status !== status);
    let skippedDueToRawMaterial = 0;
    if (status === "READY_FOR_DISPATCH" || status === "DISPATCHED") {
      const blockedIds = ordersToUpdate
        .filter((o) => o.items.some((item) => item.status === "RAW_MATERIAL_NA"))
        .map((o) => o.id);
      if (blockedIds.length > 0) {
        skippedDueToRawMaterial = blockedIds.length;
        ordersToUpdate = ordersToUpdate.filter((o) => !blockedIds.includes(o.id));
      }
    }

    if (ordersToUpdate.length > 0) {
      // Use callback-based transaction (required for driver adapters)
      await prisma.$transaction(async (tx) => {
        for (const order of ordersToUpdate) {
          await tx.order.update({
            where: { id: order.id },
            data: { status },
          });
          // Cascade status to all items in this order
          await tx.orderItem.updateMany({
            where: { orderId: order.id },
            data: { status },
          });
          await tx.orderStatusLog.create({
            data: {
              orderId: order.id,
              fromStatus: order.status,
              toStatus: status,
              notes: notes || "Bulk status update",
              changedById: userId,
            },
          });
        }
      });
    }

    return NextResponse.json({ updated: ordersToUpdate.length, skipped: skippedDueToRawMaterial });
  } catch (error: any) {
    console.error("Error bulk updating status:", error);
    return NextResponse.json({ error: "Failed to update", detail: error?.message || String(error) }, { status: 500 });
  }
}
