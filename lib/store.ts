import { randomUUID } from "crypto";
import path from "path";
import { readJsonSafe, writeJsonAtomic } from "./storage/atomic.ts";
import {
  type Chat,
  type CreateChatInput,
  type CreateFileInput,
  type Message,
  type PaginatedMessages,
  type PaginationOptions,
  type UpdateChatInput,
  type UpdateMessageInput,
  MAX_MESSAGE_LENGTH
} from "../types/store.ts";

export type {
  Chat,
  Message,
  PaginationOptions,
  PaginatedMessages,
  CreateChatInput,
  UpdateChatInput,
  CreateFileInput,
  UpdateMessageInput
};

export { MAX_MESSAGE_LENGTH };

const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "messages.json");
const chatsDbPath = path.join(dataDir, "chats.json");

// صف زنجیره‌ای جهت جلوگیری از تداخل نوشتن‌های همزمان
let writeQueue = Promise.resolve();

// کش در حافظه جهت جلوگیری از I/O مکرر دیسک در هر درخواست
let cachedChats: Chat[] | null = null;
let cachedMessages: Message[] | null = null;

function withWriteLock<T>(task: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(task, task);
  writeQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

const defaultChat: Chat = {
  id: "default",
  name: "Saved Messages",
  avatar: "💾",
  avatarType: "emoji",
  createdAt: "2026-01-01T00:00:00.000Z"
};

async function ensureInitialized() {
  if (cachedChats === null) {
    const rawChats = await readJsonSafe<Chat[]>(chatsDbPath, [defaultChat]);
    const normalizedChats = rawChats.map((c) => ({
      ...c,
      avatar: c.avatar ?? null,
      avatarType: c.avatarType ?? null
    }));

    if (!normalizedChats.some((c) => c.id === "default")) {
      normalizedChats.unshift(defaultChat);
      await writeJsonAtomic(chatsDbPath, normalizedChats);
    }
    cachedChats = normalizedChats;
  }

  if (cachedMessages === null) {
    const rawMessages = await readJsonSafe<Message[]>(dbPath, []);
    cachedMessages = rawMessages.map((m) => ({
      ...m,
      chatId: m.chatId ?? "default",
      pinned: m.pinned ?? false,
      saved: m.saved ?? false,
      tags: m.tags ?? []
    }));
  }
}

// ── توابع مدیریت چت‌ها (Chat CRUD) ──

export async function getChats(): Promise<Chat[]> {
  await ensureInitialized();
  const chats = [...(cachedChats || [])];
  return chats.sort((a, b) => {
    if (a.id === "default") return -1;
    if (b.id === "default") return 1;
    return +new Date(a.createdAt) - +new Date(b.createdAt);
  });
}

export async function createChat(input: CreateChatInput): Promise<Chat> {
  return withWriteLock(async () => {
    await ensureInitialized();
    const chat: Chat = {
      id: randomUUID(),
      name: input.name,
      avatar: input.avatar ?? null,
      avatarType: input.avatarType ?? null,
      createdAt: new Date().toISOString()
    };

    cachedChats = [...(cachedChats || []), chat];
    await writeJsonAtomic(chatsDbPath, cachedChats);
    return chat;
  });
}

export async function updateChat(id: string, updates: UpdateChatInput): Promise<Chat | null> {
  return withWriteLock(async () => {
    await ensureInitialized();
    if (!cachedChats) return null;

    const index = cachedChats.findIndex((c) => c.id === id);
    if (index === -1) return null;

    const updated = { ...cachedChats[index], ...updates };
    cachedChats[index] = updated;
    await writeJsonAtomic(chatsDbPath, cachedChats);
    return updated;
  });
}

export async function deleteChat(id: string): Promise<Chat | null> {
  return withWriteLock(async () => {
    if (id === "default") return null; // چت پیش‌فرض حذف نمی‌شود
    await ensureInitialized();
    if (!cachedChats || !cachedMessages) return null;

    const chat = cachedChats.find((c) => c.id === id);
    if (!chat) return null;

    cachedChats = cachedChats.filter((c) => c.id !== id);
    cachedMessages = cachedMessages.filter((m) => m.chatId !== id);

    await Promise.all([
      writeJsonAtomic(chatsDbPath, cachedChats),
      writeJsonAtomic(dbPath, cachedMessages)
    ]);

    return chat;
  });
}

// ── توابع مدیریت پیام‌ها (Message CRUD) ──

/**
 * دریافت پیام‌ها به صورت ساده (سازگار با کدهای قبلی)
 */
export async function getMessages(chatId?: string): Promise<Message[]> {
  await ensureInitialized();
  const sorted = [...(cachedMessages || [])].sort(
    (a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)
  );
  if (chatId) return sorted.filter((m) => m.chatId === chatId);
  return sorted;
}

/**
 * دریافت پیام‌ها همراه با صفحه‌بندی مبتنی بر Cursor
 */
export async function getPaginatedMessages(options: PaginationOptions = {}): Promise<PaginatedMessages> {
  await ensureInitialized();
  const { chatId, limit = 50, before } = options;

  let list = [...(cachedMessages || [])];
  if (chatId) {
    list = list.filter((m) => m.chatId === chatId);
  }

  // مرتب‌سازی از جدیدترین به قدیمی‌ترین برای صفحه‌بندی کارآمد
  list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

  if (before) {
    const beforeDate = new Date(before).getTime();
    list = list.filter((m) => +new Date(m.createdAt) < beforeDate);
  }

  const safeLimit = Math.max(1, Math.min(limit, 100));
  const pageItems = list.slice(0, safeLimit);
  const hasMore = list.length > safeLimit;
  const nextCursor = hasMore && pageItems.length > 0 ? pageItems[pageItems.length - 1].createdAt : null;

  // بازگردانی آیتم‌های صفحه با ترتیب زمانی صعودی (مطابق رابط چت)
  pageItems.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));

  return {
    messages: pageItems,
    nextCursor,
    total: cachedMessages?.length || 0,
    hasMore
  };
}

export async function createTextMessage(content: string, chatId: string = "default"): Promise<Message> {
  return withWriteLock(async () => {
    await ensureInitialized();
    const message: Message = {
      id: randomUUID(),
      chatId,
      type: "TEXT",
      content,
      fileName: null,
      fileSize: null,
      mimeType: null,
      pinned: false,
      saved: false,
      tags: [],
      createdAt: new Date().toISOString()
    };

    cachedMessages = [...(cachedMessages || []), message];
    await writeJsonAtomic(dbPath, cachedMessages);
    return message;
  });
}

export async function createFileMessage(input: CreateFileInput): Promise<Message> {
  return withWriteLock(async () => {
    await ensureInitialized();
    const message: Message = {
      id: randomUUID(),
      chatId: input.chatId ?? "default",
      type: "FILE",
      content: input.content,
      fileName: input.fileName,
      fileSize: input.fileSize,
      mimeType: input.mimeType,
      pinned: false,
      saved: false,
      tags: [],
      createdAt: new Date().toISOString()
    };

    cachedMessages = [...(cachedMessages || []), message];
    await writeJsonAtomic(dbPath, cachedMessages);
    return message;
  });
}

export async function deleteMessage(id: string): Promise<Message | null> {
  return withWriteLock(async () => {
    await ensureInitialized();
    if (!cachedMessages) return null;

    const message = cachedMessages.find((item) => item.id === id);
    if (!message) return null;

    cachedMessages = cachedMessages.filter((item) => item.id !== id);
    await writeJsonAtomic(dbPath, cachedMessages);
    return message;
  });
}

export async function deleteMessages(ids: string[]): Promise<Message[]> {
  return withWriteLock(async () => {
    await ensureInitialized();
    if (!cachedMessages) return [];

    const idSet = new Set(ids);
    const removed = cachedMessages.filter((item) => idSet.has(item.id));
    cachedMessages = cachedMessages.filter((item) => !idSet.has(item.id));

    await writeJsonAtomic(dbPath, cachedMessages);
    return removed;
  });
}

export async function updateMessage(id: string, updates: UpdateMessageInput): Promise<Message | null> {
  return withWriteLock(async () => {
    await ensureInitialized();
    if (!cachedMessages) return null;

    const index = cachedMessages.findIndex((item) => item.id === id);
    if (index === -1) return null;

    const updated = { ...cachedMessages[index], ...updates };
    cachedMessages[index] = updated;
    await writeJsonAtomic(dbPath, cachedMessages);
    return updated;
  });
}

export async function getAllTags(): Promise<string[]> {
  await ensureInitialized();
  const tagSet = new Set<string>();
  for (const m of cachedMessages || []) {
    for (const t of m.tags ?? []) tagSet.add(t);
  }
  return Array.from(tagSet).sort();
}
