import { randomUUID } from "crypto";
import path from "path";

/**
 * حداکثر سقف حجم مجاز برای آپلود فایل به بایت
 * پیش‌فرض: ۱۰۰ مگابایت (قابل تنظیم با متغیر محیطی MAX_FILE_SIZE_MB)
 */
export const MAX_FILE_SIZE_BYTES =
  (parseInt(process.env.MAX_FILE_SIZE_MB || "100", 10) || 100) * 1024 * 1024;

/**
 * لیست پسوندهای اجرایی سمت سرور که به هیچ عنوان نباید آپلود شوند
 */
export const BLOCKED_SERVER_EXTENSIONS = new Set([
  ".php",
  ".phtml",
  ".php3",
  ".php4",
  ".php5",
  ".php7",
  ".phps",
  ".asp",
  ".aspx",
  ".cgi",
  ".pl",
  ".jsp",
  ".jspx"
]);

/**
 * پاکسازی نام اصلی فایل و حذف کاراکترهای خطرناک و Path Traversal
 */
export function sanitizeFileName(rawName: string): string {
  // یکسان‌سازی جداکننده‌های دایرکتوری در تمامی سیستم‌عامل‌ها (لینوکس و ویندوز)
  const normalizedSeparators = rawName.replace(/\\/g, "/");
  const base = path.basename(normalizedSeparators).replace(/\0/g, "").trim();
  // حذف کاراکترهای کنترلی غیرقابل چاپ
  const cleaned = base.replace(/[\x00-\x1F\x7F]/g, "");
  return cleaned.slice(0, 255) || "unnamed-file";
}

/**
 * استخراج و نرمال‌سازی پسوند فایل
 */
export function extractCleanExtension(fileName: string): string {
  const rawExt = path.extname(fileName).toLowerCase();
  // فقط حروف و اعداد در پسوند مجاز هستند
  const cleaned = rawExt.replace(/[^a-z0-9]/g, "");
  return cleaned ? `.${cleaned.slice(0, 10)}` : "";
}

export type FileValidationSuccess = {
  valid: true;
  safeFileName: string;
  safeExt: string;
  mimeType: string;
  originalName: string;
};

export type FileValidationFailure = {
  valid: false;
  error: string;
  status: number;
};

export type FileValidationResult = FileValidationSuccess | FileValidationFailure;

export type UploadableFileInput = {
  name: string;
  size: number;
  type?: string;
};

/**
 * اعتبارسنجی کامل امنیتی فایل ارسالی:
 * - بررسی حجم فایل (جلوگیری از DoS / OOM)
 * - مسدودسازی اسکریپت‌های اجرایی
 * - خنثی‌سازی فایل‌های HTML جهت جلوگیری از Stored XSS
 * - ساخت نام یکتا و امن
 */
export function validateUploadedFile(file: UploadableFileInput): FileValidationResult {
  if (file.size <= 0) {
    return {
      valid: false,
      error: "فایل ارسالی خالی است (حجم صفر بایت).",
      status: 400
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    const maxMb = Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024));
    return {
      valid: false,
      error: `حجم فایل بیش از حد مجاز است (حداکثر سقف مجاز: ${maxMb} مگابایت).`,
      status: 413
    };
  }

  const sanitizedOriginal = sanitizeFileName(file.name);
  const ext = extractCleanExtension(sanitizedOriginal);

  // بررسی پسوندهای مسدودشده اجرایی سرور
  if (BLOCKED_SERVER_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `آپلود فایل‌های اسکریپت اجرایی (${ext}) به دلایل امنیتی مجاز نیست.`,
      status: 400
    };
  }

  let safeMime = file.type || "application/octet-stream";
  let finalExt = ext;

  // خنثی‌سازی فایل‌های متنی وب برای جلوگیری از اجرای جاوااسکریپت در Origin سرور (Stored XSS)
  if (
    ext === ".html" ||
    ext === ".htm" ||
    ext === ".xhtml" ||
    safeMime.toLowerCase().includes("text/html")
  ) {
    safeMime = "text/plain";
    finalExt = `${ext}.txt`;
  }

  const uniqueSafeName = `${Date.now()}-${randomUUID()}${finalExt}`;

  return {
    valid: true,
    safeFileName: uniqueSafeName,
    safeExt: finalExt,
    mimeType: safeMime,
    originalName: sanitizedOriginal
  };
}
