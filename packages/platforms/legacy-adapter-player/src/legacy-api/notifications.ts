export function sendHeartbeat(): void {
  parent.postMessage('alive', '*');
}

export function sendPlayerReady(): void {
  parent.postMessage('player_ready', '*');
}
