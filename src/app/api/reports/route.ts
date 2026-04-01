import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));

  // Date range for the month
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  try {
    const [
      ordersInMonth,
      dispatchedLogs,
      ordersByCategory,
      ordersByStatus,
    ] = await Promise.all([
      // All orders created in this month
      prisma.order.findMany({
        where: {
          createdAt: { gte: startDate, lt: endDate },
        },
        include: { customer: true },
        orderBy: { createdAt: "asc" },
      }),

      // Orders dispatched in this month
      prisma.orderStatusLog.findMany({
        where: {
          toStatus: "DISPATCHED",
          changedAt: { gte: startDate, lt: endDate },
        },
        select: { orderId: true },
        distinct: ["orderId"],
      }),

      // Orders by category for this month
      prisma.order.groupBy({
        by: ["productCategory"],
        where: { createdAt: { gte: startDate, lt: endDate } },
        _count: { id: true },
      }),

      // Orders by current status for this month
      prisma.order.groupBy({
        by: ["status"],
        where: { createdAt: { gte: startDate, lt: endDate } },
        _count: { id: true },
      }),
    ]);

    const totalOrders = ordersInMonth.length;
    const completedOrders = dispatchedLogs.length;
    const pendingOrders = totalOrders - ordersInMonth.filter(o => o.status === "DISPATCHED").length;

    // Product-wise
    const productWise = ordersByCategory.map((g) => ({
      productCategory: g.productCategory,
      count: g._count.id,
    }));

    // Status-wise
    const statusWise = ordersByStatus.map((g) => ({
      status: g.status,
      count: g._count.id,
    }));

    // Customer-wise (top 10)
    const customerMap: Record<string, { partyName: string; location: string | null; count: number }> = {};
    for (const order of ordersInMonth) {
      const key = order.customerId;
      if (!customerMap[key]) {
        customerMap[key] = {
          partyName: order.customer.partyName,
          location: order.customer.location,
          count: 0,
        };
      }
      customerMap[key].count++;
    }
    const customerWise = Object.values(customerMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Daily orders
    const dailyMap: Record<string, number> = {};
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      dailyMap[dateStr] = 0;
    }
    for (const order of ordersInMonth) {
      const dateStr = new Date(order.createdAt).toISOString().split("T")[0];
      if (dailyMap[dateStr] !== undefined) {
        dailyMap[dateStr]++;
      }
    }
    const dailyOrders = Object.entries(dailyMap).map(([date, count]) => ({
      date,
      count,
    }));

    return NextResponse.json({
      totalOrders,
      completedOrders,
      pendingOrders,
      productWise,
      statusWise,
      customerWise,
      dailyOrders,
    });
  } catch (error) {
    console.error("Error fetching report:", error);
    return NextResponse.json({ error: "Failed to fetch report" }, { status: 500 });
  }
}
