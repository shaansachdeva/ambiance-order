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

  const userRole = (session.user as any).role;

  const where: any = {};

  if (status) where.status = status;
  if (productCategory) {
    // Search in both order-level and item-level categories
    where.OR = [
      { productCategory },
      { items: { some: { productCategory } } },
    ];
  }
  if (search) where.orderId = { contains: search };
  if (customerId) where.customerId = customerId;
  if (priority) where.priority = priority;

  const orders = await prisma.order.findMany({
    where,
    include: {
      customer: userRole === "PRODUCTION" ? false : true,
      items: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (userRole === "PRODUCTION") {
    const ordersWithNullCustomer = orders.map((order) => ({
      ...order,
      customer: null,
    }));
    return NextResponse.json(ordersWithNullCustomer);
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

    // Auto-generate orderId
    const counter = await prisma.counter.upsert({
      where: { id: "order_counter" },
      update: { value: { increment: 1 } },
      create: { id: "order_counter", value: 1 },
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
            amount: item.amount || null,
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
  } catch (error) {
    console.error("Error creating order:", error);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}
