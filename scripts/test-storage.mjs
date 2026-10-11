import assert from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";
import { readJsonSafe, writeJsonAtomic } from "../lib/storage/atomic.ts";
import {
  createChat,
  createTextMessage,
  deleteMessage,
  getAllTags,
  getChats,
  getMessages,
  getPaginatedMessages,
  updateMessage
} from "../lib/store.ts";

const testDir = process.env.DATA_DIR || path.join(process.cwd(), "data");

async function runTests() {
  console.log("=== شروع تست‌های اعتبارسنجی معماری ذخیره‌سازی داده ===");

  // تست ۱: بررسی ایجاد اولیه و خواندن امن
  console.log("تست ۱: ایجاد و خواندن اتمیک فایل...");
  const sampleFilePath = path.join(testDir, "test-atomic.json");
  await writeJsonAtomic(sampleFilePath, { test: 123, status: "ok" });
  const readBack = await readJsonSafe(sampleFilePath, null);
  assert.strictEqual(readBack.test, 123);
  assert.strictEqual(readBack.status, "ok");
  console.log("✓ تست ۱ با موفقیت پاس شد.");

  // تست ۲: مقاومت در برابر خطای خرابی داده و بازیابی از بکاپ (.bak)
  console.log("تست ۲: تست شبیه‌سازی خرابی و بازیابی خودکار از فایل پشتیبان...");
  await writeJsonAtomic(sampleFilePath, { test: 456, status: "healthy-backup" });
  await writeJsonAtomic(sampleFilePath, { test: 789, status: "latest" });
  // اکنون فایل بکاپ حاوی 456 است. فایل اصلی را به عمد تخریب می‌کنیم:
  await fs.writeFile(sampleFilePath, '{"broken": [1, 2, 3', "utf8");

  // تلاش برای خواندن فایل خراب و بررسی بازیابی از بکاپ
  const recovered = await readJsonSafe(sampleFilePath, { test: 0, status: "fallback" });
  assert.strictEqual(recovered.test, 456);
  assert.strictEqual(recovered.status, "healthy-backup");
  console.log("✓ تست ۲ (بازیابی خودکار از بکاپ پس از فساد داده) با موفقیت پاس شد.");

  // پاکسازی فایل تستی
  await fs.unlink(sampleFilePath).catch(() => undefined);
  await fs.unlink(`${sampleFilePath}.bak`).catch(() => undefined);

  // تست ۳: تست صف نوشتن و همزمانی (Concurrency Stress Test)
  console.log("تست ۳: تست نوشتن همزمان ۲۰ پیام به صورت موازی...");
  const promises = [];
  for (let i = 1; i <= 20; i++) {
    promises.push(createTextMessage(`پیام همزمان شماره ${i}`, "default"));
  }
  const createdMessages = await Promise.all(promises);
  assert.strictEqual(createdMessages.length, 20);

  const allMessages = await getMessages("default");
  assert.ok(allMessages.length >= 20);
  console.log(`✓ تست ۳ با موفقیت پاس شد. (تعداد پیام‌های موجود: ${allMessages.length})`);

  // تست ۴: تست صفحه‌بندی مبتنی بر Cursor (Cursor Pagination)
  console.log("تست ۴: تست صفحه‌بندی با limit=5...");
  const page1 = await getPaginatedMessages({ chatId: "default", limit: 5 });
  assert.strictEqual(page1.messages.length, 5);
  assert.strictEqual(page1.hasMore, true);
  assert.ok(page1.nextCursor !== null);

  console.log(`صفحه اول دریافت شد: ۵ پیام. نشانگر صفحه بعد: ${page1.nextCursor}`);
  const page2 = await getPaginatedMessages({
    chatId: "default",
    limit: 5,
    before: page1.nextCursor
  });
  assert.strictEqual(page2.messages.length, 5);
  assert.notStrictEqual(page1.messages[0].id, page2.messages[0].id);
  console.log("✓ تست ۴ (صفحه‌بندی با Cursor) با موفقیت پاس شد.");

  // تست ۵: تست تگ‌گذاری، به‌روزرسانی و حذف پیام
  console.log("تست ۵: تست ویرایش، تگ و حذف...");
  const firstMsg = page1.messages[0];
  const updated = await updateMessage(firstMsg.id, {
    tags: ["مهم", "تستی"],
    pinned: true
  });
  assert.strictEqual(updated.pinned, true);
  assert.deepStrictEqual(updated.tags, ["مهم", "تستی"]);

  const allTags = await getAllTags();
  assert.ok(allTags.includes("مهم"));
  assert.ok(allTags.includes("تستی"));

  const deleted = await deleteMessage(firstMsg.id);
  assert.strictEqual(deleted.id, firstMsg.id);
  console.log("✓ تست ۵ با موفقیت پاس شد.");

  // تست ۶: تست مدیریت چت‌ها
  console.log("تست ۶: بررسی لیست چت‌ها و چت پیش‌فرض...");
  const chats = await getChats();
  const defChat = chats.find((c) => c.id === "default");
  assert.ok(defChat !== undefined);
  assert.strictEqual(defChat.name, "Saved Messages");
  console.log("✓ تست ۶ با موفقیت پاس شد.");

  console.log("\n=== تمامی تست‌های پایداری و ذخیره‌سازی با موفقیت ۱۰۰٪ پاس شدند ===");
}

runTests().catch((err) => {
  console.error("خطا در اجرای تست‌ها:", err);
  process.exit(1);
});
