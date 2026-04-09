import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProductCategoryLabel, getStatusLabel } from "@/lib/utils";
import * as XLSX from "xlsx";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  const year = searchParams.get("year");
  const status = searchParams.get("status");

  const where: any = { deletedAt: null };
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

  // Build rows — one row per order item (or one row per order if no items)
  const rows: any[] = [];

  for (const order of orders) {
    const orderId =
      typeof order.orderId === "number"
        ? `ORD-${String(order.orderId).padStart(4, "0")}`
        : order.orderId;
    const date = new Date(order.createdAt).toLocaleDateString("en-IN");
    const party = order.customer?.partyName || "";
    const location = order.customer?.location || "";
    const orderStatus = getStatusLabel(order.status);
    const priority = order.priority || "NORMAL";
    const deadline = order.deliveryDeadline
      ? new Date(order.deliveryDeadline).toLocaleDateString("en-IN")
      : "";
    const challan = order.challanNumber || "";
    const remarks = order.remarks || "";
    const createdBy = order.createdBy?.name || "";

    if (order.items.length === 0) {
      rows.push({
        "Order ID": orderId,
        "Date": date,
        "Party Name": party,
        "Location": location,
        "Product Category": getProductCategoryLabel(order.productCategory),
        "Product Description": "",
        "Status": orderStatus,
        "Priority": priority,
        "Delivery Deadline": deadline,
        "Challan No": challan,
        "Jumbo Code": order.jumboCode || "",
        "Rate": "",
        "Remarks": remarks,
        "Created By": createdBy,
      });
    } else {
      for (const item of order.items) {
        let detailsObj: Record<string, string> = {};
        try {
          detailsObj = JSON.parse(item.productDetails || "{}");
        } catch {}

        // Build human-readable description from productDetails keys
        const description = Object.entries(detailsObj)
          .filter(([k, v]) => v && k !== "sizeMm") // skip auto-calculated sizeMm
          .map(([k, v]) => {
            const label = k.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
            return `${label}: ${v}`;
          })
          .join(", ");

        const jumboCode = detailsObj.jumboCode || order.jumboCode || "";

        rows.push({
          "Order ID": orderId,
          "Date": date,
          "Party Name": party,
          "Location": location,
          "Product Category": getProductCategoryLabel(item.productCategory),
          "Product Description": description,
          "Status": orderStatus,
          "Priority": priority,
          "Delivery Deadline": deadline,
          "Challan No": challan,
          "Jumbo Code": jumboCode,
          "Rate": item.rate || "",
          "Remarks": remarks,
          "Created By": createdBy,
        });
      }
    }
  }

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Auto-fit column widths
  const colWidths = Object.keys(rows[0] || {}).map((key) => ({
    wch: Math.max(
      key.length,
      ...rows.map((r) => String(r[key] || "").length)
    ),
  }));
  worksheet["!cols"] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Orders");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const filename = `orders-${month || "all"}-${year || "all"}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
