import { AddOn } from './addon.interface';

export interface AddOnNode {
  children?: Map<string, AddOnNode>;
  addon?: AddOn;
}
