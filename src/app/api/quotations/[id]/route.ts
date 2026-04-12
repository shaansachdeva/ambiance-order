import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/quotations/[id]
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const quotation = await prisma.quotation.findUnique({
    where: { id: params.id },
    include: {
      customer: { select: { id: true, partyName: true, location: true } },
      createdBy: { select: { id: true, name: true } },
      items: true,
    },
  });

  if (!quotation) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
  return NextResponse.json(quotation);
}

// PATCH /api/quotations/[id]
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const exists = await prisma.quotation.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });

  const body = await req.json();
  const { status, remarks, validUntil, termsAndCond, customerId, items } = body;

  // Full edit: replace items if provided — wrapped in transaction to avoid partial updates
  if (items !== undefined) {
    const updated = await prisma.$transaction(async (tx) => {
      await tx.quotationItem.deleteMany({ where: { quotationId: params.id } });
      return tx.quotation.update({
        where: { id: params.id },
        data: {
          ...(customerId !== undefined && { customerId: customerId || null }),
          ...(remarks !== undefined && { remarks }),
          ...(validUntil !== undefined && { validUntil: validUntil ? new Date(validUntil) : null }),
          ...(termsAndCond !== undefined && { termsAndCond }),
          items: {
            create: items.map((item: any) => ({
              productCategory: item.productCategory || "BOPP_TAPE",
              productDetails: JSON.stringify(item.productDetails || {}),
              rate: item.rate ? parseFloat(item.rate) : null,
              gst: item.gst ? parseFloat(item.gst) : null,
            })),
          },
        },
        include: { customer: true, createdBy: { select: { id: true, name: true } }, items: true },
      });
    });
    return NextResponse.json(updated);
  }

  const quotation = await prisma.quotation.update({
    where: { id: params.id },
    data: {
      ...(status && { status }),
      ...(remarks !== undefined && { remarks }),
      ...(validUntil !== undefined && { validUntil: validUntil ? new Date(validUntil) : null }),
      ...(termsAndCond !== undefined && { termsAndCond }),
    },
    include: {
      customer: true,
      createdBy: { select: { id: true, name: true } },
      items: true,
    },
  });

  return NextResponse.json(quotation);
}

// DELETE /api/quotations/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role;
  if (role !== "ADMIN" && role !== "SALES" && role !== "ACCOUNTANT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.quotation.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
