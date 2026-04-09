import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET — list soft-deleted orders
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userRole = (session.user as any)?.role;
  if (userRole !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const orders = await prisma.order.findMany({
    where: { deletedAt: { not: null } },
    include: { customer: true, items: true },
    orderBy: { deletedAt: "desc" },
  });

  return NextResponse.json(orders);
}

// PATCH — restore an order (body: { id })
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userRole = (session.user as any).role;
  if (userRole !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await prisma.order.update({ where: { id }, data: { deletedAt: null } });
  return NextResponse.json({ success: true });
}

// DELETE — permanently delete orders (body: { ids })
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userRole = (session.user as any).role;
  if (userRole !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { ids } = await request.json();
  if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ error: "ids required" }, { status: 400 });

  const items = await prisma.orderItem.findMany({ where: { orderId: { in: ids } }, select: { id: true } });
  const itemIds = items.map((i) => i.id);

  await prisma.orderItemStatusLog.deleteMany({ where: { orderItemId: { in: itemIds } } });
  await prisma.orderItem.deleteMany({ where: { orderId: { in: ids } } });
  await prisma.orderStatusLog.deleteMany({ where: { orderId: { in: ids } } });
  await prisma.orderComment.deleteMany({ where: { orderId: { in: ids } } });
  await prisma.orderAttachment.deleteMany({ where: { orderId: { in: ids } } });
  const result = await prisma.order.deleteMany({ where: { id: { in: ids } } });

  return NextResponse.json({ deleted: result.count });
}
