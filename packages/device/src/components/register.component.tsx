import { createSignal, onMount } from 'solid-js';
import * as QRCode from 'qrcode';
import { Device } from '../classes';
import { PincodeComponent } from './pincode.component';
import styles from './register.module.scss';
import castmillLogo from '../assets/castmill-logo.png';

export function RegisterComponent(props: { device: Device; pincode: string }) {
  const [qrCodeUrl, setQrCodeUrl] = createSignal<string>('');
  const [windowWidth, setWindowWidth] = createSignal(window.innerWidth);

  onMount(async () => {
    // Update window width on resize to make QR code responsive
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    
    try {
      // Generate QR code for the registration URL with responsive sizing
      const registrationUrl = `https://app.castmill.com/register/${props.pincode}`;
      
      // Make QR code size responsive to screen dimensions
      const getQrSize = () => {
        if (windowWidth() < 480) return 150;
        if (windowWidth() < 768) return 180;
        return 200;
      };

      const qrDataUrl = await QRCode.toDataURL(registrationUrl, {
        width: getQrSize(),
        margin: 1,
        color: {
          dark: '#315aa9', // Using Castmill brand color
          light: '#ffffff'
        }
      });
      setQrCodeUrl(qrDataUrl);
    } catch (error) {
      console.error('Error generating QR code:', error);
    }

    // Cleanup event listener on unmount
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  });

  return (
    <div class={styles.container}>
      <div class={styles.main}>
        <header class={styles.header}>
          <img src={castmillLogo} alt="Castmill" class={styles.logo} />
          <h1 class={styles.title}>Register Your Device</h1>
          <p class={styles.subtitle}>Connect your device to the Castmill platform</p>
        </header>

        <div class={styles.content}>
          <PincodeComponent pincode={props.pincode} />

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
