"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  RotateCcw,
  FastForward,
  CheckCircle2,
} from "lucide-react";

export const PLAYBACK_SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

export interface VideoPlayerControlsProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  videoUrl?: string | null;
  lessonTitle: string;
  durationSeconds?: number;
  initialPositionSeconds?: number;
  onProgressUpdate?: (positionSeconds: number, playbackPct: number) => void;
  onAutoCompleted?: () => void;
  isCompleted?: boolean;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function VideoPlayerControls({
  videoRef,
  videoUrl,
  lessonTitle,
  durationSeconds = 0,
  initialPositionSeconds = 0,
  onProgressUpdate,
  onAutoCompleted,
  isCompleted = false,
}: VideoPlayerControlsProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(initialPositionSeconds);
  const [duration, setDuration] = useState(durationSeconds);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [hasAutoCompleted, setHasAutoCompleted] = useState(isCompleted);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync initial position when video is loaded
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      if (video.duration && !isNaN(video.duration)) {
        setDuration(video.duration);
      }
      if (initialPositionSeconds > 0 && initialPositionSeconds < video.duration) {
        video.currentTime = initialPositionSeconds;
        setCurrentTime(initialPositionSeconds);
      }
    };

    const handleTimeUpdate = () => {
      const current = video.currentTime;
      setCurrentTime(current);

      const total = video.duration || durationSeconds;
      if (total > 0) {
        const pct = Math.round((current / total) * 100);
        onProgressUpdate?.(Math.floor(current), pct);

        // Auto-complete at 90%+ playback
        if (pct >= 90 && !hasAutoCompleted) {
          setHasAutoCompleted(true);
          onAutoCompleted?.();
        }
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      if (!hasAutoCompleted) {
        setHasAutoCompleted(true);
        onAutoCompleted?.();
      }
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("ended", handleEnded);

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("ended", handleEnded);
    };
  }, [videoRef, initialPositionSeconds, durationSeconds, hasAutoCompleted, onProgressUpdate, onAutoCompleted]);

  // Reset auto-completed state when lesson/video changes
  useEffect(() => {
    setHasAutoCompleted(isCompleted);
  }, [videoUrl, isCompleted]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused || video.ended) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const seekTime = parseFloat(e.target.value);
    video.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  const handleSpeedChange = (speed: PlaybackSpeed) => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = speed;
    }
    setPlaybackSpeed(speed);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const vol = parseFloat(e.target.value);
    video.volume = vol;
    video.muted = vol === 0;
    setVolume(vol);
    setIsMuted(vol === 0);
  };

  const toggleFullscreen = () => {
    const container = containerRef.current || videoRef.current?.parentElement;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const effectiveDuration = duration || durationSeconds || 1;
  const progressPercent = Math.min(100, Math.max(0, (currentTime / effectiveDuration) * 100));

  return (
    <div
      ref={containerRef}
      className="group relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col justify-end"
    >
      {/* Video Element is mounted by parent or nested */}
      {videoUrl ? (
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-full object-contain cursor-pointer"
          onClick={togglePlay}
          playsInline
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-900/80">
          <p className="text-sm">No streaming video available for this lesson.</p>
        </div>
      )}

      {/* Completion Pill Overlay */}
      {hasAutoCompleted && (
        <div
          className="absolute top-4 right-4 z-20 flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/90 text-white text-xs font-bold backdrop-blur-md shadow-lg transition-all animate-in fade-in"
          data-testid="video-completed-badge"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>90%+ Completed</span>
        </div>
      )}

      {/* Control Overlay Bar */}
      <div className="z-10 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-4 transition-opacity duration-200">
        {/* Scrubber Progress Bar */}
        <div className="relative w-full flex items-center mb-3 group/scrubber">
          <input
            type="range"
            min={0}
            max={effectiveDuration}
            step={0.5}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 bg-slate-700/60 rounded-lg appearance-none cursor-pointer accent-brand-500 hover:h-2 transition-all"
            style={{
              background: `linear-gradient(to right, #3b82f6 ${progressPercent}%, rgba(51, 65, 85, 0.6) ${progressPercent}%)`,
            }}
          />
        </div>

        {/* Lower Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-white">
          {/* Play/Pause + Time */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={togglePlay}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white"
              title={isPlaying ? "Pause (Space)" : "Play (Space)"}
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>

            <button
              type="button"
              onClick={() => {
                if (videoRef.current) {
                  videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
                }
              }}
              className="p-1.5 text-slate-300 hover:text-white transition-colors"
              title="Rewind 10s"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Time Stamp Display */}
            <div className="text-xs font-mono text-slate-300">
              <span className="text-white font-bold">{formatTime(currentTime)}</span> / {formatTime(effectiveDuration)}
            </div>
          </div>

          {/* Center Title */}
          <div className="hidden md:block text-xs font-medium text-slate-300 truncate max-w-xs text-center">
            {lessonTitle}
          </div>

          {/* Right Controls: Volume + Exact Speeds + Fullscreen */}
          <div className="flex items-center gap-3">
            {/* Volume Control */}
            <div className="flex items-center gap-1.5 group/vol">
              <button
                type="button"
                onClick={toggleMute}
                className="text-slate-300 hover:text-white transition-colors p-1"
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-16 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-white"
              />
            </div>

            {/* EXACT SPEED CONTROLS: 0.75x, 1x, 1.25x, 1.5x, 2x */}
            <div
              className="flex items-center bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/80 text-[11px] font-semibold"
              data-testid="speed-controls"
            >
              {PLAYBACK_SPEEDS.map((speed) => (
                <button
                  key={speed}
                  type="button"
                  onClick={() => handleSpeedChange(speed)}
                  data-speed={speed}
                  className={`px-2 py-0.5 rounded-md transition-all ${
                    playbackSpeed === speed
                      ? "bg-brand-600 text-white shadow-sm font-bold"
                      : "text-slate-400 hover:text-white hover:bg-slate-700/50"
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>

            {/* Fullscreen Button */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-1.5 text-slate-300 hover:text-white transition-colors"
              title="Fullscreen"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
