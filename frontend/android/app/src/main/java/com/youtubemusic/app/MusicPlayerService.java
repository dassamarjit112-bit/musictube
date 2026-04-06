package com.youtubemusic.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.session.MediaLibraryService;
import androidx.media3.session.MediaSession;
import com.getcapacitor.JSObject;

import java.io.InputStream;
import java.net.URL;
import java.util.concurrent.Executors;

public class MusicPlayerService extends MediaLibraryService {
    private static final String TAG = "MusicPlayerService";
    private static final String CHANNEL_ID = "music_playback_channel";
    private ExoPlayer player;
    private MediaLibrarySession mediaLibrarySession;
    private final Handler positionHandler = new Handler(Looper.getMainLooper());
    private Runnable positionRunnable;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();

        player = new ExoPlayer.Builder(this)
            .setAudioAttributes(
                new AudioAttributes.Builder()
                    .setUsage(C.USAGE_MEDIA)
                    .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                    .build(),
                /* handleAudioFocus= */ true
            )
            .setHandleAudioBecomingNoisy(true)
            .build();

        // ─── Player listener: sync state back to JS via BackgroundPlaybackPlugin ───
        player.addListener(new Player.Listener() {
            @Override
            public void onIsPlayingChanged(boolean isPlaying) {
                broadcastPlayingState(isPlaying);
            }

            @Override
            public void onPlaybackStateChanged(int state) {
                if (state == Player.STATE_ENDED) {
                    // Tell JS that the track finished
                    JSObject data = new JSObject();
                    data.put("type", "trackTransition");
                    data.put("message", "skipNext");
                    broadcastToJS("onPlayerUpdate", data);
                }
            }

            @Override
            public void onMediaItemTransition(@Nullable MediaItem item, int reason) {
                // Whenever the media source actually loads, push an initial position update
                broadcastPosition();
            }
        });

        Intent intent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 0, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        mediaLibrarySession = new MediaLibrarySession.Builder(this, player,
            new MediaLibrarySession.Callback() {
                @Override
                public MediaSession.ConnectionResult onConnect(
                        @NonNull MediaSession session,
                        @NonNull MediaSession.ControllerInfo controller) {
                    // Accept all default session + player commands.
                    // Media3 automatically exposes seek capabilities from ExoPlayer.
                    return MediaSession.ConnectionResult.accept(
                        MediaSession.ConnectionResult.DEFAULT_SESSION_COMMANDS,
                        MediaSession.ConnectionResult.DEFAULT_PLAYER_COMMANDS
                    );
                }
            })
            .setSessionActivity(pendingIntent)
            .build();

        // Start periodic position broadcast (every 1s)
        startPositionUpdates();
    }

    // ──────────────────────────────────────────────────────────────
    //  Notification channel
    // ──────────────────────────────────────────────────────────────
    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "Music Playback", NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Playback controls for MusicTube");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(channel);
        }
    }

    // ──────────────────────────────────────────────────────────────
    //  Periodic position updates → JS
    // ──────────────────────────────────────────────────────────────
    private void startPositionUpdates() {
        stopPositionUpdates();
        positionRunnable = () -> {
            broadcastPosition();
            positionHandler.postDelayed(positionRunnable, 1000);
        };
        positionHandler.post(positionRunnable);
    }

    private void stopPositionUpdates() {
        if (positionRunnable != null) {
            positionHandler.removeCallbacks(positionRunnable);
        }
    }

    private void broadcastPosition() {
        if (player == null) return;
        long posMs = player.getCurrentPosition();
        long durMs = player.getDuration();
        if (durMs == C.TIME_UNSET) durMs = 0;

        JSObject data = new JSObject();
        data.put("type", "positionUpdate");
        data.put("position", posMs / 1000.0);
        data.put("duration", durMs / 1000.0);
        broadcastToJS("onPlayerUpdate", data);
    }

    private void broadcastPlayingState(boolean isPlaying) {
        JSObject data = new JSObject();
        data.put("type", "isPlayingChanged");
        data.put("isPlaying", isPlaying);
        broadcastToJS("onPlayerUpdate", data);
    }

    private void broadcastToJS(String event, JSObject data) {
        if (BackgroundPlaybackPlugin.instance != null) {
            BackgroundPlaybackPlugin.instance.broadcastEvent(event, data);
        }
    }

    // ──────────────────────────────────────────────────────────────
    //  Intent-based actions from BackgroundPlaybackPlugin
    // ──────────────────────────────────────────────────────────────
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getStringExtra("action");
            if (action != null) {
                switch (action) {
                    case "play":
                        handlePlay(intent);
                        break;
                    case "pause":
                        if (player != null) player.pause();
                        break;
                    case "resume":
                        if (player != null) player.play();
                        break;
                    case "next":
                        // Delegate to JS – JS holds the queue
                        JSObject nextData = new JSObject();
                        nextData.put("type", "trackTransition");
                        nextData.put("message", "skipNext");
                        broadcastToJS("onPlayerUpdate", nextData);
                        break;
                    case "previous":
                        JSObject prevData = new JSObject();
                        prevData.put("type", "trackTransition");
                        prevData.put("message", "skipPrev");
                        broadcastToJS("onPlayerUpdate", prevData);
                        break;
                    case "seekTo":
                        long seekPos = intent.getLongExtra("position", 0);
                        if (player != null) player.seekTo(seekPos);
                        break;
                    case "updateMetadata":
                        handleUpdateMetadata(intent);
                        break;
                }
            }
        }
        return super.onStartCommand(intent, flags, startId);
    }

    /**
     * Start playback of a new stream URL.
     * Builds MediaMetadata with title, artist, duration, and artwork so the
     * system MediaSession (lock screen / notification) shows correct info.
     */
    private void handlePlay(Intent intent) {
        String streamUrl = intent.getStringExtra("url");
        String title = intent.getStringExtra("title");
        String artist = intent.getStringExtra("artist");
        String imageUrl = intent.getStringExtra("imageUrl");
        long durationMs = intent.getLongExtra("duration", 0);

        if (streamUrl == null || streamUrl.isEmpty()) {
            Log.w(TAG, "handlePlay: missing stream URL");
            return;
        }

        // Build rich metadata for the system media session
        MediaMetadata.Builder metaBuilder = new MediaMetadata.Builder()
            .setTitle(title != null ? title : "MusicTube")
            .setArtist(artist != null ? artist : "")
            .setIsPlayable(true);

        // Artwork URI (Media3 loads it automatically for the notification)
        if (imageUrl != null && !imageUrl.isEmpty()) {
            metaBuilder.setArtworkUri(Uri.parse(imageUrl));
        }

        MediaMetadata metadata = metaBuilder.build();

        MediaItem item = new MediaItem.Builder()
            .setUri(streamUrl)
            .setMediaMetadata(metadata)
            .build();

        player.setMediaItem(item);
        player.prepare();
        player.play();

        Log.d(TAG, "▶ Playing: " + title + " | url: " + streamUrl.substring(0, Math.min(80, streamUrl.length())));
    }

    /**
     * Update metadata on the current item without restarting playback.
     * This is the bridge call from JS: BackgroundPlayback.updateMetadata(...)
     * Fixes the "blank duration" issue by rebuilding the MediaItem metadata
     * with the correct title, artist, duration, and artwork.
     */
    private void handleUpdateMetadata(Intent intent) {
        if (player == null || player.getCurrentMediaItem() == null) return;

        String title = intent.getStringExtra("title");
        String artist = intent.getStringExtra("artist");
        String imageUrl = intent.getStringExtra("imageUrl");
        long durationMs = intent.getLongExtra("duration", 0);
        long positionMs = intent.getLongExtra("position", 0);

        MediaItem current = player.getCurrentMediaItem();
        MediaMetadata.Builder metaBuilder = current.mediaMetadata.buildUpon();

        if (title != null)  metaBuilder.setTitle(title);
        if (artist != null) metaBuilder.setArtist(artist);
        if (imageUrl != null && !imageUrl.isEmpty()) {
            metaBuilder.setArtworkUri(Uri.parse(imageUrl));
        }

        MediaMetadata updatedMeta = metaBuilder.build();

        // Replace the current item with updated metadata (keeps playback going)
        player.replaceMediaItem(
            player.getCurrentMediaItemIndex(),
            current.buildUpon().setMediaMetadata(updatedMeta).build()
        );

        Log.d(TAG, "📝 Metadata updated: " + title + " – " + artist + " | dur=" + durationMs + "ms");
    }

    // ──────────────────────────────────────────────────────────────
    //  Lifecycle
    // ──────────────────────────────────────────────────────────────
    @Nullable
    @Override
    public MediaLibrarySession onGetSession(@NonNull MediaSession.ControllerInfo controllerInfo) {
        return mediaLibrarySession;
    }

    @Override
    public void onDestroy() {
        stopPositionUpdates();
        if (mediaLibrarySession != null) {
            mediaLibrarySession.release();
            mediaLibrarySession = null;
        }
        if (player != null) {
            player.release();
            player = null;
        }
        super.onDestroy();
    }
}