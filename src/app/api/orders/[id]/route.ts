import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = (session.user as any).role;

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      customer: true,
      items: true,
      comments: {
        include: {
          user: {
            select: { id: true, name: true, username: true, role: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      attachments: {
        include: {
          user: {
            select: { id: true, name: true, role: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      statusLogs: {
        include: {
          changedBy: {
            select: { id: true, name: true, username: true, role: true },
          },
        },
        orderBy: { changedAt: "desc" },
      },
      createdBy: {
        select: { id: true, name: true, username: true, role: true },
      },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (userRole === "PRODUCTION") {
    return NextResponse.json({ ...order, customer: null });
  }

  return NextResponse.json(order);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = (session.user as any).role as string;

  try {
    const body = await request.json();
    const { remarks, deliveryDeadline, challanNumber, jumboCode, productDetails, productCategory, productionStages, priority } = body;

    const updateData: any = {};

    if (userRole === "ADMIN" || userRole === "ACCOUNTANT") {
      if (remarks !== undefined) updateData.remarks = remarks;
      if (deliveryDeadline !== undefined) {
        updateData.deliveryDeadline = deliveryDeadline ? new Date(deliveryDeadline) : null;
      }
      if (challanNumber !== undefined) updateData.challanNumber = challanNumber;
      if (jumboCode !== undefined) updateData.jumboCode = jumboCode;
      if (productDetails !== undefined) {
        updateData.productDetails =
          typeof productDetails === "string" ? productDetails : JSON.stringify(productDetails);
      }
      if (productCategory !== undefined) updateData.productCategory = productCategory;
      if (productionStages !== undefined) updateData.productionStages = productionStages;
      if (priority !== undefined) updateData.priority = priority;
    } else if (userRole === "PRODUCTION") {
      if (jumboCode !== undefined) updateData.jumboCode = jumboCode;
      if (productionStages !== undefined) updateData.productionStages = productionStages;
    } else if (userRole === "DISPATCH") {
      if (challanNumber !== undefined) updateData.challanNumber = challanNumber;
    } else {
      return NextResponse.json(
        { error: "You do not have permission to update orders" },
        { status: 403 }
      );
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const order = await prisma.order.update({
      where: { id: params.id },
      data: updateData,
      include: {
        customer: true,
        items: true,
      },
    });

    return NextResponse.json(order);
  } catch (error) {
    console.error("Error updating order:", error);
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }
}
