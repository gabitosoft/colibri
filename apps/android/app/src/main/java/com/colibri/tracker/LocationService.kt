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
import kotlin.math.abs
import kotlin.math.min

class LocationService : LifecycleService() {

    private lateinit var fusedClient: FusedLocationProviderClient
    private lateinit var prefs: Prefs
    private var api: LocationApi? = null

    private var successCount = 0
    private var errorCount = 0
    private var skippedCount = 0

    /** Last location that was successfully sent to the API. Used for all filter comparisons. */
    private var lastRecordedLocation: Location? = null

    private val locationCallback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            result.lastLocation?.let { onLocationReceived(it) }
        }
    }

    // -------------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------------

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
            ACTION_STOP  -> stopTracking()
        }
        return START_STICKY
    }

    // -------------------------------------------------------------------------
    // Tracking start / stop
    // -------------------------------------------------------------------------

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

        lastRecordedLocation = null
        skippedCount = 0

        startForeground(NOTIFICATION_ID, buildNotification("Tracking active", "Starting…"))

        // Use a fixed base interval from prefs; the adaptive logic will reschedule
        // the request after each fix if the speed has changed significantly.
        requestLocationUpdates(prefs.intervalSeconds * 1_000L)
    }

    private fun stopTracking() {
        fusedClient.removeLocationUpdates(locationCallback)
        prefs.isTracking = false
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun requestLocationUpdates(intervalMs: Long) {
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, intervalMs)
            .setMinUpdateIntervalMillis(intervalMs / 2)
            .setMaxUpdateDelayMillis(intervalMs * 2)
            .build()
        try {
            fusedClient.removeLocationUpdates(locationCallback)
            fusedClient.requestLocationUpdates(request, locationCallback, Looper.getMainLooper())
            Log.d(TAG, "Location updates requested at ${intervalMs}ms interval")
        } catch (e: SecurityException) {
            Log.e(TAG, "Location permission not granted", e)
            stopSelf()
        }
    }

    // -------------------------------------------------------------------------
    // Filtering
    // -------------------------------------------------------------------------

    /**
     * Entry point for every raw GPS fix.
     * Applies all filters before deciding whether to send the location to the API.
     */
    private fun onLocationReceived(location: Location) {
        // Speed-adaptive interval: reschedule if the bucket has changed
        maybeAdaptInterval(location)

        when (val reason = filterReason(location)) {
            null -> sendLocation(location)   // passed all gates — forward to API
            else -> {
                skippedCount++
                Log.d(TAG, "Skipped fix: $reason (total skipped: $skippedCount)")
            }
        }
    }

    /**
     * Returns a human-readable reason string if the fix should be dropped,
     * or null if it should be recorded.
     */
    private fun filterReason(location: Location): String? {
        // 1. Accuracy gate — discard poor satellite fixes
        if (!location.hasAccuracy() || location.accuracy > MAX_ACCURACY_METERS) {
            return "accuracy ${location.accuracy}m > ${MAX_ACCURACY_METERS}m"
        }

        val last = lastRecordedLocation
            ?: return null  // always record the very first fix

        val distanceM = location.distanceTo(last)
        val elapsedMs = location.time - last.time

        // 2. Heartbeat — always record after a long silence so the dashboard
        //    knows the device is still alive even when stationary
        if (elapsedMs >= MAX_SILENCE_MS) return null

        // 3. Distance threshold — skip if the device hasn't moved enough
        if (distanceM < MIN_DISTANCE_METERS) {
            return "distance ${distanceM.toInt()}m < ${MIN_DISTANCE_METERS}m"
        }

        // 4. Heading override — keep extra points around curves even when
        //    the distance threshold would otherwise pass
        if (headingChangedSignificantly(last, location)) return null

        return null  // passed all gates
    }

    /** True when the bearing has changed by at least MIN_HEADING_DELTA_DEG. */
    private fun headingChangedSignificantly(last: Location, new: Location): Boolean {
        if (!new.hasBearing() || !last.hasBearing()) return false
        val delta = abs(new.bearing - last.bearing)
        return min(delta, 360f - delta) >= MIN_HEADING_DELTA_DEG
    }

    /**
     * Reschedules the FusedLocationProvider request when the speed bucket changes,
     * so the service polls less aggressively when the device is slow or stationary.
     */
    private var currentIntervalMs: Long = 0L

    private fun maybeAdaptInterval(location: Location) {
        if (!location.hasSpeed()) return
        val newInterval = adaptiveIntervalMs(location.speed)
        if (newInterval != currentIntervalMs) {
            currentIntervalMs = newInterval
            requestLocationUpdates(newInterval)
        }
    }

    // -------------------------------------------------------------------------
    // API call
    // -------------------------------------------------------------------------

    private fun sendLocation(location: Location) {
        val deviceKey = prefs.deviceKey
        if (deviceKey.isBlank()) return

        val payload = LocationPayload(
            latitude  = location.latitude,
            longitude = location.longitude,
            altitude  = if (location.hasAltitude()) location.altitude else null,
            speed     = if (location.hasSpeed()) location.speed.toDouble() else null,
            heading   = if (location.hasBearing()) location.bearing.toDouble() else null,
            accuracy  = if (location.hasAccuracy()) location.accuracy.toDouble() else null,
            recordedAt = DateTimeFormatter.ISO_INSTANT.format(Instant.ofEpochMilli(location.time)),
        )

        lifecycleScope.launch {
            try {
                val response = api!!.pushLocation(deviceKey, payload)
                if (response.isSuccessful) {
                    // Advance the baseline only on a confirmed successful push
                    lastRecordedLocation = location
                    successCount++
                    val coords = "%.5f, %.5f".format(location.latitude, location.longitude)
                    updateNotification("Tracking active", "Last: $coords · Sent: $successCount · Skipped: $skippedCount")
                    broadcastStatus(coords, successCount, errorCount, skippedCount)
                } else {
                    errorCount++
                    Log.w(TAG, "Push failed: ${response.code()}")
                    updateNotification("Tracking active — server error (${response.code()})", "Errors: $errorCount")
                    broadcastStatus(null, successCount, errorCount, skippedCount)
                }
            } catch (e: Exception) {
                errorCount++
                Log.e(TAG, "Push error", e)
                updateNotification("Tracking active — no connection", "Errors: $errorCount")
                broadcastStatus(null, successCount, errorCount, skippedCount)
            }
        }
    }

    // -------------------------------------------------------------------------
    // Broadcasts
    // -------------------------------------------------------------------------

    private fun broadcastError(message: String) {
        sendBroadcast(Intent(ACTION_STATUS_UPDATE).apply {
            putExtra(EXTRA_ERROR_MESSAGE, message)
        })
    }

    private fun broadcastStatus(lastCoords: String?, sent: Int, errors: Int, skipped: Int) {
        sendBroadcast(Intent(ACTION_STATUS_UPDATE).apply {
            putExtra(EXTRA_LAST_COORDS, lastCoords)
            putExtra(EXTRA_SENT_COUNT, sent)
            putExtra(EXTRA_ERROR_COUNT, errors)
            putExtra(EXTRA_SKIPPED_COUNT, skipped)
        })
    }

    // -------------------------------------------------------------------------
    // Notification helpers
    // -------------------------------------------------------------------------

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
        ).apply { description = "Ongoing GPS location tracking" }
        (getSystemService(NOTIFICATION_SERVICE) as NotificationManager)
            .createNotificationChannel(channel)
    }

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    companion object {
        private const val TAG = "LocationService"
        private const val CHANNEL_ID    = "colibri_tracking"
        private const val NOTIFICATION_ID = 1001

        // --- Filtering thresholds (see docs/location-filtering-strategy.md) ---
        /** Fixes with accuracy worse than this are discarded. */
        private const val MAX_ACCURACY_METERS = 30f
        /** Minimum movement from the last recorded point to trigger a new record. */
        private const val MIN_DISTANCE_METERS = 15f
        /** Bearing change large enough to force a record regardless of distance. */
        private const val MIN_HEADING_DELTA_DEG = 10f
        /** Always record at least once per this interval to act as a heartbeat. */
        private const val MAX_SILENCE_MS = 5 * 60_000L  // 5 minutes

        // --- Speed-adaptive intervals ---
        private const val INTERVAL_FAST_MS   =  5_000L  // >72 km/h — vehicle
        private const val INTERVAL_MEDIUM_MS = 10_000L  // walking / cycling
        private const val INTERVAL_SLOW_MS   = 30_000L  // near-stationary

        /** Returns the polling interval appropriate for the current speed (m/s). */
        fun adaptiveIntervalMs(speedMs: Float): Long = when {
            speedMs > 20f -> INTERVAL_FAST_MS
            speedMs > 5f  -> INTERVAL_MEDIUM_MS
            else          -> INTERVAL_SLOW_MS
        }

        // --- Intent actions / extras ---
        const val ACTION_START        = "com.colibri.tracker.START"
        const val ACTION_STOP         = "com.colibri.tracker.STOP"
        const val ACTION_STATUS_UPDATE = "com.colibri.tracker.STATUS_UPDATE"
        const val EXTRA_LAST_COORDS   = "last_coords"
        const val EXTRA_SENT_COUNT    = "sent_count"
        const val EXTRA_ERROR_COUNT   = "error_count"
        const val EXTRA_SKIPPED_COUNT = "skipped_count"
        const val EXTRA_ERROR_MESSAGE = "error_message"
    }
}
