import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  const header = [
    "Company Name",
    "Status",
    "Contact Name",
    "Contact Phone",
    "Contact Email",
    "Sales Person",
    "Products Interested",
    "Rates",
    "GST %",
    "Next Follow-up",
    "Close Reason",
    "Created Date",
    "Remarks",
  ].join(",");

  const rows: string[] = [header];

  for (const lead of leads) {
    const primaryContact = lead.contacts.find((c) => c.isPrimary) || lead.contacts[0];
    const products = lead.items.map((i) => formatCategory(i.productCategory)).join(" + ");
    const rates = lead.items
      .map((i) => (i.rate ? `₹${i.rate}` : ""))
      .filter(Boolean)
      .join(" + ");
    const gsts = lead.items
      .map((i: any) => (i.gst ? `${i.gst}%` : ""))
      .filter(Boolean)
      .join(" + ");

    rows.push(
      [
        csvEscape(lead.companyName),
        lead.status.replace(/_/g, " "),
        csvEscape(primaryContact?.name || ""),
        csvEscape(primaryContact?.phone || ""),
        csvEscape(primaryContact?.email || ""),
        csvEscape(lead.salesPerson.name),
        csvEscape(products),
        csvEscape(rates),
        csvEscape(gsts),
        lead.nextFollowUp
          ? new Date(lead.nextFollowUp).toLocaleDateString("en-IN")
          : "",
        csvEscape(lead.closeReason || ""),
        new Date(lead.createdAt).toLocaleDateString("en-IN"),
        csvEscape(lead.remarks || ""),
      ].join(",")
    );
  }

  const csv = rows.join("\n");
  const filename = `leads-export-${new Date().toISOString().slice(0, 10)}.csv`;

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
