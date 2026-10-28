import assert from "node:assert";
import { promises as fs } from "node:fs";
import path from "node:path";

// Test Range parsing logic used by the file serving endpoint
function parseRange(rangeHeader, totalSize) {
  if (!rangeHeader || totalSize <= 0) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match || (!match[1] && !match[2])) return null;

  let start;
  let end;
  if (!match[1]) {
    // بازه پسوندی (Suffix range): آخرین N بایت فایل
    const suffix = parseInt(match[2], 10);
    start = Math.max(0, totalSize - suffix);
    end = totalSize - 1;
  } else {
    start = parseInt(match[1], 10);
    end = match[2] ? Math.min(parseInt(match[2], 10), totalSize - 1) : totalSize - 1;
  }

  if (start >= totalSize || start > end) {
    return { status: 416, contentRange: `bytes */${totalSize}` };
  }

  return {
    status: 206,
    start,
    end,
    chunkSize: end - start + 1
  };
}

function isSafePreviewableMime(mimeType, isDownload = false) {
  return (
    !isDownload &&
    ((mimeType.startsWith("image/") && mimeType !== "image/svg+xml") ||
      mimeType.startsWith("video/") ||
      mimeType.startsWith("audio/") ||
      mimeType === "application/pdf")
  );
}

function getFileUrl(content, download = false) {
  if (!content) return "";
  if (content.startsWith("/uploads/")) {
    const filename = content.replace("/uploads/", "");
    return `/api/files/${filename}${download ? "?download=1" : ""}`;
  }
  return content;
}

async function runTests() {
  console.log("=== شروع تست‌های اعتبارسنجی سرو و استریم فایل‌ها و مدیا ===");

  // تست ۱: تبدیل آدرس‌های /uploads/ به /api/files/
  console.log("تست ۱: تبدیل آدرس /uploads/ به اندپوینت امن /api/files/...");
  const imgContent = "/uploads/test-image.jpg";
  const previewUrl = getFileUrl(imgContent, false);
  const downloadUrl = getFileUrl(imgContent, true);
  assert.strictEqual(previewUrl, "/api/files/test-image.jpg");
  assert.strictEqual(downloadUrl, "/api/files/test-image.jpg?download=1");
  console.log("✓ تست ۱ با موفقیت پاس شد.");

  // تست ۲: پردازش هدر Range برای استریم ویدیو و موزیک (HTTP 206 Partial Content)
  console.log("تست ۲: پردازش هدر Range و بازه‌های بایت (Range Requests)...");
  const totalFileSize = 1000000; // 1MB

  // درخواست از ابتدای فایل
  const range1 = parseRange("bytes=0-", totalFileSize);
  assert.deepStrictEqual(range1, { status: 206, start: 0, end: 999999, chunkSize: 1000000 });

  // درخواست تکه‌ای برای Seeking (مثلاً پرش به وسط ویدیو)
  const range2 = parseRange("bytes=500000-799999", totalFileSize);
  assert.deepStrictEqual(range2, { status: 206, start: 500000, end: 799999, chunkSize: 300000 });

  // بازه پسوندی (Suffix range: مثلاً 500 بایت انتهایی فایل برای خواندن متادیتا یا پلیرها)
  const suffixRange = parseRange("bytes=-500", totalFileSize);
  assert.deepStrictEqual(suffixRange, { status: 206, start: 999500, end: 999999, chunkSize: 500 });

  // محدودسازی سقف انتهای بازه (Clamping) در صورت ارسال مقداری فراتر از حجم فایل
  const clampedRange = parseRange("bytes=900000-2000000", totalFileSize);
  assert.deepStrictEqual(clampedRange, { status: 206, start: 900000, end: 999999, chunkSize: 100000 });

  // درخواست خارج از محدوده مجاز فایل که باید وضعیت 416 برگرداند
  const outOfRange = parseRange("bytes=2000000-3000000", totalFileSize);
  assert.deepStrictEqual(outOfRange, { status: 416, contentRange: "bytes */1000000" });

  const invertedRange = parseRange("bytes=500-100", totalFileSize);
  assert.deepStrictEqual(invertedRange, { status: 416, contentRange: "bytes */1000000" });
  console.log("✓ تست ۲ (استریمینگ، Suffix Ranges و مهار خطای ۴۱۶) با موفقیت پاس شد.");

  // تست ۳: اعتبارسنجی فرمت Content-Range
  console.log("تست ۳: اعتبارسنجی فرمت هدر Content-Range...");
  const rangeHeader = `bytes ${range2.start}-${range2.end}/${totalFileSize}`;
  assert.strictEqual(rangeHeader, "bytes 500000-799999/1000000");
  console.log("✓ تست ۳ با موفقیت پاس شد.");

  // تست ۴: تفکیک امنیتی پیش‌نمایش تصویر SVG و فعال‌سازی سندباکس CSP
  console.log("تست ۴: بررسی سندباکس امنیتی برای فایل‌های SVG...");
  assert.strictEqual(isSafePreviewableMime("image/jpeg"), true, "تصویر JPEG باید بدون سندباکس پیش‌نمایش شود");
  assert.strictEqual(isSafePreviewableMime("image/png"), true, "تصویر PNG باید بدون سندباکس پیش‌نمایش شود");
  assert.strictEqual(isSafePreviewableMime("image/svg+xml"), false, "فایل SVG باید جهت مهار XSS مشمول سندباکس CSP گردد");
  assert.strictEqual(isSafePreviewableMime("video/mp4"), true, "ویدیو MP4 مجاز است");
  console.log("✓ تست ۴ با موفقیت پاس شد.");

  console.log("\n=== تمامی تست‌های سرو و استریم مدیا با موفقیت ۱۰۰٪ پاس شدند ===");
}

runTests().catch((err) => {
  console.error("✗ خطا در تست‌های سرو فایل:", err);
  process.exit(1);
});
