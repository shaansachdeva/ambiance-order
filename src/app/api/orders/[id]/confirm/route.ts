import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = (session.user as any).role;
  const userId = (session.user as any).id;

  if (userRole !== "ADMIN") {
    return NextResponse.json({ error: "Only admin can confirm orders" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { action, notes } = body; // action: "confirm" | "reject"

    if (!["confirm", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const order = await prisma.order.findFirst({
      where: {
        OR: [{ id: params.id }, { orderId: params.id }],
        deletedAt: null,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.status !== "PENDING_CONFIRMATION") {
      return NextResponse.json({ error: "Order is not pending confirmation" }, { status: 400 });
    }

    const newStatus = action === "confirm" ? "ORDER_PLACED" : "REJECTED";

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: { status: newStatus },
      });

      await tx.orderItem.updateMany({
        where: { orderId: order.id },
        data: { status: newStatus },
      });

      await tx.orderStatusLog.create({
        data: {
          orderId: order.id,
          fromStatus: "PENDING_CONFIRMATION",
          toStatus: newStatus,
          notes: notes || (action === "confirm" ? "Order confirmed by admin" : "Order rejected by admin"),
          changedById: userId,
        },
      });
    });

    return NextResponse.json({ success: true, status: newStatus });
  } catch (error: any) {
    console.error("Error confirming order:", error);
    return NextResponse.json({ error: "Failed to confirm order", detail: error?.message }, { status: 500 });
  }
}
