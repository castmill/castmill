package com.castmill.android.app.root;

import android.util.Log;

public class SuRoot {

  private static final String TAG = "SuRoot";

  // returns true if device is rooted
  public static boolean isRooted() {
    Log.d(TAG, "isRooted");
    return RootUtils.findBinary("su");
  }

  // returns true if app has root authorizations
  public static boolean hasRoot() {
    Log.d(TAG, "hasRoot");
    boolean root = false;

    if(isRooted()){
      String idResult = sudo("id");
      root = idResult != null && idResult.contains("uid=0");
    }

    Log.e(TAG, "hasRoot = "+root);
    return root;
  }

  public static void requestRoot() {
    Log.d(TAG, "requestRoot");
    if(isRooted()){
      hasRoot();
    }else{
      Log.e(TAG, "sorry, no root");
    }
  }

  public static String sudo(String...strings) {
    Log.d(TAG, "sudo");

    return RootUtils.exec("su", strings);
  }
}
