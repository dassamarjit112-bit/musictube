package com.youtubemusic.app;

import android.content.Intent;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import androidx.media3.exoplayer.ExoPlayer;

/**
 * BackgroundPlaybackPlugin
 *
 * Capacitor bridge that lets JavaScript control the Native ExoPlayer
 * inside MusicPlayerService.
 */
@CapacitorPlugin(name = "BackgroundPlayback")
public class BackgroundPlaybackPlugin extends Plugin {

    @PluginMethod
    public void startService(PluginCall call) {
        // Legacy compat (just ensures service is running)
        Intent intent = new Intent(getContext(), MusicPlayerService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void playSong(PluginCall call) {
        String title  = call.getString("title",  "MusicTube");
        String artist = call.getString("artist", "Playing…");
        String url    = call.getString("url"); // Final stream URL
        String imageUrl = call.getString("imageUrl"); // Artwork URL

        if (url == null || url.isEmpty()) {
            call.reject("URL is required for native playback");
            return;
        }

        Intent intent = new Intent(getContext(), MusicPlayerService.class);
        intent.putExtra("action", "play");
        intent.putExtra("title",  title);
        intent.putExtra("artist", artist);
        intent.putExtra("url",    url);
        intent.putExtra("imageUrl", imageUrl);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }

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
    public void seekTo(PluginCall call) {
        Double position = call.getDouble("position"); // seconds
        if (position == null) {
            call.reject("Position is required");
            return;
        }
        Intent intent = new Intent(getContext(), MusicPlayerService.class);
        intent.putExtra("action", "seek");
        intent.putExtra("position", (long)(position * 1000)); // convert to ms
        getContext().startService(intent);
        call.resolve();
    }

    @PluginMethod
    public void getPlaybackState(PluginCall call) {
        ExoPlayer player = MusicPlayerService.getStaticPlayer();
        JSObject ret = new JSObject();
        
        if (player == null) {
            ret.put("isPlaying", false);
            ret.put("position", 0);
            ret.put("duration", 0);
        } else {
            ret.put("isPlaying", player.getPlayWhenReady());
            ret.put("position", (double)player.getCurrentPosition() / 1000.0);
            long duration = player.getDuration();
            if (duration < 0) {
                duration = 0;
            }
            ret.put("duration", (double)duration / 1000.0);
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void stopService(PluginCall call) {
        Intent intent = new Intent(getContext(), MusicPlayerService.class);
        getContext().stopService(intent);
        call.resolve();
    }

    @PluginMethod
    public void updateMetadata(PluginCall call) {
        // Media3 handles metadata automatically via the MediaItem, 
        // but it's good to have this for future specific updates.
        call.resolve();
    }
}
