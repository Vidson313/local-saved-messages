import assert from "node:assert";

/**
 * شبیه‌سازی دقیق ماشین وضعیت درگ‌اند‌دراپ بر اساس شمارنده رویداد
 */
class DragDropStateManager {
  constructor() {
    this.counter = 0;
    this.isDragging = false;
  }

  handleDragEnter(types = ["Files"]) {
    if (!types.includes("Files")) return;
    this.counter += 1;
    if (this.counter === 1) {
      this.isDragging = true;
    }
  }

  handleDragLeave() {
    this.counter = Math.max(0, this.counter - 1);
    if (this.counter === 0) {
      this.isDragging = false;
    }
  }

  handleDrop() {
    this.counter = 0;
    this.isDragging = false;
  }
}

async function runDragDropTests() {
  console.log("=== شروع تست‌های اعتبارسنجی درگ‌اند‌دراپ و مهار چشمک‌زدن (Flicker Prevention) ===");

  const manager = new DragDropStateManager();

  // تست ۱: ورود فایل اولیه به پنجره
  console.log("تست ۱: ورود فایل به پنجره برنامه (DragEnter اولیه)...");
  manager.handleDragEnter(["Files"]);
  assert.strictEqual(manager.isDragging, true, "وضعیت درگ باید فعال باشد");
  assert.strictEqual(manager.counter, 1);
  console.log("✓ تست ۱ با موفقیت پاس شد.");

  // تست ۲: جابجایی ماوس بین فرزندان پنجره (Child Elements) - نباید باعث خروج یا چشمک‌زدن شود
  console.log("تست ۲: جابجایی ماوس روی فرزندان داخلی (عبور از مرز المان‌ها)...");
  // ورود به المان فرزند (مثلاً سایدبار)
  manager.handleDragEnter(["Files"]);
  // خروج از والد
  manager.handleDragLeave();
  assert.strictEqual(manager.isDragging, true, "در حین جابجایی بین فرزندان وضعیت درگ نباید قطع شود");
  assert.strictEqual(manager.counter, 1);

  // ورود به فرزند دیگر (مثلاً لیست پیام‌ها)
  manager.handleDragEnter(["Files"]);
  // خروج از سایدبار
  manager.handleDragLeave();
  assert.strictEqual(manager.isDragging, true, "وضعیت درگ همچنان پایدار است");
  assert.strictEqual(manager.counter, 1);
  console.log("✓ تست ۲ (پایداری و مهار چشمک‌زدن) با موفقیت پاس شد.");

  // تست ۳: نادیده گرفتن درگ متن معمولی
  console.log("تست ۳: اطمینان از نادیده گرفتن درگ متن معمولی بدون فایل...");
  const textManager = new DragDropStateManager();
  textManager.handleDragEnter(["text/plain"]);
  assert.strictEqual(textManager.isDragging, false, "درگ متن نباید صفحه آپلود را فعال کند");
  console.log("✓ تست ۳ با موفقیت پاس شد.");

  // تست ۴: خروج کامل ماوس از پنجره برنامه
  console.log("تست ۴: خروج کامل ماوس از پنجره...");
  manager.handleDragLeave();
  assert.strictEqual(manager.isDragging, false, "با خروج کامل ماوس وضعیت درگ باید غیرفعال شود");
  assert.strictEqual(manager.counter, 0);
  console.log("✓ تست ۴ با موفقیت پاس شد.");

  // تست ۵: رها کردن فایل (Drop) و ریست کامل شمارنده
  console.log("تست ۵: رها کردن فایل (Drop)...");
  manager.handleDragEnter(["Files"]);
  manager.handleDragEnter(["Files"]);
  manager.handleDrop();
  assert.strictEqual(manager.isDragging, false, "پس از Drop وضعیت باید ریست شود");
  assert.strictEqual(manager.counter, 0);
  console.log("✓ تست ۵ با موفقیت پاس شد.");

  console.log("\n=== تمامی تست‌های درگ‌اند‌دراپ با موفقیت ۱۰۰٪ پاس شدند ===");
}

runDragDropTests().catch((err) => {
  console.error("خطا در اجرای تست درگ‌اند‌دراپ:", err);
  process.exit(1);
});
