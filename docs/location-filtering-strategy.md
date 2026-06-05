# Location Filtering Strategy

## Problem

The Android tracker (`LocationService.kt`) currently forwards **every GPS fix** it receives to the API.
This produces two categories of waste:

| Issue | Cause |
|---|---|
| **Duplicate positions** | Device stationary — GPS keeps firing at the configured interval |
| **Low-accuracy fixes** | Poor satellite coverage (indoors, urban canyons) — large error radius |

Both inflate database size, slow down map rendering, and make the polyline noisy.

---

## Recommended Filters

Apply these in order inside `sendLocation()`, **before** building the payload or making the API call.

### 1. Accuracy gate (discard bad fixes)

Reject any fix whose reported horizontal accuracy exceeds the threshold.

```kotlin
const val MAX_ACCURACY_METERS = 30f

if (!location.hasAccuracy() || location.accuracy > MAX_ACCURACY_METERS) return
```

> The API's `PushLocationDto` already validates `accuracy` but this saves a round-trip entirely.

---

### 2. Distance threshold (discard stationary duplicates)

Only forward a fix when the device has moved at least `MIN_DISTANCE_METERS` from the **last successfully recorded point**.

```kotlin
const val MIN_DISTANCE_METERS = 15f

private var lastRecordedLocation: Location? = null

fun shouldRecord(newLoc: Location): Boolean {
    val last = lastRecordedLocation ?: return true          // always record first fix
    return newLoc.distanceTo(last) >= MIN_DISTANCE_METERS
}
```

Call `lastRecordedLocation = location` only after a **successful** API response so a failed push doesn't advance the baseline.

---

### 3. Heading-change override (preserve curves)

Even on a straight highway, only recording by distance produces correct tracks.
But on a tight curve at low speed the distance check alone may skip too many points.
Force a record whenever the heading changes significantly:

```kotlin
const val MIN_HEADING_DELTA_DEG = 10f

fun headingChanged(last: Location, new: Location): Boolean {
    if (!new.hasBearing() || !last.hasBearing()) return false
    val delta = Math.abs(new.bearing - last.bearing)
    return Math.min(delta, 360f - delta) >= MIN_HEADING_DELTA_DEG
}
```

---

### 4. Heartbeat (max silence interval)

Even when the device has not moved, record at least once every **5 minutes** so the dashboard
knows the tracker is still alive and hasn't lost connectivity.

```kotlin
const val MAX_SILENCE_MS = 5 * 60_000L

val elapsed = location.time - (lastRecordedLocation?.time ?: 0L)
val isHeartbeat = elapsed >= MAX_SILENCE_MS
```

---

### 5. Speed-adaptive polling interval (optional — reduces battery use)

Adjust the `LocationRequest` interval at runtime based on the current reported speed
so the service polls less aggressively when the device is slow or stationary.

```kotlin
fun adaptiveInterval(speedMs: Float): Long = when {
    speedMs > 20f -> 5_000L    // ~72 km/h — vehicle, sample every 5 s
    speedMs > 5f  -> 10_000L   // walking / cycling, every 10 s
    else          -> 30_000L   // near-stationary, every 30 s
}
```

Call `fusedClient.removeLocationUpdates(...)` + `requestLocationUpdates(...)` with the new
interval after each fix to keep it up to date.

---

## Combined Decision Function

```kotlin
private var lastRecordedLocation: Location? = null

private fun shouldRecord(location: Location): Boolean {
    // 1. Accuracy gate — drop poor fixes entirely
    if (!location.hasAccuracy() || location.accuracy > MAX_ACCURACY_METERS) return false

    val last = lastRecordedLocation

    // Always record the very first fix
    if (last == null) return true

    val distance = location.distanceTo(last)
    val elapsed  = location.time - last.time

    // 2. Heartbeat — record even when stationary so dashboard sees device is alive
    if (elapsed >= MAX_SILENCE_MS) return true

    // 3. Distance threshold — skip if device hasn't moved enough
    if (distance < MIN_DISTANCE_METERS) return false

    // 4. Heading override — keep extra points around curves
    if (headingChanged(last, location)) return true

    return true
}
```

In `sendLocation()`:

```kotlin
private fun sendLocation(location: Location) {
    if (!shouldRecord(location)) return          // ← add this line

    // ... build payload and push to API as before ...

    // On successful push:
    lastRecordedLocation = location
}
```

---

## Server-side Safety Net

`LocationsService.push()` can guard against duplicates that slip through (e.g. multiple device
instances, clock skew):

```ts
// apps/api/src/modules/locations/locations.service.ts
async push(deviceId: string, dto: PushLocationDto) {
  const latest = await this.findLatest(deviceId);
  if (latest) {
    const dist = haversineMeters(
      { lat: Number(latest.latitude), lng: Number(latest.longitude) },
      { lat: dto.latitude,            lng: dto.longitude            },
    );
    if (dist < 10) return latest; // silently ignore near-duplicate
  }
  // ... normal save path
}
```

---

## Configuration Summary

| Constant | Value | Where |
|---|---|---|
| `MAX_ACCURACY_METERS` | `30` | Android `LocationService.kt` |
| `MIN_DISTANCE_METERS` | `15` | Android `LocationService.kt` |
| `MIN_HEADING_DELTA_DEG` | `10` | Android `LocationService.kt` |
| `MAX_SILENCE_MS` | `300 000` (5 min) | Android `LocationService.kt` |
| Server dedup radius | `10 m` | API `locations.service.ts` |

---

## Current State

All five filters are **implemented** in `LocationService.kt`:

| # | Filter | Status |
|---|---|---|
| 1 | Accuracy gate | ✅ Implemented |
| 2 | Distance threshold | ✅ Implemented |
| 3 | Heading-change override | ✅ Implemented |
| 4 | Heartbeat (max silence) | ✅ Implemented |
| 5 | Speed-adaptive interval | ✅ Implemented |

The notification and status broadcast now also include a **skipped count** so the
app UI can show how many fixes were filtered out in the current session.

The API `PushLocationDto` validates `accuracy` but does no server-side dedup (the
`haversineMeters` guard described above is not yet implemented in `locations.service.ts`).
