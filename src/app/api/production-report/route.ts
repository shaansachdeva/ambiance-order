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
  const dateStr = searchParams.get("date");

  // Default to today
  const date = dateStr ? new Date(dateStr) : new Date();
  date.setHours(0, 0, 0, 0);
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);

  try {
    const [
      ordersCreatedToday,
      statusChangesToday,
      allActiveOrders,
      dispatchedToday,
    ] = await Promise.all([
      // Orders created on this date
      prisma.order.findMany({
        where: {
          createdAt: { gte: date, lt: nextDay },
        },
        include: { customer: true, items: true },
        orderBy: { createdAt: "desc" },
      }),

      // All status changes on this date
      prisma.orderStatusLog.findMany({
        where: {
          changedAt: { gte: date, lt: nextDay },
        },
        include: {
          changedBy: { select: { name: true } },
          order: {
            select: {
              orderId: true,
              id: true,
              productCategory: true,
              customer: { select: { partyName: true } },
            },
          },
        },
        orderBy: { changedAt: "desc" },
      }),

      // Current snapshot: all non-dispatched orders
      prisma.order.groupBy({
        by: ["status"],
        _count: { id: true },
        where: { status: { not: "DISPATCHED" } },
      }),

      // Orders dispatched today
      prisma.orderStatusLog.findMany({
        where: {
          toStatus: "DISPATCHED",
          changedAt: { gte: date, lt: nextDay },
        },
        include: {
          order: {
            select: {
              orderId: true,
              id: true,
              productCategory: true,
              customer: { select: { partyName: true } },
              items: true,
            },
          },
        },
        distinct: ["orderId"],
      }),
    ]);

    // Went into production today
    const inProductionToday = statusChangesToday.filter(
      (log) => log.toStatus === "IN_PRODUCTION"
    );

    // Orders that became ready today
    const readyToday = statusChangesToday.filter(
      (log) => log.toStatus === "READY_FOR_DISPATCH"
    );

    // Current pipeline snapshot
    const pipelineSnapshot = allActiveOrders.map((g) => ({
      status: g.status,
      count: g._count.id,
    }));

    // Summary stats
    const summary = {
      ordersReceived: ordersCreatedToday.length,
      movedToProduction: inProductionToday.length,
      madeReady: readyToday.length,
      dispatched: dispatchedToday.length,
      totalStatusChanges: statusChangesToday.length,
    };

    return NextResponse.json({
      date: date.toISOString().split("T")[0],
      summary,
      pipelineSnapshot,
      ordersCreated: ordersCreatedToday,
      statusChanges: statusChangesToday,
      dispatchedOrders: dispatchedToday.map((d) => d.order),
      inProductionOrders: inProductionToday.map((d) => ({
        ...d.order,
        changedBy: d.changedBy.name,
      })),
    });
  } catch (error) {
    console.error("Production report error:", error);
    return NextResponse.json({ error: "Failed to fetch report" }, { status: 500 });
  }
}
