import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const materials = await prisma.rawMaterial.findMany({
    orderBy: { name: "asc" },
    include: {
      logs: {
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { name: true } },
        },
      },
    },
  });

  return NextResponse.json(materials);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = (session.user as any).role;
  if (!["ADMIN", "PRODUCTION"].includes(userRole)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, category, unit, currentStock, minStock } = body;

    if (!name?.trim() || !category || !unit) {
      return NextResponse.json({ error: "name, category, and unit are required" }, { status: 400 });
    }

    const material = await prisma.rawMaterial.create({
      data: {
        name: name.trim(),
        category,
        unit,
        currentStock: currentStock || 0,
        minStock: minStock || 0,
      },
    });

    return NextResponse.json(material, { status: 201 });
  } catch (error) {
    console.error("Error creating material:", error);
    return NextResponse.json({ error: "Failed to create material" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = (session.user as any).role;
  if (!["ADMIN", "PRODUCTION"].includes(userRole)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { materialId, type, quantity, notes } = body;
    const userId = (session.user as any).id;

    if (!materialId || !type || !quantity) {
      return NextResponse.json({ error: "materialId, type, and quantity are required" }, { status: 400 });
    }

    if (!["IN", "OUT"].includes(type)) {
      return NextResponse.json({ error: "type must be IN or OUT" }, { status: 400 });
    }

    const material = await prisma.rawMaterial.findUnique({
      where: { id: materialId },
    });

    if (!material) {
      return NextResponse.json({ error: "Material not found" }, { status: 404 });
    }

    const newStock =
      type === "IN"
        ? material.currentStock + quantity
        : material.currentStock - quantity;

    if (newStock < 0) {
      return NextResponse.json({ error: "Insufficient stock" }, { status: 400 });
    }

    const [updatedMaterial] = await prisma.$transaction([
      prisma.rawMaterial.update({
        where: { id: materialId },
        data: { currentStock: newStock },
      }),
      prisma.stockLog.create({
        data: {
          materialId,
          type,
          quantity,
          notes: notes || null,
          userId,
        },
      }),
    ]);

    return NextResponse.json(updatedMaterial);
  } catch (error) {
    console.error("Error updating stock:", error);
    return NextResponse.json({ error: "Failed to update stock" }, { status: 500 });
  }
}
