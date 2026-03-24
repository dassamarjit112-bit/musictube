/**
 * useYouTubePlayer – wraps the YouTube IFrame API directly.
 * react-player v3 dropped YouTube support, so we use the raw YT API.
 */
import { useEffect, useRef, useCallback } from "react";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

let apiLoaded = false;
let apiReadyCallbacks: (() => void)[] = [];

function loadYTApi() {
  if (apiLoaded || document.getElementById("yt-iframe-api")) return;
  const tag = document.createElement("script");
  tag.id = "yt-iframe-api";
  tag.src = "https://www.youtube.com/iframe_api";
  document.head.appendChild(tag);
  window.onYouTubeIframeAPIReady = () => {
    apiLoaded = true;
    apiReadyCallbacks.forEach((cb) => cb());
    apiReadyCallbacks = [];
  };
}

export interface YTPlayerOptions {
  onReady?: () => void;
  onStateChange?: (state: number) => void;
  onProgress?: (played: number, playedSeconds: number) => void;
  onDuration?: (duration: number) => void;
  onEnded?: () => void;
  onError?: (code: number) => void;
}

export function useYouTubePlayer(
  containerId: string,
  options: YTPlayerOptions
) {
  const playerRef = useRef<any>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const stopProgress = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startProgress = useCallback(() => {
    stopProgress();
    intervalRef.current = setInterval(() => {
      const p = playerRef.current;
      if (!p || typeof p.getCurrentTime !== "function") return;
      try {
        const cur = p.getCurrentTime();
        const dur = p.getDuration();
        if (dur > 0) {
          optionsRef.current.onProgress?.(cur / dur, cur);
          optionsRef.current.onDuration?.(dur);
        }
      } catch {}
    }, 500);
  }, [stopProgress]);

  const initPlayer = useCallback(
    (videoId: string) => {
      const container = document.getElementById(containerId);
      if (!container) return;

      if (playerRef.current) {
        try {
          playerRef.current.loadVideoById(videoId);
          return;
        } catch {}
      }

      playerRef.current = new window.YT.Player(containerId, {
        videoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            optionsRef.current.onReady?.();
          },
          onStateChange: (e: any) => {
            const state: number = e.data;
            optionsRef.current.onStateChange?.(state);
            if (state === window.YT.PlayerState.PLAYING) {
              startProgress();
            } else {
              stopProgress();
            }
            if (state === window.YT.PlayerState.ENDED) {
              optionsRef.current.onEnded?.();
            }
          },
          onError: (e: any) => {
            optionsRef.current.onError?.(e.data);
          },
        },
      });
    },
    [containerId, startProgress, stopProgress]
  );

  useEffect(() => {
    loadYTApi();
    return () => {
      stopProgress();
    };
  }, [stopProgress]);

  const load = useCallback(
    (videoId: string) => {
      if (!videoId) return;
      if (window.YT && window.YT.Player) {
        initPlayer(videoId);
      } else {
        apiReadyCallbacks.push(() => initPlayer(videoId));
      }
    },
    [initPlayer]
  );

  const play = useCallback(() => {
    try { playerRef.current?.playVideo(); } catch {}
  }, []);

  const pause = useCallback(() => {
    try { playerRef.current?.pauseVideo(); } catch {}
    stopProgress();
  }, [stopProgress]);

  const seekTo = useCallback((fraction: number) => {
    const p = playerRef.current;
    if (!p || typeof p.getDuration !== "function") return;
    try {
      const dur = p.getDuration();
      p.seekTo(fraction * dur, true);
    } catch {}
  }, []);

  const setVolume = useCallback((vol: number) => {
    try { playerRef.current?.setVolume(vol * 100); } catch {}
  }, []);

  const destroy = useCallback(() => {
    stopProgress();
    try { playerRef.current?.destroy(); } catch {}
    playerRef.current = null;
  }, [stopProgress]);

  return { load, play, pause, seekTo, setVolume, destroy };
}
