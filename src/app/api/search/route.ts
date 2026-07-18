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
  const q = searchParams.get("q")?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ orders: [], customers: [] });
  }

  const userRole = (session.user as any).role;
  const showCustomers = ["ADMIN", "SALES", "ACCOUNTANT"].includes(userRole);

  // Postgres `contains` is case-sensitive by default, so party names stored as
  // "Shivam Stationery" would never match a user typing "shivam". Opt into
  // case-insensitive matching on Postgres (SQLite `contains` is already
  // case-insensitive and rejects the `mode` arg, so omit it there).
  const isPg = process.env.DB_PROVIDER === "postgresql";
  const mode = isPg ? { mode: "insensitive" as const } : {};

  try {
    const [orders, customers] = await Promise.all([
      // Search orders by orderId or product category
      prisma.order.findMany({
        where: {
          deletedAt: null,
          OR: [
            { orderId: { contains: q, ...mode } },
            { productCategory: { contains: q, ...mode } },
            { remarks: { contains: q, ...mode } },
            ...(showCustomers
              ? [{ customer: { partyName: { contains: q, ...mode } } }]
              : []),
          ],
        },
        include: {
          customer: showCustomers,
          items: true,
        },
        take: 15,
        orderBy: { createdAt: "desc" },
      }),

      // Search customers
      showCustomers
        ? prisma.customer.findMany({
            where: {
              OR: [
                { partyName: { contains: q, ...mode } },
                { location: { contains: q, ...mode } },
              ],
            },
            take: 5,
            orderBy: { partyName: "asc" },
          })
        : [],
    ]);

    return NextResponse.json({ orders, customers });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
