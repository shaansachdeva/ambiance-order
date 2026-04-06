import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = (session.user as any).role;
  if (userRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = 50;
  const userId = searchParams.get("userId");
  const dateStr = searchParams.get("date");

  const where: any = {};
  if (userId) where.changedById = userId;
  if (dateStr) {
    const date = new Date(dateStr);
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    where.changedAt = { gte: date, lt: nextDay };
  }

  try {
    const [logs, total, users] = await Promise.all([
      prisma.orderStatusLog.findMany({
        where,
        include: {
          changedBy: {
            select: { id: true, name: true, role: true },
          },
          order: {
            select: { orderId: true, id: true, customer: { select: { partyName: true } } },
          },
        },
        orderBy: { changedAt: "desc" },
        take: limit,
        skip: (page - 1) * limit,
      }),

      prisma.orderStatusLog.count({ where }),

      prisma.user.findMany({
        select: { id: true, name: true, role: true },
        where: { active: true },
        orderBy: { name: "asc" },
      }),
    ]);

    return NextResponse.json({
      logs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      users,
    });
  } catch (error) {
    console.error("Activity log error:", error);
    return NextResponse.json({ error: "Failed to fetch activity log" }, { status: 500 });
  }
}
