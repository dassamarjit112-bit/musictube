package com.youtubemusic.app;

import android.content.Intent;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * BackgroundPlaybackPlugin
 *
 * Capacitor bridge that lets JavaScript start, stop, and update the
 * MusicPlayerService from the React/TypeScript layer.
 *
 * Usage (TypeScript):
 *   import { BackgroundPlayback } from './plugins/BackgroundPlayback';
 *   await BackgroundPlayback.startService({ title: 'Song', artist: 'Artist' });
 *   await BackgroundPlayback.stopService();
 */
@CapacitorPlugin(name = "BackgroundPlayback")
public class BackgroundPlaybackPlugin extends Plugin {

    // ── startService ──────────────────────────────────────────────────────────

    @PluginMethod
    public void startService(PluginCall call) {
        String title  = call.getString("title",  "MusicTube");
        String artist = call.getString("artist", "Playing…");

        Intent intent = new Intent(getContext(), MusicPlayerService.class);
        intent.putExtra(MusicPlayerService.EXTRA_TITLE,  title);
        intent.putExtra(MusicPlayerService.EXTRA_ARTIST, artist);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }

        call.resolve();
    }

    // ── updateMetadata ────────────────────────────────────────────────────────
    // Re-start the service with updated song info (this triggers onStartCommand
    // again which rebuilds the notification without stopping playback).

    @PluginMethod
    public void updateMetadata(PluginCall call) {
        startService(call); // reusing the same logic
    }

    // ── stopService ───────────────────────────────────────────────────────────

    @PluginMethod
    public void stopService(PluginCall call) {
        Intent intent = new Intent(getContext(), MusicPlayerService.class);
        getContext().stopService(intent);
        call.resolve();
    }
}
