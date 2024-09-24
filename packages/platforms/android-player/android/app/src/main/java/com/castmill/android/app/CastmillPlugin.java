package com.castmill.android.app;

import android.content.Intent;
import android.util.Log;
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

        if(result)
            call.resolve();
        else
            Log.e(TAG, "restart failed");
            call.reject("Restart failed");
    }

    @PluginMethod()
    public void reboot(PluginCall call) {
        Log.d(TAG, "reboot");
        Toast.makeText(getContext(), "About to reboot", Toast.LENGTH_SHORT).show();

        boolean result = RecoveryTools.reboot();

        if(result)
            // not likely that we ever get here
            call.resolve();
        else
            Log.e(TAG, "reboot failed");
            call.reject("Restart failed");
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
    /*
    @PluginMethod()
    public void restart(PluginCall call) {
        String value = call.getString("value");

        JSObject ret = new JSObject();
        ret.put("value", value);
        call.resolve(ret);
    }
    */
}
