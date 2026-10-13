import assert from "node:assert";

// ── شبیه‌سازی منطق توکنایزر و پارسر مارک‌داون تلگرام ──

function parseCodeBlocks(content) {
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  const blocks = [];
  let match;
  while ((match = codeBlockRegex.exec(content)) !== null) {
    blocks.push({
      lang: match[1] || "",
      code: match[2]
    });
  }
  return blocks;
}

function parseSpoilers(text) {
  const spoilerRegex = /\|\|([\s\S]+?)\|\|/g;
  const matches = [];
  let match;
  while ((match = spoilerRegex.exec(text)) !== null) {
    matches.push(match[1]);
  }
  return matches;
}

function parseMarkdownLinks(text) {
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  const links = [];
  let match;
  while ((match = linkRegex.exec(text)) !== null) {
    links.push({ label: match[1], url: match[2] });
  }
  return links;
}

function detectDirection(text) {
  // استفاده از کدهای یونیکد صریح جهت جلوگیری از کاراکترهای نامرئی
  const rtlChars = new RegExp("[\\u0600-\\u06FF\\u0750-\\u077F\\u0590-\\u05FF\\uFB50-\\uFDFF\\uFE70-\\uFEFF]");
  const ltrChars = /[a-zA-Z]/;

  for (const char of text) {
    if (rtlChars.test(char)) return "rtl";
    if (ltrChars.test(char)) return "ltr";
  }
  return "auto";
}

function formatDuration(seconds) {
  if (!seconds || Number.isNaN(seconds) || !Number.isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

async function runUXTests() {
  console.log("=== شروع تست‌های اعتبارسنجی ارتقای تجربه کاربری (UX, RTL, Markdown) ===");

  // تست ۱: استخراج کدبلاک‌های چندخطی با زبان مشخص
  console.log("تست ۱: تست شناسایی Code Block چندخطی و تعیین زبان...");
  const sampleSnippet = "اینجا کد است:\n```typescript\nconst x: number = 42;\nconsole.log(x);\n```\nپایان کد.";
  const blocks = parseCodeBlocks(sampleSnippet);
  assert.strictEqual(blocks.length, 1);
  assert.strictEqual(blocks[0].lang, "typescript");
  assert.ok(blocks[0].code.includes("const x: number = 42;"));
  console.log("✓ تست ۱ با موفقیت پاس شد (تشخیص صحیح زبان و بدنه کد).");

  // تست ۲: شناسایی اسپویلرهای تلگرامی (||spoiler||)
  console.log("تست ۲: تست اسپویلرهای تلگرامی...");
  const spoilerSample = "پاسخ سوال ||گزینه چهارم|| است و دیگر هیچ.";
  const spoilers = parseSpoilers(spoilerSample);
  assert.strictEqual(spoilers.length, 1);
  assert.strictEqual(spoilers[0], "گزینه چهارم");
  console.log("✓ تست ۲ با موفقیت پاس شد (استخراج دقیق اسپویلر).");

  // تست ۳: استخراج لینک‌های مارک‌داون
  console.log("تست ۳: تست لینک‌های مارک‌داون [label](url)...");
  const linkSample = "برای مشاهده کلیک کنید: [مخزن گیت‌هاب](https://github.com/Vidson313/local-saved-messages).";
  const links = parseMarkdownLinks(linkSample);
  assert.strictEqual(links.length, 1);
  assert.strictEqual(links[0].label, "مخزن گیت‌هاب");
  assert.strictEqual(links[0].url, "https://github.com/Vidson313/local-saved-messages");
  console.log("✓ تست ۳ با موفقیت پاس شد (تشخیص برچسب و آدرس لینک).");

  // تست ۴: تشخیص هوشمند جهت متن (RTL / LTR)
  console.log("تست ۴: تست تشخیص جهت متون فارسی، انگلیسی و ترکیبی...");
  assert.strictEqual(detectDirection("سلام دنیا"), "rtl");
  assert.strictEqual(detectDirection("Hello world"), "ltr");
  assert.strictEqual(detectDirection("پیام فارسی با کلمه English در وسط"), "rtl");
  assert.strictEqual(detectDirection("English text with فارسی inside"), "ltr");
  console.log("✓ تست ۴ با موفقیت پاس شد (تشخیص جهت زبان‌های راست‌به‌چپ و چپ‌به‌راست).");

  // تست ۵: فرمت‌بندی زمان در پلیر صوتی
  console.log("تست ۵: تست فرمت‌بندی زمان در پلیر صوتی (formatDuration)...");
  assert.strictEqual(formatDuration(0), "0:00");
  assert.strictEqual(formatDuration(45), "0:45");
  assert.strictEqual(formatDuration(125), "2:05");
  assert.strictEqual(formatDuration(3605), "60:05");
  console.log("✓ تست ۵ با موفقیت پاس شد (محاسبه دقیق دقیقه و ثانیه).");

  console.log("\n=== تمامی تست‌های تجربه کاربری (UX) با موفقیت ۱۰۰٪ پاس شدند ===");
}

runUXTests().catch((err) => {
  console.error("خطا در تست‌های UX:", err);
  process.exit(1);
});
