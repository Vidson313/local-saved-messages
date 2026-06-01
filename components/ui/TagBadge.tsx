"use client";

import { X } from "lucide-react";

type TagBadgeProps = {
  tag: string;
  onRemove?: () => void;
  onClick?: () => void;
  size?: "sm" | "md";
};

export function TagBadge({ tag, onRemove, onClick, size = "sm" }: TagBadgeProps) {
  return (
    <span
      className={`tg-tag-badge ${size === "md" ? "tg-tag-badge-md" : ""} ${onClick ? "tg-tag-badge-clickable" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
    >
      <span className="tg-tag-hash">#</span>
      {tag}
      {onRemove && (
        <button
          className="tg-tag-remove"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          aria-label={`Remove tag ${tag}`}
          type="button"
        >
          <X size={12} />
        </button>
      )}
    </span>
  );
}

type TagListProps = {
  tags: string[];
  onRemove?: (tag: string) => void;
  onTagClick?: (tag: string) => void;
  size?: "sm" | "md";
};

export function TagList({ tags, onRemove, onTagClick, size = "sm" }: TagListProps) {
  if (tags.length === 0) return null;
  return (
    <div className="tg-tag-list">
      {tags.map((tag) => (
        <TagBadge
          key={tag}
          tag={tag}
          onRemove={onRemove ? () => onRemove(tag) : undefined}
          onClick={onTagClick ? () => onTagClick(tag) : undefined}
          size={size}
        />
      ))}
    </div>
  );
}
