package com.castmill.android.app;

import android.content.Intent;
import android.provider.Settings;
import android.util.Log;
import android.view.Window;
import android.view.WindowManager;
import android.widget.Toast;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "Castmill")
public class CastmillPlugin extends Plugin {
    private static final String TAG = "CastmillPlugin";

    @PluginMethod()
    public void restart(PluginCall call) {
        Log.d(TAG, "restart");
        Toast.makeText(getContext(), "About to restart", Toast.LENGTH_SHORT).show();

        boolean result = RecoveryTools.restart();

        if(result) {
            call.resolve();
        } else {
            Log.e(TAG, "restart failed");
            call.reject("Restart failed");
        }
    }

    @PluginMethod()
    public void reboot(PluginCall call) {
        Log.d(TAG, "reboot");
        Toast.makeText(getContext(), "About to reboot", Toast.LENGTH_SHORT).show();

        boolean result = RecoveryTools.reboot();

        if(result) {
            // not likely that we ever get here
            call.resolve();
        } else {
            Log.e(TAG, "reboot failed");
            call.reject("Reboot failed");
        }
    }
    private void stopWatchdogApp() {
        Log.d(TAG, "Stopping watchdog");
        WatchdogHelper.disableWatchdog(getContext());
    }

    @PluginMethod()
    public void quit(PluginCall call) {
        Log.d(TAG, "quit");
        Toast.makeText(getContext(), "About to quit", Toast.LENGTH_SHORT).show();

        stopWatchdogApp();
        //System.exit(0);

        getActivity().finishAffinity();

        call.resolve();
    }

    @PluginMethod()
    public void getBrightness(PluginCall call) {
        Window window = getActivity() != null ? getActivity().getWindow() : null;
        if (window == null) {
            call.reject("Unable to access activity window");
            return;
        }

        float currentBrightness = window.getAttributes().screenBrightness;
        int brightness;

        if (currentBrightness >= 0f) {
            brightness = Math.round(currentBrightness * 100f);
        } else {
            try {
                int systemBrightness = Settings.System.getInt(
                        getContext().getContentResolver(),
                        Settings.System.SCREEN_BRIGHTNESS
                );
                brightness = Math.round((systemBrightness / 255f) * 100f);
            } catch (Exception e) {
                brightness = 100;
            }
        }

        brightness = Math.max(0, Math.min(100, brightness));
        JSObject result = new JSObject();
        result.put("brightness", brightness);
        call.resolve(result);
    }

    @PluginMethod()
    public void setBrightness(PluginCall call) {
        Integer brightness = call.getInt("brightness");
        if (brightness == null) {
            call.reject("Missing brightness value");
            return;
        }

        if (brightness < 0 || brightness > 100) {
            call.reject("Brightness must be between 0 and 100");
            return;
        }

        Window window = getActivity() != null ? getActivity().getWindow() : null;
        if (window == null) {
            call.reject("Unable to access activity window");
            return;
        }

        float normalizedBrightness = brightness / 100f;
        getActivity().runOnUiThread(() -> {
            WindowManager.LayoutParams layoutParams = window.getAttributes();
            layoutParams.screenBrightness = normalizedBrightness;
            window.setAttributes(layoutParams);
            call.resolve();
        });
    }
}
