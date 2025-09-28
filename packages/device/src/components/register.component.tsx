import { createSignal, onMount } from 'solid-js';
import * as QRCode from 'qrcode';
import { Device } from '../classes';
import styles from './register.module.css';
import logoSvg from '../assets/logo.svg';

export function RegisterComponent(props: { device: Device; pincode: string }) {
  const [qrCodeUrl, setQrCodeUrl] = createSignal<string>('');

  onMount(async () => {
    try {
      // Generate QR code for the registration URL
      // In a real implementation, this would be the actual registration URL
      const registrationUrl = `https://app.castmill.com/register/${props.pincode}`;
      const qrDataUrl = await QRCode.toDataURL(registrationUrl, {
        width: 200,
        margin: 1,
        color: {
          dark: '#1e3a8a',
          light: '#ffffff'
        }
      });
      setQrCodeUrl(qrDataUrl);
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  });

  return (
    <div class={styles.container}>
      <div class={styles.main}>
        <header class={styles.header}>
          <img src={logoSvg} alt="Castmill" class={styles.logo} />
          <h1 class={styles.title}>Register Your Device</h1>
          <p class={styles.subtitle}>Connect your device to the Castmill platform</p>
        </header>

        <div class={styles.content}>
          <div class={styles.pincodeSection}>
            <div class={styles.pincodeLabel}>Your Registration Code</div>
            <div class={styles.pincode}>{props.pincode}</div>
            <div class={styles.instructions}>
              Enter this code on the Castmill dashboard to register your device, 
              or scan the QR code below with your mobile device.
            </div>
          </div>

          {qrCodeUrl() && (
            <div class={styles.qrSection}>
              <div class={styles.qrLabel}>Scan to Register</div>
              <div class={styles.qrCode}>
                <img src={qrCodeUrl()} alt="QR Code for device registration" />
              </div>
            </div>
          )}
        </div>
      </div>

      <footer class={styles.footer}>
        <div>© 2024 Castmill. All rights reserved.</div>
        <div>Digital Signage Made Simple</div>
      </footer>
    </div>
  );
}
