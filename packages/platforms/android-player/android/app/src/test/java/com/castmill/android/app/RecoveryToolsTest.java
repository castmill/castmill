package com.castmill.android.app;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.mockito.Mockito.mockStatic;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.MockedStatic;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

@RunWith(RobolectricTestRunner.class)
@Config(manifest = Config.NONE)
public class RecoveryToolsTest {

    @Test
    public void testRestart_returnsTrue_whenRestartAppSucceeds() {
        try (MockedStatic<RootTools> mockedRootTools = mockStatic(RootTools.class)) {
            mockedRootTools.when(RootTools::restartApp).thenReturn(true);

            boolean result = RecoveryTools.restart();

            assertTrue(result);
        }
    }

    @Test
    public void testRestart_returnsFalse_whenRestartAppFails() {
        try (MockedStatic<RootTools> mockedRootTools = mockStatic(RootTools.class)) {
            mockedRootTools.when(RootTools::restartApp).thenReturn(false);

            boolean result = RecoveryTools.restart();

            assertFalse(result);
        }
    }

    @Test
    public void testReboot_returnsTrue_whenRebootSucceeds() {
        try (MockedStatic<RootTools> mockedRootTools = mockStatic(RootTools.class)) {
            mockedRootTools.when(RootTools::reboot).thenReturn(true);

            boolean result = RecoveryTools.reboot();

            assertTrue(result);
        }
    }

    @Test
    public void testReboot_returnsFalse_whenRebootFails() {
        try (MockedStatic<RootTools> mockedRootTools = mockStatic(RootTools.class)) {
            mockedRootTools.when(RootTools::reboot).thenReturn(false);

            boolean result = RecoveryTools.reboot();

            assertFalse(result);
        }
    }
}
