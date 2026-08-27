import { Logger } from '../utils';

const logger = new Logger('Inbound');

// inbound interface
export const inbound = {
  command: function (cmd: string) {
    logger.log('command: ' + cmd);
    return Promise.resolve();
  },
  event: function (type: string, param: unknown): Promise<void> {
    return new Promise(function (resolve, reject) {
      logger.log('event ' + type + ' ' + param);
      switch (type) {
        case 'ready':
          resolve();
          break;
        case 'playing':
          resolve();
          break;
        case 'state':
          resolve();
          break;
        case 'progress':
          resolve();
          break;
        case 'console':
          // TODO: call setLogMode local on device instance
          // Maybe it should be an event.
          // device.setLogMode('local');
          resolve();
          break;
        default:
          reject();
      }
    });
  },
};
