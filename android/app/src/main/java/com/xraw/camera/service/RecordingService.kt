package com.xraw.camera.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.xraw.camera.R

/**
 * Recording Service
 * 
 * Foreground service that keeps the app alive during recording.
 * Shows a persistent notification with recording status.
 */
class RecordingService : Service() {
    
    companion object {
        const val CHANNEL_ID = "xraw_recording"
        const val NOTIFICATION_ID = 1001
        const val ACTION_START = "com.xraw.camera.START_RECORDING"
        const val ACTION_STOP = "com.xraw.camera.STOP_RECORDING"
        const val ACTION_UPDATE = "com.xraw.camera.UPDATE_RECORDING"
        
        const val EXTRA_FRAME_COUNT = "frameCount"
        const val EXTRA_DROPPED_FRAMES = "droppedFrames"
        const val EXTRA_FILE_SIZE = "fileSize"
    }
    
    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }
    
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                val notification = buildNotification("Recording...", 0, 0, 0L)
                startForeground(NOTIFICATION_ID, notification)
            }
            ACTION_STOP -> {
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
            ACTION_UPDATE -> {
                val frames = intent.getIntExtra(EXTRA_FRAME_COUNT, 0)
                val dropped = intent.getIntExtra(EXTRA_DROPPED_FRAMES, 0)
                val size = intent.getLongExtra(EXTRA_FILE_SIZE, 0L)
                val notification = buildNotification("Recording...", frames, dropped, size)
                
                val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                nm.notify(NOTIFICATION_ID, notification)
            }
        }
        
        return START_STICKY
    }
    
    override fun onBind(intent: Intent?): IBinder? = null
    
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "XRAW Recording",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Recording status notification"
                setShowBadge(false)
            }
            
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.createNotificationChannel(channel)
        }
    }
    
    private fun buildNotification(title: String, frames: Int, dropped: Int, fileSize: Long): Notification {
        val sizeStr = when {
            fileSize >= 1024 * 1024 * 1024 -> String.format("%.1f GB", fileSize / (1024.0 * 1024 * 1024))
            fileSize >= 1024 * 1024 -> String.format("%d MB", fileSize / (1024 * 1024))
            else -> String.format("%d KB", fileSize / 1024)
        }
        
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("XRAW Camera")
            .setContentText("$title | $frames frames | $sizeStr")
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .setOngoing(true)
            .setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }
    
    override fun onDestroy() {
        super.onDestroy()
        stopForeground(STOP_FOREGROUND_REMOVE)
    }
}
