import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = (session.user as any).role as string;
  if (userRole !== "ADMIN") {
    return NextResponse.json({ error: "Only admins can bulk delete orders" }, { status: 403 });
  }

  const { ids } = await request.json();
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "No order IDs provided" }, { status: 400 });
  }

  // Delete order items first (foreign key constraint), then orders
  await prisma.orderItem.deleteMany({ where: { orderId: { in: ids } } });
  const result = await prisma.order.deleteMany({ where: { id: { in: ids } } });

  return NextResponse.json({ deleted: result.count });
}
