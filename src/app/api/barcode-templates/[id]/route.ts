import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH — update a template (rename and/or replace data). Admin-only.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Only an admin can rename or edit label formats" }, { status: 403 });
  }
  const { id } = await params;

  const body = await req.json();
  const update: { name?: string; data?: string } = {};
  if (typeof body?.name === "string" && body.name.trim()) update.name = body.name.trim();
  if (body?.data !== undefined) {
    update.data = typeof body.data === "string" ? body.data : JSON.stringify(body.data);
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  try {
    const row = await prisma.barcodeTemplate.update({ where: { id }, data: update });
    return NextResponse.json(row);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

// DELETE — remove a template. Admin-only.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Only an admin can delete label formats" }, { status: 403 });
  }
  const { id } = await params;
  try {
    await prisma.barcodeTemplate.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
