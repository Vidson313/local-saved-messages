import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { broadcast } from "@/lib/events";
import { deleteMessage, updateMessage } from "@/lib/store";

const uploadDir = path.join(process.cwd(), "public", "uploads");

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const message = await deleteMessage(id);

  if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (message.type === "FILE" && message.content.startsWith("/uploads/")) {
    const filePath = path.join(uploadDir, path.basename(message.content));
    await fs.unlink(filePath).catch(() => undefined);
  }

  broadcast({ type: "deleted", id });
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const updates: Record<string, unknown> = {};

  if (typeof body.pinned === "boolean") updates.pinned = body.pinned;
  if (typeof body.saved === "boolean") updates.saved = body.saved;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid updates" }, { status: 400 });
  }

  const message = await updateMessage(id, updates as { pinned?: boolean; saved?: boolean });

  if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 });

  broadcast({ type: "updated", message });
  return NextResponse.json(message);
}
