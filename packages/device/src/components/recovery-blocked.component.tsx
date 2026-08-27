import styles from './recovery-blocked.module.scss';

export function RecoveryBlockedComponent() {
  return (
    <div class={styles.container}>
      <div class={styles.content}>
        <h1>Automatic recovery is blocked</h1>
        <p>
          The player could not be automatically recovered for security reasons.
        </p>
        <p>
          Open the device in the Castmill dashboard and activate recovery under
          the Maintenance tab.
        </p>
        <p class={styles.note}>This screen will refresh automatically.</p>
      </div>
    </div>
  );
}
