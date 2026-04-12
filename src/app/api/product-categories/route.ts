import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/product-categories — list all custom categories (active)
export async function GET() {
  const categories = await prisma.customProductCategory.findMany({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(categories);
}

// POST /api/product-categories — create a new custom category (admin only)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { name, fields } = body;

  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  try {
    const category = await prisma.customProductCategory.create({
      data: {
        name: name.trim(),
        fields: Array.isArray(fields) ? JSON.stringify(fields) : JSON.stringify([]),
      },
    });
    return NextResponse.json(category, { status: 201 });
  } catch (err: any) {
    if (err.code === "P2002") return NextResponse.json({ error: "Category name already exists" }, { status: 400 });
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}

// PATCH /api/product-categories — update (deactivate) a category
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { id, active, fields } = body;
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  const category = await prisma.customProductCategory.update({
    where: { id },
    data: {
      ...(active !== undefined && { active }),
      ...(fields !== undefined && { fields: JSON.stringify(fields) }),
    },
  });
  return NextResponse.json(category);
}

// DELETE /api/product-categories — permanently delete (admin only)
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  await prisma.customProductCategory.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
