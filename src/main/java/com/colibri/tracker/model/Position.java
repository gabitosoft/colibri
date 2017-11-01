package com.colibri.tracker.model;

import java.util.Date;

/**
 * Created by gabriel.delgado on 11/1/17.
 */
public class Position {
    private long latitude;
    private long longitude;
    private int deviceId;
    private Date dateRegistered;

    public Position(int deviceId, long latitude, long longitude) {
        this.deviceId = deviceId;
        this.latitude = latitude;
        this.longitude = longitude;
        this.dateRegistered = new Date();
    }

    public long getLatitude() {
        return latitude;
    }

    public void setLatitude(long latitude) {
        this.latitude = latitude;
    }

    public long getLongitude() {
        return longitude;
    }

    public void setLongitude(long longitude) {
        this.longitude = longitude;
    }

    public int getDeviceId() {
        return deviceId;
    }

    public void setDeviceId(int deviceId) {
        this.deviceId = deviceId;
    }

    public Date getDateRegistered() {
        return dateRegistered;
    }

    public void setDateRegistered(Date dateRegistered) {
        this.dateRegistered = dateRegistered;
    }
}
