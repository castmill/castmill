package com.castmill.android.app.root;

import android.util.Log;

public class AdbRoot {

  private static final String TAG = "AdbRoot";

  private static boolean connectAdb() {
    Log.d(TAG, "connectAdb");

    String result = RootUtils.exec("adb connect localhost");
    boolean success = result != null && result.contains("connected");

    Log.e(TAG, "connectAdb result: "+success);
    return success;
  }

  private static String adbShell(String...strings) {
    Log.d(TAG, "adbShell");

    String result = RootUtils.exec("adb shell", strings);

    Log.d(TAG, "adbShell result: "+result);
    return result;
  }

  public static String sudo(String...cmds) {
    Log.d(TAG, "sudo");

    // first try to execute command through adb shell
    // this normally works if no other adb connection is or was present
    String result = adbShell(cmds);

    // check whether command failed due to missing device connection
    // this happens when an adb connection was present at an earlier point in time
    if (result != null && result.contains("device not found")) {
      Log.d(TAG, "command failed due to missing adb connection. Connecting...");

      // connect to adb
      connectAdb();

      // try again
      result = adbShell(cmds);
    }

    // check whether command failed due to "device offline"
    // this happens when more than one client tried to connect. We currently don't
    // have any way to recover from this other than manually restarting devices or
    // disabling and re-enabling debugging under developer options
    if (result != null && result.contains("device offline")) {
      Log.d(TAG, "command failed due to 'device offline'. Unrecoverable error.");
      return null;
    }

    return result;
  }

  public static boolean isRooted() {
    Log.d(TAG, "isRooted");
    return RootUtils.findBinary("adb");
  }
}
