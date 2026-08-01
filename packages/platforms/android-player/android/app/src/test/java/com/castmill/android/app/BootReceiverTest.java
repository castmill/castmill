package com.castmill.android.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;

import android.content.Context;
import android.content.Intent;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.Shadows;
import org.robolectric.annotation.Config;
import org.robolectric.shadows.ShadowApplication;

@RunWith(RobolectricTestRunner.class)
@Config(manifest = Config.NONE)
public class BootReceiverTest {

    @Test
    public void testOnReceive_bootCompleted_startsMainActivity() {
        Context context = RuntimeEnvironment.getApplication();
        BootReceiver receiver = new BootReceiver();
        Intent intent = new Intent(Intent.ACTION_BOOT_COMPLETED);

        receiver.onReceive(context, intent);

        ShadowApplication shadowApp = Shadows.shadowOf(RuntimeEnvironment.getApplication());
        Intent startedIntent = shadowApp.getNextStartedActivity();
        assertNotNull(startedIntent);
        assertNotNull(startedIntent.getComponent());
        assertEquals(
                MainActivity.class.getName(),
                startedIntent.getComponent().getClassName());
    }

    @Test
    public void testOnReceive_otherAction_doesNotStartActivity() {
        Context context = RuntimeEnvironment.getApplication();
        BootReceiver receiver = new BootReceiver();
        Intent intent = new Intent(Intent.ACTION_SCREEN_ON);

        receiver.onReceive(context, intent);

        ShadowApplication shadowApp = Shadows.shadowOf(RuntimeEnvironment.getApplication());
        Intent startedIntent = shadowApp.getNextStartedActivity();
        assertNull(startedIntent);
    }

    @Test
    public void testOnReceive_nullAction_doesNotStartActivity() {
        Context context = RuntimeEnvironment.getApplication();
        BootReceiver receiver = new BootReceiver();
        Intent intent = new Intent();

        receiver.onReceive(context, intent);

        ShadowApplication shadowApp = Shadows.shadowOf(RuntimeEnvironment.getApplication());
        Intent startedIntent = shadowApp.getNextStartedActivity();
        assertNull(startedIntent);
    }
}
