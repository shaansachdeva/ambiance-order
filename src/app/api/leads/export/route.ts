import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

// GET /api/leads/export?ids=id1,id2  (empty = export all visible to user)
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = (session.user as any).role;
  const userId = (session.user as any).id;

  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get("ids");
  const ids = idsParam ? idsParam.split(",").filter(Boolean) : [];

  const where: any = {};
  if (ids.length > 0) where.id = { in: ids };
  if (userRole === "SALES") where.salesPersonId = userId;

  const leads = await prisma.lead.findMany({
    where,
    include: {
      contacts: true,
      items: true,
      salesPerson: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows: (string | number)[][] = [
    [
      "Company Name",
      "Location",
      "Status",
      "Contact Name",
      "Contact Phone",
      "Contact Email",
      "Sales Person",
      "Products Interested",
      "Rate (₹)",
      "GST %",
      "Total Amount (₹)",
      "Next Follow-up",
      "Close Reason",
      "Created Date",
      "Remarks",
    ],
  ];

  for (const lead of leads) {
    const primaryContact =
      lead.contacts.find((c: any) => c.isPrimary) || lead.contacts[0];
    const products = lead.items
      .map((i: any) => formatCategory(i.productCategory))
      .join(" + ");
    const rates = lead.items
      .map((i: any) => (i.rate != null ? Number(i.rate) : null))
      .filter((r: number | null) => r !== null) as number[];
    const gsts = lead.items
      .map((i: any) => (i.gst != null ? Number(i.gst) : null))
      .filter((g: number | null) => g !== null) as number[];

    const totalAmount = lead.items.reduce((sum: number, i: any) => {
      const r = Number(i.rate) || 0;
      const g = Number(i.gst) || 0;
      return sum + r + (r * g) / 100;
    }, 0);

    const rateCell =
      rates.length === 0 ? "" : rates.length === 1 ? rates[0] : rates.join(" + ");
    const gstCell =
      gsts.length === 0 ? "" : gsts.length === 1 ? gsts[0] : gsts.join(" + ");

    rows.push([
      lead.companyName,
      (lead as any).location || "",
      lead.status.replace(/_/g, " "),
      primaryContact?.name || "",
      primaryContact?.phone || "",
      primaryContact?.email || "",
      lead.salesPerson.name,
      products,
      rateCell,
      gstCell,
      totalAmount > 0 ? totalAmount : "",
      lead.nextFollowUp
        ? new Date(lead.nextFollowUp).toLocaleDateString("en-IN")
        : "",
      lead.closeReason || "",
      new Date(lead.createdAt).toLocaleDateString("en-IN"),
      lead.remarks || "",
    ]);
  }

  const worksheet = XLSX.utils.aoa_to_sheet(rows);

  // Column widths
  worksheet["!cols"] = [
    { wch: 28 }, // Company
    { wch: 22 }, // Location
    { wch: 14 }, // Status
    { wch: 20 }, // Contact Name
    { wch: 16 }, // Phone
    { wch: 26 }, // Email
    { wch: 18 }, // Sales Person
    { wch: 30 }, // Products
    { wch: 14 }, // Rate
    { wch: 10 }, // GST
    { wch: 16 }, // Total
    { wch: 14 }, // Next Follow-up
    { wch: 24 }, // Close Reason
    { wch: 14 }, // Created Date
    { wch: 40 }, // Remarks
  ];

  // Apply Rupee formatting to numeric rate & total columns (I = 9th col, K = 11th col)
  const rupeeFormat = '"₹"#,##,##0.00;"₹"-#,##,##0.00';
  for (let r = 1; r < rows.length; r++) {
    const rateCell = XLSX.utils.encode_cell({ r, c: 8 }); // Rate column
    const totalCell = XLSX.utils.encode_cell({ r, c: 10 }); // Total column
    if (worksheet[rateCell] && typeof worksheet[rateCell].v === "number") {
      worksheet[rateCell].z = rupeeFormat;
      worksheet[rateCell].t = "n";
    }
    if (worksheet[totalCell] && typeof worksheet[totalCell].v === "number") {
      worksheet[totalCell].z = rupeeFormat;
      worksheet[totalCell].t = "n";
    }
  }

  // Style header row — bold with grey background (basic cell styling via xlsx library)
  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "374151" } },
    alignment: { horizontal: "center", vertical: "center" },
  };
  for (let c = 0; c < rows[0].length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (worksheet[addr]) {
      (worksheet[addr] as any).s = headerStyle;
    }
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");

  const buf = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
    cellStyles: true,
  });

  const filename = `leads-export-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
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
