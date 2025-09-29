import styles from './pincode.module.scss';

export function PincodeComponent(props: { pincode: string }) {
  return (
    <div class={styles.pincodeSection}>
      <div class={styles.pincodeLabel}>Your Registration Code</div>
      <div class={styles.pincode}>{props.pincode ? props.pincode : 'Loading pincode...'}</div>
      <div class={styles.instructions}>
        Enter this code on the Castmill dashboard to register your device,
        or scan the QR code below with your mobile device.
      </div>
    </div>
  );
}
