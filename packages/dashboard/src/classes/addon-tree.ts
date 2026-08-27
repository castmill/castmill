import { AddOnNode } from '../interfaces/addon-node.interface';
import { AddOn } from '../interfaces/addon.interface';

export class AddOnTree {
  root: Map<string, AddOnNode>;

  constructor(addons: AddOn[]) {
    // Convert the AddOn array to a tree structure
    this.root = this.buildTree(addons);
  }

  getSubTree(path: string): AddOnNode | undefined {
    const mountPoint = path.split('.');
    let nodeChildren = this.root;
    for (let i = 0; i < mountPoint.length; i++) {
      const key = mountPoint[i];
      const node = nodeChildren.get(key);
      if (!node) {
        return;
      }
      if (i === mountPoint.length - 1) {
        return node;
      }
      nodeChildren = node.children!;
    }
  }

  private buildTree(addons: AddOn[]): Map<string, AddOnNode> {
    const root = new Map<string, AddOnNode>();

    for (let i = 0; i < addons.length; i++) {
      const addon = addons[i];
      const mountPoint = addon.mount_point.split('.');
      let nodeChildren = root;

      for (let j = 0; j < mountPoint.length; j++) {
        const key = mountPoint[j];
        if (nodeChildren.has(key)) {
          const node = nodeChildren.get(key);
          if (!node!.children) {
            node!.children = new Map<string, AddOnNode>();
          }
          nodeChildren = node!.children;
          continue;
        } else {
          const isLastKey = j === mountPoint.length - 1;
          const newNode = {
            children: !isLastKey ? new Map<string, AddOnNode>() : undefined,
            // Add the addon if we are at the last key
            addon: isLastKey ? addon : undefined,
          };
          nodeChildren.set(key, newNode);
          nodeChildren = newNode.children!;
        }
      }
    }
    return root;
  }
}
