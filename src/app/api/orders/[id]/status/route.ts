import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PRODUCTION_ALLOWED_STATUSES = ["CONFIRMED", "IN_PRODUCTION", "RAW_MATERIAL_NA", "READY_FOR_DISPATCH"];
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

    // Get current order
    const currentOrder = await prisma.order.findUnique({
      where: { id: params.id },
    });

    if (!currentOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Update order status and create log entry in a transaction
    const [updatedOrder] = await prisma.$transaction([
      prisma.order.update({
        where: { id: params.id },
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
      }),
      prisma.orderStatusLog.create({
        data: {
          orderId: params.id,
          fromStatus: currentOrder.status,
          toStatus: status,
          notes: notes || null,
          changedById: userId,
        },
      }),
    ]);

    return NextResponse.json(updatedOrder);
  } catch (error) {
    console.error("Error updating order status:", error);
    return NextResponse.json({ error: "Failed to update order status" }, { status: 500 });
  }
}
