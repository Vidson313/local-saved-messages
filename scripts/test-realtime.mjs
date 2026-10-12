import assert from "node:assert";
import {
  broadcast,
  formatSSEMessage,
  getEventsSince,
  subscribe
} from "../lib/events.ts";

async function runRealtimeTests() {
  console.log("=== شروع تست‌های اعتبارسنجی سیستم همگام‌سازی بلادرنگ SSE ===");

  // تست ۱: بررسی ساختار و ارسال رویداد با شناسه ترتیبی
  console.log("تست ۱: بررسی انتشار رویداد با Event ID ترتیبی...");
  let receivedPayload = null;
  let receivedId = null;

  const unsubscribe1 = subscribe((payload, eventId) => {
    receivedPayload = payload;
    receivedId = eventId;
  });

  const testEvent = { type: "test-event", content: "سلام بلادرنگ" };
  const eventId1 = broadcast(testEvent);

  assert.strictEqual(receivedId, eventId1);
  assert.ok(receivedPayload.includes(`id: ${eventId1}`));
  assert.ok(receivedPayload.includes("سلام بلادرنگ"));
  console.log(`✓ تست ۱ با موفقیت پاس شد. (شناسه رویداد: ${eventId1})`);

  // تست ۲: بازپخش رویدادهای از دست رفته (Last-Event-ID Catch-up)
  console.log("تست ۲: تست استخراج رویدادهای بعد از شناسه مشخص (Missed Events Catch-up)...");
  const eventId2 = broadcast({ type: "created", msgId: "m-101" });
  const eventId3 = broadcast({ type: "created", msgId: "m-102" });
  const eventId4 = broadcast({ type: "created", msgId: "m-103" });

  // کلاینتی که آخرین بار eventId1 را دریافت کرده بوده، وصل می‌شود:
  const catchupResult = getEventsSince(eventId1);
  assert.strictEqual(catchupResult.canCatchUp, true);
  assert.strictEqual(catchupResult.events.length, 3);
  assert.strictEqual(catchupResult.events[0].id, eventId2);
  assert.strictEqual(catchupResult.events[1].id, eventId3);
  assert.strictEqual(catchupResult.events[2].id, eventId4);

  // بررسی قالب‌بندی پیام‌های SSE برای ارسال مجدد
  const formatted = formatSSEMessage(catchupResult.events[0]);
  assert.ok(formatted.startsWith(`id: ${eventId2}\n`));
  assert.ok(formatted.includes('"msgId":"m-101"'));
  console.log("✓ تست ۲ (تحویل رویدادهای جامانده) با موفقیت پاس شد.");

  // تست ۳: تست لغو اشتراک شنونده (Unsubscribe)
  console.log("تست ۳: تست لغو اشتراک و چندشنوندگی...");
  let listener2Count = 0;
  const unsubscribe2 = subscribe(() => {
    listener2Count++;
  });

  broadcast({ type: "ping" });
  assert.strictEqual(listener2Count, 1);

  // لغو اشتراک شنونده ۱ و ۲
  unsubscribe1();
  unsubscribe2();

  const prevPayload = receivedPayload;
  broadcast({ type: "after-unsub" });
  assert.strictEqual(receivedPayload, prevPayload); // نباید تغییر کرده باشد
  assert.strictEqual(listener2Count, 1); // نباید اضافه شده باشد
  console.log("✓ تست ۳ (Unsubscribe و چندشنوندگی) با موفقیت پاس شد.");

  // تست ۴: تست منقضی شدن رویدادها در بافر چرخشی
  console.log("تست ۴: تست بافر چرخشی و اعلام resync برای شناسه‌های بسیار قدیمی...");
  // شناسه -9999 بسیار قدیمی‌تر از بافر فعلی است
  const expiredResult = getEventsSince(-9999);
  assert.strictEqual(expiredResult.canCatchUp, false);
  assert.strictEqual(expiredResult.events.length, 0);
  console.log("✓ تست ۴ (تشخیص انقضای رویدادها و الزام به resync) با موفقیت پاس شد.");

  console.log("\n=== تمامی تست‌های سیستم بلادرنگ SSE با موفقیت ۱۰۰٪ پاس شدند ===");
}

runRealtimeTests().catch((err) => {
  console.error("خطا در اجرای تست‌ها:", err);
  process.exit(1);
});
