import { NextResponse } from "next/server";
import { createReadStream } from "fs";
import { promises as fs } from "fs";
import path from "path";
import { Readable } from "stream";
import { getMessages } from "@/lib/store";

const uploadDir =
  process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");

/**
 * اندپوینت امن سرو و دانلود فایل‌ها
 * - مهار کامل Path Traversal با تطابق الگوی دقیق نام‌های امن
 * - ارسال هدرهای امنیتی ضد اجرای اسکریپت (nosniff و CSP sandbox)
 * - دانلود با نام اصلی فایل به صورت چندزبانه استاندارد (RFC 5987)
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  const safeName = path.basename(filename);

  // بررسی عدم دستکاری مسیر فایل و اطمینان از امن بودن کاراکترها
  const isSafeChars = /^[a-zA-Z0-9._-]+$/.test(safeName);
  if (
    !safeName ||
    safeName !== filename ||
    filename.includes("..") ||
    safeName.length > 100 ||
    !isSafeChars
  ) {
    return NextResponse.json({ error: "نام فایل نامعتبر است." }, { status: 400 });
  }

  const filePath = `${uploadDir}/${safeName}`;

  let stat;
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      return NextResponse.json({ error: "فایل یافت نشد." }, { status: 404 });
    }
  } catch {
    return NextResponse.json({ error: "فایل یافت نشد." }, { status: 404 });
  }

  // پیدا کردن مشخصات فایل و نام اصلی از پیام‌های ذخیره‌شده
  const messages = await getMessages();
  const fileMsg = messages.find(
    (m) =>
      m.type === "FILE" &&
      (m.content.endsWith(`/${safeName}`) || m.content === safeName)
  );
  const originalName = fileMsg?.fileName || safeName;
  const mimeType = fileMsg?.mimeType || "application/octet-stream";

  const url = new URL(req.url);
  const isDownload = url.searchParams.get("download") === "1";

  // پیش‌نمایش فقط برای رسانه‌های امن معتبر است
  const isSafePreviewable =
    !isDownload &&
    (mimeType.startsWith("image/") ||
      mimeType.startsWith("video/") ||
      mimeType.startsWith("audio/") ||
      mimeType === "application/pdf");

  const dispositionType = isSafePreviewable ? "inline" : "attachment";
  const encodedName = encodeURIComponent(originalName);

  const headers = new Headers();
  headers.set("Content-Type", mimeType);
  headers.set("Content-Length", stat.size.toString());
  headers.set(
    "Content-Disposition",
    `${dispositionType}; filename="${originalName.replace(/[^\x20-\x7E]/g, "_")}"; filename*=UTF-8''${encodedName}`
  );
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Content-Security-Policy", "default-src 'none'; sandbox");
  headers.set("Cache-Control", "public, max-age=31536000, immutable");

  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const nodeStream = createReadStream(filePath);
  const webStream = Readable.toWeb(nodeStream);

  return new Response(webStream as ReadableStream, {
    status: 200,
    headers
  });
}
