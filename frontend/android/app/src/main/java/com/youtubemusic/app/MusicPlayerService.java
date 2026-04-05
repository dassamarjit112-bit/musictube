package com.youtubemusic.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;
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

public class MusicPlayerService extends MediaLibraryService {
    private static final String CHANNEL_ID = "music_playback_channel";
    private ExoPlayer player;
    private MediaLibrarySession mediaLibrarySession;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        
        player = new ExoPlayer.Builder(this)
            .setAudioAttributes(new AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_MUSIC).build(), true)
            .setHandleAudioBecomingNoisy(true)
            .build();

        Intent intent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        mediaLibrarySession = new MediaLibrarySession.Builder(this, player, new MediaLibrarySession.Callback() {
            @Override
            public MediaSession.ConnectionResult onConnect(@NonNull MediaSession session, @NonNull MediaSession.ControllerInfo controller) {
                return MediaSession.ConnectionResult.accept(MediaSession.ConnectionResult.DEFAULT_SESSION_COMMANDS, MediaSession.ConnectionResult.DEFAULT_PLAYER_COMMANDS);
            }
        }).setSessionActivity(pendingIntent).build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Music Playback", NotificationManager.IMPORTANCE_LOW);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(channel);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getStringExtra("action");
            if ("play".equals(action)) {
                String streamUrl = intent.getStringExtra("url");
                String title = intent.getStringExtra("title");
                MediaMetadata metadata = new MediaMetadata.Builder().setTitle(title).build();
                MediaItem item = new MediaItem.Builder().setUri(streamUrl).setMediaMetadata(metadata).build();
                player.setMediaItem(item);
                player.prepare();
                player.play();
            } else if ("pause".equals(action)) {
                player.pause();
            } else if ("updateMetadata".equals(action)) {
                String title = intent.getStringExtra("title");
                String artist = intent.getStringExtra("artist");
                if (player.getCurrentMediaItem() != null) {
                    MediaMetadata newMetadata = player.getCurrentMediaItem().mediaMetadata.buildUpon()
                            .setTitle(title)
                            .setArtist(artist)
                            .build();
                    player.replaceMediaItem(player.getCurrentMediaItemIndex(), player.getCurrentMediaItem().buildUpon().setMediaMetadata(newMetadata).build());
                }
            }
        }
        return super.onStartCommand(intent, flags, startId);
    }

    @Nullable
    @Override
    public MediaLibrarySession onGetSession(@NonNull MediaSession.ControllerInfo controllerInfo) { return mediaLibrarySession; }

    @Override
    public void onDestroy() {
        if (mediaLibrarySession != null) { mediaLibrarySession.release(); mediaLibrarySession = null; }
        if (player != null) { player.release(); player = null; }
        super.onDestroy();
    }
}