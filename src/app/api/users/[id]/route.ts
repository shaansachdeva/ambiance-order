import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentUserRole = (session.user as any).role;
  const currentUserId = (session.user as any).id;

  try {
    const body = await request.json();
    const { name, username, role, active, password, customPermissions } = body;

    // Non-admin users can only change their own password
    if (currentUserRole !== "ADMIN") {
      if (params.id !== currentUserId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      // Non-admin can only update password
      if (name !== undefined || username !== undefined || role !== undefined || active !== undefined) {
        return NextResponse.json({ error: "Forbidden: You can only change your password" }, { status: 403 });
      }
    }

    // Don't allow admin to change their own role
    if (role !== undefined && params.id === currentUserId) {
      return NextResponse.json(
        { error: "You cannot change your own role" },
        { status: 400 }
      );
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: params.id },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const updateData: any = {};

    if (name !== undefined) updateData.name = name;
    if (username !== undefined) updateData.username = username;
    if (role !== undefined) updateData.role = role;
    if (active !== undefined) updateData.active = active;
    if (customPermissions !== undefined) {
      // null = reset to role defaults; array = custom feature list
      updateData.customPermissions = customPermissions === null
        ? null
        : JSON.stringify(customPermissions);
    }
    if (password !== undefined && password.trim() !== "") {
      updateData.password = await bcrypt.hash(password, 10);
      updateData.plainPassword = password;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentUserRole = (session.user as any).role;
  const currentUserId = (session.user as any).id;

  if (currentUserRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (params.id === currentUserId) {
    return NextResponse.json({ error: "You cannot delete yourself" }, { status: 400 });
  }

  try {
    await prisma.user.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
