package com.youtubemusic.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

/**
 * MusicPlayerService
 *
 * A persistent Android foreground service that:
 * 1. Keeps the app process alive even after the user swipes it from recents
 * 2. Holds a CPU WakeLock so the device doesn't sleep mid-song
 * 3. Holds Android AudioFocus so no other app interrupts playback
 * 4. Shows a persistent notification that returns the user to the app
 * 5. Uses START_STICKY so Android auto-restarts it if killed by the OS
 */
public class MusicPlayerService extends Service {

    private static final String CHANNEL_ID       = "MusicTubePlayback";
    private static final String CHANNEL_NAME     = "MusicTube Background Playback";
    private static final int    NOTIFICATION_ID  = 7331;

    // Extras the JS layer can pass via BackgroundPlaybackPlugin
    public static final String EXTRA_TITLE  = "title";
    public static final String EXTRA_ARTIST = "artist";
    public static final String EXTRA_ACTION = "action";

    private PowerManager.WakeLock   wakeLock;
    private AudioManager            audioManager;
    private AudioFocusRequest       audioFocusRequest; // API 26+

    // ── Lifecycle ──────────────────────────────────────────────────────────────

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        acquireWakeLock();
        requestAudioFocus();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String title  = (intent != null) ? intent.getStringExtra(EXTRA_TITLE)  : null;
        String artist = (intent != null) ? intent.getStringExtra(EXTRA_ARTIST) : null;
        if (title  == null) title  = "MusicTube";
        if (artist == null) artist = "Music is playing…";

        startForeground(NOTIFICATION_ID, buildNotification(title, artist));

        // START_STICKY: if the OS kills this service, it will be restarted
        // automatically with the last Intent, keeping background playback alive.
        return START_STICKY;
    }

    /**
     * Called when the USER swipes the app card from the Recents screen.
     * We reschedule the service so it restarts itself, keeping audio alive.
     */
    @Override
    public void onTaskRemoved(Intent rootIntent) {
        Intent restartServiceIntent = new Intent(getApplicationContext(), MusicPlayerService.class);
        restartServiceIntent.setPackage(getPackageName());
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(restartServiceIntent);
        } else {
            startService(restartServiceIntent);
        }
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        releaseWakeLock();
        abandonAudioFocus();
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null; // Not a bound service
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private void acquireWakeLock() {
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "MusicTube::BackgroundPlaybackLock"
            );
            // Hold WakeLock for up to 4 hours (a very long album/playlist session)
            if (!wakeLock.isHeld()) {
                wakeLock.acquire(4 * 60 * 60 * 1000L);
            }
        }
    }

    private void releaseWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
    }

    private void requestAudioFocus() {
        audioManager = (AudioManager) getSystemService(AUDIO_SERVICE);
        if (audioManager == null) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            AudioAttributes attrs = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .build();
            audioFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                .setAudioAttributes(attrs)
                .setAcceptsDelayedFocusGain(true)
                .setOnAudioFocusChangeListener(change -> {
                    // Keep focus — do nothing on transient loss for robustness
                })
                .build();
            audioManager.requestAudioFocus(audioFocusRequest);
        } else {
            //noinspection deprecation
            audioManager.requestAudioFocus(
                null,
                AudioManager.STREAM_MUSIC,
                AudioManager.AUDIOFOCUS_GAIN
            );
        }
    }

    private void abandonAudioFocus() {
        if (audioManager == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && audioFocusRequest != null) {
            audioManager.abandonAudioFocusRequest(audioFocusRequest);
        } else {
            //noinspection deprecation
            audioManager.abandonAudioFocus(null);
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_LOW   // LOW = silent, no heads-up
            );
            channel.setDescription("Keeps music playing while the app is in the background");
            channel.setShowBadge(false);
            channel.setSound(null, null);  // Completely silent channel

            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }
    }

    private Notification buildNotification(String title, String artist) {
        // Tapping the notification re-opens the app
        Intent openAppIntent = new Intent(this, MainActivity.class);
        openAppIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT
            | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent openPendingIntent = PendingIntent.getActivity(this, 0, openAppIntent, piFlags);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(artist)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentIntent(openPendingIntent)
            .setOngoing(true)                              // Cannot be swiped away
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setSilent(true)
            .build();
    }
}
