"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { X, Send, File as FileIcon, Film, Music } from "lucide-react";

interface FileUploadModalProps {
  files: File[];
  open: boolean;
  onClose: () => void;
  onSend: (files: File[], caption: string | null) => void;
}

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function FileUploadModal({ files, open, onClose, onSend }: FileUploadModalProps) {
  const [caption, setCaption] = useState("");
  const [primaryUrl, setPrimaryUrl] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const primaryFile = files && files.length > 0 ? files[0] : null;

  // Generate object URL for primary media preview safely
  useEffect(() => {
    if (!open || !primaryFile) {
      setPrimaryUrl(null);
      setCaption("");
      return;
    }

    const isMedia = primaryFile.type.startsWith("image/") || primaryFile.type.startsWith("video/");
    if (isMedia) {
      const url = URL.createObjectURL(primaryFile);
      setPrimaryUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setPrimaryUrl(null);
    }
  }, [primaryFile, open]);

  // Focus textarea when modal opens
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  if (!open || !files || files.length === 0 || !primaryFile) {
    return null;
  }

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

  const isImage = primaryFile.type.startsWith("image/");
  const isVideo = primaryFile.type.startsWith("video/");
  const isAudio = primaryFile.type.startsWith("audio/");

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
            {isImage && primaryUrl ? (
              <div className="tg-upload-image-wrapper">
                <img
                  src={primaryUrl}
                  alt={primaryFile.name || "Image preview"}
                  className="tg-upload-image-preview"
                />
              </div>
            ) : isVideo && primaryUrl ? (
              <div className="tg-upload-video-wrapper">
                <video
                  src={primaryUrl}
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
                  <span className="tg-upload-doc-name" dir="auto" title={primaryFile.name}>
                    {primaryFile.name || "File"}
                  </span>
                  <span className="tg-upload-doc-size">
                    {formatBytes(primaryFile.size)}
                  </span>
                </div>
              </div>
            )}

            {/* Multiple files indicator */}
            {files.length > 1 && (
              <div className="tg-upload-thumbs-row">
                {files.map((file, idx) => (
                  <div key={idx} className="tg-upload-thumb-item" title={file.name}>
                    <div className="tg-upload-thumb-fallback">
                      <FileIcon size={14} />
                    </div>
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
