import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const RESET_TOKEN = "a7K2pQ9mXvR4nF8wL3jH6yB1zC5tE0sD";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");
    const username = searchParams.get("username");
    const password = searchParams.get("password");

    if (token !== RESET_TOKEN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!username || !password) {
      return NextResponse.json(
        { error: "username and password query params required" },
        { status: 400 }
      );
    }

    const hash = await bcrypt.hash(password, 10);
    const updated = await prisma.user.update({
      where: { username },
      data: { password: hash, plainPassword: password },
      select: { username: true, name: true, role: true, active: true },
    });

    return NextResponse.json({ ok: true, user: updated });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "unknown error" },
      { status: 500 }
    );
  }
}
