import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function parsePrefs(raw: string | null): Record<string, any> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as any).id as string;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });
  return NextResponse.json(parsePrefs(user?.preferences ?? null));
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as any).id as string;

  const body = await request.json().catch(() => ({}));
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Body must be an object" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });
  const current = parsePrefs(user?.preferences ?? null);
  const next = { ...current, ...body };

  await prisma.user.update({
    where: { id: userId },
    data: { preferences: JSON.stringify(next) },
  });

  return NextResponse.json(next);
}
