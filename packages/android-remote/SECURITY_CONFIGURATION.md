# Security Configuration Guide

This document describes the security features implemented in the Android Remote Control service and how to configure them for production deployment.

## Table of Contents

1. [Overview](#overview)
2. [TLS Certificate Validation](#tls-certificate-validation)
3. [Certificate Pinning](#certificate-pinning)
4. [Authentication](#authentication)
5. [Best Practices](#best-practices)

## Overview

The Android Remote Control service implements multiple layers of security:

- **TLS/SSL Encryption**: All WebSocket connections use WSS (WebSocket Secure) protocol
- **Certificate Validation**: Server certificates are validated against Android's system trust store
- **Certificate Pinning** (optional): Additional validation against known certificate pins
- **Token Authentication**: Device token and session ID validated on connection
- **Secure Headers**: Device credentials sent in request headers

## TLS Certificate Validation

### Default Behavior

By default, the WebSocketManager uses Android's built-in certificate validation:

```kotlin
// Default SSL context uses Android's system trust store
// No custom TrustManager needed - rely on system's certificate store
```

This provides automatic validation of:
- Certificate chain of trust
- Certificate expiration
- Certificate revocation (if CRL/OCSP is available)
- Hostname verification

### Certificate Information Logging

When a WSS connection is established, certificate information is logged:

```
I/WebSocketManager: TLS connection established with 3 certificate(s)
D/WebSocketManager: Certificate 0: Subject=CN=api.castmill.io, Issuer=CN=Let's Encrypt Authority X3
D/WebSocketManager: Certificate 1: Subject=CN=Let's Encrypt Authority X3, Issuer=CN=DST Root CA X3
D/WebSocketManager: Certificate 2: Subject=CN=DST Root CA X3, Issuer=CN=DST Root CA X3
```

## Certificate Pinning

Certificate pinning provides an additional layer of security by validating that the server's certificate matches a known set of pins. This prevents man-in-the-middle attacks even if a Certificate Authority is compromised.

### When to Use Certificate Pinning

Use certificate pinning when:
- Deploying to production environments
- Connecting to a controlled backend infrastructure
- Requiring maximum security for sensitive operations
- Compliance or regulatory requirements mandate it

**Note**: Certificate pinning requires maintenance - pins must be updated when certificates are rotated.

### Obtaining Certificate Pins

To get the SHA-256 pin for your server's certificate:

#### Method 1: Using OpenSSL
```bash
# Get the certificate
echo | openssl s_client -connect api.castmill.io:443 2>/dev/null | \
  openssl x509 -pubkey -noout | \
  openssl pkey -pubin -outform der | \
  openssl dgst -sha256 -binary | \
  base64
```

#### Method 2: Using OkHttp's CertificatePinner Tool
```bash
# Run this in a separate test to see what pins to use
curl -v https://api.castmill.io 2>&1 | grep "Server certificate"
```

#### Method 3: Programmatically (for testing)
```kotlin
val client = OkHttpClient()
val request = Request.Builder()
    .url("https://api.castmill.io")
    .build()

client.newCall(request).execute().use { response ->
    response.handshake?.peerCertificates?.forEach { cert ->
        if (cert is X509Certificate) {
            val pin = CertificatePinner.pin(cert)
            println("sha256/$pin")
        }
    }
}
```

### Configuring Certificate Pinning

Certificate pinning is configured in `RemoteControlService.kt`:

```kotlin
private fun connectWebSocket(sessionId: String, deviceToken: String) {
    val backendUrl = getString(R.string.backend_url)
    
    // Certificate pinning configuration
    val certificatePins = mapOf(
        "api.castmill.io" to listOf(
            "YLh1dUR9y6Kja30RrAn7JKnbQG/uEtLMkBgFF2Fuihg=",  // Example primary certificate pin (replace with actual)
            "AfMENBVvOS8MnISprtvyPsjKlPooqh8nMB/pvCrpJpw="   // Example backup certificate pin (replace with actual)
        )
    )
    
    webSocketManager = WebSocketManager(
        baseUrl = backendUrl,
        deviceId = deviceId!!,
        deviceToken = deviceToken,
        coroutineScope = lifecycleScope,
        diagnosticsManager = diagnosticsManager,
        certificatePins = certificatePins  // Enable pinning
    )
    
    webSocketManager?.connect(sessionId)
}
```

### Pin Format

Pins are SHA-256 hashes of the certificate's Subject Public Key Info (SPKI), encoded in base64.

Format: `"sha256/{base64-encoded-hash}"`

Example: `"sha256/YLh1dUR9y6Kja30RrAn7JKnbQG/uEtLMkBgFF2Fuihg="`

### Best Practices for Certificate Pinning

1. **Pin Multiple Certificates**
   - Pin both the current certificate and a backup
   - Prevents service disruption during certificate rotation

2. **Pin the CA Certificate**
   - Alternative to pinning leaf certificates
   - More maintainable but slightly less secure

3. **Update Schedule**
   - Monitor certificate expiration dates
   - Update pins before certificate rotation
   - Test new pins in staging before production

4. **Backup Pins**
   - Always have at least 2 pins configured
   - Include a backup certificate that can be activated quickly

5. **Monitoring**
   - Log pin validation failures
   - Monitor for pin mismatch errors
   - Set up alerts for pinning failures

### Pin Rotation Workflow

1. Generate new certificate and obtain its pin
2. Add new pin to the app configuration (keep old pin)
3. Deploy updated app
4. Wait for majority of devices to update
5. Rotate certificate on the server
6. Remove old pin in next app update

### Example Configuration

```kotlin
// Example: Pin both current and next certificate
val certificatePins = mapOf(
    "api.castmill.io" to listOf(
        "YLh1dUR9y6Kja30RrAn7JKnbQG/uEtLMkBgFF2Fuihg=",  // Current cert (expires 2025-01-15)
        "AfMENBVvOS8MnISprtvyPsjKlPooqh8nMB/pvCrpJpw="   // Next cert (will be active 2025-01-01)
    ),
    "backup.castmill.io" to listOf(
        "x9SZw6TwIqfmvrLZ4DxPy4L6a3lR1Hq5rPkEyc3SBN4="   // Backup server
    )
)
```

## Authentication

### Device Token

The device token is a secure authentication credential:

- Generated by the backend during device registration
- Stored securely in SharedPreferences
- Sent in the `X-Device-Token` header on WebSocket connect
- Validated by the backend on channel join

### Session ID

The session ID identifies a specific remote control session:

- Provided by the backend when initiating a remote session
- Sent in the join payload along with the device token
- Validated by the backend to ensure the session is authorized

### Authentication Flow

```
1. Device connects to WebSocket
   ├─ Sends X-Device-ID header
   ├─ Sends X-Device-Token header
   └─ Opens connection
   
2. Device joins channel (device_rc:{device_id})
   ├─ Sends token in payload
   ├─ Sends session_id in payload
   └─ Waits for phx_reply
   
3. Backend validates
   ├─ Checks device token is valid
   ├─ Checks session_id exists and is active
   ├─ Checks device_id matches session
   └─ Sends ok or error response
   
4. On success
   ├─ Set isAuthenticated = true
   ├─ Start diagnostics reporting
   └─ Begin accepting commands
   
5. On failure
   ├─ Disconnect immediately
   ├─ Do not retry automatically
   └─ Log authentication failure
```

### Authentication Code

```kotlin
private fun joinChannel() {
    val sid = sessionId ?: run {
        Log.e(TAG, "Cannot join channel: sessionId is null")
        return
    }

    joinRef = (++messageRef).toString()
    
    val payload = buildJsonObject {
        put("token", deviceToken)
        put("session_id", sid)
    }
    sendMessage("phx_join", payload)
}
```

## Best Practices

### General Security

1. **Use HTTPS/WSS in Production**
   ```xml
   <!-- res/values/strings.xml -->
   <string name="backend_url">https://api.castmill.io</string>
   
   <!-- res/values-debug/strings.xml -->
   <string name="backend_url">http://localhost:4000</string>
   ```

2. **Secure Token Storage**
   - Store device tokens in EncryptedSharedPreferences (Android API 23+)
   - Never log tokens in production builds
   - Clear tokens on app uninstall

3. **Network Security Config**
   Create `res/xml/network_security_config.xml`:
   ```xml
   <?xml version="1.0" encoding="utf-8"?>
   <network-security-config>
       <!-- Prevent cleartext traffic in production -->
       <base-config cleartextTrafficPermitted="false">
           <trust-anchors>
               <certificates src="system" />
           </trust-anchors>
       </base-config>
       
       <!-- Allow localhost for debugging -->
       <debug-overrides>
           <domain-config cleartextTrafficPermitted="true">
               <domain includeSubdomains="true">localhost</domain>
               <domain includeSubdomains="true">10.0.2.2</domain>
           </domain-config>
       </debug-overrides>
   </network-security-config>
   ```

4. **Update Dependencies**
   - Keep OkHttp updated for security patches
   - Monitor security advisories
   - Test updates in staging first

### Development vs Production

#### Development
- Certificate pinning: **Disabled**
- Cleartext traffic: **Allowed for localhost**
- Certificate logging: **Enabled**
- Token logging: **Enabled (careful with sensitive data)**

#### Production
- Certificate pinning: **Enabled with backup pins**
- Cleartext traffic: **Disabled**
- Certificate logging: **Minimal**
- Token logging: **Disabled**

### Troubleshooting

#### Certificate Pinning Failures

If you see errors like `CertificateException: Pin verification failed`:

1. Verify pins are correct:
   ```bash
   echo | openssl s_client -connect api.castmill.io:443 2>/dev/null | \
     openssl x509 -pubkey -noout | \
     openssl pkey -pubin -outform der | \
     openssl dgst -sha256 -binary | \
     base64
   ```

2. Check hostname matches:
   - Pin hostname must exactly match connection hostname
   - Include subdomains if needed: `"*.api.castmill.io"`

3. Verify certificate hasn't been rotated:
   - Check certificate expiration date
   - Confirm you're using current pins

#### Authentication Failures

If authentication fails:

1. Check device token is valid:
   - Verify token in backend database
   - Check token hasn't expired

2. Verify session ID:
   - Confirm session exists in backend
   - Check session hasn't expired
   - Ensure session is active

3. Check device ID:
   - Verify device ID matches backend records
   - Confirm Settings.Secure.ANDROID_ID is accessible

## Testing

### Testing Certificate Validation

```kotlin
@Test
fun testCertificateValidation() {
    val manager = WebSocketManager(
        baseUrl = "https://api.castmill.io",
        deviceId = "test-device",
        deviceToken = "test-token",
        coroutineScope = testScope
    )
    
    // Attempt connection and verify certificate logging
    manager.connect("test-session")
}
```

### Testing Certificate Pinning

```kotlin
@Test
fun testCertificatePinning() {
    val pins = mapOf(
        "api.castmill.io" to listOf(
            "YLh1dUR9y6Kja30RrAn7JKnbQG/uEtLMkBgFF2Fuihg="
        )
    )
    
    val manager = WebSocketManager(
        baseUrl = "https://api.castmill.io",
        deviceId = "test-device",
        deviceToken = "test-token",
        coroutineScope = testScope,
        certificatePins = pins
    )
    
    // Should succeed with correct pin
    manager.connect("test-session")
}
```

### Testing Authentication

```kotlin
@Test
fun testAuthenticationFlow() {
    val diagnostics = DiagnosticsManager()
    
    val manager = WebSocketManager(
        baseUrl = "https://api.castmill.io",
        deviceId = "test-device",
        deviceToken = "valid-token",
        coroutineScope = testScope,
        diagnosticsManager = diagnostics
    )
    
    manager.connect("valid-session")
    
    // Verify authentication tracking
    // isAuthenticated should be set on successful join
}
```

## References

- [OkHttp Certificate Pinning](https://square.github.io/okhttp/features/https/)
- [Android Network Security Configuration](https://developer.android.com/training/articles/security-config)
- [Android EncryptedSharedPreferences](https://developer.android.com/topic/security/data)
- [OWASP Mobile Security Guide](https://owasp.org/www-project-mobile-security/)
