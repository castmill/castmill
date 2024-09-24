package com.castmill.android.app;

import android.content.Intent;
import android.graphics.Bitmap;
import android.os.Bundle;
import android.util.Log;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "CastmillPlayer";
    private static final String CASTMILL_WATCHDOG_PACKAGE = "com.castmill.android.app.watchdog";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CastmillPlugin.class);
        super.onCreate(savedInstanceState);

        launchWatchdog();
        WatchdogHelper.enableWatchdog(this);
    }

    @Override
    public void onStart() {
        super.onStart();

        // disables the ugly default video tag poster image
        this.getBridge().getWebView().setWebChromeClient(new BridgeWebChromeClient(bridge) {
            @Override
            public Bitmap getDefaultVideoPoster() {
                return Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888);
            }
        });
    }

    private void launchWatchdog() {
        try {
            Intent launchIntent = this.getPackageManager().getLaunchIntentForPackage(CASTMILL_WATCHDOG_PACKAGE);
            if (launchIntent == null) {
                Log.d(TAG, "Couldn't create launch intent for Castmill Watchdog");
            } else {
                launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                this.startActivity(launchIntent);
            }
        } catch (Exception e) {
            Log.d(TAG, "Exception when trying to start Watchdog" + e.toString());
        }
    }
}
