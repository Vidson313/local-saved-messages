import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";

/**
 * نوشتن اتمیک و مقاوم داده‌های JSON روی دیسک
 * از ایجاد فایل موقت، fsync و atomic rename برای جلوگیری از فساد داده استفاده می‌کند.
 */
export async function writeJsonAtomic<T>(filePath: string, data: T): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  const tempPath = `${filePath}.${randomUUID()}.tmp`;
  const backupPath = `${filePath}.bak`;
  const serialized = JSON.stringify(data, null, 2);

  // ۱. نوشتن در فایل موقت و فلاش فیزیکی به دیسک (fsync)
  const fileHandle = await fs.open(tempPath, "w");
  try {
    await fileHandle.writeFile(serialized, "utf8");
    await fileHandle.sync();
  } finally {
    await fileHandle.close();
  }

  // ۲. تهیه نسخه پشتیبان پیش از جایگزینی
  try {
    await fs.copyFile(filePath, backupPath);
  } catch {
    // در اولین اجرا که فایل اصلی وجود ندارد خطایی رخ نمی‌دهد
  }

  // ۳. جایگزینی اتمیک فایل اصلی (Atomic Rename)
  try {
    await fs.rename(tempPath, filePath);
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === "EPERM" || error.code === "EBUSY") {
      // حل تعلیق موقت هندل فایل در ویندوز
      await new Promise((resolve) => setTimeout(resolve, 25));
      await fs.unlink(filePath).catch(() => undefined);
      await fs.rename(tempPath, filePath);
    } else {
      await fs.unlink(tempPath).catch(() => undefined);
      throw err;
    }
  }
}

/**
 * خواندن امن داده‌های JSON با قابلیت بازیابی خودکار از فایل پشتیبان
 */
export async function readJsonSafe<T>(filePath: string, fallback: T): Promise<T> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  try {
    await fs.access(filePath);
  } catch {
    // فایل هنوز ایجاد نشده است؛ ایجاد فایل اولیه سالم
    await writeJsonAtomic(filePath, fallback);
    return fallback;
  }

  try {
    const raw = await fs.readFile(filePath, "utf8");
    if (!raw.trim()) {
      throw new SyntaxError("File is empty or truncated");
    }
    return JSON.parse(raw) as T;
  } catch (readError) {
    console.error(`[Storage Warning] Error reading ${filePath}:`, readError);

    // ۱. نگهداری نسخه آسیب‌دیده برای عدم از دست رفتن داده‌های قابل بازیابی
    const corruptPath = `${filePath}.corrupt.${Date.now()}`;
    await fs.copyFile(filePath, corruptPath).catch(() => undefined);

    // ۲. تلاش برای بازیابی از فایل پشتیبان (.bak)
    const backupPath = `${filePath}.bak`;
    try {
      const backupRaw = await fs.readFile(backupPath, "utf8");
      const backupData = JSON.parse(backupRaw) as T;
      console.warn(`[Storage Recovery] Successfully restored ${filePath} from backup.`);
      // بازگردانی فایل اصلی با داده سالم پشتیبان
      await writeJsonAtomic(filePath, backupData);
      return backupData;
    } catch {
      console.error(`[Storage Error] Backup unavailable or invalid for ${filePath}. Using fallback.`);
      await writeJsonAtomic(filePath, fallback);
      return fallback;
    }
  }
}
