package com.colibri.tracker

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.widget.ArrayAdapter
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.colibri.tracker.databinding.ActivityMainBinding
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanIntentResult
import com.journeyapps.barcodescanner.ScanOptions

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var prefs: Prefs

    private val intervals = listOf(5, 10, 15, 30, 60, 120, 300)
    private val intervalLabels = listOf("5 sec", "10 sec", "15 sec", "30 sec", "1 min", "2 min", "5 min")

    private val statusReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            val errorMessage = intent.getStringExtra(LocationService.EXTRA_ERROR_MESSAGE)
            if (errorMessage != null) {
                Toast.makeText(this@MainActivity, errorMessage, Toast.LENGTH_LONG).show()
                updateTrackingUI(false)
                return
            }
            val coords = intent.getStringExtra(LocationService.EXTRA_LAST_COORDS)
            val sent = intent.getIntExtra(LocationService.EXTRA_SENT_COUNT, 0)
            val errors = intent.getIntExtra(LocationService.EXTRA_ERROR_COUNT, 0)
            val skipped = intent.getIntExtra(LocationService.EXTRA_SKIPPED_COUNT, 0)
            updateStatusUI(coords, sent, errors, skipped)
        }
    }

    private val locationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val fine = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true
        val coarse = permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        if (fine || coarse) {
            requestBackgroundLocationIfNeeded()
        } else {
            showPermissionRationale()
        }
    }

    private val backgroundPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            startTracking()
        } else {
            Toast.makeText(this, "Background location needed to track while screen is off", Toast.LENGTH_LONG).show()
            startTracking() // still start, will work while app is foreground
        }
    }

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { requestLocationPermissions() }

    private val qrScanLauncher = registerForActivityResult(ScanContract()) { result: ScanIntentResult ->
        val text = result.contents
        if (!text.isNullOrBlank()) {
            binding.etDeviceKey.setText(text)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        prefs = Prefs(this)
        setupIntervalSpinner()
        restoreInputs()
        updateTrackingUI(prefs.isTracking)

        binding.btnToggle.setOnClickListener {
            if (prefs.isTracking) stopTracking() else checkPermissionsAndStart()
        }

        binding.btnScanQr.setOnClickListener {
            val options = ScanOptions()
                .setPrompt("Scan the device key QR code")
                .setBeepEnabled(false)
                .setOrientationLocked(false)
            qrScanLauncher.launch(options)
        }
    }

    override fun onResume() {
        super.onResume()
        val filter = IntentFilter(LocationService.ACTION_STATUS_UPDATE)
        registerReceiver(statusReceiver, filter, RECEIVER_NOT_EXPORTED)
    }

    override fun onPause() {
        super.onPause()
        saveInputs()
        unregisterReceiver(statusReceiver)
    }

    private fun setupIntervalSpinner() {
        val adapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, intervalLabels)
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        binding.spinnerInterval.adapter = adapter

        val savedInterval = prefs.intervalSeconds
        val index = intervals.indexOf(savedInterval).coerceAtLeast(0)
        binding.spinnerInterval.setSelection(index)
    }

    private fun restoreInputs() {
        binding.etServerUrl.setText(prefs.serverUrl)
        binding.etDeviceKey.setText(prefs.deviceKey)
    }

    private fun saveInputs() {
        prefs.serverUrl = binding.etServerUrl.text.toString().trim()
        prefs.deviceKey = binding.etDeviceKey.text.toString().trim()
        prefs.intervalSeconds = intervals[binding.spinnerInterval.selectedItemPosition]
    }

    private fun isValidUrl(url: String): Boolean {
        if (url.isBlank()) return false
        return try {
            val parsed = java.net.URL(url)
            parsed.protocol == "http" || parsed.protocol == "https"
        } catch (_: Exception) {
            false
        }
    }

    private fun checkPermissionsAndStart() {
        saveInputs()

        if (prefs.serverUrl.isBlank() || prefs.deviceKey.isBlank()) {
            Toast.makeText(this, "Enter the server URL and device key first", Toast.LENGTH_SHORT).show()
            return
        }

        if (!isValidUrl(prefs.serverUrl)) {
            Toast.makeText(
                this,
                "Invalid server URL. It must start with http:// or https://",
                Toast.LENGTH_LONG,
            ).show()
            binding.etServerUrl.requestFocus()
            return
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                return
            }
        }

        requestLocationPermissions()
    }

    private fun requestLocationPermissions() {
        val fine = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
        val coarse = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION)

        if (fine == PackageManager.PERMISSION_GRANTED || coarse == PackageManager.PERMISSION_GRANTED) {
            requestBackgroundLocationIfNeeded()
        } else {
            locationPermissionLauncher.launch(
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION,
                )
            )
        }
    }

    private fun requestBackgroundLocationIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val bg = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_BACKGROUND_LOCATION)
            if (bg != PackageManager.PERMISSION_GRANTED) {
                AlertDialog.Builder(this)
                    .setTitle("Background location")
                    .setMessage("To track while the screen is off, allow location access 'All the time' in the next screen.")
                    .setPositiveButton("Continue") { _, _ ->
                        backgroundPermissionLauncher.launch(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
                    }
                    .setNegativeButton("Skip") { _, _ -> startTracking() }
                    .show()
                return
            }
        }
        startTracking()
    }

    private fun startTracking() {
        prefs.isTracking = true
        updateTrackingUI(true)
        val intent = Intent(this, LocationService::class.java).apply {
            action = LocationService.ACTION_START
        }
        ContextCompat.startForegroundService(this, intent)
    }

    private fun stopTracking() {
        prefs.isTracking = false
        updateTrackingUI(false)
        val intent = Intent(this, LocationService::class.java).apply {
            action = LocationService.ACTION_STOP
        }
        startService(intent)
    }

    private fun updateTrackingUI(tracking: Boolean) {
        binding.btnToggle.text = if (tracking) "Stop tracking" else "Start tracking"
        binding.btnToggle.setBackgroundColor(
            ContextCompat.getColor(this, if (tracking) R.color.error else R.color.primary)
        )
        binding.etServerUrl.isEnabled = !tracking
        binding.etDeviceKey.isEnabled = !tracking
        binding.btnScanQr.isEnabled = !tracking
        binding.spinnerInterval.isEnabled = !tracking
        binding.tvStatus.text = if (tracking) "Tracking active" else "Not tracking"
        binding.tvLastCoords.text = if (!tracking) "—" else binding.tvLastCoords.text
    }

    private fun updateStatusUI(coords: String?, sent: Int, errors: Int, skipped: Int = 0) {
        binding.tvLastCoords.text = coords ?: "Error sending"
        binding.tvSentCount.text = "Sent: $sent  |  Skipped: $skipped  |  Errors: $errors"
    }

    private fun showPermissionRationale() {
        AlertDialog.Builder(this)
            .setTitle("Location permission required")
            .setMessage("This app needs location access to track the device. Please grant the permission in Settings.")
            .setPositiveButton("Open Settings") { _, _ ->
                startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                    data = Uri.fromParts("package", packageName, null)
                })
            }
            .setNegativeButton("Cancel", null)
            .show()
    }
}
