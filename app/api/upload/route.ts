import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { broadcast } from "@/lib/events";
import { createFileMessage } from "@/lib/store";

const uploadDir = path.join(process.cwd(), "public", "uploads");

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file");
  const chatId = (formData.get("chatId") as string) || "default";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File not provided" }, { status: 400 });
  }

  await fs.mkdir(uploadDir, { recursive: true });

  const ext = path.extname(file.name);
  const safeName = `${Date.now()}-${randomUUID()}${ext}`;
  const outputPath = path.join(uploadDir, safeName);

  const arrayBuffer = await file.arrayBuffer();
  await fs.writeFile(outputPath, Buffer.from(arrayBuffer));

  const content = `/uploads/${safeName}`;
  const message = await createFileMessage({
    content,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || "application/octet-stream",
    chatId
  });

  broadcast({ type: "created", message });
  return NextResponse.json(message, { status: 201 });
}
