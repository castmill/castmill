package com.castmill.android.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;

import com.castmill.android.app.root.AdbRoot;
import com.castmill.android.app.root.SuRoot;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.MockedStatic;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

@RunWith(RobolectricTestRunner.class)
@Config(manifest = Config.NONE)
public class RootToolsTest {

    // ── isRooted ──────────────────────────────────────────────────────────────

    @Test
    public void testIsRooted_returnsFalse_whenNeitherRooted() {
        try (MockedStatic<SuRoot> mockedSu = mockStatic(SuRoot.class);
             MockedStatic<AdbRoot> mockedAdb = mockStatic(AdbRoot.class)) {
            mockedSu.when(SuRoot::isRooted).thenReturn(false);
            mockedAdb.when(AdbRoot::isRooted).thenReturn(false);

            assertFalse(RootTools.isRooted());
        }
    }

    @Test
    public void testIsRooted_returnsTrue_whenSuRooted() {
        try (MockedStatic<SuRoot> mockedSu = mockStatic(SuRoot.class);
             MockedStatic<AdbRoot> mockedAdb = mockStatic(AdbRoot.class)) {
            mockedSu.when(SuRoot::isRooted).thenReturn(true);
            mockedAdb.when(AdbRoot::isRooted).thenReturn(false);

            assertTrue(RootTools.isRooted());
        }
    }

    @Test
    public void testIsRooted_returnsTrue_whenAdbRooted() {
        try (MockedStatic<SuRoot> mockedSu = mockStatic(SuRoot.class);
             MockedStatic<AdbRoot> mockedAdb = mockStatic(AdbRoot.class)) {
            mockedSu.when(SuRoot::isRooted).thenReturn(false);
            mockedAdb.when(AdbRoot::isRooted).thenReturn(true);

            assertTrue(RootTools.isRooted());
        }
    }

    // ── hasRoot ───────────────────────────────────────────────────────────────

    @Test
    public void testHasRoot_returnsTrue_whenSuHasRoot() {
        try (MockedStatic<SuRoot> mockedSu = mockStatic(SuRoot.class)) {
            mockedSu.when(SuRoot::hasRoot).thenReturn(true);

            assertTrue(RootTools.hasRoot());
        }
    }

    @Test
    public void testHasRoot_returnsFalse_whenSuHasNoRoot() {
        try (MockedStatic<SuRoot> mockedSu = mockStatic(SuRoot.class)) {
            mockedSu.when(SuRoot::hasRoot).thenReturn(false);

            assertFalse(RootTools.hasRoot());
        }
    }

    // ── requestRoot ──────────────────────────────────────────────────────────

    @Test
    public void testRequestRoot_callsSuRequestRoot_whenSuIsRooted() {
        try (MockedStatic<SuRoot> mockedSu = mockStatic(SuRoot.class)) {
            mockedSu.when(SuRoot::isRooted).thenReturn(true);

            RootTools.requestRoot();

            mockedSu.verify(SuRoot::requestRoot);
        }
    }

    @Test
    public void testRequestRoot_doesNotCallSuRequestRoot_whenSuIsNotRooted() {
        try (MockedStatic<SuRoot> mockedSu = mockStatic(SuRoot.class)) {
            mockedSu.when(SuRoot::isRooted).thenReturn(false);

            RootTools.requestRoot();

            mockedSu.verify(SuRoot::requestRoot, never());
        }
    }

    // ── execCmd ───────────────────────────────────────────────────────────────

    @Test
    public void testExecCmd_returnsSuResult_whenSuSucceeds() {
        try (MockedStatic<SuRoot> mockedSu = mockStatic(SuRoot.class);
             MockedStatic<AdbRoot> mockedAdb = mockStatic(AdbRoot.class)) {
            mockedSu.when(() -> SuRoot.sudo(anyString())).thenReturn("hello");

            String result = RootTools.execCmd("echo hello");

            assertEquals("hello", result);
        }
    }

    @Test
    public void testExecCmd_fallsBackToAdb_whenSuReturnsNull() {
        try (MockedStatic<SuRoot> mockedSu = mockStatic(SuRoot.class);
             MockedStatic<AdbRoot> mockedAdb = mockStatic(AdbRoot.class)) {
            mockedSu.when(() -> SuRoot.sudo(anyString())).thenReturn(null);
            mockedAdb.when(() -> AdbRoot.sudo(anyString())).thenReturn("hello");

            String result = RootTools.execCmd("echo hello");

            assertEquals("hello", result);
        }
    }

    @Test
    public void testExecCmd_returnsNull_whenBothFail() {
        try (MockedStatic<SuRoot> mockedSu = mockStatic(SuRoot.class);
             MockedStatic<AdbRoot> mockedAdb = mockStatic(AdbRoot.class)) {
            mockedSu.when(() -> SuRoot.sudo(anyString())).thenReturn(null);
            mockedAdb.when(() -> AdbRoot.sudo(anyString())).thenReturn(null);

            assertNull(RootTools.execCmd("some cmd"));
        }
    }

    // ── execCmdB ──────────────────────────────────────────────────────────────

    @Test
    public void testExecCmdB_returnsTrue_whenCmdSucceeds() {
        try (MockedStatic<SuRoot> mockedSu = mockStatic(SuRoot.class);
             MockedStatic<AdbRoot> mockedAdb = mockStatic(AdbRoot.class)) {
            mockedSu.when(() -> SuRoot.sudo(anyString())).thenReturn("result");

            assertTrue(RootTools.execCmdB("some cmd"));
        }
    }

    @Test
    public void testExecCmdB_returnsFalse_whenCmdFails() {
        try (MockedStatic<SuRoot> mockedSu = mockStatic(SuRoot.class);
             MockedStatic<AdbRoot> mockedAdb = mockStatic(AdbRoot.class)) {
            mockedSu.when(() -> SuRoot.sudo(anyString())).thenReturn(null);
            mockedAdb.when(() -> AdbRoot.sudo(anyString())).thenReturn(null);

            assertFalse(RootTools.execCmdB("some cmd"));
        }
    }

    // ── reboot ────────────────────────────────────────────────────────────────

    @Test
    public void testReboot_returnsTrue_whenCommandSucceeds() {
        try (MockedStatic<SuRoot> mockedSu = mockStatic(SuRoot.class);
             MockedStatic<AdbRoot> mockedAdb = mockStatic(AdbRoot.class)) {
            mockedSu.when(() -> SuRoot.sudo(anyString())).thenReturn("rebooting");

            assertTrue(RootTools.reboot());
        }
    }

    @Test
    public void testReboot_returnsFalse_whenCommandFails() {
        try (MockedStatic<SuRoot> mockedSu = mockStatic(SuRoot.class);
             MockedStatic<AdbRoot> mockedAdb = mockStatic(AdbRoot.class)) {
            mockedSu.when(() -> SuRoot.sudo(anyString())).thenReturn(null);
            mockedAdb.when(() -> AdbRoot.sudo(anyString())).thenReturn(null);

            assertFalse(RootTools.reboot());
        }
    }

    // ── restartApp ────────────────────────────────────────────────────────────

    @Test
    public void testRestartApp_returnsTrue_whenCommandSucceeds() {
        try (MockedStatic<SuRoot> mockedSu = mockStatic(SuRoot.class);
             MockedStatic<AdbRoot> mockedAdb = mockStatic(AdbRoot.class)) {
            mockedSu.when(() -> SuRoot.sudo(anyString())).thenReturn("result");

            assertTrue(RootTools.restartApp());
        }
    }

    @Test
    public void testRestartApp_returnsFalse_whenCommandFails() {
        try (MockedStatic<SuRoot> mockedSu = mockStatic(SuRoot.class);
             MockedStatic<AdbRoot> mockedAdb = mockStatic(AdbRoot.class)) {
            mockedSu.when(() -> SuRoot.sudo(anyString())).thenReturn(null);
            mockedAdb.when(() -> AdbRoot.sudo(anyString())).thenReturn(null);

            assertFalse(RootTools.restartApp());
        }
    }

    // ── clearDumps ────────────────────────────────────────────────────────────

    @Test
    public void testClearDumps_returnsTrue_whenCommandSucceeds() {
        try (MockedStatic<SuRoot> mockedSu = mockStatic(SuRoot.class);
             MockedStatic<AdbRoot> mockedAdb = mockStatic(AdbRoot.class)) {
            mockedSu.when(() -> SuRoot.sudo(anyString())).thenReturn("result");

            assertTrue(RootTools.clearDumps());
        }
    }

    @Test
    public void testClearDumps_returnsFalse_whenCommandFails() {
        try (MockedStatic<SuRoot> mockedSu = mockStatic(SuRoot.class);
             MockedStatic<AdbRoot> mockedAdb = mockStatic(AdbRoot.class)) {
            mockedSu.when(() -> SuRoot.sudo(anyString())).thenReturn(null);
            mockedAdb.when(() -> AdbRoot.sudo(anyString())).thenReturn(null);

            assertFalse(RootTools.clearDumps());
        }
    }

    // ── getLastModified ───────────────────────────────────────────────────────

    @Test
    public void testGetLastModified_returnsTimestamp_whenCommandSucceeds() {
        try (MockedStatic<SuRoot> mockedSu = mockStatic(SuRoot.class);
             MockedStatic<AdbRoot> mockedAdb = mockStatic(AdbRoot.class)) {
            mockedSu.when(() -> SuRoot.sudo(anyString())).thenReturn("1700000000");

            long result = RootTools.getLastModified("testfile.txt");

            assertEquals(1700000000L, result);
        }
    }

    @Test
    public void testGetLastModified_returnsZero_whenCommandFails() {
        try (MockedStatic<SuRoot> mockedSu = mockStatic(SuRoot.class);
             MockedStatic<AdbRoot> mockedAdb = mockStatic(AdbRoot.class)) {
            mockedSu.when(() -> SuRoot.sudo(anyString())).thenReturn(null);
            mockedAdb.when(() -> AdbRoot.sudo(anyString())).thenReturn(null);

            assertEquals(0L, RootTools.getLastModified("testfile.txt"));
        }
    }

    @Test
    public void testGetLastModified_returnsZero_whenCommandOutputIsNotANumber() {
        try (MockedStatic<SuRoot> mockedSu = mockStatic(SuRoot.class);
             MockedStatic<AdbRoot> mockedAdb = mockStatic(AdbRoot.class)) {
            mockedSu.when(() -> SuRoot.sudo(anyString())).thenReturn("not-a-number");

            assertEquals(0L, RootTools.getLastModified("testfile.txt"));
        }
    }

    // ── touchFile ─────────────────────────────────────────────────────────────

    @Test
    public void testTouchFile_returnsResult_whenCommandSucceeds() {
        try (MockedStatic<SuRoot> mockedSu = mockStatic(SuRoot.class);
             MockedStatic<AdbRoot> mockedAdb = mockStatic(AdbRoot.class)) {
            mockedSu.when(() -> SuRoot.sudo(anyString())).thenReturn("result");

            String result = RootTools.touchFile("myfile.txt");

            assertEquals("result", result);
        }
    }

    @Test
    public void testTouchFile_returnsNull_whenCommandFails() {
        try (MockedStatic<SuRoot> mockedSu = mockStatic(SuRoot.class);
             MockedStatic<AdbRoot> mockedAdb = mockStatic(AdbRoot.class)) {
            mockedSu.when(() -> SuRoot.sudo(anyString())).thenReturn(null);
            mockedAdb.when(() -> AdbRoot.sudo(anyString())).thenReturn(null);

            assertNull(RootTools.touchFile("myfile.txt"));
        }
    }

    // ── deleteFile ────────────────────────────────────────────────────────────

    @Test
    public void testDeleteFile_returnsResult_whenCommandSucceeds() {
        try (MockedStatic<SuRoot> mockedSu = mockStatic(SuRoot.class);
             MockedStatic<AdbRoot> mockedAdb = mockStatic(AdbRoot.class)) {
            mockedSu.when(() -> SuRoot.sudo(anyString())).thenReturn("removed");

            String result = RootTools.deleteFile("myfile.txt");

            assertEquals("removed", result);
        }
    }

    @Test
    public void testDeleteFile_returnsNull_whenCommandFails() {
        try (MockedStatic<SuRoot> mockedSu = mockStatic(SuRoot.class);
             MockedStatic<AdbRoot> mockedAdb = mockStatic(AdbRoot.class)) {
            mockedSu.when(() -> SuRoot.sudo(anyString())).thenReturn(null);
            mockedAdb.when(() -> AdbRoot.sudo(anyString())).thenReturn(null);

            assertNull(RootTools.deleteFile("myfile.txt"));
        }
    }
}
