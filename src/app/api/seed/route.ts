import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST() {
  try {
    const hashedAdmin = await bcrypt.hash("admin123", 10);
    const hashedProd = await bcrypt.hash("prod123", 10);
    const hashedDispatch = await bcrypt.hash("dispatch123", 10);
    const hashedSales = await bcrypt.hash("sales123", 10);

    // Seed passwords are only ever stored hashed. The plaintext lives here in
    // source (dev fixtures), never in the database.
    const admin = await prisma.user.upsert({
      where: { username: "admin" },
      update: {},
      create: {
        name: "Admin",
        username: "admin",
        password: hashedAdmin,
        role: "ADMIN",
      },
    });

    const prod = await prisma.user.upsert({
      where: { username: "production" },
      update: {},
      create: {
        name: "Production Supervisor",
        username: "production",
        password: hashedProd,
        role: "PRODUCTION",
      },
    });

    const dispatch = await prisma.user.upsert({
      where: { username: "dispatch" },
      update: {},
      create: {
        name: "Dispatch Team",
        username: "dispatch",
        password: hashedDispatch,
        role: "DISPATCH",
      },
    });

    const sales = await prisma.user.upsert({
      where: { username: "sales" },
      update: {},
      create: {
        name: "Sales",
        username: "sales",
        password: hashedSales,
        role: "SALES",
      },
    });

    await prisma.counter.upsert({
      where: { id: "order_counter" },
      update: {},
      create: { id: "order_counter", value: 0 },
    });

    return NextResponse.json({
      message: "Seed complete",
      users: [
        { name: admin.name, username: admin.username, role: admin.role },
        { name: prod.name, username: prod.username, role: prod.role },
        { name: dispatch.name, username: dispatch.username, role: dispatch.role },
        { name: sales.name, username: sales.username, role: sales.role },
      ],
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json({ error: "Seed failed" }, { status: 500 });
  }
}
