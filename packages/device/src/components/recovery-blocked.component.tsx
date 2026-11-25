import styles from './recovery-blocked.module.scss';

export function RecoveryBlockedComponent() {
  return (
    <div class={styles.container}>
      <div class={styles.content} role="alert">
        <h1>Automatic recovery is blocked</h1>
        <p>
          This player has lost its stored credentials and needs to recover them.
          Automatic recovery is currently blocked for security reasons.
        </p>
        <p>
          Open the device in the Castmill dashboard, select the Maintenance tab,
          and enable Recover lost settings.
        </p>
        <p>
          See the documentation for more information:{' '}
          <a href="https://docs.castmill.io/docs/players/troubleshooting#the-screen-shows-automatic-recovery-is-blocked">
            docs.castmill.io
          </a>
        </p>
        <p class={styles.note}>This screen will refresh automatically.</p>
      </div>
    </div>
  );
}
