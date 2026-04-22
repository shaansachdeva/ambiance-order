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

  const idParam = String(params.id);

  // Search for the order by internal ID (cuid) first
  let order = await prisma.order.findFirst({
    where: { id: idParam },
    include: {
      customer: true,
      items: true,
    }
  });

  if (order) {
    if (order.deletedAt !== null) {
      return NextResponse.json({ error: "This order is in the recycle bin" }, { status: 404 });
    }
  } else {
    // Try by orderId
    order = await prisma.order.findFirst({
      where: { orderId: idParam },
      include: {
        customer: true,
        items: true,
      }
    });
    if (order && order.deletedAt !== null) {
      return NextResponse.json({ error: "This order is in the recycle bin" }, { status: 404 });
    }
  }

  if (!order) {
    return NextResponse.json({ error: `Order not found (ID: ${idParam})` }, { status: 404 });
  }

  // If we found it, re-fetch with full includes
  order = await prisma.order.findUnique({
    where: { id: order.id },
    include: {
      customer: true,
      items: {
        include: {
          statusLogs: {
            include: { changedBy: { select: { name: true } } },
            orderBy: { changedAt: "desc" },
          },
        },
      },
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
    console.warn(`Order fetch failed for ID: ${idParam}`);
    return NextResponse.json({ error: `Order not found (ID: ${idParam})` }, { status: 404 });
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

  // Find order first to get internal ID if params.id is the human-readable orderId
  const existingOrder = await prisma.order.findFirst({
    where: {
      OR: [{ id: params.id }, { orderId: params.id }],
      deletedAt: null,
    },
    select: { id: true, status: true },
  });

  if (!existingOrder) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const orderId = existingOrder.id;
  const userRole = (session.user as any).role as string;

  try {
    const body = await request.json();
    const { remarks, deliveryDeadline, challanNumber, jumboCode, productDetails, productCategory, productionStages, priority, items, status } = body;

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
      if (status !== undefined) updateData.status = status;
    } else if (userRole === "PRODUCTION") {
      if (jumboCode !== undefined) updateData.jumboCode = jumboCode;
      if (productionStages !== undefined) updateData.productionStages = productionStages;
      // Production can change order status (confirm, start production, raw material NA, ready)
      if (status !== undefined) updateData.status = status;
    } else if (userRole === "SALES") {
      if (remarks !== undefined) updateData.remarks = remarks;
      if (deliveryDeadline !== undefined) {
        updateData.deliveryDeadline = deliveryDeadline ? new Date(deliveryDeadline) : null;
      }
      if (priority !== undefined) updateData.priority = priority;
    } else if (userRole === "DISPATCH") {
      if (challanNumber !== undefined) updateData.challanNumber = challanNumber;
      // Dispatch can mark as dispatched
      if (status !== undefined) updateData.status = status;
    } else {
      return NextResponse.json(
        { error: "You do not have permission to update orders" },
        { status: 403 }
      );
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    if (items && Array.isArray(items) && (userRole === "ADMIN" || userRole === "ACCOUNTANT")) {
      // First update the order's core fields
      await prisma.order.update({
        where: { id: orderId },
        data: updateData,
      });

      // Use a transaction for items
      await prisma.$transaction(async (tx) => {
        // Collect dbIds that remain
        const remainingDbIds = items.map((i: any) => i.dbId).filter(Boolean);
        
        // Delete items that were removed
        await tx.orderItem.deleteMany({
          where: { 
            orderId: orderId,
            id: { notIn: remainingDbIds.length > 0 ? remainingDbIds : ["none"] }
          }
        });

        // Upsert items
        for (const item of items) {
          const productDetailsStr = typeof item.productDetails === "string" 
            ? item.productDetails 
            : JSON.stringify(item.productDetails || {});
            
          if (item.dbId) {
            await tx.orderItem.update({
              where: { id: item.dbId },
              data: {
                productCategory: item.productCategory,
                productDetails: productDetailsStr,
                rate: item.rate || null,
                gst: item.gst || null,
              }
            });
          } else {
            await tx.orderItem.create({
              data: {
                orderId: orderId,
                productCategory: item.productCategory,
                productDetails: productDetailsStr,
                rate: item.rate || null,
                gst: item.gst || null,
              }
            });
          }
        }
      });
    } else {
      await prisma.order.update({
        where: { id: orderId },
        data: updateData,
      });
    }

    // If status was changed, cascade to all items
    if (updateData.status) {
      await prisma.orderItem.updateMany({
        where: { orderId: orderId },
        data: { status: updateData.status },
      });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        items: true,
      },
    });

    return NextResponse.json(order);
  } catch (error: any) {
    console.error("Error updating order:", error);
    return NextResponse.json({ error: "Failed to update order", detail: error?.message || String(error) }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = (session.user as any).role;
  if (userRole !== "ADMIN") {
    return NextResponse.json(
      { error: "Only admins can delete orders" },
      { status: 403 }
    );
  }

  try {
    const existingOrder = await prisma.order.findFirst({
      where: {
        OR: [{ id: params.id }, { orderId: params.id }],
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!existingOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    await prisma.order.update({
      where: { id: existingOrder.id },
      data: { deletedAt: new Date() },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting order:", error);
    return NextResponse.json({ error: "Failed to delete order", detail: error?.message || String(error) }, { status: 500 });
  }
}
