"use client";

import { useEffect, useRef, useState, useCallback, type ChangeEvent } from "react";

interface AudioPlayerProps {
  src: string;
  fileName?: string | null;
  fileSize?: number | null;
  downloadUrl?: string;
}

function formatDuration(seconds: number): string {
  if (!seconds || Number.isNaN(seconds) || !Number.isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * پلیر صوتی اختصاصی و شیک با سبک و حس تلگرام (Telegram-style Audio Player)
 */
export function TelegramAudioPlayer({
  src,
  fileName,
  downloadUrl
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<1 | 1.5 | 2>(1);
  const [isSeeking, setIsSeeking] = useState(false);
  const isSeekingRef = useRef(false);

  useEffect(() => {
    isSeekingRef.current = isSeeking;
  }, [isSeeking]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      if (!isSeekingRef.current) {
        setCurrentTime(audio.currentTime);
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handlePlay = () => {
      setIsPlaying(true);
    };
    const handlePause = () => {
      setIsPlaying(false);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.pause();
    };
  }, [src]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch((err) => {
        console.warn("[Audio Playback Error]", err);
      });
    }
  }, [isPlaying]);

  const handleSeek = (e: ChangeEvent<HTMLInputElement>) => {
    const targetTime = parseFloat(e.target.value);
    setCurrentTime(targetTime);
    if (audioRef.current) {
      audioRef.current.currentTime = targetTime;
    }
  };

  const cyclePlaybackRate = () => {
    const audio = audioRef.current;
    if (!audio) return;

    const nextRate: 1 | 1.5 | 2 =
      playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    setPlaybackRate(nextRate);
    audio.playbackRate = nextRate;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const displayName = fileName || "Voice message";

  return (
    <div className="tg-audio-player" dir="ltr">
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* دکمه دایره‌ای پخش / توقف */}
      <button
        type="button"
        className="tg-audio-play-btn"
        onClick={togglePlay}
        aria-label={isPlaying ? "Pause audio" : "Play audio"}
        title={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1.5" />
            <rect x="14" y="4" width="4" height="16" rx="1.5" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 5.5v13a1 1 0 0 0 1.55.83l10-6.5a1 1 0 0 0 0-1.66l-10-6.5A1 1 0 0 0 7 5.5z" />
          </svg>
        )}
      </button>

      {/* اطلاعات ترک، اسلایدر و زمان */}
      <div className="tg-audio-body">
        <div className="tg-audio-meta">
          <span className="tg-audio-title" dir="auto" title={displayName}>
            {displayName}
          </span>
          <div className="tg-audio-tools">
            <button
              type="button"
              className="tg-audio-rate-btn"
              onClick={cyclePlaybackRate}
              title="Change playback speed"
            >
              {playbackRate}x
            </button>
            {downloadUrl && (
              <a
                href={downloadUrl}
                download={fileName || undefined}
                className="tg-audio-dl-btn"
                title="Download audio"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </a>
            )}
          </div>
        </div>

        {/* نوار پیشرفت سفارشی با قابلیت Seek */}
        <div className="tg-audio-track-wrap">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            onMouseDown={() => {
              setIsSeeking(true);
            }}
            onMouseUp={() => {
              setIsSeeking(false);
            }}
            onTouchStart={() => {
              setIsSeeking(true);
            }}
            onTouchEnd={() => {
              setIsSeeking(false);
            }}
            onTouchCancel={() => {
              setIsSeeking(false);
            }}
            className="tg-audio-slider"
            style={{ "--progress-percent": `${progressPercent}%` } as React.CSSProperties}
            aria-label="Audio seeker"
          />
        </div>

        <div className="tg-audio-times">
          <span>{formatDuration(currentTime)}</span>
          <span>{duration > 0 ? formatDuration(duration) : "--:--"}</span>
        </div>
      </div>
    </div>
  );
}
