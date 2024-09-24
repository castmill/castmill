package com.castmill.android.app;

import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.util.Log;

public class WatchdogHelper {
    private static final String TAG = "WatchdogHelper";
    private static final Uri ENABLE_URI = Uri.parse("content://com.castmill.android.watchdog.provider/enable");
    private static final Uri DISABLE_URI = Uri.parse("content://com.castmill.android.watchdog.provider/disable");

    public static void enableWatchdog(Context context) {
        Log.d(TAG, "enableWatchdog");
        //TODO: uncomment when watchdog is available
        //ContentValues values = new ContentValues();
        //context.getContentResolver().insert(ENABLE_URI, values);
    }

    public static void disableWatchdog(Context context) {
        Log.d(TAG, "disableWatchdog");
        //TODO: uncomment when watchdog is available
        //ContentValues values = new ContentValues();
        //context.getContentResolver().insert(DISABLE_URI, values);
    }
}
