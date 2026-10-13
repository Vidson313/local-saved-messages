import assert from "node:assert";
import {
  BLOCKED_SERVER_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
  extractCleanExtension,
  sanitizeFileName,
  validateUploadedFile
} from "../lib/security/upload.ts";

async function runUploadSecurityTests() {
  console.log("=== شروع تست‌های اعتبارسنجی امنیت آپلود فایل ===");

  // تست ۱: بررسی فایل با حجم صفر بایت
  console.log("تست ۱: بررسی فایل خالی (حجم صفر)...");
  const emptyFile = new File([], "empty.txt", { type: "text/plain" });
  const emptyResult = validateUploadedFile(emptyFile);
  assert.strictEqual(emptyResult.valid, false);
  assert.strictEqual(emptyResult.status, 400);
  console.log("✓ تست ۱ با موفقیت پاس شد (رد فایل خالی با وضعیت 400).");

  // تست ۲: بررسی فایل با حجم بیش از سقف مجاز
  console.log("تست ۲: بررسی فایل با حجم بیش از سقف مجاز (DoS / OOM protection)...");
  // شبیه‌سازی فایل با حجم بالاتر از سقف با ویژگی اندازه
  const hugeFile = {
    name: "huge-archive.zip",
    size: MAX_FILE_SIZE_BYTES + 1024 * 1024,
    type: "application/zip"
  };
  const hugeResult = validateUploadedFile(hugeFile);
  assert.strictEqual(hugeResult.valid, false);
  assert.strictEqual(hugeResult.status, 413);
  assert.ok(hugeResult.error.includes("حجم فایل بیش از حد مجاز است"));
  console.log("✓ تست ۲ با موفقیت پاس شد (رد فایل بیش از حد با وضعیت 413).");

  // تست ۳: مسدودسازی فایل‌های اسکریپت اجرایی سمت سرور
  console.log("تست ۳: تست مسدودسازی پسوندهای اجرایی سمت سرور (.php, .asp, .cgi)...");
  for (const ext of [".php", ".asp", ".cgi", ".jsp"]) {
    assert.ok(BLOCKED_SERVER_EXTENSIONS.has(ext));
    const maliciousFile = new File(["echo 'hack';"], `shell${ext}`, {
      type: "application/x-php"
    });
    const res = validateUploadedFile(maliciousFile);
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.status, 400);
    assert.ok(res.error.includes("اسکریپت اجرایی"));
  }
  console.log("✓ تست ۳ با موفقیت پاس شد (مسدودسازی کامل اسکریپت‌های اجرایی).");

  // تست ۴: خنثی‌سازی فایل‌های HTML جهت جلوگیری از Stored XSS
  console.log("تست ۴: خنثی‌سازی فایل‌های HTML برای پیشگیری از Stored XSS...");
  const htmlFile = new File(
    ["<!DOCTYPE html><html><body>Test</body></html>"],
    "sample.html",
    { type: "text/html" }
  );
  const xssResult = validateUploadedFile(htmlFile);
  assert.strictEqual(xssResult.valid, true);
  // نوع MIME باید به text/plain تغییر یافته باشد تا در مرورگر به عنوان صفحه وب اجرا نشود
  assert.strictEqual(xssResult.mimeType, "text/plain");
  assert.ok(xssResult.safeFileName.endsWith(".html.txt"));
  console.log("✓ تست ۴ با موفقیت پاس شد (تبدیل به text/plain و خنثی‌سازی XSS).");

  // تست ۵: پاکسازی نام فایل و مهار Path Traversal
  console.log("تست ۵: تست پاکسازی نام فایل و مهار Path Traversal...");
  const traversal1 = sanitizeFileName("../../../etc/passwd");
  assert.strictEqual(traversal1, "passwd");

  const traversal2 = sanitizeFileName("..\\..\\Windows\\System32\\calc.exe");
  assert.strictEqual(traversal2, "calc.exe");

  const nullByte = sanitizeFileName("file.pdf\0.exe");
  assert.strictEqual(nullByte, "file.pdf.exe");
  console.log("✓ تست ۵ با موفقیت پاس شد (حذف کاراکترهای Path Traversal و نال‌بایت).");

  // تست ۶: استخراج و نرمال‌سازی پسوند
  console.log("تست ۶: نرمال‌سازی پسوندهای نامتعارف...");
  assert.strictEqual(extractCleanExtension("PHOTO.JPEG"), ".jpeg");
  assert.strictEqual(extractCleanExtension("document.PDF"), ".pdf");
  assert.strictEqual(extractCleanExtension("archive.tar.gz"), ".gz");
  assert.strictEqual(extractCleanExtension("no-extension"), "");
  console.log("✓ تست ۶ با موفقیت پاس شد.");

  console.log("\n=== تمامی تست‌های امنیت و اعتبارسنجی آپلود با موفقیت ۱۰۰٪ پاس شدند ===");
}

runUploadSecurityTests().catch((err) => {
  console.error("خطا در تست‌های آپلود:", err);
  process.exit(1);
});
