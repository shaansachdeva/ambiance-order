import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET — list all templates. Readable by every logged-in user: the format library
// is shared org-wide so anyone can pick an admin's format and print with it.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await prisma.barcodeTemplate.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(rows);
}

// POST — create a new template. Body: { name, data } where data is the full SavedTemplate JSON.
// Admin-only: everyone can use formats, only admins define them.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Only an admin can create label formats" }, { status: 403 });
  }

  const body = await req.json();
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const data = body?.data;
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  if (data === undefined) return NextResponse.json({ error: "data required" }, { status: 400 });

  const dataString = typeof data === "string" ? data : JSON.stringify(data);
  const row = await prisma.barcodeTemplate.create({
    data: {
      name,
      data: dataString,
      createdById: (session.user as any).id || null,
    },
  });
  return NextResponse.json(row);
}
