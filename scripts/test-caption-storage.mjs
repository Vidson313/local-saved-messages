import assert from "node:assert";
import { createFileMessage, updateMessage, getMessages } from "../lib/store.ts";

async function runTest() {
  console.log("=== شروع تست‌های اعتبارسنجی کپشن در لایه ذخیره‌سازی ===");

  // تست ۱: ایجاد پیام فایل با کپشن
  console.log("تست ۱: ایجاد پیام فایل به همراه کپشن...");
  const msg = await createFileMessage({
    content: "/uploads/test-sample.jpg",
    fileName: "sample.jpg",
    fileSize: 1024,
    mimeType: "image/jpeg",
    chatId: "default",
    caption: "این یک عکس تستی با کپشن است"
  });

  assert.strictEqual(msg.caption, "این یک عکس تستی با کپشن است", "کپشن باید هنگام ساخت پیام ذخیره شود");
  console.log("✓ تست ۱ با موفقیت پاس شد.");

  // تست ۲: به‌روزرسانی و ویرایش کپشن
  console.log("تست ۲: ویرایش کپشن پیام فایل...");
  const updated = await updateMessage(msg.id, {
    caption: "کپشن ویرایش‌شده"
  });

  assert.strictEqual(updated.caption, "کپشن ویرایش‌شده", "کپشن باید به درستی آپدیت شود");
  console.log("✓ تست ۲ با موفقیت پاس شد.");

  // تست ۳: بازیابی مجدد پیام و اطمینان از پایداری روی دیسک
  console.log("تست ۳: بازیابی از دیتابیس و بررسی پایداری کپشن...");
  const all = await getMessages("default");
  const found = all.find((m) => m.id === msg.id);
  assert.strictEqual(found?.caption, "کپشن ویرایش‌شده", "پیام ذخیره‌شده باید فیلد کپشن را حفظ کند");
  console.log("✓ تست ۳ با موفقیت پاس شد.");

  console.log("=== تمامی تست‌های کپشن فایل با موفقیت ۱۰۰٪ پاس شدند ===");
}

runTest().catch((err) => {
  console.error("✗ خطا در تست کپشن:", err);
  process.exit(1);
});
