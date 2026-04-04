package com.youtubemusic.app;

import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import androidx.annotation.Nullable;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.DefaultLoadControl;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;
import com.bumptech.glide.Glide;
import java.io.ByteArrayOutputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * MusicPlayerService (Media3 Implementation)
 *
 * This service implements advanced streaming optimizations:
 * 1. WifiLock & WakeLock for persistent background streaming.
 * 2. Optimized LoadControl for heavy buffering (50s).
 * 3. Background Artwork loading using Glide.
 * 4. Comprehensive Error Handling.
 */
public class MusicPlayerService extends MediaSessionService {
    private static final String TAG = "MusicPlayerService";

    // Static reference for UI bridge
    private static ExoPlayer staticPlayer;
    public static ExoPlayer getStaticPlayer() {
        return staticPlayer;
    }

    private ExoPlayer player;
    private MediaSession mediaSession;
    private WifiManager.WifiLock wifiLock;
    private final ExecutorService artworkExecutor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    @Override
    public void onCreate() {
        super.onCreate();
        
        // 1. WifiLock: Ensure high-performance WiFi during background streaming
        WifiManager wifiManager = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
        if (wifiManager != null) {
            wifiLock = wifiManager.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "MusicPlayer:WifiLock");
        }
        
        initializePlayer();
        staticPlayer = player;
    }

    private void initializePlayer() {
        // 3. Load Control: Custom buffer strategy (hoards 50s of audio)
        DefaultLoadControl loadControl = new DefaultLoadControl.Builder()
            .setBufferDurationsMs(
                50000, // minBufferMs: "Hoard" enough music for transitions
                100000, // maxBufferMs
                2500,  // bufferForPlaybackMs
                5000   // bufferForPlaybackAfterRebufferMs
            )
            .build();

        AudioAttributes audioAttributes = new AudioAttributes.Builder()
            .setUsage(C.USAGE_MEDIA)
            .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
            .build();

        // 5. DataSource: Ensures high-compatibility for network streams & headers
        DefaultHttpDataSource.Factory httpDataSourceFactory = new DefaultHttpDataSource.Factory()
            .setUserAgent("MusicTube/1.0")
            .setAllowCrossProtocolRedirects(true);

        // Build ExoPlayer with optimizations
        player = new ExoPlayer.Builder(this)
            .setAudioAttributes(audioAttributes, true)
            .setHandleAudioBecomingNoisy(true)
            .setLoadControl(loadControl)
            .setMediaSourceFactory(new DefaultMediaSourceFactory(this).setDataSourceFactory(httpDataSourceFactory))
            .setWakeMode(C.WAKE_MODE_NETWORK) // 6. WakeMode: NETWORK keeps CPU + Radio alive
            .build();

        // 7. Robust Error Handling
        player.addListener(new Player.Listener() {
            @Override
            public void onPlayerError(PlaybackException error) {
                Log.e(TAG, "ExoPlayer Error [" + error.getErrorCodeName() + "]: " + error.getMessage(), error);
            }
        });

        // Initialize MediaSession
        mediaSession = new MediaSession.Builder(this, player).build();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && player != null) {
            String action = intent.getStringExtra("action");
            
            if ("play".equals(action)) {
                handlePlayAction(intent);
            } else if ("pause".equals(action)) {
                player.pause();
            } else if ("resume".equals(action)) {
                player.play();
            } else if ("stop".equals(action)) {
                player.stop();
            } else if ("seek".equals(action)) {
                long positionMs = intent.getLongExtra("position", 0);
                player.seekTo(positionMs);
            }
        }
        return super.onStartCommand(intent, flags, startId);
    }

    private void handlePlayAction(Intent intent) {
        String title  = intent.getStringExtra("title");
        String artist = intent.getStringExtra("artist");
        String url    = intent.getStringExtra("url");
        String imageUrl = intent.getStringExtra("imageUrl");

        if (url == null) return;

        // Acquire WifiLock as we are about to start a network stream
        if (wifiLock != null && !wifiLock.isHeld()) {
            wifiLock.acquire();
            Log.d(TAG, "WifiLock ACQUIRED");
        }

        // 4. Background Metadata & Artwork Loading
        // We load the artwork in a background thread to prevent competing with the audio stream
        artworkExecutor.execute(() -> {
            byte[] artworkData = null;
            if (imageUrl != null && !imageUrl.isEmpty()) {
                try {
                    Bitmap bitmap = Glide.with(this)
                        .asBitmap()
                        .load(imageUrl)
                        .submit(400, 400) // Optimal size for notification/metadata
                        .get();
                    
                    ByteArrayOutputStream stream = new ByteArrayOutputStream();
                    bitmap.compress(Bitmap.CompressFormat.JPEG, 80, stream);
                    artworkData = stream.toByteArray();
                } catch (Exception e) {
                    Log.e(TAG, "Failed to load artwork from " + imageUrl, e);
                }
            }

            final byte[] finalArtwork = artworkData;
            mainHandler.post(() -> {
                MediaMetadata metadata = new MediaMetadata.Builder()
                    .setTitle(title)
                    .setArtist(artist)
                    .setArtworkData(finalArtwork, MediaMetadata.PICTURE_TYPE_FRONT_COVER)
                    .setArtworkUri(imageUrl != null ? Uri.parse(imageUrl) : null)
                    .build();

                MediaItem item = new MediaItem.Builder()
                    .setUri(url)
                    .setMediaMetadata(metadata)
                    .build();

                player.setMediaItem(item);
                player.prepare();
                player.play();
            });
        });
    }

    @Nullable
    @Override
    public MediaSession onGetSession(MediaSession.ControllerInfo controllerInfo) {
        return mediaSession;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        if (player != null && !player.getPlayWhenReady()) {
            stopSelf();
        }
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        // Release locks
        if (wifiLock != null && wifiLock.isHeld()) {
            wifiLock.release();
            Log.d(TAG, "WifiLock RELEASED");
        }
        
        artworkExecutor.shutdown();
        
        if (mediaSession != null) {
            mediaSession.release();
            mediaSession = null;
        }
        if (player != null) {
            player.release();
            player = null;
        }
        super.onDestroy();
    }
}
