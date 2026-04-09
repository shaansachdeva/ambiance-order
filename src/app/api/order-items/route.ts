import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const searchParams = request.nextUrl.searchParams;
  const includeDispatched = searchParams.get("includeDispatched") === "true";
  
  try {
    const items = await prisma.orderItem.findMany({
      where: includeDispatched
        ? { order: { deletedAt: null } }
        : { status: { not: "DISPATCHED" }, order: { deletedAt: null } },
      include: {
        order: {
          include: {
            customer: true,
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    const flattened = items.map((item) => ({
      id: item.id,
      orderId: item.order.orderId,
      originalOrderId: item.orderId,
      status: item.status,
      productCategory: item.productCategory,
      productDetails: item.productDetails,
      priority: item.order.priority,
      deliveryDeadline: item.order.deliveryDeadline,
      customer: item.order.customer,
      createdAt: item.createdAt,
    }));
    
    return NextResponse.json(flattened);
  } catch (error) {
    console.error("Error fetching order items:", error);
    return NextResponse.json({ error: "Failed to fetch order items" }, { status: 500 });
  }
}
