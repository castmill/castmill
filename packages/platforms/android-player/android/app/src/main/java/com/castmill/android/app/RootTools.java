package com.castmill.android.app;

import java.lang.Exception;
import android.util.Log;
import java.io.*;
import com.castmill.android.app.root.SuRoot;
import com.castmill.android.app.root.AdbRoot;
import android.os.Environment;

public class RootTools {

    private static final String FILE_DIR = Environment.getExternalStorageDirectory().toString()+"/castmill";
    private static final String TAG = "RootTools";

    // returns true if device is rooted
    public static boolean isRooted() {
        return SuRoot.isRooted() || AdbRoot.isRooted();
    }

    // returns true if app has su root authorizations
    public static boolean hasRoot() {
        return SuRoot.hasRoot();
    }

    // request root access if required
    public static void requestRoot() {
        if (SuRoot.isRooted()) {
            SuRoot.requestRoot();
        }
    }

    public static String execCmd(String cmd) {
        String result = SuRoot.sudo(cmd);

        if(result == null) {
            result = AdbRoot.sudo(cmd);
        }

        if(result == null) {
            return null;
        }

        return result;
    }

    public static boolean execCmdB(String cmd) {
        String result = execCmd(cmd);

        if(result == null) {
            return false;
        } else {
            return true;
        }
    }

    public static boolean reboot(){
        return execCmdB("reboot");
    }

    public static boolean restartApp(){
        // this dosn't always (LOLLIPOP) work as expected. Sometimes the app is just
        // killed by this call. However Castmill Watchdog will reanimate it when it
        // detects that the app is dead.
        // Any alarm managers and broadcast receivers are killed with the app so we
        // can't use that either
        return execCmdB("am start -S -W -n com.castmill.app/.MainActivity");
    }

    // clear core dumps from /data/core
    public static boolean clearDumps(){
        return execCmdB("rm /data/core/*");
    }

    public static String touchFile(String name){
        String path = FILE_DIR+"/"+name;

        execCmd("mkdir -p "+FILE_DIR);
        return execCmd("touch "+path);
    }

    public static String deleteFile(String name){
        String path = FILE_DIR+"/"+name;

        return execCmd("rm "+path);
    }

    public static long getLastModified(String name){
        String path = FILE_DIR+"/"+name;

        String result = execCmd("date -r "+path+" \"+%s\"");

        try {
            return Long.parseLong(result, 10);
        } catch(Exception e) {
            return 0;
        }
    }
}
