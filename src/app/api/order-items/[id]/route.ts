import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userEmail = session.user.email;
  const user = await prisma.user.findUnique({
    where: { username: userEmail as string },
  });

  if (!user || (!["ADMIN", "PRODUCTION", "DISPATCH"].includes(user.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { status, productionStages, notes, productDetails } = await request.json();

    const existing = await prisma.orderItem.findUnique({
      where: { id: params.id },
      include: { order: true }
    });

    if (!existing) {
      return NextResponse.json({ error: "Order item not found" }, { status: 404 });
    }

    const updateData: any = {};
    if (status !== undefined) updateData.status = status;
    if (productionStages !== undefined) updateData.productionStages = productionStages;
    if (productDetails !== undefined) {
      // Merge with existing productDetails so only changed keys are updated
      const existing_details = (() => {
        try { return JSON.parse(existing.productDetails || "{}"); } catch { return {}; }
      })();
      updateData.productDetails = JSON.stringify({ ...existing_details, ...productDetails });
    }

    const updated = await prisma.orderItem.update({
      where: { id: params.id },
      data: updateData,
    });

    // Record log and sync parent Order status
    if (status && status !== existing.status) {
      await prisma.orderItemStatusLog.create({
        data: {
          orderItemId: params.id,
          fromStatus: existing.status,
          toStatus: status,
          notes: notes || null,
          changedById: user.id,
        },
      });

      // Sync parent Order.status:
      // Rule: if ANY item is RAW_MATERIAL_NA → order is blocked (RAW_MATERIAL_NA)
      // Otherwise: order status = minimum (least advanced) of all items
      const STATUS_PRIORITY = [
        "ORDER_PLACED",
        "CONFIRMED",
        "IN_PRODUCTION",
        "RAW_MATERIAL_NA",
        "READY_FOR_DISPATCH",
        "DISPATCHED",
      ];
      const allItems = await prisma.orderItem.findMany({
        where: { orderId: existing.orderId },
        select: { status: true },
      });

      let orderStatus: string;
      if (allItems.some(item => item.status === "RAW_MATERIAL_NA")) {
        // Any blocked item blocks the whole order
        orderStatus = "RAW_MATERIAL_NA";
      } else {
        // Order reflects the least advanced item (nothing progresses until all are ready)
        orderStatus = allItems.reduce((worst, item) => {
          const itemIdx = STATUS_PRIORITY.indexOf(item.status);
          const worstIdx = STATUS_PRIORITY.indexOf(worst);
          return itemIdx < worstIdx ? item.status : worst;
        }, allItems[0]?.status || "ORDER_PLACED");
      }

      await prisma.order.update({
        where: { id: existing.orderId },
        data: { status: orderStatus },
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating order item:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
