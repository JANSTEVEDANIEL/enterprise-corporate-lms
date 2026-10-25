"use client";
import React, { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, RotateCcw, CheckCircle2 } from "lucide-react";

export interface VideoChapter {
  time: number; // in seconds
  title: string;
}

export interface VideoPlayerConfig {
  videoUrl: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  chapters?: VideoChapter[];
  summary?: string;
}

interface VideoPlayerProps {
  config: VideoPlayerConfig;
  initialPositionSeconds?: number;
  onProgress?: (positionSeconds: number, durationSeconds: number) => void;
  onComplete?: () => void;
  isCompleted?: boolean;
}

export function VideoPlayer({
  config,
  initialPositionSeconds = 0,
  onProgress,
  onComplete,
  isCompleted = false,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(initialPositionSeconds);
  const [duration, setDuration] = useState(config.durationSeconds || 0);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [hasTriggeredComplete, setHasTriggeredComplete] = useState(isCompleted);

  useEffect(() => {
    if (videoRef.current && initialPositionSeconds > 0) {
      videoRef.current.currentTime = initialPositionSeconds;
    }
  }, [initialPositionSeconds]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const cur = videoRef.current.currentTime;
    const dur = videoRef.current.duration || config.durationSeconds || 0;
    setCurrentTime(cur);
    if (dur > 0 && dur !== duration) {
      setDuration(dur);
    }

    if (onProgress) {
      onProgress(Math.round(cur), Math.round(dur));
    }

    // Trigger complete if within 5% of end or completed
    if (!hasTriggeredComplete && dur > 0 && cur >= dur * 0.95) {
      setHasTriggeredComplete(true);
      if (onComplete) {
        onComplete();
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetTime = Number(e.target.value);
    setCurrentTime(targetTime);
    if (videoRef.current) {
      videoRef.current.currentTime = targetTime;
    }
  };

  const handleJumpToChapter = (chapterTime: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = chapterTime;
      setCurrentTime(chapterTime);
      if (!isPlaying) {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const cyclePlaybackRate = () => {
    const rates = [1, 1.25, 1.5, 2];
    const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
    const nextRate = rates[nextIdx];
    setPlaybackRate(nextRate);
    if (videoRef.current) {
      videoRef.current.playbackRate = nextRate;
    }
  };

  const toggleFullscreen = () => {
    if (!videoRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      videoRef.current.requestFullscreen().catch(() => {});
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-video shadow-md border border-slate-800 group">
        <video
          ref={videoRef}
          src={config.videoUrl}
          poster={config.thumbnailUrl}
          className="w-full h-full object-cover"
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => {
            setIsPlaying(false);
            if (!hasTriggeredComplete) {
              setHasTriggeredComplete(true);
              if (onComplete) onComplete();
            }
          }}
          onClick={togglePlay}
          playsInline
        />

        {/* Center Play Overlay when paused */}
        {!isPlaying && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-blue-600/90 text-white flex items-center justify-center shadow-lg hover:scale-105 hover:bg-blue-500 transition-all cursor-pointer z-10"
            aria-label="Play video"
          >
            <Play className="w-8 h-8 translate-x-0.5 fill-current" />
          </button>
        )}

        {/* Top Badges */}
        <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
          {hasTriggeredComplete && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/90 text-white text-xs font-bold backdrop-blur">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Lesson Watched
            </span>
          )}
        </div>

        {/* Bottom Control Bar */}
        <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent z-20 space-y-2 opacity-90 group-hover:opacity-100 transition-opacity">
          {/* Progress Slider */}
          <div className="relative flex items-center">
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          <div className="flex items-center justify-between text-white text-xs">
            <div className="flex items-center gap-3">
              <button
                onClick={togglePlay}
                className="p-1 hover:text-blue-400 transition-colors"
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
              </button>

              <button
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.currentTime = 0;
                    setCurrentTime(0);
                  }
                }}
                className="p-1 hover:text-blue-400 transition-colors"
                title="Restart"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={toggleMute}
                className="p-1 hover:text-blue-400 transition-colors"
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>

              <span className="font-mono text-[11px] text-slate-300">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={cyclePlaybackRate}
                className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[11px] font-semibold transition-colors"
                title="Playback speed"
              >
                {playbackRate}x
              </button>

              <button
                onClick={toggleFullscreen}
                className="p-1 hover:text-blue-400 transition-colors"
                title="Fullscreen"
              >
                <Maximize className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Chapters list if available */}
      {config.chapters && config.chapters.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5">
            Video Chapters & Timestamps
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {config.chapters.map((ch, idx) => (
              <button
                key={idx}
                onClick={() => handleJumpToChapter(ch.time)}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-blue-50 border border-slate-100 hover:border-blue-200 text-left transition-all text-xs"
              >
                <span className="font-medium text-slate-800 truncate mr-2">{ch.title}</span>
                <span className="font-mono text-[10px] text-blue-600 bg-blue-100/60 px-1.5 py-0.5 rounded shrink-0">
                  {formatTime(ch.time)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Video summary */}
      {config.summary && (
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs md:text-sm text-slate-600 leading-relaxed">
          <strong className="text-slate-900 font-semibold block mb-1">Key Takeaway:</strong>
          {config.summary}
        </div>
      )}
    </div>
  );
}
