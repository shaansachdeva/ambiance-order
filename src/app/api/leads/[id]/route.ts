import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const lead = await prisma.lead.findUnique({
      where: { id: params.id },
      include: {
        followUps: {
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { name: true } }
          }
        },
        salesPerson: { select: { name: true } },
        contacts: true,
        items: true
      }
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if ((session.user as any).role === "SALES" && lead.salesPersonId !== (session.user as any).id) {
       return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    return NextResponse.json(lead);
  } catch (error) {
    console.error("Failed to fetch lead:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const lead = await prisma.lead.findUnique({ where: { id: params.id } });
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    if ((session.user as any).role === "SALES" && lead.salesPersonId !== (session.user as any).id) {
       return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { action, notes, ...updateData } = body;

    if (action === 'FOLLOW_UP') {
      const { nextFollowUp } = updateData;
      await prisma.leadFollowUp.create({
        data: {
          leadId: params.id,
          userId: (session.user as any).id,
          notes: notes || "Followed up",
        }
      });
      
      const updatedLead = await prisma.lead.update({
        where: { id: params.id },
        data: {
          status: "FOLLOW_UP",
          nextFollowUp: nextFollowUp ? new Date(nextFollowUp) : lead.nextFollowUp
        }
      });
      return NextResponse.json(updatedLead);
    } 
    
    if (action === 'UPDATE_STATUS') {
      const { status, closeReason } = updateData;
      if (!status) return NextResponse.json({ error: "Status required" }, { status: 400 });

      const result = await prisma.lead.update({
        where: { id: params.id },
        data: {
          status,
          closeReason: status === 'CLOSED_LOST' ? closeReason : null
        }
      });
      return NextResponse.json(result);
    }
    
    // Generic update
    if (updateData.nextFollowUp === null || updateData.nextFollowUp === "") {
      updateData.nextFollowUp = null;
    } else if (updateData.nextFollowUp) {
      updateData.nextFollowUp = new Date(updateData.nextFollowUp);
    }

    const result = await prisma.lead.update({
      where: { id: params.id },
      data: updateData
    });

    return NextResponse.json(result);

  } catch (error) {
    console.error("Failed to update lead:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
