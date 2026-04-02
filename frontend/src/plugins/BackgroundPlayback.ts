/**
 * BackgroundPlayback Capacitor Plugin
 *
 * Bridges JavaScript to the native MusicPlayerService on Android.
 * On web/iOS (where the service doesn't exist), all calls are no-ops so the
 * app continues to work without crashing.
 */
import { registerPlugin } from '@capacitor/core';

export interface BackgroundPlaybackPlugin {
  /** Start the Android foreground service and update the notification. */
  startService(options: { title: string; artist: string }): Promise<void>;
  /** Update the notification text while the service is running. */
  updateMetadata(options: { title: string; artist: string }): Promise<void>;
  /** Stop the service (call when playback is fully stopped by user). */
  stopService(): Promise<void>;
}

// Web stub — all methods are no-ops when running outside Android
const WebImpl: BackgroundPlaybackPlugin = {
  startService:   async () => {},
  updateMetadata: async () => {},
  stopService:    async () => {},
};

export const BackgroundPlayback = registerPlugin<BackgroundPlaybackPlugin>(
  'BackgroundPlayback',
  { web: WebImpl }
);
