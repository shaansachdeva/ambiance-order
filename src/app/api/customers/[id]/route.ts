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

  const customer = await prisma.customer.findUnique({
    where: { id: params.id },
    include: {
      _count: { select: { orders: true } },
    },
  });

  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  return NextResponse.json(customer);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = (session.user as any).role;
  if (!["ADMIN", "ACCOUNTANT"].includes(userRole)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { partyName, location } = body;

    const data: any = {};
    if (partyName !== undefined) data.partyName = partyName.trim();
    if (location !== undefined) data.location = location?.trim() || null;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const updated = await prisma.customer.update({
      where: { id: params.id },
      data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating customer:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
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
    return NextResponse.json({ error: "Only admins can delete parties" }, { status: 403 });
  }

  try {
    // Check if customer has orders
    const orderCount = await prisma.order.count({
      where: { customerId: params.id },
    });

    if (orderCount > 0) {
      // Soft-delete: deactivate instead of deleting
      await prisma.customer.update({
        where: { id: params.id },
        data: { active: false },
      });
      return NextResponse.json({ success: true, softDeleted: true, message: `Party deactivated (has ${orderCount} orders)` });
    }

    // Hard delete if no orders
    await prisma.customer.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting customer:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
