"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Tag, Plus } from "lucide-react";
import { TagBadge } from "./TagBadge";
import { useFocusTrap } from "@/hooks/useFocusTrap";

type TagEditorProps = {
  isOpen: boolean;
  onClose: () => void;
  tags: string[];
  allTags: string[];
  onSave: (tags: string[]) => void;
};

export function TagEditor({ isOpen, onClose, tags, allTags, onSave }: TagEditorProps) {
  const [currentTags, setCurrentTags] = useState<string[]>(tags);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen);

  useEffect(() => {
    setCurrentTags(tags);
    setInputValue("");
  }, [tags, isOpen]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const addTag = useCallback((tag: string) => {
    const normalized = tag.trim().toLowerCase().replace(/[^a-z0-9\u0600-\u06FF\u0980-\u09FF\u4e00-\u9fff\-_]/g, "");
    if (!normalized || currentTags.includes(normalized)) return;
    setCurrentTags((prev) => [...prev, normalized]);
    setInputValue("");
  }, [currentTags]);

  const removeTag = useCallback((tag: string) => {
    setCurrentTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === "Backspace" && !inputValue && currentTags.length > 0) {
      removeTag(currentTags[currentTags.length - 1]);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  const handleSave = () => {
    onSave(currentTags);
    onClose();
  };

  const suggestedTags = allTags.filter(
    (t) => !currentTags.includes(t) && t.includes(inputValue.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="tg-modal-overlay" onClick={onClose}>
      <div
        ref={modalRef}
        className="tg-tag-editor"
        role="dialog"
        aria-modal="true"
        aria-label="Edit tags"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tg-tag-editor-header">
          <Tag size={18} />
          <strong>Edit Tags</strong>
          <button className="tg-ghost-button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="tg-tag-editor-body">
          <div className="tg-tag-input-container">
            {currentTags.map((tag) => (
              <TagBadge key={tag} tag={tag} onRemove={() => removeTag(tag)} size="md" />
            ))}
            <input
              ref={inputRef}
              className="tg-tag-input"
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={currentTags.length === 0 ? "Add tags..." : ""}
              aria-label="Add tag"
            />
          </div>
          <small className="tg-tag-hint">Press Enter or comma to add. Backspace to remove last.</small>

          {suggestedTags.length > 0 && (
            <div className="tg-tag-suggestions">
              <small className="tg-tag-suggestions-label">Existing tags:</small>
              <div className="tg-tag-suggestions-list">
                {suggestedTags.slice(0, 10).map((tag) => (
                  <button
                    key={tag}
                    className="tg-tag-suggestion"
                    onClick={() => addTag(tag)}
                    type="button"
                  >
                    <Plus size={12} />
                    <span className="tg-tag-hash">#</span>{tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="tg-tag-editor-footer">
          <button className="tg-tag-btn tg-tag-btn-cancel" onClick={onClose}>Cancel</button>
          <button className="tg-tag-btn tg-tag-btn-save" onClick={handleSave}>Save Tags</button>
        </div>
      </div>
    </div>
  );
}
