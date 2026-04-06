import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/customers/export?ids=id1,id2  (empty ids = export all)
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get("ids");
  const ids = idsParam ? idsParam.split(",").filter(Boolean) : [];

  const customers = await prisma.customer.findMany({
    where: ids.length > 0 ? { id: { in: ids } } : { active: true },
    include: {
      orders: {
        orderBy: { createdAt: "desc" },
        include: { items: true },
      },
    },
    orderBy: { partyName: "asc" },
  });

  // Build CSV rows: one row per order, party details repeated
  // Header
  const header = [
    "Party Name",
    "Location",
    "Order ID",
    "Order Status",
    "Products",
    "Priority",
    "Delivery Deadline",
    "Order Date",
    "Remarks",
  ].join(",");

  const rows: string[] = [header];

  for (const customer of customers) {
    if (customer.orders.length === 0) {
      rows.push(
        [
          csvEscape(customer.partyName),
          csvEscape(customer.location || ""),
          "",
          "",
          "",
          "",
          "",
          new Date(customer.createdAt).toLocaleDateString("en-IN"),
          "",
        ].join(",")
      );
    } else {
      for (const order of customer.orders) {
        const products = order.items.length > 0
          ? order.items.map((i) => formatCategory(i.productCategory)).join(" + ")
          : formatCategory(order.productCategory);

        rows.push(
          [
            csvEscape(customer.partyName),
            csvEscape(customer.location || ""),
            order.orderId,
            order.status.replace(/_/g, " "),
            csvEscape(products),
            order.priority,
            order.deliveryDeadline
              ? new Date(order.deliveryDeadline).toLocaleDateString("en-IN")
              : "",
            new Date(order.createdAt).toLocaleDateString("en-IN"),
            csvEscape(order.remarks || ""),
          ].join(",")
        );
      }
    }
  }

  const csv = rows.join("\n");
  const filename = `parties-export-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function csvEscape(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function formatCategory(cat: string): string {
  const map: Record<string, string> = {
    BOPP_TAPE: "BOPP Tape",
    BOPP_JUMBO: "BOPP Jumbo",
    THERMAL_ROLL: "Thermal Roll",
    BARCODE_LABEL: "Barcode Label",
    COMPUTER_STATIONERY: "Computer Stationery",
  };
  return map[cat] || cat;
}
