import assert from "node:assert";

function validateCaption(text) {
  if (!text) return { valid: true, caption: null };
  const trimmed = text.trim();
  if (!trimmed) return { valid: true, caption: null };
  if (trimmed.length > 50000) {
    return { valid: false, error: "Caption exceeds maximum length" };
  }
  return { valid: true, caption: trimmed };
}

function detectDirection(text) {
  const rtlRegex = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
  return rtlRegex.test(text) ? "rtl" : "ltr";
}

async function run() {
  console.log("=== شروع تست‌های اعتبارسنجی منطق کپشن و جهت متن ===");

  const res1 = validateCaption("  عکس منظره قشنگ  ");
  assert.strictEqual(res1.caption, "عکس منظره قشنگ");

  assert.strictEqual(detectDirection("سلام دنیا"), "rtl");
  assert.strictEqual(detectDirection("Hello world"), "ltr");
  assert.strictEqual(detectDirection("123 hello"), "ltr");
  assert.strictEqual(detectDirection("123 سلام"), "rtl");

  const empty = validateCaption("   ");
  assert.strictEqual(empty.caption, null);

  console.log("✓ تمامی تست‌های اعتبارسنجی کپشن با موفقیت پاس شدند.");
}

run().catch((err) => {
  console.error("✗ خطا در تست کپشن:", err);
  process.exit(1);
});
