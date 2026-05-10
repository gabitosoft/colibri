package com.colibri.tracker

import com.google.gson.annotations.SerializedName

data class LocationPayload(
    @SerializedName("latitude") val latitude: Double,
    @SerializedName("longitude") val longitude: Double,
    @SerializedName("altitude") val altitude: Double?,
    @SerializedName("speed") val speed: Double?,
    @SerializedName("heading") val heading: Double?,
    @SerializedName("accuracy") val accuracy: Double?,
    @SerializedName("recordedAt") val recordedAt: String,
)
