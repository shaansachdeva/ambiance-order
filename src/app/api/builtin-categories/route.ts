import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET — any authenticated user reads the overrides (to hide/relabel built-ins in pickers)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await prisma.builtinCategoryOverride.findMany();
  return NextResponse.json(rows);
}

// PATCH — admin upserts an override for a single built-in key
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { key, hidden, label } = body;
  if (!key || typeof key !== "string") return NextResponse.json({ error: "key required" }, { status: 400 });

  const trimmedLabel = typeof label === "string" ? label.trim() : null;
  const row = await prisma.builtinCategoryOverride.upsert({
    where: { key },
    update: {
      ...(hidden !== undefined && { hidden: Boolean(hidden) }),
      ...(label !== undefined && { label: trimmedLabel ? trimmedLabel : null }),
    },
    create: {
      key,
      hidden: Boolean(hidden),
      label: trimmedLabel || null,
    },
  });
  return NextResponse.json(row);
}
