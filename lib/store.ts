import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";

export type Chat = {
  id: string;
  name: string;
  avatar: string | null;
  avatarType: "emoji" | "image" | null;
  createdAt: string;
};

export type Message = {
  id: string;
  chatId: string;
  type: "TEXT" | "FILE";
  content: string;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  pinned: boolean;
  saved: boolean;
  createdAt: string;
};

const dataDir = path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "messages.json");
const chatsDbPath = path.join(dataDir, "chats.json");

let writeQueue = Promise.resolve();

async function ensureDir() {
  await fs.mkdir(dataDir, { recursive: true });
}

async function ensureFile(filePath: string, defaultContent: string) {
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, defaultContent, "utf8");
  }
}

async function readChats(): Promise<Chat[]> {
  await ensureDir();
  await ensureFile(chatsDbPath, "[]");
  const raw = await fs.readFile(chatsDbPath, "utf8");
  const parsed = JSON.parse(raw) as Chat[];
  return parsed.map((c) => ({
    ...c,
    avatar: c.avatar ?? null,
    avatarType: c.avatarType ?? null
  }));
}

async function writeChats(chats: Chat[]) {
  await ensureDir();
  await fs.writeFile(chatsDbPath, JSON.stringify(chats, null, 2), "utf8");
}

async function readMessages(): Promise<Message[]> {
  await ensureDir();
  await ensureFile(dbPath, "[]");
  const raw = await fs.readFile(dbPath, "utf8");
  const parsed = JSON.parse(raw) as Message[];
  return parsed.map((m) => ({
    ...m,
    chatId: m.chatId ?? "default",
    pinned: m.pinned ?? false,
    saved: m.saved ?? false
  }));
}

async function writeMessages(messages: Message[]) {
  await ensureDir();
  await fs.writeFile(dbPath, JSON.stringify(messages, null, 2), "utf8");
}

function withWriteLock<T>(task: () => Promise<T>) {
  const run = writeQueue.then(task, task);
  writeQueue = run.then(() => undefined, () => undefined);
  return run;
}

// ── Chat CRUD ──

export async function getChats() {
  const chats = await readChats();
  // Ensure default chat exists
  if (!chats.find((c) => c.id === "default")) {
    const defaultChat: Chat = {
      id: "default",
      name: "Saved Messages",
      avatar: "💾",
      avatarType: "emoji",
      createdAt: new Date().toISOString()
    };
    chats.push(defaultChat);
    await writeChats(chats);
  }
  return chats.sort((a, b) => {
    if (a.id === "default") return -1;
    if (b.id === "default") return 1;
    return +new Date(a.createdAt) - +new Date(b.createdAt);
  });
}

export async function createChat(input: { name: string; avatar?: string; avatarType?: "emoji" | "image" }) {
  return withWriteLock(async () => {
    const chats = await readChats();
    const chat: Chat = {
      id: randomUUID(),
      name: input.name,
      avatar: input.avatar ?? null,
      avatarType: input.avatarType ?? null,
      createdAt: new Date().toISOString()
    };
    chats.push(chat);
    await writeChats(chats);
    return chat;
  });
}

export async function updateChat(id: string, updates: Partial<Pick<Chat, "name" | "avatar" | "avatarType">>) {
  return withWriteLock(async () => {
    const chats = await readChats();
    const index = chats.findIndex((c) => c.id === id);
    if (index === -1) return null;
    chats[index] = { ...chats[index], ...updates };
    await writeChats(chats);
    return chats[index];
  });
}

export async function deleteChat(id: string) {
  return withWriteLock(async () => {
    if (id === "default") return null; // Cannot delete default chat
    const chats = await readChats();
    const chat = chats.find((c) => c.id === id);
    if (!chat) return null;
    await writeChats(chats.filter((c) => c.id !== id));
    // Also delete all messages in this chat
    const messages = await readMessages();
    await writeMessages(messages.filter((m) => m.chatId !== id));
    return chat;
  });
}

// ── Message CRUD ──

export async function getMessages(chatId?: string) {
  const messages = await readMessages();
  const sorted = messages.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
  if (chatId) return sorted.filter((m) => m.chatId === chatId);
  return sorted;
}

export async function createTextMessage(content: string, chatId: string = "default") {
  return withWriteLock(async () => {
    const messages = await readMessages();
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
      createdAt: new Date().toISOString()
    };
    messages.push(message);
    await writeMessages(messages);
    return message;
  });
}

export async function createFileMessage(input: {
  content: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  chatId?: string;
}) {
  return withWriteLock(async () => {
    const messages = await readMessages();
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
      createdAt: new Date().toISOString()
    };
    messages.push(message);
    await writeMessages(messages);
    return message;
  });
}

export async function deleteMessage(id: string) {
  return withWriteLock(async () => {
    const messages = await readMessages();
    const message = messages.find((item) => item.id === id);
    if (!message) return null;

    await writeMessages(messages.filter((item) => item.id !== id));
    return message;
  });
}

export async function updateMessage(id: string, updates: Partial<Pick<Message, "pinned" | "saved">>) {
  return withWriteLock(async () => {
    const messages = await readMessages();
    const index = messages.findIndex((item) => item.id === id);
    if (index === -1) return null;

    messages[index] = { ...messages[index], ...updates };
    await writeMessages(messages);
    return messages[index];
  });
}

export async function deleteMessages(ids: string[]) {
  return withWriteLock(async () => {
    const messages = await readMessages();
    const idSet = new Set(ids);
    const removed = messages.filter((item) => idSet.has(item.id));
    await writeMessages(messages.filter((item) => !idSet.has(item.id)));
    return removed;
  });
}
