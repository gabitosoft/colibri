package com.colibri.tracker

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.location.Location
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.lifecycle.LifecycleService
import androidx.lifecycle.lifecycleScope
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.format.DateTimeFormatter

class LocationService : LifecycleService() {

    private lateinit var fusedClient: FusedLocationProviderClient
    private lateinit var prefs: Prefs
    private var api: LocationApi? = null

    private var successCount = 0
    private var errorCount = 0

    private val locationCallback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            result.lastLocation?.let { sendLocation(it) }
        }
    }

    override fun onCreate() {
        super.onCreate()
        prefs = Prefs(this)
        fusedClient = LocationServices.getFusedLocationProviderClient(this)
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)

        when (intent?.action) {
            ACTION_START -> startTracking()
            ACTION_STOP -> stopTracking()
        }

        return START_STICKY
    }

    private fun startTracking() {
        try {
            api = ApiClient.create(prefs.serverUrl)
        } catch (e: Exception) {
            Log.e(TAG, "Invalid server URL: ${prefs.serverUrl}", e)
            prefs.isTracking = false
            broadcastError("Invalid server URL. Please check the configuration.")
            stopSelf()
            return
        }

        startForeground(NOTIFICATION_ID, buildNotification("Tracking active", "Starting…"))

        val intervalMs = prefs.intervalSeconds * 1_000L
        val locationRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, intervalMs)
            .setMinUpdateIntervalMillis(intervalMs / 2)
            .setMaxUpdateDelayMillis(intervalMs * 2)
            .build()

        try {
            fusedClient.requestLocationUpdates(locationRequest, locationCallback, Looper.getMainLooper())
        } catch (e: SecurityException) {
            Log.e(TAG, "Location permission not granted", e)
            stopSelf()
        }
    }

    private fun stopTracking() {
        fusedClient.removeLocationUpdates(locationCallback)
        prefs.isTracking = false
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun sendLocation(location: Location) {
        val deviceKey = prefs.deviceKey
        if (deviceKey.isBlank()) return

        val payload = LocationPayload(
            latitude = location.latitude,
            longitude = location.longitude,
            altitude = if (location.hasAltitude()) location.altitude else null,
            speed = if (location.hasSpeed()) location.speed.toDouble() else null,
            heading = if (location.hasBearing()) location.bearing.toDouble() else null,
            accuracy = if (location.hasAccuracy()) location.accuracy.toDouble() else null,
            recordedAt = DateTimeFormatter.ISO_INSTANT.format(Instant.ofEpochMilli(location.time)),
        )

        lifecycleScope.launch {
            try {
                val response = api!!.pushLocation(deviceKey, payload)
                if (response.isSuccessful) {
                    successCount++
                    val coords = "%.5f, %.5f".format(location.latitude, location.longitude)
                    updateNotification("Tracking active", "Last: $coords · Sent: $successCount")
                    broadcastStatus(coords, successCount, errorCount)
                } else {
                    errorCount++
                    Log.w(TAG, "Push failed: ${response.code()}")
                    updateNotification("Tracking active — server error (${response.code()})", "Errors: $errorCount")
                    broadcastStatus(null, successCount, errorCount)
                }
            } catch (e: Exception) {
                errorCount++
                Log.e(TAG, "Push error", e)
                updateNotification("Tracking active — no connection", "Errors: $errorCount")
                broadcastStatus(null, successCount, errorCount)
            }
        }
    }

    private fun broadcastError(message: String) {
        val intent = Intent(ACTION_STATUS_UPDATE).apply {
            putExtra(EXTRA_ERROR_MESSAGE, message)
        }
        sendBroadcast(intent)
    }

    private fun broadcastStatus(lastCoords: String?, sent: Int, errors: Int) {
        val intent = Intent(ACTION_STATUS_UPDATE).apply {
            putExtra(EXTRA_LAST_COORDS, lastCoords)
            putExtra(EXTRA_SENT_COUNT, sent)
            putExtra(EXTRA_ERROR_COUNT, errors)
        }
        sendBroadcast(intent)
    }

    private fun buildNotification(title: String, text: String): Notification {
        val openIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentIntent(openIntent)
            .setOngoing(true)
            .setSilent(true)
            .build()
    }

    private fun updateNotification(title: String, text: String) {
        val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, buildNotification(title, text))
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "GPS Tracking",
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            description = "Ongoing GPS location tracking"
        }
        val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        manager.createNotificationChannel(channel)
    }

    companion object {
        private const val TAG = "LocationService"
        private const val CHANNEL_ID = "colibri_tracking"
        private const val NOTIFICATION_ID = 1001

        const val ACTION_START = "com.colibri.tracker.START"
        const val ACTION_STOP = "com.colibri.tracker.STOP"
        const val ACTION_STATUS_UPDATE = "com.colibri.tracker.STATUS_UPDATE"
        const val EXTRA_LAST_COORDS = "last_coords"
        const val EXTRA_SENT_COUNT = "sent_count"
        const val EXTRA_ERROR_COUNT = "error_count"
        const val EXTRA_ERROR_MESSAGE = "error_message"
    }
}
