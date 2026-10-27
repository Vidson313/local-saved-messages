"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { X, Send, File as FileIcon, Image as ImageIcon, Film, Music } from "lucide-react";

interface FileUploadModalProps {
  files: File[];
  open: boolean;
  onClose: () => void;
  onSend: (files: File[], caption: string | null) => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function FileUploadModal({ files, open, onClose, onSend }: FileUploadModalProps) {
  const [caption, setCaption] = useState("");
  const [previews, setPreviews] = useState<{ file: File; url: string | null }[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Generate object URLs for images/videos
  useEffect(() => {
    if (!open || files.length === 0) {
      setPreviews([]);
      setCaption("");
      return;
    }

    const items = files.map((file) => {
      const isMedia = file.type.startsWith("image/") || file.type.startsWith("video/");
      return {
        file,
        url: isMedia ? URL.createObjectURL(file) : null
      };
    });

    setPreviews(items);

    return () => {
      items.forEach((item) => {
        if (item.url) URL.revokeObjectURL(item.url);
      });
    };
  }, [files, open]);

  // Focus textarea when modal opens
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  if (!open || files.length === 0) return null;

  const handleSend = () => {
    const trimmed = caption.trim();
    onSend(files, trimmed || null);
    onClose();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  const primary = previews[0];
  const isImage = primary?.file.type.startsWith("image/");
  const isVideo = primary?.file.type.startsWith("video/");
  const isAudio = primary?.file.type.startsWith("audio/");

  return (
    <div
      className="tg-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Send files with caption"
    >
      <div className="tg-modal tg-upload-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tg-modal-header">
          <strong>
            {files.length === 1 ? "Send File" : `Send ${files.length} Files`}
          </strong>
          <button className="tg-ghost-button" onClick={onClose} aria-label="Close" type="button">
            <X size={20} />
          </button>
        </div>

        <div className="tg-modal-body tg-upload-modal-body">
          {/* Main Preview Area */}
          <div className="tg-upload-preview-area">
            {isImage && primary.url ? (
              <div className="tg-upload-image-wrapper">
                <img
                  src={primary.url}
                  alt={primary.file.name}
                  className="tg-upload-image-preview"
                />
              </div>
            ) : isVideo && primary.url ? (
              <div className="tg-upload-video-wrapper">
                <video
                  src={primary.url}
                  className="tg-upload-video-preview"
                  controls
                  muted
                />
              </div>
            ) : (
              <div className="tg-upload-doc-preview">
                <div className="tg-upload-doc-icon">
                  {isAudio ? <Music size={36} /> : isVideo ? <Film size={36} /> : <FileIcon size={36} />}
                </div>
                <div className="tg-upload-doc-info">
                  <span className="tg-upload-doc-name" dir="auto" title={primary.file.name}>
                    {primary.file.name}
                  </span>
                  <span className="tg-upload-doc-size">
                    {formatBytes(primary.file.size)}
                  </span>
                </div>
              </div>
            )}

            {/* Multiple files indicator / thumbnails */}
            {files.length > 1 && (
              <div className="tg-upload-thumbs-row">
                {previews.map((item, idx) => (
                  <div key={idx} className="tg-upload-thumb-item" title={item.file.name}>
                    {item.url && item.file.type.startsWith("image/") ? (
                      <img src={item.url} alt={item.file.name} />
                    ) : (
                      <div className="tg-upload-thumb-fallback">
                        <FileIcon size={14} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Caption Input */}
          <div className="tg-upload-caption-wrapper">
            <textarea
              ref={textareaRef}
              dir="auto"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add a caption... (Enter to send)"
              rows={2}
              className="tg-upload-caption-input"
              maxLength={50000}
            />
          </div>
        </div>

        <div className="tg-modal-footer tg-upload-modal-footer">
          <button
            type="button"
            className="tg-btn-secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="tg-btn-primary tg-send-file-btn"
            onClick={handleSend}
          >
            <Send size={16} />
            <span>Send</span>
          </button>
        </div>
      </div>
    </div>
  );
}
