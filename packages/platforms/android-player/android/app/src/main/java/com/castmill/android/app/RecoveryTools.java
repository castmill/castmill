package com.castmill.android.app;

import java.lang.System;

public class RecoveryTools {
    public static synchronized boolean restart(){
        //
        // Force GC to claim free memory
        //
        System.gc();

        return RootTools.restartApp();
    }

    public static synchronized boolean reboot(){
        return RootTools.reboot();
    }
}
