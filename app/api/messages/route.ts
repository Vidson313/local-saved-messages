import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { broadcast } from "@/lib/events";
import { createTextMessage, deleteMessages, getMessages, getPaginatedMessages } from "@/lib/store";

const uploadDir = path.join(process.cwd(), "public", "uploads");
const MAX_MESSAGE_LENGTH = 50000;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const chatId = url.searchParams.get("chatId") || undefined;
  const limitParam = url.searchParams.get("limit");
  const beforeParam = url.searchParams.get("before") || undefined;

  // در صورت ارسال پارامترهای صفحه‌بندی، پاسخ با ساختار صفحه‌بندی‌شده برمی‌گردد
  if (limitParam !== null || beforeParam !== undefined) {
    const parsedLimit = limitParam ? parseInt(limitParam, 10) : 50;
    const limit = Number.isNaN(parsedLimit) ? 50 : parsedLimit;

    const result = await getPaginatedMessages({
      chatId,
      limit,
      before: beforeParam
    });
    return NextResponse.json(result);
  }

  // سازگاری کامل با فراخوانی‌های پیش‌فرض فرانت‌اند
  const messages = await getMessages(chatId);
  return NextResponse.json(messages);
}

export async function POST(req: Request) {
  const body = await req.json();
  const text = typeof body?.content === "string" ? body.content.trim() : "";
  const chatId = typeof body?.chatId === "string" ? body.chatId : "default";

  if (!text) {
    return NextResponse.json({ error: "Message is empty" }, { status: 400 });
  }

  if (text.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `Message exceeds maximum allowed length (${MAX_MESSAGE_LENGTH} characters)` },
      { status: 400 }
    );
  }

  const message = await createTextMessage(text, chatId);

  broadcast({ type: "created", message });
  return NextResponse.json(message, { status: 201 });
}

export async function DELETE(req: Request) {
  const body = await req.json();
  const ids: string[] = body?.ids;

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "No ids provided" }, { status: 400 });
  }

  const removed = await deleteMessages(ids);

  // پاکسازی ایمن فایل‌های پیوست مربوط به پیام‌های حذف‌شده
  for (const message of removed) {
    if (message.type === "FILE" && message.content.startsWith("/uploads/")) {
      const filePath = path.join(uploadDir, path.basename(message.content));
      await fs.unlink(filePath).catch(() => undefined);
    }
  }

  for (const id of ids) {
    broadcast({ type: "deleted", id });
  }

  return NextResponse.json({ ok: true, deleted: removed.length });
}
