import { execFile } from 'child_process';
import type { ExecFileAsync } from './types';

export const createExecFileAsync = (): ExecFileAsync => {
  return (file: string, args: string[]) =>
    new Promise((resolve, reject) => {
      execFile(file, args, (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(stdout.toString().trim());
      });
    });
};
