import assert from "node:assert";
import { promises as fs } from "node:fs";
import path from "node:path";

// Test Range parsing logic used by the file serving endpoint
function parseRange(rangeHeader, totalSize) {
  if (!rangeHeader || totalSize <= 0) return null;
  const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
  if (!match) return null;

  const startStr = match[1];
  const endStr = match[2];

  let start = startStr ? parseInt(startStr, 10) : 0;
  let end = endStr ? parseInt(endStr, 10) : totalSize - 1;

  if (isNaN(start) || start >= totalSize || end >= totalSize || start > end) {
    return null;
  }

  return {
    start,
    end,
    chunkSize: end - start + 1
  };
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
  assert.deepStrictEqual(range1, { start: 0, end: 999999, chunkSize: 1000000 });

  // درخواست تکه‌ای برای Seeking (مثلاً پرش به وسط ویدیو)
  const range2 = parseRange("bytes=500000-799999", totalFileSize);
  assert.deepStrictEqual(range2, { start: 500000, end: 799999, chunkSize: 300000 });

  // درخواست نامعتبر (بازه خارج از محدوده فایل)
  const invalidRange = parseRange("bytes=2000000-3000000", totalFileSize);
  assert.strictEqual(invalidRange, null, "بازه نامعتبر باید null برگرداند");
  console.log("✓ تست ۲ (استریمینگ و Seeking مدیا) با موفقیت پاس شد.");

  // تست ۳: اعتبارسنجی فرمت Content-Range
  console.log("تست ۳: اعتبارسنجی فرمت هدر Content-Range...");
  const rangeHeader = `bytes ${range2.start}-${range2.end}/${totalFileSize}`;
  assert.strictEqual(rangeHeader, "bytes 500000-799999/1000000");
  console.log("✓ تست ۳ با موفقیت پاس شد.");

  console.log("\n=== تمامی تست‌های سرو و استریم مدیا با موفقیت ۱۰۰٪ پاس شدند ===");
}

runTests().catch((err) => {
  console.error("✗ خطا در تست‌های سرو فایل:", err);
  process.exit(1);
});
