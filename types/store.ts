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
  tags: string[];
  createdAt: string;
};

export type PaginationOptions = {
  chatId?: string;
  limit?: number;
  before?: string;
};

export type PaginatedMessages = {
  messages: Message[];
  nextCursor: string | null;
  total: number;
  hasMore: boolean;
};

export type CreateChatInput = {
  name: string;
  avatar?: string | null;
  avatarType?: "emoji" | "image" | null;
};

export type UpdateChatInput = Partial<Pick<Chat, "name" | "avatar" | "avatarType">>;

export type CreateFileInput = {
  content: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  chatId?: string;
};

export type UpdateMessageInput = Partial<Pick<Message, "pinned" | "saved" | "tags" | "content">>;

export const MAX_MESSAGE_LENGTH = 50000;

