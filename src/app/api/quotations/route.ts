import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/quotations — list all quotations
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const search = searchParams.get("search");

  const where: any = {};
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { quotationId: { contains: search } },
      { customer: { partyName: { contains: search } } },
      { remarks: { contains: search } },
    ];
  }

  const quotations = await prisma.quotation.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { id: true, partyName: true, location: true } },
      createdBy: { select: { id: true, name: true } },
      items: true,
    },
  });

  return NextResponse.json(quotations);
}

// POST /api/quotations — create a new quotation
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const body = await req.json();
  const { customerId, remarks, validUntil, termsAndCond, items } = body;

  if (!customerId) return NextResponse.json({ error: "Customer is required" }, { status: 400 });
  if (!items || items.length === 0) return NextResponse.json({ error: "At least one item is required" }, { status: 400 });

  // Auto-increment quotation counter
  const counter = await prisma.quotationCounter.upsert({
    where: { id: "quotation_counter" },
    update: { value: { increment: 1 } },
    create: { id: "quotation_counter", value: 1 },
  });

  const quotationId = `QT-${String(counter.value).padStart(4, "0")}`;

  const quotation = await prisma.quotation.create({
    data: {
      quotationId,
      customerId,
      remarks: remarks || null,
      validUntil: validUntil ? new Date(validUntil) : null,
      termsAndCond: termsAndCond || null,
      createdById: userId,
      items: {
        create: items.map((item: any) => ({
          productCategory: item.productCategory,
          productDetails: typeof item.productDetails === "string"
            ? item.productDetails
            : JSON.stringify(item.productDetails || {}),
          rate: item.rate ? parseFloat(item.rate) : null,
          gst: item.gst ? parseFloat(item.gst) : null,
        })),
      },
    },
    include: {
      customer: true,
      createdBy: { select: { id: true, name: true } },
      items: true,
    },
  });

  return NextResponse.json(quotation, { status: 201 });
}
