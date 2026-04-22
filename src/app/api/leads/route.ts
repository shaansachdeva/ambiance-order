import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const search = searchParams.get('search');
    const salesPersonId = searchParams.get('salesPersonId');

    const whereClause: any = {};

    // For Sales people, only show their leads, Admin can see all (optionally filtered by salesPersonId)
    if ((session.user as any).role === "SALES") {
      whereClause.salesPersonId = (session.user as any).id;
    } else if (salesPersonId) {
      whereClause.salesPersonId = salesPersonId;
    }

    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      whereClause.nextFollowUp = {
        gte: startOfDay,
        lte: endOfDay
      };
    }

    const searchTerm = search?.trim();
    if (searchTerm) {
      const isPostgres = process.env.DB_PROVIDER === "postgres";
      const mk = (v: string) => (isPostgres ? { contains: v, mode: "insensitive" as const } : { contains: v });
      whereClause.OR = [
        { companyName: mk(searchTerm) },
        { remarks: mk(searchTerm) },
        { location: mk(searchTerm) },
        { contacts: { some: { name: mk(searchTerm) } } },
        { contacts: { some: { phone: mk(searchTerm) } } },
        { contacts: { some: { email: mk(searchTerm) } } },
      ];
    }

    const leads = await prisma.lead.findMany({
      where: whereClause,
      orderBy: { updatedAt: "desc" },
      include: {
        salesPerson: {
          select: { name: true }
        },
        contacts: true,
        items: true
      }
    });

    return NextResponse.json(leads);
  } catch (error) {
    console.error("Failed to fetch leads:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { companyName, location, remarks, contacts, items, nextFollowUp, visitLatitude, visitLongitude } = body;

    if (!companyName) {
      return NextResponse.json({ error: "Company name is required" }, { status: 400 });
    }

    const lead = await prisma.lead.create({
      data: {
        companyName,
        location: location?.trim() || null,
        remarks,
        nextFollowUp: nextFollowUp ? new Date(nextFollowUp) : null,
        salesPersonId: (session.user as any).id,
        status: nextFollowUp ? "FOLLOW_UP" : "NEW",
        visitLatitude: visitLatitude ?? null,
        visitLongitude: visitLongitude ?? null,
        
        contacts: contacts && contacts.length > 0 ? {
          create: contacts.map((c: any) => ({
            name: c.name,
            designation: c.designation,
            phone: c.phone,
            email: c.email,
            isPrimary: c.isPrimary || false
          }))
        } : undefined,

        items: items && items.length > 0 ? {
          create: items.map((i: any) => ({
            productCategory: i.productCategory,
            productDetails: JSON.stringify(i.productDetails || {}),
            rate: i.rate ? parseFloat(i.rate) : null,
            gst: i.gst ? parseFloat(i.gst) : null,
          }))
        } : undefined,
      },
    });

    return NextResponse.json(lead);
  } catch (error) {
    console.error("Failed to create lead:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
