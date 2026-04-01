import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProductCategoryLabel, getStatusLabel } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  const year = searchParams.get("year");
  const status = searchParams.get("status");

  const where: any = {};
  if (status) where.status = status;
  if (month && year) {
    const m = parseInt(month);
    const y = parseInt(year);
    where.createdAt = {
      gte: new Date(y, m - 1, 1),
      lt: new Date(y, m, 1),
    };
  }

  const orders = await prisma.order.findMany({
    where,
    include: {
      customer: true,
      items: true,
      createdBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Build CSV
  const headers = [
    "Order ID",
    "Date",
    "Party Name",
    "Location",
    "Product Category",
    "Status",
    "Priority",
    "Delivery Deadline",
    "Challan No",
    "Jumbo Code",
    "Rate",
    "Amount",
    "Remarks",
    "Created By",
  ];

  const rows = orders.map((order) => {
    // Calculate totals from items
    const totalRate = order.items.reduce((s, i) => s + (i.rate || 0), 0);
    const totalAmount = order.items.reduce((s, i) => s + (i.amount || 0), 0);
    const categories = order.items.length > 0
      ? order.items.map((i) => getProductCategoryLabel(i.productCategory)).join("; ")
      : getProductCategoryLabel(order.productCategory);

    return [
      order.orderId,
      new Date(order.createdAt).toLocaleDateString("en-IN"),
      order.customer?.partyName || "",
      order.customer?.location || "",
      categories,
      getStatusLabel(order.status),
      order.priority || "NORMAL",
      order.deliveryDeadline
        ? new Date(order.deliveryDeadline).toLocaleDateString("en-IN")
        : "",
      order.challanNumber || "",
      order.jumboCode || "",
      totalRate || "",
      totalAmount || "",
      (order.remarks || "").replace(/[\n\r,]/g, " "),
      order.createdBy?.name || "",
    ];
  });

  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");

  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="orders-${month || "all"}-${year || "all"}.csv"`,
    },
  });
}
