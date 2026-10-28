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

  // پیش‌نمایش بدون سندباکس فقط برای رسانه‌های امن معتبر است (SVG شامل سندباکس امنیتی می‌شود)
  const isSafePreviewable =
    !isDownload &&
    ((mimeType.startsWith("image/") && mimeType !== "image/svg+xml") ||
      mimeType.startsWith("video/") ||
      mimeType.startsWith("audio/") ||
      mimeType === "application/pdf");

  const dispositionType = isSafePreviewable ? "inline" : "attachment";
  const encodedName = encodeURIComponent(originalName);
  // پاکسازی دقیق fallback ASCII جهت جلوگیری از شکستن کوتیشن‌ها و Header Injection
  const safeAsciiFallback = originalName
    .replace(/["\\\r\n;]/g, "_")
    .replace(/[^\x20-\x7E]/g, "_")
    .trim() || "download";

  const headers = new Headers();
  headers.set("Content-Type", mimeType);
  headers.set("Accept-Ranges", "bytes");
  headers.set(
    "Content-Disposition",
    `${dispositionType}; filename="${safeAsciiFallback}"; filename*=UTF-8''${encodedName}`
  );
  headers.set("X-Content-Type-Options", "nosniff");
  if (!isSafePreviewable) {
    headers.set("Content-Security-Policy", "default-src 'none'; sandbox");
  }
  headers.set("Cache-Control", "public, max-age=31536000, immutable");

  // پشتیبانی از Range Requests جهت استریم روان، Seeking و لود سریع ویدیوها و فایل‌های صوتی
  const rangeHeader = req.headers.get("range");
  if (rangeHeader && stat.size > 0 && !isDownload) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
    if (match && (match[1] || match[2])) {
      let start: number;
      let end: number;
      if (!match[1]) {
        // بازه پسوندی: آخرین N بایت فایل (Suffix range)
        const suffix = parseInt(match[2], 10);
        start = Math.max(0, stat.size - suffix);
        end = stat.size - 1;
      } else {
        start = parseInt(match[1], 10);
        end = match[2] ? Math.min(parseInt(match[2], 10), stat.size - 1) : stat.size - 1;
      }

      if (start >= stat.size || start > end) {
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${stat.size}` }
        });
      }

      const chunkSize = end - start + 1;
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      const rangeStream = createReadStream(filePath, { start, end });
      const webStream = Readable.toWeb(rangeStream);

      headers.set("Content-Range", `bytes ${start}-${end}/${stat.size}`);
      headers.set("Content-Length", chunkSize.toString());

      return new Response(webStream as ReadableStream, {
        status: 206,
        headers
      });
    }
  }

  headers.set("Content-Length", stat.size.toString());
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const nodeStream = createReadStream(filePath);
  const webStream = Readable.toWeb(nodeStream);

  return new Response(webStream as ReadableStream, {
    status: 200,
    headers
  });
}
