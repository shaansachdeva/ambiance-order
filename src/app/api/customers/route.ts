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
  const withCount = searchParams.get("withCount") === "true";

  const customers = await prisma.customer.findMany({
    where: { active: true },
    orderBy: { partyName: "asc" },
    ...(withCount && { include: { _count: { select: { orders: true } } } }),
  });

  return NextResponse.json(customers);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { partyName, location } = body;

    if (!partyName || !partyName.trim()) {
      return NextResponse.json(
        { error: "partyName is required" },
        { status: 400 }
      );
    }

    const customer = await prisma.customer.create({
      data: {
        partyName: partyName.trim(),
        location: location?.trim() || null,
      },
    });

    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    console.error("Error creating customer:", error);
    return NextResponse.json({ error: "Failed to create customer" }, { status: 500 });
  }
}
