import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Run all queries in parallel for performance
    const [
      totalOrders,
      pendingOrders,
      todayProductionLogs,
      readyForDispatch,
      dispatched,
      rawMaterialNA,
      recentOrders,
      allOrders,
      ordersByCategory,
    ] = await Promise.all([
      // Total orders
      prisma.order.count(),

      // Pending orders (not dispatched)
      prisma.order.count({
        where: { status: { not: "DISPATCHED" } },
      }),

      // Today's production: orders that had status changed to IN_PRODUCTION today
      prisma.orderStatusLog.findMany({
        where: {
          toStatus: "IN_PRODUCTION",
          changedAt: {
            gte: today,
            lt: tomorrow,
          },
        },
        select: { orderId: true },
        distinct: ["orderId"],
      }),

      // Ready for dispatch
      prisma.order.count({
        where: { status: "READY_FOR_DISPATCH" },
      }),

      // Dispatched
      prisma.order.count({
        where: { status: "DISPATCHED" },
      }),

      // Raw Material N/A
      prisma.order.count({
        where: { status: "RAW_MATERIAL_NA" },
      }),

      // Recent 10 orders with customer
      prisma.order.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: { customer: true },
      }),

      // All non-dispatched orders for deadline check
      prisma.order.findMany({
        where: {
          status: { not: "DISPATCHED" },
          deliveryDeadline: { not: null },
        },
        include: { customer: true },
      }),

      // Orders grouped by productCategory
      prisma.order.groupBy({
        by: ["productCategory"],
        _count: { id: true },
      }),
    ]);

    // Filter delayed orders: past deliveryDeadline and not dispatched
    const now = new Date();
    const delayedOrders = allOrders.filter(
      (order) => order.deliveryDeadline && new Date(order.deliveryDeadline) < now
    );

    // Format product-wise counts
    const productWiseCounts = ordersByCategory.map((group) => ({
      productCategory: group.productCategory,
      count: group._count.id,
    }));

    return NextResponse.json({
      totalOrders,
      pendingOrders,
      todayProduction: todayProductionLogs.length,
      readyForDispatch,
      dispatched,
      rawMaterialNA,
      recentOrders,
      productWiseCounts,
      delayedOrders,
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json({ error: "Failed to fetch dashboard stats" }, { status: 500 });
  }
}
