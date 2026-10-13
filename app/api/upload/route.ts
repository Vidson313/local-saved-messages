import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createWriteStream } from "fs";
import { promises as fs } from "fs";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { broadcast } from "@/lib/events";
import { validateUploadedFile } from "@/lib/security/upload";
import { createFileMessage } from "@/lib/store";

const uploadDir =
  process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");

export async function POST(req: Request) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "درخواست ارسالی نامعتبر است (خطای پردازش فرم)." },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  const chatId = (formData.get("chatId") as string) || "default";

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "هیچ فایلی ارسال نشده است." },
      { status: 400 }
    );
  }

  // اعتبارسنجی امنیتی حجم، پسوند و محتوای فایل
  const validation = validateUploadedFile(file);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error },
      { status: validation.status }
    );
  }

  await fs.mkdir(uploadDir, { recursive: true });

  const safeExt = validation.safeExt;
  const cleanExt = /^\.[a-z0-9.]+$/.test(safeExt) ? safeExt : "";
  const safeFileName = `${Date.now()}-${randomUUID()}${cleanExt}`;

  const baseDir = path.resolve(uploadDir);
  // nosemgrep
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const outputPath = path.resolve(baseDir, safeFileName);
  if (!outputPath.startsWith(baseDir + path.sep)) {
    return NextResponse.json({ error: "مسیر ذخیره‌سازی نامعتبر است." }, { status: 400 });
  }

  // نوشتن محتوا روی دیسک از طریق Stream به منظور جلوگیری از اشغال غیرضروری RAM
  try {
    const webStream = file.stream();
    // تبدیل Web Stream استاندارد به Node Readable Stream
    const nodeStream = Readable.fromWeb(webStream as Parameters<typeof Readable.fromWeb>[0]);
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    await pipeline(nodeStream, createWriteStream(outputPath));
  } catch (streamError) {
    // پاکسازی فایل ناقص در صورت بروز خطا حین انتقال
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    await fs.unlink(outputPath).catch(() => undefined);
    console.error("[Upload Stream Error]", streamError);
    return NextResponse.json(
      { error: "خطا در فرآیند ذخیره‌سازی فایل روی دیسک." },
      { status: 500 }
    );
  }

  const content = `/uploads/${safeFileName}`;
  const message = await createFileMessage({
    content,
    fileName: validation.originalName,
    fileSize: file.size,
    mimeType: validation.mimeType,
    chatId
  });

  broadcast({ type: "created", message });
  return NextResponse.json(message, { status: 201 });
}
