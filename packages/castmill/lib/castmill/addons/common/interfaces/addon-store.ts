import { Socket } from 'phoenix';
import { Env } from './env';

export interface AddonStore {
  organizations: { selectedId: string };
  socket: Socket;
  env: Env;
}
