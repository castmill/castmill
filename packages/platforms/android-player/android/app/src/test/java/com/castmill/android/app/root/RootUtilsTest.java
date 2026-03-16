package com.castmill.android.app.root;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

@RunWith(RobolectricTestRunner.class)
@Config(manifest = Config.NONE)
public class RootUtilsTest {

    // ── findBinary ────────────────────────────────────────────────────────────

    @Test
    public void testFindBinary_returnsFalse_whenBinaryDoesNotExist() {
        // A binary with a name that will never exist in the Android-specific
        // paths (/sbin/, /system/bin/, etc.) checked by findBinary.
        assertFalse(RootUtils.findBinary("this_binary_definitely_does_not_exist_xyz123"));
    }

    // ── exec ──────────────────────────────────────────────────────────────────

    @Test
    public void testExec_returnsNull_whenCommandDoesNotExist() {
        // An invalid command causes an IOException which is caught, so null is
        // returned.
        String result = RootUtils.exec("this_command_does_not_exist_xyz123");
        assertNull(result);
    }
}
