import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { broadcast } from "@/lib/events";
import { MAX_MESSAGE_LENGTH, deleteMessage, updateMessage } from "@/lib/store";

const uploadDir =
  process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");

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
  if (Array.isArray(body.tags)) updates.tags = body.tags.filter((t: unknown) => typeof t === "string");
  if (typeof body.content === "string") {
    const trimmed = body.content.trim();
    if (!trimmed) {
      return NextResponse.json({ error: "Message content cannot be empty" }, { status: 400 });
    }
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `Message exceeds maximum allowed length (${MAX_MESSAGE_LENGTH} characters)` },
        { status: 400 }
      );
    }
    updates.content = trimmed;
  }
  if (typeof body.caption === "string") {
    if (body.caption.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `Caption exceeds maximum allowed length (${MAX_MESSAGE_LENGTH} characters)` },
        { status: 400 }
      );
    }
    updates.caption = body.caption.trim() || null;
  } else if (body.caption === null) {
    updates.caption = null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid updates" }, { status: 400 });
  }

  const message = await updateMessage(id, updates as { pinned?: boolean; saved?: boolean; tags?: string[]; content?: string });

  if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 });

  broadcast({ type: "updated", message });
  return NextResponse.json(message);
}
