import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { broadcast } from "@/lib/events";
import { deleteChat, updateChat } from "@/lib/store";

const uploadDir = path.join(process.cwd(), "public", "uploads");

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const updates: { name?: string; avatar?: string | null; avatarType?: "emoji" | "image" | null } = {};

  if (typeof body.name === "string") updates.name = body.name.trim();
  if ("avatar" in body) updates.avatar = body.avatar;
  if ("avatarType" in body) updates.avatarType = body.avatarType;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid updates" }, { status: 400 });
  }

  const chat = await updateChat(id, updates);
  if (!chat) return NextResponse.json({ error: "Not found" }, { status: 404 });

  broadcast({ type: "chat-updated", chat });
  return NextResponse.json(chat);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const chat = await deleteChat(id);

  if (!chat) return NextResponse.json({ error: "Not found or cannot delete default" }, { status: 404 });

  // Delete avatar image if it's a custom upload
  if (chat.avatarType === "image" && chat.avatar?.startsWith("/uploads/")) {
    const filePath = path.join(uploadDir, path.basename(chat.avatar));
    await fs.unlink(filePath).catch(() => undefined);
  }

  broadcast({ type: "chat-deleted", chatId: id });
  return NextResponse.json({ ok: true });
}
