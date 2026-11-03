package io.github.bridgemouse.bacta

// ACCESS_LOCAL_NETWORK only exists from Android 17 (API 37); on older releases LAN access is implicit,
// and requesting the unknown permission would be auto-denied and falsely block the app.
fun localNetworkPermissionRequired(sdkInt: Int): Boolean = sdkInt >= 37
