"use client";

import { useEffect, useRef, useState, useCallback, type KeyboardEvent } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Music,
  Film
} from "lucide-react";
import { MessageFormatter } from "./MessageFormatter";
import { TelegramAudioPlayer } from "./AudioPlayer";

export interface MediaItem {
  id: string;
  src: string;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  caption?: string | null;
  createdAt: string;
}

interface MediaLightboxProps {
  items: MediaItem[];
  activeId: string | null;
  onClose: () => void;
  onNavigate: (id: string) => void;
}

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "";
  }
}

export function MediaLightbox({ items, activeId, onClose, onNavigate }: MediaLightboxProps) {
  const [zoom, setZoom] = useState(1);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const currentIndex = items.findIndex((i) => i.id === activeId);
  const currentItem = currentIndex !== -1 ? items[currentIndex] : null;

  // Reset zoom on item change
  useEffect(() => {
    setZoom(1);
  }, [activeId]);

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      onNavigate(items[currentIndex - 1].id);
    }
  }, [currentIndex, items, onNavigate]);

  const goToNext = useCallback(() => {
    if (currentIndex < items.length - 1) {
      onNavigate(items[currentIndex + 1].id);
    }
  }, [currentIndex, items, onNavigate]);

  const handleZoomIn = () => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)));
  const handleZoomOut = () => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)));
  const handleZoomReset = () => setZoom(1);

  // Keyboard navigation & controls
  useEffect(() => {
    if (!activeId) return;

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToPrevious();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goToNext();
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        handleZoomOut();
      } else if (e.key === "0") {
        e.preventDefault();
        handleZoomReset();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeId, goToPrevious, goToNext, onClose]);

  if (!activeId || !currentItem) return null;

  const mime = currentItem.mimeType || "";
  const isImage = mime.startsWith("image/");
  const isVideo = mime.startsWith("video/");
  const isAudio = mime.startsWith("audio/");

  return (
    <div
      className="tg-lightbox-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Media Lightbox"
      onClick={onClose}
    >
      {/* Top Header Bar */}
      <div className="tg-lightbox-header" onClick={(e) => e.stopPropagation()}>
        <div className="tg-lightbox-title-info">
          <strong className="tg-lightbox-filename" dir="auto" title={currentItem.fileName || "Media"}>
            {currentItem.fileName || "Media"}
          </strong>
          <span className="tg-lightbox-meta">
            {formatDate(currentItem.createdAt)}
            {currentItem.fileSize ? ` • ${formatBytes(currentItem.fileSize)}` : ""}
            {items.length > 1 ? ` • (${currentIndex + 1} of ${items.length})` : ""}
          </span>
        </div>

        <div className="tg-lightbox-actions">
          {isImage && (
            <>
              <button
                type="button"
                className="tg-lightbox-btn"
                onClick={handleZoomIn}
                title="Zoom In (+)"
                aria-label="Zoom in"
              >
                <ZoomIn size={18} />
              </button>
              <button
                type="button"
                className="tg-lightbox-btn"
                onClick={handleZoomOut}
                title="Zoom Out (-)"
                aria-label="Zoom out"
              >
                <ZoomOut size={18} />
              </button>
              {zoom !== 1 && (
                <button
                  type="button"
                  className="tg-lightbox-btn"
                  onClick={handleZoomReset}
                  title="Reset Zoom (0)"
                  aria-label="Reset zoom"
                >
                  <RotateCcw size={18} />
                </button>
              )}
            </>
          )}

          <a
            href={currentItem.src}
            download={currentItem.fileName || undefined}
            className="tg-lightbox-btn"
            title="Download"
            aria-label="Download"
            onClick={(e) => e.stopPropagation()}
          >
            <Download size={18} />
          </a>

          <button
            type="button"
            className="tg-lightbox-btn tg-lightbox-close-btn"
            onClick={onClose}
            title="Close (Esc)"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="tg-lightbox-content" onClick={(e) => e.stopPropagation()}>
        {/* Navigation - Previous */}
        {currentIndex > 0 && (
          <button
            type="button"
            className="tg-lightbox-nav-btn tg-lightbox-nav-prev"
            onClick={goToPrevious}
            title="Previous (Left Arrow)"
            aria-label="Previous media"
          >
            <ChevronLeft size={36} />
          </button>
        )}

        {/* Media Item */}
        <div className="tg-lightbox-media-wrapper">
          {isImage ? (
            <img
              src={currentItem.src}
              alt={currentItem.fileName || "Image"}
              className="tg-lightbox-img"
              style={{
                transform: `scale(${zoom})`,
                transition: "transform 0.15s ease-out"
              }}
            />
          ) : isVideo ? (
            <video
              ref={videoRef}
              src={currentItem.src}
              controls
              autoPlay
              className="tg-lightbox-video"
            />
          ) : isAudio ? (
            <div className="tg-lightbox-audio-card">
              <div className="tg-lightbox-audio-icon">
                <Music size={48} />
              </div>
              <strong className="tg-lightbox-audio-title" dir="auto">
                {currentItem.fileName || "Audio Track"}
              </strong>
              <div className="tg-lightbox-audio-player-wrapper">
                <TelegramAudioPlayer
                  src={currentItem.src}
                  fileName={currentItem.fileName}
                  fileSize={currentItem.fileSize}
                  downloadUrl={currentItem.src}
                />
              </div>
            </div>
          ) : (
            <div className="tg-lightbox-fallback-card">
              <Film size={48} />
              <p>{currentItem.fileName}</p>
            </div>
          )}
        </div>

        {/* Navigation - Next */}
        {currentIndex < items.length - 1 && (
          <button
            type="button"
            className="tg-lightbox-nav-btn tg-lightbox-nav-next"
            onClick={goToNext}
            title="Next (Right Arrow)"
            aria-label="Next media"
          >
            <ChevronRight size={36} />
          </button>
        )}
      </div>

      {/* Bottom Caption Pill */}
      {currentItem.caption && (
        <div className="tg-lightbox-caption-container" onClick={(e) => e.stopPropagation()}>
          <div className="tg-lightbox-caption-pill" dir="auto">
            <MessageFormatter content={currentItem.caption} />
          </div>
        </div>
      )}
    </div>
  );
}
