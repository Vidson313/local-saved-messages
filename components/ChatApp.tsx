"use client";

import {
  ChangeEvent,
  ClipboardEvent,
  DragEvent,
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
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { MessageFormatter } from "@/components/ui/MessageFormatter";
import { TelegramAudioPlayer } from "@/components/ui/AudioPlayer";
import { FileUploadModal } from "@/components/ui/FileUploadModal";
import { MediaLightbox, type MediaItem } from "@/components/ui/MediaLightbox";
import {
  ArrowLeft,
  Bookmark,
  Camera,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  Forward,
  Keyboard as KeyboardIcon,
  Link2,
  Lock,
  Menu,
  MoreVertical,
  Paperclip,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Reply,
  Save,
  SaveOff,
  Search,
  Send,
  Tag,
  Trash2,
  X,
  type LucideIcon
} from "lucide-react";

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
  caption?: string | null;
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

function getLucideIcon(name: IconName): LucideIcon {
  switch (name) {
    case "attach":
      return Paperclip;
    case "copy":
      return Copy;
    case "delete":
      return Trash2;
    case "download":
      return Download;
    case "file":
      return FileText;
    case "saved":
      return Bookmark;
    case "search":
      return Search;
    case "send":
      return Send;
    case "menu":
      return Menu;
    case "dots":
      return MoreVertical;
    case "link":
      return Link2;
    case "pin":
      return Pin;
    case "unpin":
      return PinOff;
    case "save":
      return Save;
    case "unsave":
      return SaveOff;
    case "select":
      return CheckCircle2;
    case "close":
      return X;
    case "check":
      return Check;
    case "plus":
      return Plus;
    case "edit":
      return Pencil;
    case "camera":
      return Camera;
    case "back":
      return ArrowLeft;
    case "keyboard":
      return KeyboardIcon;
    case "lock":
      return Lock;
    case "forward":
      return Forward;
    case "reply":
      return Reply;
    case "tag":
      return Tag;
  }
}

function Icon({ name }: { name: IconName }) {
  const LucideComponent = getLucideIcon(name);
  return (
    <LucideComponent
      aria-hidden="true"
      className="tg-icon"
      size={20}
      strokeWidth={1.8}
    />
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

function getDownloadUrl(content: string, download = true) {
  if (content.startsWith("/uploads/")) {
    const filename = content.replace("/uploads/", "");
    return `/api/files/${filename}${download ? "?download=1" : ""}`;
  }
  return content;
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

/**
 * Deduplicates chats by ID, keeping the last occurrence and normalizing missing avatars.
 * @param chats - Chat snapshots from fetch responses or realtime events.
 * @returns Chats with the default chat first, then sorted by ascending creation time.
 */
function mergeChatsById(chats: Chat[]): Chat[] {
  const map = new Map<string, Chat>();
  for (const chat of chats) {
    map.set(chat.id, {
      ...chat,
      avatar: chat.avatar ?? null,
      avatarType: chat.avatarType ?? null
    });
  }
  return [...map.values()].sort((a, b) => {
    if (a.id === "default") return -1;
    if (b.id === "default") return 1;
    return +new Date(a.createdAt) - +new Date(b.createdAt);
  });
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
  return Boolean(
    message.mimeType?.startsWith("image/") ||
    message.mimeType?.startsWith("video/") ||
    message.mimeType?.startsWith("audio/")
  );
}

function FilePreview({
  message,
  onOpenLightbox
}: {
  message: Msg;
  onOpenLightbox?: (id: string) => void;
}) {
  const mime = message.mimeType || "";

  if (mime.startsWith("image/")) {
    return (
      <img
        src={message.content}
        alt={message.fileName || "image"}
        className="tg-media tg-media-image tg-media-clickable"
        loading="lazy"
        onClick={() => onOpenLightbox?.(message.id)}
      />
    );
  }

  if (mime.startsWith("video/")) {
    return (
      <div className="tg-video-preview-wrapper" onClick={() => onOpenLightbox?.(message.id)}>
        <video src={message.content} controls className="tg-media tg-media-video tg-media-clickable" />
      </div>
    );
  }

  if (mime.startsWith("audio/")) {
    return (
      <TelegramAudioPlayer
        src={message.content}
        fileName={message.fileName}
        fileSize={message.fileSize}
        downloadUrl={getDownloadUrl(message.content, true)}
      />
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

/** Renders the chat workspace and coordinates local interactions with realtime updates. */
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
  const [visibleCount, setVisibleCount] = useState(80);

  const [uploadModalFiles, setUploadModalFiles] = useState<File[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [lightboxActiveId, setLightboxActiveId] = useState<string | null>(null);

  useEffect(() => {
    setVisibleCount(80);
  }, [activeChatId]);

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

  /** Refreshes chats with deduplication and stable ordering, showing a toast on failure. */
  async function syncChats() {
    try {
      const res = await fetch("/api/chats", { cache: "no-store" });
      if (!res.ok) throw new Error("Could not load chats");
      const data = (await res.json()) as Chat[];
      setChats(mergeChatsById(data));
    } catch {
      toast.error("Chats could not be refreshed.");
    }
  }

  /** Applies message and chat events, deduplicating chat snapshots and handling deleted active chats. */
  const handleRealtimeEvent = useCallback((data: Record<string, unknown>) => {
    if (data.type === "created") setMessages((prev) => mergeById([...prev, data.message as Msg]));
    if (data.type === "deleted") setMessages((prev) => prev.filter((message) => message.id !== data.id));
    if (data.type === "updated") setMessages((prev) => mergeById([...prev.filter((m) => m.id !== (data.message as Msg).id), data.message as Msg]));
    if (data.type === "chat-created") setChats((prev) => mergeChatsById([...prev, data.chat as Chat]));
    if (data.type === "chat-updated") setChats((prev) => mergeChatsById(prev.map((c) => c.id === (data.chat as Chat).id ? (data.chat as Chat) : c)));
    if (data.type === "chat-deleted") {
      setChats((prev) => prev.filter((c) => c.id !== data.chatId));
      setMessages((prev) => prev.filter((m) => m.chatId !== data.chatId));
      setActiveChatId((current) => {
        if (current === data.chatId) {
          setFilterTag(null);
          return "default";
        }
        return current;
      });
    }
  }, []);

  const handleResync = useCallback(async () => {
    await Promise.all([syncChats(), syncMessages(), fetchAllTags()]);
  }, []);

  const { status: connectionStatus } = useRealtimeSync({
    onEvent: handleRealtimeEvent,
    onResync: handleResync
  });

  useEffect(() => {
    handleResync()
      .catch((err) => {
        console.error("[ChatApp] Initial data sync error:", err);
        toast.error("Failed to load initial data. Please refresh.");
      })
      .finally(() => {
        setInitialLoading(false);
      });
  }, [handleResync]);

  // ── Derived data ──

  const allMessages = useMemo(() => mergeById(messages), [messages]);

  const chatMessages = useMemo(() => allMessages.filter((m) => m.chatId === activeChatId), [allMessages, activeChatId]);

  const mediaItems: MediaItem[] = useMemo(() => {
    return chatMessages
      .filter((m) => m.type === "FILE" && isMedia(m))
      .map((m) => ({
        id: m.id,
        src: getDownloadUrl(m.content, false),
        fileName: m.fileName,
        fileSize: m.fileSize,
        mimeType: m.mimeType,
        caption: m.caption,
        createdAt: m.createdAt
      }));
  }, [chatMessages]);

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
          const caption = message.caption || "";
          const tagText = (message.tags ?? []).map((t) => `#${t}`).join(" ");
          return `${message.content} ${fileName} ${caption} ${tagText}`.toLowerCase().includes(needle);
        });
      }
    }

    return result;
  }, [chatMessages, query, filterTag]);

  const visibleMessages = useMemo(() => {
    if (filteredMessages.length <= visibleCount) return filteredMessages;
    return filteredMessages.slice(filteredMessages.length - visibleCount);
  }, [filteredMessages, visibleCount]);

  const hasOlderMessages = filteredMessages.length > visibleCount;

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

  async function uploadFiles(files: FileList | File[], caption?: string | null) {
    const items = Array.from(files);
    if (!items.length || uploading) return;

    setUploading(true);
    try {
      for (let i = 0; i < items.length; i++) {
        const file = items[i];
        const fd = new FormData();
        fd.append("file", file);
        fd.append("chatId", activeChatId);
        if (i === 0 && caption) {
          fd.append("caption", caption);
        }
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        if (!res.ok) {
          const errData = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(errData?.error || "Upload failed");
        }
        const message = (await res.json()) as Msg;
        setMessages((prev) => mergeById([...prev, message]));
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
      requestAnimationFrame(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "File upload failed.";
      toast.error(msg);
    } finally {
      setUploading(false);
      syncMessages();
    }
  }

  const dragCounterRef = useRef(0);

  useEffect(() => {
    const preventDefault = (e: globalThis.DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener("dragover", preventDefault);
    window.addEventListener("drop", preventDefault);
    return () => {
      window.removeEventListener("dragover", preventDefault);
      window.removeEventListener("drop", preventDefault);
    };
  }, []);

  function handleDragEnter(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    if (e.dataTransfer?.types && Array.from(e.dataTransfer.types).includes("Files")) {
      dragCounterRef.current += 1;
      if (dragCounterRef.current === 1) {
        setDragging(true);
      }
    }
  }

  function handleDragOver(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "copy";
    }
  }

  function handleDragLeave(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) {
      setDragging(false);
    }
  }

  function handleDrop(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    dragCounterRef.current = 0;
    setDragging(false);
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      setUploadModalFiles(Array.from(e.dataTransfer.files));
      setShowUploadModal(true);
    }
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      setUploadModalFiles(Array.from(e.target.files));
      setShowUploadModal(true);
      e.target.value = "";
    }
  }

  function onPaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    if (e.clipboardData.files.length > 0) {
      e.preventDefault();
      setUploadModalFiles(Array.from(e.clipboardData.files));
      setShowUploadModal(true);
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

  async function editMessage(id: string, newText: string) {
    const msg = messages.find((m) => m.id === id);
    if (!msg) return;

    const trimmed = newText.trim();
    if (msg.type === "TEXT" && !trimmed) return;

    try {
      const body = msg.type === "FILE"
        ? { caption: trimmed || null }
        : { content: trimmed };

      const res = await fetch(`/api/messages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error("Edit failed");
      const updated = (await res.json()) as Msg;
      setMessages((prev) => mergeById([...prev.filter((m) => m.id !== id), updated]));
      toast.success(msg.type === "FILE" ? "Caption updated." : "Message edited.");
    } catch {
      toast.error(msg.type === "FILE" ? "Failed to edit caption." : "Failed to edit message.");
    }
    setEditingMessageId(null);
    setEditText("");
  }

  function startEdit(msg: Msg) {
    setEditingMessageId(msg.id);
    setEditText(msg.type === "FILE" ? (msg.caption || "") : msg.content);
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

  /** Creates a named chat, merges the response with realtime state, and opens the new chat. */
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
      setChats((prev) => mergeChatsById([...prev, chat]));
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

  /** Saves the edited chat details and normalizes the updated list, keeping the editor open on failure. */
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
      setChats((prev) => mergeChatsById(prev.map((c) => c.id === chat.id ? chat : c)));
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
      if (!res.ok) {
        const errData = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errData?.error || "Upload failed");
      }
      const msg = (await res.json()) as Msg;
      if (target === "new") {
        setNewChatAvatar(msg.content);
        setNewChatAvatarType("image");
      } else {
        setEditChatAvatar(msg.content);
        setEditChatAvatarType("image");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to upload avatar.";
      toast.error(msg);
    }
  }

  // ── Context menu handlers ──

  const handleContextMenu = useCallback((e: React.MouseEvent, messageId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const menuWidth = 200;
    const menuHeight = 360;
    let x = e.clientX;
    let y = e.clientY;

    // Flip upwards if menu would overflow bottom of viewport
    if (y + menuHeight > window.innerHeight - 12) {
      y = Math.max(12, y - menuHeight);
    }
    // Flip leftwards if menu would overflow right of viewport
    if (x + menuWidth > window.innerWidth - 12) {
      x = Math.max(12, x - menuWidth);
    }

    setContextMenu({
      visible: true,
      x,
      y,
      messageId
    });
  }, []);

  const handleChatContextMenu = useCallback((e: React.MouseEvent, chatId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const menuWidth = 180;
    const menuHeight = 180;
    let x = rect.right;
    let y = rect.bottom;

    if (x + menuWidth > window.innerWidth - 12) {
      x = Math.max(12, rect.left - menuWidth);
    }
    if (y + menuHeight > window.innerHeight - 12) {
      y = Math.max(12, rect.top - menuHeight);
    }

    setChatContextMenu({
      visible: true,
      x,
      y,
      chatId
    });
  }, []);

  const openChatContextMenuAt = useCallback((chatId: string, clientX: number, clientY: number) => {
    const menuWidth = 180;
    const menuHeight = 180;
    let x = clientX;
    let y = clientY;

    if (x + menuWidth > window.innerWidth - 12) {
      x = Math.max(12, x - menuWidth);
    }
    if (y + menuHeight > window.innerHeight - 12) {
      y = Math.max(12, y - menuHeight);
    }

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
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
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
              dir="auto"
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

        <div className="tg-chat-list" aria-label="Chats">
          {initialLoading ? <ChatListSkeleton /> : chats.map((chat) => {
            const lastMsg = getChatLastMessage(chat.id);
            const count = getChatMessageCount(chat.id);
            const isActive = chat.id === activeChatId;

            return (
              <div
                key={chat.id}
                className={`tg-chat-card tg-chat-card-anim ${isActive ? "tg-chat-card-active" : ""}`}
                role="button"
                tabIndex={0}
                aria-pressed={isActive}
                onClick={() => {
                  setActiveChatId(chat.id);
                  setFilterTag(null);
                  setDesktopHomeView(false);
                  setMobileView("chat");
                  setQuery("");
                  exitSelectMode();
                }}
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setActiveChatId(chat.id);
                    setFilterTag(null);
                    setDesktopHomeView(false);
                    setMobileView("chat");
                    setQuery("");
                    exitSelectMode();
                  }
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
                  onKeyDown={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <Icon name="dots" />
                </button>
              </div>
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
              <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <strong>{activeChat?.name || "Saved Messages"}</strong>
                <span
                  title={
                    connectionStatus === "connected"
                      ? "Realtime connected"
                      : connectionStatus === "connecting"
                      ? "Connecting to server..."
                      : "Disconnected"
                  }
                  style={{
                    display: "inline-block",
                    width: "7px",
                    height: "7px",
                    borderRadius: "50%",
                    backgroundColor:
                      connectionStatus === "connected"
                        ? "#22c55e"
                        : connectionStatus === "connecting"
                        ? "#eab308"
                        : "#ef4444",
                    boxShadow:
                      connectionStatus === "connected"
                        ? "0 0 6px rgba(34, 197, 94, 0.6)"
                        : "none"
                  }}
                  aria-label={`Connection status: ${connectionStatus}`}
                />
              </div>
              <small>
                {chatMessages.length} items
                {connectionStatus === "connecting" && " • connecting..."}
                {connectionStatus === "disconnected" && " • offline"}
              </small>
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
            const target = pinnedMessages[pinnedMessages.length - 1];
            const targetIdx = filteredMessages.findIndex((m) => m.id === target.id);
            if (targetIdx !== -1 && filteredMessages.length - targetIdx > visibleCount) {
              setVisibleCount(filteredMessages.length - targetIdx + 20);
            }
            requestAnimationFrame(() => {
              const pinnedEl = document.querySelector(`[data-message-id="${target.id}"]`);
              pinnedEl?.scrollIntoView({ behavior: "smooth", block: "center" });
            });
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

          {hasOlderMessages && (
            <div style={{ display: "flex", justifyContent: "center", padding: "10px 0" }}>
              <button
                type="button"
                className="tg-btn-secondary"
                onClick={() => setVisibleCount((prev) => prev + 60)}
                style={{ fontSize: "12px", padding: "5px 14px", borderRadius: "14px" }}
              >
                Load earlier messages ({filteredMessages.length - visibleCount} more)
              </button>
            </div>
          )}

          {visibleMessages.map((message, index) => {
            const previous = visibleMessages[index - 1];
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
                          dir="auto"
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
                      <MessageFormatter content={message.content} searchNeedle={searchNeedle} />
                    ) : (
                      <div className="tg-file-message">
                        <div className="tg-file-heading">
                          <a className="tg-file-name" dir="auto" href={getDownloadUrl(message.content, true)} download={message.fileName || undefined}>
                            {message.fileName || "Download file"}
                          </a>
                          <span className="tg-file-size">{formatBytes(message.fileSize)}</span>
                        </div>
                        <FilePreview message={message} onOpenLightbox={setLightboxActiveId} />
                        {message.caption && (
                          <div className="tg-file-caption" dir="auto">
                            <MessageFormatter content={message.caption} searchNeedle={searchNeedle} />
                          </div>
                        )}
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
            dir="auto"
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
                <div
                  key={message.id}
                  className="tg-media-thumb tg-media-clickable"
                  onClick={() => setLightboxActiveId(message.id)}
                  title={message.fileName || "View media"}
                >
                  {message.mimeType?.startsWith("video/") ? (
                    <video src={message.content} muted />
                  ) : message.mimeType?.startsWith("audio/") ? (
                    <div className="tg-media-audio-thumb" title={message.fileName || "Audio"}>
                      <Icon name="file" />
                      <span className="tg-media-audio-name">{message.fileName || "Audio"}</span>
                    </div>
                  ) : (
                    <img src={message.content} alt={message.fileName || "media"} loading="lazy" />
                  )}
                </div>
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
                <a key={message.id} href={getDownloadUrl(message.content, true)} download={message.fileName || undefined} className="tg-side-row">
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
                dir="auto"
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
                dir="auto"
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

      {/* ── Floating Message Context Menu ── */}
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
              href={getDownloadUrl(contextMessage.content, true)}
              download={contextMessage.fileName || undefined}
              onClick={() => setContextMenu((prev) => ({ ...prev, visible: false }))}
            >
              <Icon name="download" />
              <span>Download</span>
            </a>
          )}
          {(contextMessage?.type === "TEXT" || contextMessage?.type === "FILE") && (
            <button
              className="tg-context-item"
              onClick={() => {
                if (contextMessage) startEdit(contextMessage);
              }}
            >
              <Icon name="edit" />
              <span>{contextMessage.type === "FILE" ? "Edit Caption" : "Edit"}</span>
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

      {/* ── File Upload Modal with Caption ── */}
      <FileUploadModal
        files={uploadModalFiles}
        open={showUploadModal}
        onClose={() => {
          setShowUploadModal(false);
          setUploadModalFiles([]);
        }}
        onSend={(filesToSend, caption) => {
          uploadFiles(filesToSend, caption);
        }}
      />

      {/* ── Telegram Media Lightbox ── */}
      <MediaLightbox
        items={mediaItems}
        activeId={lightboxActiveId}
        onClose={() => setLightboxActiveId(null)}
        onNavigate={(id) => setLightboxActiveId(id)}
      />
    </main>
    </ErrorBoundary>
  );
}
