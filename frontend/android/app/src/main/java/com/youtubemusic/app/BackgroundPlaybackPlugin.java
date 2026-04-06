package com.youtubemusic.app;

import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "BackgroundPlayback")
public class BackgroundPlaybackPlugin extends Plugin {

    public static BackgroundPlaybackPlugin instance;

    @Override
    public void load() {
        super.load();
        instance = this;
    }

    /** Called from MusicPlayerService to push events to JS (onPlayerUpdate) */
    public void broadcastEvent(String eventName, JSObject data) {
        notifyListeners(eventName, data);
    }

    // ─── Service lifecycle ────────────────────────────────────────

    @PluginMethod
    public void startService(PluginCall call) {
        Intent intent = new Intent(getContext(), MusicPlayerService.class);
        getContext().startService(intent);
        call.resolve();
    }

    @PluginMethod
    public void stopService(PluginCall call) {
        Intent intent = new Intent(getContext(), MusicPlayerService.class);
        getContext().stopService(intent);
        call.resolve();
    }

    // ─── Playback control ─────────────────────────────────────────

    @PluginMethod
    public void playSong(PluginCall call) {
        Intent intent = new Intent(getContext(), MusicPlayerService.class);
        intent.putExtra("action",   "play");
        intent.putExtra("title",    call.getString("title", "MusicTube"));
        intent.putExtra("artist",   call.getString("artist", ""));
        intent.putExtra("url",      call.getString("url"));
        intent.putExtra("imageUrl", call.getString("imageUrl"));
        intent.putExtra("duration", (long)(call.getDouble("duration", 0.0) * 1000)); // seconds → ms
        getContext().startService(intent);
        call.resolve();
    }

    @PluginMethod
    public void pause(PluginCall call) {
        Intent intent = new Intent(getContext(), MusicPlayerService.class);
        intent.putExtra("action", "pause");
        getContext().startService(intent);
        call.resolve();
    }

    @PluginMethod
    public void resume(PluginCall call) {
        Intent intent = new Intent(getContext(), MusicPlayerService.class);
        intent.putExtra("action", "resume");
        getContext().startService(intent);
        call.resolve();
    }

    @PluginMethod
    public void next(PluginCall call) {
        Intent intent = new Intent(getContext(), MusicPlayerService.class);
        intent.putExtra("action", "next");
        getContext().startService(intent);
        call.resolve();
    }

    @PluginMethod
    public void previous(PluginCall call) {
        Intent intent = new Intent(getContext(), MusicPlayerService.class);
        intent.putExtra("action", "previous");
        getContext().startService(intent);
        call.resolve();
    }

    @PluginMethod
    public void seekTo(PluginCall call) {
        Intent intent = new Intent(getContext(), MusicPlayerService.class);
        intent.putExtra("action", "seekTo");
        intent.putExtra("position", (long)(call.getDouble("position", 0.0) * 1000)); // seconds → ms
        getContext().startService(intent);
        call.resolve();
    }

    // ─── Metadata update (fixes blank duration / stale info) ──────

    @PluginMethod
    public void updateMetadata(PluginCall call) {
        Intent intent = new Intent(getContext(), MusicPlayerService.class);
        intent.putExtra("action",   "updateMetadata");
        intent.putExtra("title",    call.getString("title"));
        intent.putExtra("artist",   call.getString("artist"));
        intent.putExtra("imageUrl", call.getString("imageUrl"));
        intent.putExtra("duration", (long)(call.getDouble("duration", 0.0) * 1000)); // seconds → ms
        intent.putExtra("position", (long)(call.getDouble("position", 0.0) * 1000)); // seconds → ms
        getContext().startService(intent);
        call.resolve();
    }

    // ─── Playback state query ─────────────────────────────────────

    @PluginMethod
    public void getPlaybackState(PluginCall call) {
        // This is best-effort; the real position comes from periodic onPlayerUpdate events
        JSObject ret = new JSObject();
        ret.put("isPlaying", false);
        ret.put("position", 0);
        ret.put("duration", 0);
        call.resolve(ret);
    }

    // ─── Cleanup ──────────────────────────────────────────────────

    @Override
    protected void handleOnDestroy() {
        instance = null;
        super.handleOnDestroy();
    }
}