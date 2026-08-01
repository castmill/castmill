package com.castmill.android.app;

import static org.junit.Assert.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.ArgumentCaptor;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

@RunWith(RobolectricTestRunner.class)
@Config(manifest = Config.NONE)
public class WatchdogHelperTest {

    @Test
    public void testEnableWatchdog_insertsToEnableUri() {
        Context mockContext = mock(Context.class);
        ContentResolver mockResolver = mock(ContentResolver.class);
        when(mockContext.getContentResolver()).thenReturn(mockResolver);

        WatchdogHelper.enableWatchdog(mockContext);

        ArgumentCaptor<Uri> uriCaptor = ArgumentCaptor.forClass(Uri.class);
        verify(mockResolver).insert(uriCaptor.capture(), any(ContentValues.class));
        assertEquals(
                "content://com.castmill.android.watchdog.provider/enable",
                uriCaptor.getValue().toString());
    }

    @Test
    public void testDisableWatchdog_insertsToDisableUri() {
        Context mockContext = mock(Context.class);
        ContentResolver mockResolver = mock(ContentResolver.class);
        when(mockContext.getContentResolver()).thenReturn(mockResolver);

        WatchdogHelper.disableWatchdog(mockContext);

        ArgumentCaptor<Uri> uriCaptor = ArgumentCaptor.forClass(Uri.class);
        verify(mockResolver).insert(uriCaptor.capture(), any(ContentValues.class));
        assertEquals(
                "content://com.castmill.android.watchdog.provider/disable",
                uriCaptor.getValue().toString());
    }

    @Test
    public void testEnableWatchdog_doesNotThrow_whenContentResolverThrows() {
        Context mockContext = mock(Context.class);
        ContentResolver mockResolver = mock(ContentResolver.class);
        when(mockContext.getContentResolver()).thenReturn(mockResolver);
        when(mockResolver.insert(any(), any())).thenThrow(new RuntimeException("Test exception"));

        // Should not throw
        WatchdogHelper.enableWatchdog(mockContext);
    }

    @Test
    public void testDisableWatchdog_doesNotThrow_whenContentResolverThrows() {
        Context mockContext = mock(Context.class);
        ContentResolver mockResolver = mock(ContentResolver.class);
        when(mockContext.getContentResolver()).thenReturn(mockResolver);
        when(mockResolver.insert(any(), any())).thenThrow(new RuntimeException("Test exception"));

        // Should not throw
        WatchdogHelper.disableWatchdog(mockContext);
    }
}
