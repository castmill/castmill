package com.getcapacitor.myapp;

import static org.mockito.Mockito.*;

import android.content.Context;

import androidx.appcompat.app.AppCompatActivity;

import com.castmill.android.app.CastmillPlugin;
import com.castmill.android.app.RecoveryTools;
import com.getcapacitor.Bridge;
import com.getcapacitor.PluginCall;

import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.MockitoAnnotations;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

@RunWith(RobolectricTestRunner.class)
@Config(manifest=Config.NONE)
public class CastmillPluginTest {

    @Mock
    private PluginCall mockCall;

    @Mock
    private AppCompatActivity mockActivity;  // Updated to AppCompatActivity

    @Mock
    private Context mockContext;

    @Mock
    private Bridge mockBridge;  // Mock the Bridge

    private CastmillPlugin plugin;

    @Before
    public void setUp() {
        // Initialize mocks
        MockitoAnnotations.initMocks(this);

        // Initialize the plugin and mock context/activity
        plugin = spy(new CastmillPlugin());

        // Use doReturn to mock the getActivity method and return AppCompatActivity
        doReturn(mockActivity).when(plugin).getActivity();
        when(mockActivity.getApplicationContext()).thenReturn(mockContext);

        // Set the mocked bridge
        doReturn(mockContext).when(mockBridge).getContext();  // Mock getContext() on the bridge
        plugin.setBridge(mockBridge);  // Set the mocked bridge in the plugin
    }

    @Test
    public void testRestart_Success() {
        // Mock the static method RecoveryTools.restart() to return true
        try (MockedStatic<RecoveryTools> mockedRecoveryTools = mockStatic(RecoveryTools.class)) {
            mockedRecoveryTools.when(RecoveryTools::restart).thenReturn(true);

            plugin.restart(mockCall);

            verify(mockCall).resolve();
            verify(mockCall, never()).reject(anyString());
        }
    }

    @Test
    public void testRestart_Failure() {
        // Mock the static method RecoveryTools.restart() to return false
        try (MockedStatic<RecoveryTools> mockedRecoveryTools = mockStatic(RecoveryTools.class)) {
            mockedRecoveryTools.when(RecoveryTools::restart).thenReturn(false);

            plugin.restart(mockCall);

            verify(mockCall).reject("Restart failed");
            verify(mockCall, never()).resolve();
        }
    }

    @Test
    public void testReboot_Success() {
        // Mock the static method RecoveryTools.reboot() to return true
        try (MockedStatic<RecoveryTools> mockedRecoveryTools = mockStatic(RecoveryTools.class)) {
            mockedRecoveryTools.when(RecoveryTools::reboot).thenReturn(true);

            plugin.reboot(mockCall);

            verify(mockCall).resolve();
            verify(mockCall, never()).reject(anyString());
        }
    }

    @Test
    public void testReboot_Failure() {
        // Mock the static method RecoveryTools.reboot() to return false
        try (MockedStatic<RecoveryTools> mockedRecoveryTools = mockStatic(RecoveryTools.class)) {
            mockedRecoveryTools.when(RecoveryTools::reboot).thenReturn(false);

            plugin.reboot(mockCall);

            verify(mockCall).reject("Reboot failed");
            verify(mockCall, never()).resolve();
        }
    }

    @Test
    public void testQuit() {
        // Test quit method behavior
        plugin.quit(mockCall);

        verify(mockCall).resolve();
        verify(mockActivity).finishAffinity();  // Verify the app is closed properly
    }
}
