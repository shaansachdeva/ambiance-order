import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PRODUCTION_ALLOWED_STATUSES = ["CONFIRMED", "IN_PRODUCTION", "RAW_MATERIAL_NA", "READY_FOR_DISPATCH"];
const ACCOUNTANT_ALLOWED_STATUSES = ["CONFIRMED", "IN_PRODUCTION", "RAW_MATERIAL_NA", "READY_FOR_DISPATCH", "DISPATCHED"];
const DISPATCH_ALLOWED_STATUSES = ["DISPATCHED"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = (session.user as any).role as string;
  const userId = (session.user as any).id as string;

  try {
    const body = await request.json();
    const { status, notes } = body;

    if (!status) {
      return NextResponse.json({ error: "Status is required" }, { status: 400 });
    }

    // Get current order - support both CUID and human-readable orderId
    const currentOrder = await prisma.order.findFirst({
      where: {
        OR: [{ id: params.id }, { orderId: params.id }],
        deletedAt: null,
      },
    });

    if (!currentOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const orderId = currentOrder.id;

    // Validate role-based status transitions
    if (userRole === "ADMIN") {
      // ADMIN can change to any status - no restriction
    } else if (userRole === "PRODUCTION") {
      if (!PRODUCTION_ALLOWED_STATUSES.includes(status)) {
        return NextResponse.json(
          { error: `Production role can only set status to: ${PRODUCTION_ALLOWED_STATUSES.join(", ")}` },
          { status: 403 }
        );
      }
    } else if (userRole === "ACCOUNTANT") {
      if (!ACCOUNTANT_ALLOWED_STATUSES.includes(status)) {
        return NextResponse.json(
          { error: `Accountant role can only set status to: ${ACCOUNTANT_ALLOWED_STATUSES.join(", ")}` },
          { status: 403 }
        );
      }
    } else if (userRole === "DISPATCH") {
      if (!DISPATCH_ALLOWED_STATUSES.includes(status)) {
        return NextResponse.json(
          { error: `Dispatch role can only set status to: ${DISPATCH_ALLOWED_STATUSES.join(", ")}` },
          { status: 403 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "You do not have permission to update order status" },
        { status: 403 }
      );
    }

    // Block progression if any item has raw material issue
    if (status === "READY_FOR_DISPATCH" || status === "DISPATCHED") {
      const items = await prisma.orderItem.findMany({
        where: { orderId: orderId },
        select: { status: true },
      });
      if (items.some((item) => item.status === "RAW_MATERIAL_NA")) {
        return NextResponse.json(
          { error: "Cannot proceed: one or more items are blocked due to raw material unavailability. Resolve all material issues first." },
          { status: 400 }
        );
      }
    }

    // Update order status, cascade to all items, and create log — all in one transaction
    const updatedOrder = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status },
        include: {
          customer: true,
          statusLogs: {
            include: {
              changedBy: {
                select: {
                  id: true,
                  name: true,
                  username: true,
                  role: true,
                },
              },
            },
            orderBy: { changedAt: "desc" },
          },
        },
      });

      // Cascade status to all items in this order
      await tx.orderItem.updateMany({
        where: { orderId: orderId },
        data: { status },
      });

      await tx.orderStatusLog.create({
        data: {
          orderId: orderId,
          fromStatus: currentOrder.status,
          toStatus: status,
          notes: notes || null,
          changedById: userId,
        },
      });

      return updated;
    });

    return NextResponse.json(updatedOrder);
  } catch (error: any) {
    console.error("Error updating order status:", error);
    return NextResponse.json({ error: "Failed to update order status", detail: error?.message || String(error) }, { status: 500 });
  }
}
