import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatOrderId } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const productCategory = searchParams.get("productCategory");
  const search = searchParams.get("search");
  const customerId = searchParams.get("customerId");
  const priority = searchParams.get("priority");
  const createdById = searchParams.get("createdById");

  const userRole = (session.user as any).role;

  const andConditions: any[] = [];

  if (createdById) andConditions.push({ createdById });

  if (status === "RAW_MATERIAL_NA") {
    // Include orders where order-level OR any item is RAW_MATERIAL_NA
    andConditions.push({
      OR: [
        { status: "RAW_MATERIAL_NA" },
        { items: { some: { status: "RAW_MATERIAL_NA" } } },
      ],
    });
  } else if (status === "not_dispatched") {
    // For Production Queue / Activity Log filters
    andConditions.push({ status: { not: "DISPATCHED" } });
  } else if (status) {
    andConditions.push({ status });
  }

  if (productCategory) {
    // Search in both order-level and item-level categories
    andConditions.push({
      OR: [
        { productCategory },
        { items: { some: { productCategory } } },
      ],
    });
  }

  if (search) andConditions.push({ orderId: { contains: search } });
  if (customerId) andConditions.push({ customerId });
  if (priority) andConditions.push({ priority });

  // Always exclude soft-deleted orders
  andConditions.push({ deletedAt: null });
  const where: any = { AND: andConditions };

  // For RAW_MATERIAL_NA queries include item statusLogs so UI can show which material is missing
  const includeItemNotes = status === "RAW_MATERIAL_NA";

  const orders = await prisma.order.findMany({
    where,
    include: {
      customer: true, // Always include customer to avoid breaking frontend logic
      items: includeItemNotes
        ? {
            include: {
              statusLogs: {
                where: { toStatus: "RAW_MATERIAL_NA" },
                orderBy: { changedAt: "desc" },
                take: 1,
                select: { notes: true, changedAt: true },
              },
            },
          }
        : true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (userRole === "PRODUCTION") {
    // For PRODUCTION, obfuscate customer name if not ready for dispatch or dispatched
    return NextResponse.json(orders.map((o) => {
      const isPublic = ["READY_FOR_DISPATCH", "DISPATCHED"].includes(o.status);
      if (isPublic) return o;
      return {
        ...o,
        customer: o.customer ? { ...o.customer, partyName: "Restricted" } : null
      };
    }));
  }

  return NextResponse.json(orders);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { customerId, items, deliveryDeadline, remarks, priority } = body;

    // Support both new multi-item format and legacy single-item format
    const orderItems = items || [];

    if (!customerId) {
      return NextResponse.json({ error: "customerId is required" }, { status: 400 });
    }

    if (orderItems.length === 0 && !body.productCategory) {
      return NextResponse.json({ error: "At least one item is required" }, { status: 400 });
    }

    const userId = (session.user as any).id;

    // Auto-generate orderId — wrapped in transaction for atomicity under concurrent requests
    const counter = await prisma.$transaction(async (tx) => {
      return tx.counter.upsert({
        where: { id: "order_counter" },
        update: { value: { increment: 1 } },
        create: { id: "order_counter", value: 1 },
      });
    });

    const orderId = formatOrderId(counter.value);

    // Use first item's category as the order-level category (for backward compat)
    const firstItem = orderItems[0] || {
      productCategory: body.productCategory,
      productDetails: body.productDetails,
    };

    const order = await prisma.order.create({
      data: {
        orderId,
        productCategory: firstItem.productCategory,
        productDetails:
          typeof firstItem.productDetails === "string"
            ? firstItem.productDetails
            : JSON.stringify(firstItem.productDetails || {}),
        customerId,
        remarks: remarks || null,
        deliveryDeadline: deliveryDeadline ? new Date(deliveryDeadline) : null,
        priority: priority || "NORMAL",
        status: "ORDER_PLACED",
        createdById: userId,
        statusLogs: {
          create: {
            fromStatus: "",
            toStatus: "ORDER_PLACED",
            notes: "Order created",
            changedById: userId,
          },
        },
        items: {
          create: orderItems.map((item: any) => ({
            productCategory: item.productCategory,
            productDetails:
              typeof item.productDetails === "string"
                ? item.productDetails
                : JSON.stringify(item.productDetails || {}),
            rate: item.rate || null,
            gst: item.gst || null,
          })),
        },
      },
      include: {
        customer: true,
        statusLogs: true,
        items: true,
      },
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error: any) {
    console.error("Error creating order:", error);
    return NextResponse.json({ error: "Failed to create order", detail: error?.message || String(error) }, { status: 500 });
  }
}
