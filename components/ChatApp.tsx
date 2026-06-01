"use client";

import {
  ChangeEvent,
  ClipboardEvent,
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { SettingsModal, useAppFontSize } from "@/components/ui/SettingsModal";
import { ChatListSkeleton, MessageListSkeleton, LoadingSpinner } from "@/components/ui/Skeleton";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { CommandPalette } from "@/components/ui/CommandPalette";
import { useAppLock, LockScreen, SetPinModal } from "@/components/ui/AppLockModal";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { TagEditor } from "@/components/ui/TagEditor";
import { TagList } from "@/components/ui/TagBadge";

type Chat = {
  id: string;
  name: string;
  avatar: string | null;
  avatarType: "emoji" | "image" | null;
  createdAt: string;
};

type Msg = {
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

type TabName = "media" | "links" | "files";
type IconName =
  | "attach"
  | "copy"
  | "delete"
  | "download"
  | "file"
  | "saved"
  | "search"
  | "send"
  | "menu"
  | "dots"
  | "link"
  | "pin"
  | "unpin"
  | "save"
  | "unsave"
  | "select"
  | "close"
  | "check"
  | "plus"
  | "edit"
  | "camera"
  | "back"
  | "keyboard"
  | "lock"
  | "forward"
  | "reply"
  | "tag";

const EMOJI_OPTIONS = ["💾", "📌", "📂", "🗂️", "📝", "💡", "🔖", "⭐", "🎵", "🖼️", "🎬", "📚", "🔧", "💼", "🏠", "🎮", "💰", "🎯", "❤️", "🚀"];

function Icon({ name }: { name: IconName }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
    viewBox: "0 0 24 24"
  };

  const paths: Record<IconName, ReactNode> = {
    attach: <path d="M21 11.5 12.4 20a6 6 0 0 1-8.5-8.5l9-9a4 4 0 0 1 5.7 5.7l-9.1 9a2 2 0 0 1-2.8-2.8l8.2-8.2" />,
    copy: (
      <>
        <rect x="8" y="8" width="11" height="11" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
      </>
    ),
    delete: (
      <>
        <path d="M3 6h18" />
        <path d="M8 6V4h8v2" />
        <path d="m19 6-1 14H6L5 6" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12" />
        <path d="m7 10 5 5 5-5" />
        <path d="M5 21h14" />
      </>
    ),
    file: (
      <>
        <path d="M7 3h7l5 5v13H7z" />
        <path d="M14 3v6h5" />
      </>
    ),
    saved: (
      <>
        <path d="M6 4h12v17l-6-4-6 4z" />
        <path d="M9 8h6" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </>
    ),
    send: <path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" />,
    menu: (
      <>
        <path d="M4 7h16" />
        <path d="M4 12h16" />
        <path d="M4 17h16" />
      </>
    ),
    dots: (
      <>
        <circle cx="12" cy="5" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="12" cy="19" r="1" />
      </>
    ),
    link: (
      <>
        <path d="M10 13a5 5 0 0 0 7.1 0l2.1-2.1a5 5 0 1 0-7.1-7.1L10.9 5" />
        <path d="M14 11a5 5 0 0 0-7.1 0l-2.1 2.1a5 5 0 1 0 7.1 7.1L13.1 19" />
      </>
    ),
    pin: (
      <>
        <path d="M12 17v5" />
        <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 1 1 0 0 0 1-1V4a2 2 0 0 0-2-2h-6a2 2 0 0 0-2 2v1a1 1 0 0 0 1 1 1 1 0 0 1 1 1z" />
      </>
    ),
    unpin: (
      <>
        <path d="M12 17v5" />
        <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 1 1 0 0 0 1-1V4a2 2 0 0 0-2-2h-6a2 2 0 0 0-2 2v1a1 1 0 0 0 1 1 1 1 0 0 1 1 1z" />
        <line x1="3" y1="3" x2="21" y2="21" strokeWidth="2" />
      </>
    ),
    save: (
      <>
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
        <polyline points="17,21 17,13 7,13 7,21" />
        <polyline points="7,3 7,8 15,8" />
      </>
    ),
    unsave: (
      <>
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
        <polyline points="17,21 17,13 7,13 7,21" />
        <polyline points="7,3 7,8 15,8" />
        <line x1="3" y1="3" x2="21" y2="21" strokeWidth="2" />
      </>
    ),
    select: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M8 12l3 3 5-5" strokeWidth="2" />
      </>
    ),
    close: (
      <>
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </>
    ),
    check: (
      <>
        <polyline points="20,6 9,17 4,12" strokeWidth="2" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </>
    ),
    edit: (
      <>
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </>
    ),
    camera: (
      <>
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </>
    ),
    back: (
      <>
        <path d="m15 18-6-6 6-6" />
      </>
    ),
    keyboard: (
      <>
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M8 16h8" />
      </>
    ),
    lock: (
      <>
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </>
    ),
    forward: (
      <>
        <path d="m15 17 5-5-5-5" />
        <path d="M4 18v-2a4 4 0 0 1 4-4h12" />
      </>
    ),
    reply: (
      <>
        <path d="m9 17-5-5 5-5" />
        <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
      </>
    ),
    tag: (
      <>
        <path d="M20.6 9.6l-8.2-8.2a1 1 0 0 0-.7-.3H4a1 1 0 0 0-1 1v7.7a1 1 0 0 0 .3.7l8.2 8.2a1 1 0 0 0 1.4 0l8.7-8.7a1 1 0 0 0 0-1.4z" />
        <circle cx="7.5" cy="7.5" r="1.5" fill="currentColor" />
      </>
    )
  };

  return (
    <svg aria-hidden="true" className="tg-icon" {...common}>
      {paths[name]}
    </svg>
  );
}

function formatBytes(value: number | null) {
  if (!value) return "";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let i = 0;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[i]}`;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function mergeById(messages: Msg[]) {
  const map = new Map<string, Msg>();
  for (const message of messages) {
    map.set(message.id, {
      ...message,
      chatId: message.chatId ?? "default",
      pinned: message.pinned ?? false,
      saved: message.saved ?? false
    });
  }
  return [...map.values()].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
}

function extractLinks(text: string) {
  return text.match(/https?:\/\/[^\s]+/g) || [];
}

function linkify(text: string) {
  const pattern = /(https?:\/\/[^\s]+)/g;
  const chunks = text.split(pattern);
  return chunks.map((part, i) => {
    if (/^https?:\/\//.test(part)) {
      return (
        <a key={`${part}-${i}`} href={part} target="_blank" rel="noreferrer" className="tg-link">
          {part}
        </a>
      );
    }
    return <span key={`${part}-${i}`}>{part}</span>;
  });
}

function isMedia(message: Msg) {
  return Boolean(message.mimeType?.startsWith("image/") || message.mimeType?.startsWith("video/"));
}

function FilePreview({ message }: { message: Msg }) {
  const mime = message.mimeType || "";

  if (mime.startsWith("image/")) {
    return <img src={message.content} alt={message.fileName || "image"} className="tg-media tg-media-image" loading="lazy" />;
  }

  if (mime.startsWith("video/")) {
    return <video src={message.content} controls className="tg-media tg-media-video" />;
  }

  if (mime.startsWith("audio/")) {
    return (
      <div className="tg-audio">
        <audio src={message.content} controls />
      </div>
    );
  }

  return (
    <div className="tg-document">
      <div className="tg-document-icon">
        <Icon name="file" />
      </div>
      <div className="tg-document-copy">
        <span>{message.fileName || "File"}</span>
        <small>{formatBytes(message.fileSize)}</small>
      </div>
    </div>
  );
}

function ChatAvatar({ chat, size = "large" }: { chat: Chat; size?: "large" | "small" | "hero" }) {
  const sizeClass = size === "hero" ? "tg-avatar-hero" : size === "small" ? "tg-avatar-small" : "tg-avatar-large";

  if (chat.avatarType === "image" && chat.avatar) {
    return (
      <span className={`tg-avatar ${sizeClass} tg-avatar-image`}>
        <img src={chat.avatar} alt={chat.name} />
      </span>
    );
  }

  if (chat.avatarType === "emoji" && chat.avatar) {
    return (
      <span className={`tg-avatar ${sizeClass} tg-avatar-emoji`}>
        {chat.avatar}
      </span>
    );
  }

  return (
    <span className={`tg-avatar ${sizeClass}`}>
      <Icon name="saved" />
    </span>
  );
}

type ContextMenuState = {
  visible: boolean;
  x: number;
  y: number;
  messageId: string | null;
};

type ChatContextMenuState = {
  visible: boolean;
  x: number;
  y: number;
  chatId: string | null;
};

export default function ChatApp() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>("default");
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<TabName>("media");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    messageId: null
  });
  const [chatContextMenu, setChatContextMenu] = useState<ChatContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    chatId: null
  });
  const [isMounted, setIsMounted] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [desktopHomeView, setDesktopHomeView] = useState(true);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatName, setNewChatName] = useState("");
  const [newChatAvatar, setNewChatAvatar] = useState("💾");
  const [newChatAvatarType, setNewChatAvatarType] = useState<"emoji" | "image">("emoji");
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editChatName, setEditChatName] = useState("");
  const [editChatAvatar, setEditChatAvatar] = useState("");
  const [editChatAvatarType, setEditChatAvatarType] = useState<"emoji" | "image">("emoji");
  const [showSettings, setShowSettings] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showSetPinModal, setShowSetPinModal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [mobileNavTab, setMobileNavTab] = useState<"chats" | "search" | "saved" | "settings">("chats");
  const [replyToMessage, setReplyToMessage] = useState<Msg | null>(null);
  const [tagEditMessageId, setTagEditMessageId] = useState<string | null>(null);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [filterTag, setFilterTag] = useState<string | null>(null);

  const appLock = useAppLock();
  useAppFontSize();
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const endRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatAvatarInputRef = useRef<HTMLInputElement | null>(null);
  const historyRef = useRef<HTMLDivElement | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const chatContextMenuRef = useRef<HTMLDivElement | null>(null);

  // ── Data fetching ──

  async function syncMessages() {
    try {
      const res = await fetch("/api/messages", { cache: "no-store" });
      if (!res.ok) throw new Error("Could not load messages");
      const next = (await res.json()) as Msg[];
      setMessages(mergeById(next));
    } catch {
      toast.error("Messages could not be refreshed.");
    }
  }

  async function syncChats() {
    try {
      const res = await fetch("/api/chats", { cache: "no-store" });
      if (!res.ok) throw new Error("Could not load chats");
      const data = (await res.json()) as Chat[];
      setChats(data);
    } catch {
      toast.error("Chats could not be refreshed.");
    }
  }

  useEffect(() => {
    Promise.all([syncChats(), syncMessages(), fetchAllTags()]).finally(() => setInitialLoading(false));
    const msgInterval = window.setInterval(syncMessages, 2000);
    const chatInterval = window.setInterval(syncChats, 5000);
    const es = new EventSource("/api/events");

    es.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "created") setMessages((prev) => mergeById([...prev, data.message]));
      if (data.type === "deleted") setMessages((prev) => prev.filter((message) => message.id !== data.id));
      if (data.type === "updated") setMessages((prev) => mergeById([...prev.filter((m) => m.id !== data.message.id), data.message]));
      if (data.type === "chat-created") setChats((prev) => [...prev, data.chat]);
      if (data.type === "chat-updated") setChats((prev) => prev.map((c) => c.id === data.chat.id ? data.chat : c));
      if (data.type === "chat-deleted") {
        setChats((prev) => prev.filter((c) => c.id !== data.chatId));
        setMessages((prev) => prev.filter((m) => m.chatId !== data.chatId));
        setActiveChatId((current) => { if (current === data.chatId) { setFilterTag(null); return "default"; } return current; });
      }
    };

    es.onerror = () => {
      syncChats();
      syncMessages();
    };

    return () => {
      window.clearInterval(msgInterval);
      window.clearInterval(chatInterval);
      es.close();
    };
  }, []);

  // ── Derived data ──

  const allMessages = useMemo(() => mergeById(messages), [messages]);

  const chatMessages = useMemo(() => allMessages.filter((m) => m.chatId === activeChatId), [allMessages, activeChatId]);

  const filteredMessages = useMemo(() => {
    let result = chatMessages;

    if (filterTag) {
      result = result.filter((m) => (m.tags ?? []).includes(filterTag));
    }

    const needle = query.trim().toLowerCase();
    if (needle) {
      if (needle.startsWith("#")) {
        const tagNeedle = needle.slice(1);
        result = result.filter((m) => (m.tags ?? []).some((t) => t.includes(tagNeedle)));
      } else {
        result = result.filter((message) => {
          const fileName = message.fileName || "";
          const tagText = (message.tags ?? []).map((t) => `#${t}`).join(" ");
          return `${message.content} ${fileName} ${tagText}`.toLowerCase().includes(needle);
        });
      }
    }

    return result;
  }, [chatMessages, query, filterTag]);

  const chatTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const m of chatMessages) for (const t of m.tags ?? []) tagSet.add(t);
    return Array.from(tagSet).sort();
  }, [chatMessages]);

  const pinnedMessages = useMemo(() => chatMessages.filter((m) => m.pinned), [chatMessages]);

  const mediaMessages = useMemo(() => chatMessages.filter(isMedia), [chatMessages]);
  const fileMessages = useMemo(() => chatMessages.filter((message) => message.type === "FILE" && !isMedia(message)), [chatMessages]);
  const links = useMemo(
    () =>
      chatMessages.flatMap((message) =>
        message.type === "TEXT" ? extractLinks(message.content).map((url) => ({ id: `${message.id}-${url}`, url, createdAt: message.createdAt })) : []
      ),
    [chatMessages]
  );

  const activeChat = useMemo(() => chats.find((c) => c.id === activeChatId), [chats, activeChatId]);

  // ── Auto-scroll ──

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [filteredMessages.length]);

  // ── Close context menus on outside click ──

  useEffect(() => {
    if (!contextMenu.visible && !chatContextMenu.visible) return;
    function handleClick(e: MouseEvent) {
      if (contextMenu.visible && contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu((prev) => ({ ...prev, visible: false }));
      }
      if (chatContextMenu.visible && chatContextMenuRef.current && !chatContextMenuRef.current.contains(e.target as Node)) {
        setChatContextMenu((prev) => ({ ...prev, visible: false }));
      }
    }
    function handleScroll() {
      setContextMenu((prev) => ({ ...prev, visible: false }));
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("scroll", handleScroll, true);
    };
  }, [contextMenu.visible, chatContextMenu.visible]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 780px)");
    const updateView = () => {
      setIsMobileViewport(media.matches);
      if (media.matches) {
        setMobileView("list");
        return;
      }
      setMobileView("chat");
    };
    updateView();
    media.addEventListener("change", updateView);
    return () => media.removeEventListener("change", updateView);
  }, []);

  // ── Send / upload ──

  async function sendText(e: FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content || sending) return;

    setSending(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, chatId: activeChatId })
      });
      if (!res.ok) throw new Error("Send failed");
      const message = (await res.json()) as Msg;
      setMessages((prev) => mergeById([...prev, message]));
      setText("");
      requestAnimationFrame(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      });
    } catch {
      toast.error("Message was not sent.");
    } finally {
      setSending(false);
      syncMessages();
    }
  }

  async function uploadFiles(files: FileList | File[]) {
    const items = Array.from(files);
    if (!items.length || uploading) return;

    setUploading(true);
    try {
      for (const file of items) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("chatId", activeChatId);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        if (!res.ok) throw new Error("Upload failed");
        const message = (await res.json()) as Msg;
        setMessages((prev) => mergeById([...prev, message]));
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
      requestAnimationFrame(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      });
    } catch {
      toast.error("File upload failed.");
    } finally {
      setUploading(false);
      syncMessages();
    }
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files) uploadFiles(e.target.files);
  }

  function onPaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    if (e.clipboardData.files.length > 0) {
      e.preventDefault();
      uploadFiles(e.clipboardData.files);
    }
  }

  // ── Message actions ──

  async function remove(id: string) {
    const previous = messages;
    setMessages((prev) => prev.filter((message) => message.id !== id));
    try {
      const res = await fetch(`/api/messages/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
    } catch {
      setMessages(previous);
      toast.error("Delete failed.");
    } finally {
      syncMessages();
    }
  }

  async function removeMultiple(ids: string[]) {
    const previous = messages;
    setMessages((prev) => prev.filter((message) => !ids.includes(message.id)));
    try {
      const res = await fetch("/api/messages", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids })
      });
      if (!res.ok) throw new Error("Delete failed");
    } catch {
      setMessages(previous);
      toast.error("Delete failed.");
    } finally {
      syncMessages();
    }
  }

  async function togglePin(id: string) {
    const message = messages.find((m) => m.id === id);
    if (!message) return;
    const newPinned = !message.pinned;
    try {
      const res = await fetch(`/api/messages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: newPinned })
      });
      if (!res.ok) throw new Error("Pin failed");
      const updated = (await res.json()) as Msg;
      setMessages((prev) => mergeById([...prev.filter((m) => m.id !== id), updated]));
    } catch {
      toast.error("Failed to update pin.");
    }
  }

  async function toggleSave(id: string) {
    const message = messages.find((m) => m.id === id);
    if (!message) return;
    const newSaved = !message.saved;
    try {
      const res = await fetch(`/api/messages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saved: newSaved })
      });
      if (!res.ok) throw new Error("Save failed");
      const updated = (await res.json()) as Msg;
      setMessages((prev) => mergeById([...prev.filter((m) => m.id !== id), updated]));
    } catch {
      toast.error("Failed to update save.");
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      toast.error("Copy is blocked by the browser on this address.");
    }
  }

  function onComposerKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
    if (e.key === "Escape" && replyToMessage) {
      setReplyToMessage(null);
    }
  }

  async function editMessage(id: string, newContent: string) {
    const content = newContent.trim();
    if (!content) return;
    try {
      const res = await fetch(`/api/messages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content })
      });
      if (!res.ok) throw new Error("Edit failed");
      const updated = (await res.json()) as Msg;
      setMessages((prev) => mergeById([...prev.filter((m) => m.id !== id), updated]));
      toast.success("Message edited.");
    } catch {
      toast.error("Failed to edit message.");
    }
    setEditingMessageId(null);
    setEditText("");
  }

  function startEdit(msg: Msg) {
    if (msg.type !== "TEXT") return;
    setEditingMessageId(msg.id);
    setEditText(msg.content);
    setContextMenu((prev) => ({ ...prev, visible: false }));
  }

  async function fetchAllTags() {
    try {
      const res = await fetch("/api/tags");
      if (res.ok) setAllTags(await res.json());
    } catch { /* ignore */ }
  }

  async function saveMessageTags(id: string, tags: string[]) {
    try {
      const res = await fetch(`/api/messages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags })
      });
      if (!res.ok) throw new Error("Tag update failed");
      const updated = (await res.json()) as Msg;
      setMessages((prev) => mergeById([...prev.filter((m) => m.id !== id), updated]));
      toast.success("Tags updated.");
      fetchAllTags();
    } catch {
      toast.error("Failed to update tags.");
    }
  }

  function openTagEditor(messageId: string) {
    setTagEditMessageId(messageId);
    setContextMenu((prev) => ({ ...prev, visible: false }));
    fetchAllTags();
  }

  function highlightText(text: string, needle: string): ReactNode {
    if (!needle) return text;
    const regex = new RegExp(`(${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="tg-search-highlight">{part}</mark>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  }

  const commandPaletteItems = useMemo(() => [
    { id: "new-chat", label: "New Chat", icon: "+", group: "Actions", action: () => setShowNewChatModal(true) },
    { id: "settings", label: "Settings", icon: "\u2699", shortcut: "Ctrl+,", group: "Actions", action: () => setShowSettings(true) },
    { id: "search", label: "Search Messages", icon: "\uD83D\uDD0D", shortcut: "/", group: "Actions", action: () => searchInputRef.current?.focus() },
    { id: "select-mode", label: "Select Messages", icon: "\u2611", group: "Actions", action: () => setSelectMode(true) },
    { id: "lock", label: appLock.hasPin ? "Lock App" : "Set PIN Lock", icon: "\uD83D\uDD12", group: "Settings", action: () => { if (appLock.hasPin) appLock.lock(); else setShowSetPinModal(true); } },
    ...chats.map((c) => ({ id: `chat-${c.id}`, label: c.name, icon: c.avatar || "\uD83D\uDCBE", group: "Chats", action: () => { setActiveChatId(c.id); setFilterTag(null); setDesktopHomeView(false); setMobileView("chat"); } }))
  ], [chats, activeChatId, appLock.hasPin]);

  useKeyboardShortcuts(useMemo(() => [
    { key: "k", ctrl: true, handler: () => setShowCommandPalette(true) },
    { key: "/", handler: () => searchInputRef.current?.focus() },
    { key: ",", ctrl: true, handler: () => setShowSettings(true) },
    { key: "Escape", handler: () => { if (showCommandPalette) setShowCommandPalette(false); } }
  ], [showCommandPalette]));

  // ── Chat actions ──

  async function createNewChat() {
    const name = newChatName.trim();
    if (!name) return;
    try {
      const res = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, avatar: newChatAvatar, avatarType: newChatAvatarType })
      });
      if (!res.ok) throw new Error("Create failed");
      const chat = (await res.json()) as Chat;
      setChats((prev) => [...prev, chat]);
      setActiveChatId(chat.id);
      setFilterTag(null);
      setDesktopHomeView(false);
      setMobileView("chat");
      setShowNewChatModal(false);
      setNewChatName("");
      setNewChatAvatar("💾");
      setNewChatAvatarType("emoji");
    } catch {
      toast.error("Failed to create chat.");
    }
  }

  async function saveEditChat() {
    if (!editingChatId) return;
    const name = editChatName.trim();
    if (!name) return;
    try {
      const res = await fetch(`/api/chats/${editingChatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, avatar: editChatAvatar, avatarType: editChatAvatarType })
      });
      if (!res.ok) throw new Error("Update failed");
      const chat = (await res.json()) as Chat;
      setChats((prev) => prev.map((c) => c.id === chat.id ? chat : c));
      setEditingChatId(null);
    } catch {
      toast.error("Failed to update chat.");
    }
  }

  async function deleteChat(chatId: string) {
    if (chatId === "default") return;
    try {
      const res = await fetch(`/api/chats/${chatId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setChats((prev) => prev.filter((c) => c.id !== chatId));
      setMessages((prev) => prev.filter((m) => m.chatId !== chatId));
      if (activeChatId === chatId) { setActiveChatId("default"); setFilterTag(null); }
    } catch {
      toast.error("Failed to delete chat.");
    }
  }

  async function uploadChatAvatar(file: File, target: "new" | "edit") {
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      const msg = (await res.json()) as Msg;
      if (target === "new") {
        setNewChatAvatar(msg.content);
        setNewChatAvatarType("image");
      } else {
        setEditChatAvatar(msg.content);
        setEditChatAvatarType("image");
      }
    } catch {
      toast.error("Failed to upload avatar.");
    }
  }

  // ── Context menu handlers ──

  const handleContextMenu = useCallback((e: React.MouseEvent, messageId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const historyEl = historyRef.current;
    if (!historyEl) return;
    const historyRect = historyEl.getBoundingClientRect();
    const x = e.clientX - historyRect.left;
    const y = e.clientY - historyRect.top;
    const menuWidth = 200;
    const menuHeight = 200;
    const clampedX = Math.min(x, historyRect.width - menuWidth);
    const clampedY = Math.min(y, historyRect.height - menuHeight);
    setContextMenu({
      visible: true,
      x: Math.max(0, clampedX),
      y: Math.max(0, clampedY),
      messageId
    });
  }, []);

  const handleChatContextMenu = useCallback((e: React.MouseEvent, chatId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    setChatContextMenu({
      visible: true,
      x: rect.right,
      y: rect.bottom,
      chatId
    });
  }, []);

  const openChatContextMenuAt = useCallback((chatId: string, x: number, y: number) => {
    setChatContextMenu({
      visible: true,
      x,
      y,
      chatId
    });
  }, []);

  const handleTouchStart = useCallback((messageId: string) => {
    longPressTimerRef.current = setTimeout(() => {
      if (!selectMode) {
        setSelectMode(true);
        setSelectedIds(new Set([messageId]));
      }
    }, 500);
  }, [selectMode]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleTouchMove = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // ── Selection ──

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) setSelectMode(false);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(filteredMessages.map((m) => m.id)));
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  function handleBubbleClick(messageId: string) {
    if (selectMode) toggleSelect(messageId);
  }

  function enterSelectMode(messageId: string) {
    setSelectMode(true);
    setSelectedIds(new Set([messageId]));
    setContextMenu((prev) => ({ ...prev, visible: false }));
  }

  const contextMessage = contextMenu.messageId
    ? messages.find((m) => m.id === contextMenu.messageId)
    : null;

  const contextChat = chatContextMenu.chatId
    ? chats.find((c) => c.id === chatContextMenu.chatId)
    : null;

  // ── Chat list helper ──

  function getChatLastMessage(chatId: string) {
    const msgs = allMessages.filter((m) => m.chatId === chatId);
    return msgs[msgs.length - 1];
  }

  function getChatMessageCount(chatId: string) {
    return allMessages.filter((m) => m.chatId === chatId).length;
  }

  if (appLock.isLocked) {
    return <LockScreen onUnlock={appLock.unlock} />;
  }

  return (
    <ErrorBoundary>
    <main
      className={`tg-shell ${dragging ? "tg-shell-dragging" : ""} ${!isMobileViewport && desktopHomeView ? "tg-shell-desktop-home" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        uploadFiles(e.dataTransfer.files);
      }}
      role="application"
      aria-label="Local Saved Messages"
    >
      {/* Skip to main content */}
      <a href="#main-chat" className="tg-skip-link">Skip to main content</a>

      {/* Drag & drop overlay */}
      {dragging && (
        <div className="tg-drop-overlay" aria-hidden="true">
          <div className="tg-drop-overlay-content">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <strong>Drop files here</strong>
            <span>Files will be uploaded to the current chat</span>
          </div>
        </div>
      )}
      {/* ── Left sidebar: Chat list ── */}
      <aside
        className={[
          "tg-left-rail",
          isMounted ? (isMobileViewport ? (mobileView === "list" ? "tg-mobile-show" : "tg-mobile-hide") : "") : ""
        ].filter(Boolean).join(" ")}
        role="navigation"
        aria-label="Chat list"
      >
        <div className="tg-left-toolbar">
          <button className="tg-ghost-button" aria-label="Open settings" onClick={() => setShowSettings(true)}>
            <Icon name="menu" />
          </button>
          <label className="tg-search" id="search-bar">
            <Icon name="search" />
            <input
              ref={searchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search (press /)"
              aria-label="Search messages"
            />
            {query && (
              <button
                className="tg-search-clear"
                onClick={() => setQuery("")}
                aria-label="Clear search"
              >
                <Icon name="close" />
              </button>
            )}
          </label>
        </div>

        <div className="tg-chat-list" role="listbox" aria-label="Chats">
          {initialLoading ? <ChatListSkeleton /> : chats.map((chat) => {
            const lastMsg = getChatLastMessage(chat.id);
            const count = getChatMessageCount(chat.id);
            const isActive = chat.id === activeChatId;

            return (
              <button
                key={chat.id}
                className={`tg-chat-card tg-chat-card-anim ${isActive ? "tg-chat-card-active" : ""}`}
                role="option"
                aria-selected={isActive}
                onClick={() => {
                  setActiveChatId(chat.id);
                  setFilterTag(null);
                  setDesktopHomeView(false);
                  setMobileView("chat");
                  setQuery("");
                  exitSelectMode();
                }}
                onContextMenu={(e) => handleChatContextMenu(e, chat.id)}
              >
                <ChatAvatar chat={chat} size="large" />
                <span className="tg-chat-card-copy">
                  <span className="tg-chat-card-title">{chat.name}</span>
                  <span className="tg-chat-card-subtitle">
                    {lastMsg ? (lastMsg.type === "TEXT" ? lastMsg.content.slice(0, 38) : lastMsg.fileName) : "No messages yet"}
                  </span>
                </span>
                <span className="tg-chat-card-meta">
                  <small>{lastMsg ? formatTime(lastMsg.createdAt) : ""}</small>
                  <em>{count}</em>
                </span>
                <button
                  type="button"
                  className="tg-chat-actions-button"
                  aria-label={`Actions for ${chat.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    openChatContextMenuAt(chat.id, Math.max(8, rect.left - 140), rect.bottom + 6);
                  }}
                >
                  <Icon name="dots" />
                </button>
              </button>
            );
          })}

          <button
            className="tg-chat-card tg-chat-card-new"
            onClick={() => setShowNewChatModal(true)}
            aria-label="Create new chat"
          >
            <span className="tg-avatar tg-avatar-large tg-avatar-new">
              <Icon name="plus" />
            </span>
            <span className="tg-chat-card-copy">
              <span className="tg-chat-card-title">New Chat</span>
              <span className="tg-chat-card-subtitle">Create a new saved messages folder</span>
            </span>
          </button>

          {/* Chat context menu */}
          {chatContextMenu.visible && contextChat && (
            <div
              ref={chatContextMenuRef}
              className="tg-context-menu tg-chat-context-menu"
              style={{ left: chatContextMenu.x, top: chatContextMenu.y }}
            >
              <button
                className="tg-context-item"
                onClick={() => {
                  setEditingChatId(contextChat.id);
                  setEditChatName(contextChat.name);
                  setEditChatAvatar(contextChat.avatar || "💾");
                  setEditChatAvatarType(contextChat.avatarType || "emoji");
                  setChatContextMenu((prev) => ({ ...prev, visible: false }));
                }}
              >
                <Icon name="edit" />
                <span>Edit</span>
              </button>
              {contextChat.id !== "default" && (
                <button
                  className="tg-context-item tg-context-danger"
                  onClick={() => {
                    deleteChat(contextChat.id);
                    setChatContextMenu((prev) => ({ ...prev, visible: false }));
                  }}
                >
                  <Icon name="delete" />
                  <span>Delete</span>
                </button>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* ── Center: Chat area ── */}
      <section
        id="main-chat"
        className={[
          "tg-center",
          !isMobileViewport && desktopHomeView
            ? "tg-desktop-hide"
            : (isMounted ? (isMobileViewport ? (mobileView === "chat" ? "tg-mobile-show" : "tg-mobile-hide") : "") : "")
        ].filter(Boolean).join(" ")}
        role="main"
        aria-label="Chat messages"
      >
        {selectMode ? (
          <header className="tg-center-header tg-select-header">
            <button className="tg-ghost-button" onClick={exitSelectMode} title="Cancel">
              <Icon name="close" />
            </button>
            <div className="tg-title-block">
              <strong>{selectedIds.size} selected</strong>
            </div>
            <div className="tg-header-actions">
              <button className="tg-ghost-button" onClick={selectAll} title="Select all">
                <Icon name="select" />
              </button>
              <button
                className="tg-ghost-button"
                onClick={() => {
                  if (selectedIds.size > 0) removeMultiple([...selectedIds]);
                  exitSelectMode();
                }}
                title="Delete selected"
                disabled={selectedIds.size === 0}
              >
                <Icon name="delete" />
              </button>
              <button
                className="tg-ghost-button"
                onClick={() => {
                  if (selectedIds.size === 1) togglePin([...selectedIds][0]);
                }}
                title="Pin selected"
                disabled={selectedIds.size !== 1}
              >
                <Icon name="pin" />
              </button>
              <button
                className="tg-ghost-button"
                onClick={() => {
                  if (selectedIds.size === 1) toggleSave([...selectedIds][0]);
                }}
                title="Save selected"
                disabled={selectedIds.size !== 1}
              >
                <Icon name="save" />
              </button>
            </div>
          </header>
        ) : (
          <header className="tg-center-header">
            <button className="tg-ghost-button tg-mobile-back" onClick={() => setMobileView("list")} title="Back to chats">
              <Icon name="back" />
            </button>
            {!isMobileViewport && (
              <button className="tg-ghost-button tg-desktop-back" onClick={() => setDesktopHomeView(true)} title="Back to folders">
                <Icon name="back" />
              </button>
            )}
            <div className="tg-title-block">
              <strong>{activeChat?.name || "Saved Messages"}</strong>
              <small>{chatMessages.length} items</small>
            </div>
            <div className="tg-header-actions">
              <button className="tg-ghost-button" title="Search">
                <Icon name="search" />
              </button>
              <button
                className="tg-ghost-button"
                title="Select messages"
                onClick={() => setSelectMode(true)}
              >
                <Icon name="select" />
              </button>
              <button className="tg-ghost-button" title="Settings" onClick={() => setShowSettings(true)}>
                <Icon name="dots" />
              </button>
            </div>
          </header>
        )}

        {/* Pinned message bar */}
        {pinnedMessages.length > 0 && !selectMode && (
          <div className="tg-pinned-bar" onClick={() => {
            const pinnedEl = document.querySelector(`[data-message-id="${pinnedMessages[pinnedMessages.length - 1].id}"]`);
            pinnedEl?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}>
            <span className="tg-pinned-icon">
              <Icon name="pin" />
            </span>
            <div className="tg-pinned-info">
              <strong>Pinned Message</strong>
              <span>{pinnedMessages[pinnedMessages.length - 1].type === "TEXT"
                ? pinnedMessages[pinnedMessages.length - 1].content.slice(0, 50)
                : pinnedMessages[pinnedMessages.length - 1].fileName || "File"}</span>
            </div>
            <small className="tg-pinned-count">{pinnedMessages.length}</small>
          </div>
        )}

        {chatTags.length > 0 && (
          <div className="tg-tag-filter-bar" role="toolbar" aria-label="Filter by tag">
            <span className="tg-tag-filter-label">
              <Icon name="tag" />
              Tags:
            </span>
            {chatTags.map((tag) => (
              <button
                key={tag}
                className={`tg-tag-filter-chip ${filterTag === tag ? "active" : ""}`}
                onClick={() => setFilterTag(filterTag === tag ? null : tag)}
                aria-pressed={filterTag === tag}
              >
                #{tag}
              </button>
            ))}
            {filterTag && (
              <button className="tg-tag-filter-clear" onClick={() => setFilterTag(null)}>
                Clear
              </button>
            )}
          </div>
        )}

        <div className="tg-history" ref={historyRef}>

          {initialLoading ? <MessageListSkeleton /> : filteredMessages.length === 0 && (
            <div className="tg-empty tg-empty-enhanced" role="status">
              <div className="tg-empty-icon tg-empty-icon-animated">
                <Icon name="saved" />
              </div>
              <strong>{activeChat?.name || "Saved Messages"}</strong>
              <span>Text, links, images, music, videos and files stay synced on every device.</span>
              {query ? (
                <button className="tg-btn-secondary" onClick={() => setQuery("")}>Clear search</button>
              ) : (
                <div className="tg-empty-tips">
                  <p>Tip: Press <kbd>/</kbd> to search, <kbd>Ctrl+K</kbd> for commands</p>
                </div>
              )}
            </div>
          )}

          {filteredMessages.map((message, index) => {
            const previous = filteredMessages[index - 1];
            const showDate = !previous || formatDay(previous.createdAt) !== formatDay(message.createdAt);
            const isSelected = selectedIds.has(message.id);
            const searchNeedle = query.trim().toLowerCase();

            return (
              <div key={message.id} data-message-id={message.id} className="tg-message-anim" style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}>
                {showDate && <div className="tg-date-pill">{formatDay(message.createdAt)}</div>}
                <article className={`tg-message-row ${isSelected ? "tg-message-selected" : ""}`} role="article" aria-label={`Message from ${formatTime(message.createdAt)}`}>
                  {selectMode && (
                    <button
                      className={`tg-check-circle ${isSelected ? "tg-check-checked" : ""}`}
                      onClick={() => toggleSelect(message.id)}
                    >
                      {isSelected && <Icon name="check" />}
                    </button>
                  )}
                  <div
                    className={`tg-bubble ${message.type === "FILE" ? "tg-bubble-file" : ""} ${message.pinned ? "tg-bubble-pinned" : ""} ${message.saved ? "tg-bubble-saved" : ""}`}
                    onClick={() => handleBubbleClick(message.id)}
                    onContextMenu={(e) => handleContextMenu(e, message.id)}
                    onTouchStart={() => handleTouchStart(message.id)}
                    onTouchEnd={handleTouchEnd}
                    onTouchMove={handleTouchMove}
                  >
                    {message.pinned && (
                      <div className="tg-pin-indicator">
                        <Icon name="pin" />
                        <span>Pinned</span>
                      </div>
                    )}
                    {message.saved && (
                      <div className="tg-saved-indicator">
                        <Icon name="save" />
                        <span>Saved</span>
                      </div>
                    )}

                    {editingMessageId === message.id ? (
                      <div className="tg-edit-inline">
                        <textarea
                          className="tg-edit-textarea"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              editMessage(message.id, editText);
                            }
                            if (e.key === "Escape") {
                              setEditingMessageId(null);
                              setEditText("");
                            }
                          }}
                          autoFocus
                          rows={2}
                          aria-label="Edit message"
                        />
                        <div className="tg-edit-actions">
                          <button className="tg-btn-secondary" onClick={() => { setEditingMessageId(null); setEditText(""); }}>Cancel</button>
                          <button className="tg-btn-primary" onClick={() => editMessage(message.id, editText)}>Save</button>
                        </div>
                      </div>
                    ) : message.type === "TEXT" ? (
                      <p className="tg-message-text">{searchNeedle ? highlightText(message.content, searchNeedle) : linkify(message.content)}</p>
                    ) : (
                      <div className="tg-file-message">
                        <div className="tg-file-heading">
                          <a className="tg-file-name" href={message.content} download={message.fileName || undefined}>
                            {message.fileName || "Download file"}
                          </a>
                          <span className="tg-file-size">{formatBytes(message.fileSize)}</span>
                        </div>
                        <FilePreview message={message} />
                      </div>
                    )}

                    {(message.tags ?? []).length > 0 && (
                      <TagList
                        tags={message.tags}
                        onTagClick={(tag) => setFilterTag(filterTag === tag ? null : tag)}
                        size="sm"
                      />
                    )}

                    <div className="tg-bubble-footer">
                      <span>{formatTime(message.createdAt)}</span>
                    </div>
                  </div>
                </article>
              </div>
            );
          })}
          <div ref={endRef} />

          {/* Message context menu */}
          {contextMenu.visible && contextMessage && (
            <div
              ref={contextMenuRef}
              className="tg-context-menu"
              style={{ left: contextMenu.x, top: contextMenu.y }}
            >
              <button
                className="tg-context-item"
                onClick={() => {
                  if (contextMenu.messageId) togglePin(contextMenu.messageId);
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
              >
                <Icon name={contextMessage.pinned ? "unpin" : "pin"} />
                <span>{contextMessage.pinned ? "Unpin" : "Pin"}</span>
              </button>
              <button
                className="tg-context-item"
                onClick={() => {
                  if (contextMenu.messageId) toggleSave(contextMenu.messageId);
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
              >
                <Icon name={contextMessage.saved ? "unsave" : "save"} />
                <span>{contextMessage.saved ? "Unsave" : "Save"}</span>
              </button>
              <button
                className="tg-context-item"
                onClick={() => {
                  if (contextMenu.messageId) {
                    copy(
                      contextMessage.type === "TEXT"
                        ? contextMessage.content
                        : `${location.origin}${contextMessage.content}`
                    );
                  }
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
              >
                <Icon name="copy" />
                <span>Copy</span>
              </button>
              {contextMessage.type === "FILE" && (
                <a
                  className="tg-context-item"
                  href={contextMessage.content}
                  download={contextMessage.fileName || undefined}
                  onClick={() => setContextMenu((prev) => ({ ...prev, visible: false }))}
                >
                  <Icon name="download" />
                  <span>Download</span>
                </a>
              )}
              {contextMessage?.type === "TEXT" && (
                <button
                  className="tg-context-item"
                  onClick={() => {
                    if (contextMessage) startEdit(contextMessage);
                  }}
                >
                  <Icon name="edit" />
                  <span>Edit</span>
                  <kbd className="tg-context-kbd">E</kbd>
                </button>
              )}
              <button
                className="tg-context-item"
                onClick={() => {
                  if (contextMenu.messageId) {
                    const msg = messages.find((m) => m.id === contextMenu.messageId);
                    if (msg) {
                      setReplyToMessage(msg);
                    }
                  }
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
              >
                <Icon name="reply" />
                <span>Reply</span>
              </button>
              <button
                className="tg-context-item"
                onClick={() => {
                  if (contextMenu.messageId) openTagEditor(contextMenu.messageId);
                }}
              >
                <Icon name="tag" />
                <span>Tags</span>
                <kbd className="tg-context-kbd">T</kbd>
              </button>
              <button
                className="tg-context-item"
                onClick={() => {
                  if (contextMenu.messageId) enterSelectMode(contextMenu.messageId);
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
              >
                <Icon name="select" />
                <span>Select</span>
              </button>
              <button
                className="tg-context-item tg-context-danger"
                onClick={() => {
                  if (contextMenu.messageId) remove(contextMenu.messageId);
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
              >
                <Icon name="delete" />
                <span>Delete</span>
              </button>
            </div>
          )}
        </div>

        {/* Reply indicator */}
        {replyToMessage && (
          <div className="tg-reply-bar">
            <div className="tg-reply-bar-content">
              <Icon name="reply" />
              <span>{replyToMessage.type === "TEXT" ? replyToMessage.content.slice(0, 60) : (replyToMessage.fileName || "File")}</span>
            </div>
            <button className="tg-ghost-button" onClick={() => setReplyToMessage(null)} aria-label="Cancel reply">
              <Icon name="close" />
            </button>
          </div>
        )}

        {/* Upload progress */}
        {uploadProgress !== null && (
          <div className="tg-upload-progress" role="progressbar" aria-valuenow={uploadProgress} aria-valuemin={0} aria-valuemax={100}>
            <div className="tg-upload-progress-bar" style={{ width: `${uploadProgress}%` }} />
          </div>
        )}

        <form className="tg-composer" onSubmit={sendText} role="form" aria-label="Message composer">
          <button type="button" className="tg-ghost-button tg-compose-icon" title="Attach file" onClick={() => fileInputRef.current?.click()} disabled={uploading} aria-label="Attach file">
            {uploading ? <LoadingSpinner size={20} /> : <Icon name="attach" />}
          </button>
          <input ref={fileInputRef} type="file" multiple hidden onChange={onFileChange} aria-label="File input" />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onComposerKeyDown}
            onPaste={onPaste}
            placeholder={uploading ? "Uploading..." : "Write a message..."}
            rows={1}
            aria-label="Message input"
          />
          <button className="tg-send-button" disabled={sending || !text.trim()} title="Send" aria-label="Send message">
            {sending ? <LoadingSpinner size={20} /> : <Icon name="send" />}
          </button>
        </form>
      </section>

      {/* ── Right panel ── */}
      <aside className={`tg-right-panel ${!isMobileViewport && desktopHomeView ? "tg-desktop-hide" : ""}`}>
        <div className="tg-right-profile">
          {activeChat ? <ChatAvatar chat={activeChat} size="hero" /> : (
            <div className="tg-avatar tg-avatar-hero">
              <Icon name="saved" />
            </div>
          )}
          <strong>{activeChat?.name || "Saved Messages"}</strong>
          <small>Local network storage</small>
        </div>

        <div className="tg-right-stats">
          <div>
            <strong>{mediaMessages.length}</strong>
            <span>Media</span>
          </div>
          <div>
            <strong>{links.length}</strong>
            <span>Links</span>
          </div>
          <div>
            <strong>{fileMessages.length}</strong>
            <span>Files</span>
          </div>
        </div>

        <div className="tg-tabbar">
          <button className={tab === "media" ? "is-active" : ""} onClick={() => setTab("media")}>
            Media
          </button>
          <button className={tab === "links" ? "is-active" : ""} onClick={() => setTab("links")}>
            Links
          </button>
          <button className={tab === "files" ? "is-active" : ""} onClick={() => setTab("files")}>
            Files
          </button>
        </div>

        <div className="tg-panel-scroll">
          {tab === "media" && (
            <div className="tg-media-grid">
              {mediaMessages.map((message) => (
                <a key={message.id} href={message.content} className="tg-media-thumb" download={message.fileName || undefined}>
                  {message.mimeType?.startsWith("video/") ? (
                    <video src={message.content} muted />
                  ) : (
                    <img src={message.content} alt={message.fileName || "media"} loading="lazy" />
                  )}
                </a>
              ))}
            </div>
          )}

          {tab === "links" && (
            <div className="tg-side-list">
              {links.map((item) => (
                <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="tg-side-row">
                  <span className="tg-side-icon">
                    <Icon name="link" />
                  </span>
                  <span className="tg-side-copy">
                    <strong>{item.url}</strong>
                    <small>{formatDay(item.createdAt)}</small>
                  </span>
                </a>
              ))}
            </div>
          )}

          {tab === "files" && (
            <div className="tg-side-list">
              {fileMessages.map((message) => (
                <a key={message.id} href={message.content} download={message.fileName || undefined} className="tg-side-row">
                  <span className="tg-side-icon">
                    <Icon name="file" />
                  </span>
                  <span className="tg-side-copy">
                    <strong>{message.fileName || "File"}</strong>
                    <small>{formatBytes(message.fileSize)}</small>
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* ── New Chat Modal ── */}
      {showNewChatModal && (
        <div className="tg-modal-overlay" onClick={() => setShowNewChatModal(false)}>
          <div className="tg-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tg-modal-header">
              <strong>Create New Chat</strong>
              <button className="tg-ghost-button" onClick={() => setShowNewChatModal(false)}>
                <Icon name="close" />
              </button>
            </div>
            <div className="tg-modal-body">
              <div className="tg-avatar-picker">
                <span className="tg-avatar tg-avatar-hero tg-avatar-picker-preview">
                  {newChatAvatarType === "image" && newChatAvatar ? (
                    <img src={newChatAvatar} alt="Avatar" />
                  ) : (
                    <span className="tg-avatar-emoji-lg">{newChatAvatar}</span>
                  )}
                </span>
                <button
                  className="tg-ghost-button tg-avatar-camera-btn"
                  onClick={() => chatAvatarInputRef.current?.click()}
                  title="Upload image"
                >
                  <Icon name="camera" />
                </button>
                <input
                  ref={chatAvatarInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    if (e.target.files?.[0]) uploadChatAvatar(e.target.files[0], "new");
                  }}
                />
              </div>
              <div className="tg-emoji-grid">
                {EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    className={`tg-emoji-btn ${newChatAvatar === emoji && newChatAvatarType === "emoji" ? "tg-emoji-active" : ""}`}
                    onClick={() => {
                      setNewChatAvatar(emoji);
                      setNewChatAvatarType("emoji");
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <input
                className="tg-modal-input"
                value={newChatName}
                onChange={(e) => setNewChatName(e.target.value)}
                placeholder="Chat name"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") createNewChat();
                }}
              />
            </div>
            <div className="tg-modal-footer">
              <button className="tg-btn-secondary" onClick={() => setShowNewChatModal(false)}>Cancel</button>
              <button className="tg-btn-primary" onClick={createNewChat} disabled={!newChatName.trim()}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Settings Modal ── */}
      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        onOpenSetPin={() => { setShowSettings(false); setShowSetPinModal(true); }}
        hasPin={appLock.hasPin}
        onLock={() => { setShowSettings(false); appLock.lock(); }}
      />

      {/* ── Command Palette ── */}
      <CommandPalette
        open={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        items={commandPaletteItems}
      />

      {/* ── Set PIN Modal ── */}
      <SetPinModal
        open={showSetPinModal}
        onClose={() => setShowSetPinModal(false)}
        onSetPin={appLock.setPin}
        hasExistingPin={appLock.hasPin}
        onRemovePin={appLock.removePin}
      />

      {/* ── Mobile Bottom Nav ── */}
      {isMobileViewport && mobileView === "list" && (
        <nav className="tg-mobile-bottom-nav" role="navigation" aria-label="Mobile navigation">
          <button
            className={`tg-bottom-nav-btn ${mobileNavTab === "chats" ? "tg-bottom-nav-active" : ""}`}
            onClick={() => setMobileNavTab("chats")}
            aria-label="Chats"
          >
            <Icon name="menu" />
            <span>Chats</span>
          </button>
          <button
            className={`tg-bottom-nav-btn ${mobileNavTab === "search" ? "tg-bottom-nav-active" : ""}`}
            onClick={() => { setMobileNavTab("search"); searchInputRef.current?.focus(); }}
            aria-label="Search"
          >
            <Icon name="search" />
            <span>Search</span>
          </button>
          <button
            className={`tg-bottom-nav-btn ${mobileNavTab === "saved" ? "tg-bottom-nav-active" : ""}`}
            onClick={() => setMobileNavTab("saved")}
            aria-label="Saved"
          >
            <Icon name="save" />
            <span>Saved</span>
          </button>
          <button
            className={`tg-bottom-nav-btn ${mobileNavTab === "settings" ? "tg-bottom-nav-active" : ""}`}
            onClick={() => { setMobileNavTab("settings"); setShowSettings(true); }}
            aria-label="Settings"
          >
            <Icon name="dots" />
            <span>Settings</span>
          </button>
        </nav>
      )}

      {/* ── Edit Chat Modal ── */}
      {editingChatId && (
        <div className="tg-modal-overlay" onClick={() => setEditingChatId(null)}>
          <div className="tg-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tg-modal-header">
              <strong>Edit Chat</strong>
              <button className="tg-ghost-button" onClick={() => setEditingChatId(null)}>
                <Icon name="close" />
              </button>
            </div>
            <div className="tg-modal-body">
              <div className="tg-avatar-picker">
                <span className="tg-avatar tg-avatar-hero tg-avatar-picker-preview">
                  {editChatAvatarType === "image" && editChatAvatar ? (
                    <img src={editChatAvatar} alt="Avatar" />
                  ) : (
                    <span className="tg-avatar-emoji-lg">{editChatAvatar}</span>
                  )}
                </span>
                <button
                  className="tg-ghost-button tg-avatar-camera-btn"
                  onClick={() => chatAvatarInputRef.current?.click()}
                  title="Upload image"
                >
                  <Icon name="camera" />
                </button>
                <input
                  ref={chatAvatarInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    if (e.target.files?.[0]) uploadChatAvatar(e.target.files[0], "edit");
                  }}
                />
              </div>
              <div className="tg-emoji-grid">
                {EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    className={`tg-emoji-btn ${editChatAvatar === emoji && editChatAvatarType === "emoji" ? "tg-emoji-active" : ""}`}
                    onClick={() => {
                      setEditChatAvatar(emoji);
                      setEditChatAvatarType("emoji");
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <input
                className="tg-modal-input"
                value={editChatName}
                onChange={(e) => setEditChatName(e.target.value)}
                placeholder="Chat name"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEditChat();
                }}
              />
            </div>
            <div className="tg-modal-footer">
              <button className="tg-btn-secondary" onClick={() => setEditingChatId(null)}>Cancel</button>
              <button className="tg-btn-primary" onClick={saveEditChat} disabled={!editChatName.trim()}>Save</button>
            </div>
          </div>
        </div>
      )}
      {/* ── Tag Editor Modal ── */}
      <TagEditor
        isOpen={tagEditMessageId !== null}
        onClose={() => setTagEditMessageId(null)}
        tags={(tagEditMessageId ? messages.find((m) => m.id === tagEditMessageId)?.tags : []) ?? []}
        allTags={allTags}
        onSave={(tags) => {
          if (tagEditMessageId) saveMessageTags(tagEditMessageId, tags);
        }}
      />
    </main>
    </ErrorBoundary>
  );
}
