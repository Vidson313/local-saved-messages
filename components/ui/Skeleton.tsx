"use client";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`tg-skeleton ${className}`} />;
}

export function ChatListSkeleton() {
  return (
    <div className="tg-skeleton-list" aria-busy="true" aria-label="Loading chats">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="tg-skeleton-chat-card">
          <Skeleton className="tg-skeleton-avatar" />
          <div className="tg-skeleton-chat-copy">
            <Skeleton className="tg-skeleton-line tg-skeleton-line-title" />
            <Skeleton className="tg-skeleton-line tg-skeleton-line-subtitle" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MessageListSkeleton() {
  return (
    <div className="tg-skeleton-messages" aria-busy="true" aria-label="Loading messages">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="tg-skeleton-bubble-row">
          <div className="tg-skeleton-bubble" style={{ width: `${45 + (i % 3) * 15}%` }}>
            <Skeleton className="tg-skeleton-line" />
            {i % 2 === 0 && <Skeleton className="tg-skeleton-line tg-skeleton-line-short" />}
          </div>
        </div>
      ))}
    </div>
  );
}

export function LoadingSpinner({ size = 20 }: { size?: number }) {
  return (
    <svg
      className="tg-spinner"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
