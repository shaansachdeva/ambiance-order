import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/pjpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/gif": "gif",
  "image/bmp": "bmp",
};

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
    const file = formData.get("photo") as File | null;

    if (!file || typeof (file as any).arrayBuffer !== "function") {
      return NextResponse.json({ error: "No photo uploaded" }, { status: 400 });
    }

    const mime = (file.type || "").toLowerCase();
    if (mime && !mime.startsWith("image/")) {
      return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File size must be under 10MB" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const fromName = file.name?.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "";
    const ext = MIME_EXT[mime] || fromName || "jpg";

    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });

    const fileName = `lead-${params.id}-${Date.now()}.${ext}`;
    const filePath = path.join(uploadDir, fileName);

    await writeFile(filePath, buffer);

    const updated = await prisma.lead.update({
      where: { id: params.id },
      data: { visitPhoto: `/uploads/${fileName}` },
    });

    return NextResponse.json({ visitPhoto: updated.visitPhoto });
  } catch (error) {
    console.error("Failed to upload lead photo:", error);
    return NextResponse.json(
      { error: (error as Error)?.message || "Failed to upload photo" },
      { status: 500 }
    );
  }
}
