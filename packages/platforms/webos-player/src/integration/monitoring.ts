import { signage } from '../native';
const state: Record<string, SystemMonitorEvent['data']> = {};

// Event example:
// {
//   "source": "THERMOMETER",
//   "type": "CURRENT_TEMPERATURE",
//   "data": {
//     "temperature": 45
//   }
// }
// {
//   "source": "FAN",
//   "type": "FAN_STATUS",
//   "data": {
//     "status": "na"
//   }
// }
function eventHandler(event: SystemMonitorEvent) {
  state[event.type] = event.data;
}

export function startMonitoring() {
  return signage.registerSystemMonitor({
    monitorConfiguration: {
      fan: true,
      temperature: true,
    },
    eventHandler: eventHandler,
  });
}

export function stopMonitoring() {
  return signage.unregisterSystemMonitor();
}

export function getMonitorState() {
  return state;
}
