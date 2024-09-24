package com.castmill.android.app.root;

import android.util.Log;
import java.io.*;
import java.lang.Exception;
import java.lang.Process;
import java.util.Arrays;

public class RootUtils {
  private static final String TAG = "RootUtils";

  public static boolean findBinary(String binaryName) {
    Log.d(TAG, "findBinary");
    boolean found = false;
    if (!found) {
      String[] places = {"/sbin/", "/system/bin/", "/system/xbin/", "/data/local/xbin/",
        "/data/local/bin/", "/system/sd/xbin/", "/system/bin/failsafe/", "/data/local/"};
      for (String where : places) {
        if ( new File( where + binaryName ).exists() ) {
          found = true;
          break;
        }
      }
    }
    return found;
  }

  public static String exec(String cmd, String... input){
    Log.d(TAG, "exec " + cmd + Arrays.toString(input));

    String result = null;
    Process process = null;

    try{
      process = Runtime.getRuntime().exec(cmd);
      DataOutputStream os = new DataOutputStream(process.getOutputStream());
      DataInputStream is = new DataInputStream(process.getInputStream());

      if(input.length > 0){
        for (String s : input) {
            os.writeBytes(s+"\n");
            os.flush();
        }
        os.writeBytes("exit\n");
        os.flush();
      }

      if(null != is){
        result = is.readLine();
        if(result == null) {
          result = "";
        }
      }
      process.waitFor();
    }catch(Exception e){
      Log.d(TAG, "exec failed");
      e.printStackTrace();
    } finally {
      if (process != null) {
        try{
          process.destroy();
        }catch(Exception e){
          Log.d(TAG, "couldn't destroy process");
        }
      }
    }

    Log.d(TAG, "exec result: " + result);
    return result; 
  }
}
