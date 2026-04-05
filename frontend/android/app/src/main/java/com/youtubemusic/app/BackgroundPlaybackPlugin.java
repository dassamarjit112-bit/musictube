package com.youtubemusic.app;

import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import androidx.media3.common.Player;

@CapacitorPlugin(name = "BackgroundPlayback")
public class BackgroundPlaybackPlugin extends Plugin {

    public static BackgroundPlaybackPlugin instance;

    @Override
    public void load() {
        super.load();
        instance = this;
    }

    public void broadcastEvent(String eventName, JSObject data) {
        notifyListeners(eventName, data);
    }

    @PluginMethod
    public void startService(PluginCall call) {
        Intent intent = new Intent(getContext(), MusicPlayerService.class);
        getContext().startService(intent);
        call.resolve();
    }

    @PluginMethod
    public void playSong(PluginCall call) {
        Intent intent = new Intent(getContext(), MusicPlayerService.class);
        intent.putExtra("action", "play");
        intent.putExtra("title",  call.getString("title", "MusicTube"));
        intent.putExtra("artist", call.getString("artist", "Playing…"));
        intent.putExtra("url",    call.getString("url"));
        intent.putExtra("videoId", call.getString("videoId"));
        intent.putExtra("imageUrl", call.getString("imageUrl"));
        intent.putExtra("duration", (long)(call.getDouble("duration", 0.0) * 1000));
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
    public void next(PluginCall call) {
        Intent intent = new Intent(getContext(), MusicPlayerService.class);
        intent.putExtra("action", "next");
        getContext().startService(intent);
        call.resolve();
    }

    @PluginMethod
    public void updateMetadata(PluginCall call) {
        Intent intent = new Intent(getContext(), MusicPlayerService.class);
        intent.putExtra("action", "updateMetadata");
        intent.putExtra("title", call.getString("title"));
        intent.putExtra("artist", call.getString("artist"));
        intent.putExtra("duration", (long)(call.getDouble("duration", 0.0) * 1000));
        getContext().startService(intent);
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        instance = null;
        super.handleOnDestroy();
    }
}