import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeFile } from "fs/promises";
import path from "path";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("photo") as File;

    if (!file) {
      return NextResponse.json({ error: "No photo uploaded" }, { status: 400 });
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File size must be under 10MB" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `lead-${params.id}-${Date.now()}.${ext}`;
    const filePath = path.join(process.cwd(), "public", "uploads", fileName);

    await writeFile(filePath, buffer);

    const updated = await prisma.lead.update({
      where: { id: params.id },
      data: { visitPhoto: `/uploads/${fileName}` },
    });

    return NextResponse.json({ visitPhoto: updated.visitPhoto });
  } catch (error) {
    console.error("Failed to upload lead photo:", error);
    return NextResponse.json({ error: "Failed to upload photo" }, { status: 500 });
  }
}
