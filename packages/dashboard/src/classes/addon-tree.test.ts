import { describe, it, expect } from 'vitest';
import { AddOnTree } from './addon-tree'; // Adjust the import path as necessary

// Mock AddOn data for testing
const otherProperties = {
  description: 'Test AddOn',
  version: '1.0.0',
  author: 'Test Author',
  license: 'MIT',
  path: '/path/to/addon',
  icon: 'icon.svg',
  component: 'ComponentName',
};

const addons = [
  { id: '1', name: 'RootLevel', mount_point: 'root', ...otherProperties },
  {
    id: '2',
    name: 'FirstChild',
    mount_point: 'root.first',
    ...otherProperties,
  },
  {
    id: '3',
    name: 'SecondChild',
    mount_point: 'root.second',
    ...otherProperties,
  },
  {
    id: '4',
    name: 'GrandChild',
    mount_point: 'root.first.grand',
    ...otherProperties,
  },
];

describe('AddOnTree', () => {
  it('initializes an empty tree if no addons are provided', () => {
    const tree = new AddOnTree([]);
    expect(tree.root.size).toBe(0);
  });

  it('correctly builds a tree from a list of addons', () => {
    const tree = new AddOnTree(addons);
    console.log(tree.root);

    expect(tree.root.size).toBe(1); // Only 'root' should be at the top level
    expect(tree.root.get('root')).toBeDefined();
    expect(tree.root.get('root')?.children?.size).toBe(2); // 'first' and 'second' under 'root'
  });

  it('correctly retrieves a subtree', () => {
    const tree = new AddOnTree(addons);
    const subTree = tree.getSubTree('root.first');
    expect(subTree).toBeDefined();
    expect(subTree?.children?.size).toBe(1); // Should only contain 'grand'
    expect(subTree?.children?.get('grand')).toBeDefined();
  });

  it('returns undefined for invalid paths', () => {
    const tree = new AddOnTree(addons);
    expect(tree.getSubTree('invalid')).toBeUndefined();
    expect(tree.getSubTree('root.invalid')).toBeUndefined();
    expect(tree.getSubTree('root.first.invalid')).toBeUndefined();
  });

  it('handles paths leading to leaf nodes correctly', () => {
    const tree = new AddOnTree(addons);
    const subTree = tree.getSubTree('root.first.grand');
    expect(subTree).toBeDefined();
    expect(subTree?.addon).toBeDefined();
    expect(subTree?.children).toBeUndefined(); // Leaf node shouldn't have children
  });

  it('ensures non-leaf nodes do not contain addon data directly', () => {
    const tree = new AddOnTree(addons);
    const nonLeafNode = tree.getSubTree('root');
    expect(nonLeafNode?.children?.size).toBeGreaterThan(0); // Should have children
    expect(nonLeafNode?.addon).toBeUndefined(); // Non-leaf node, thus no direct addon
  });

  it('treats dot-separated paths as nested paths', () => {
    const tree = new AddOnTree(addons);
    const nestedNode = tree.getSubTree('root.first');
    expect(nestedNode).toBeDefined();
    expect(nestedNode?.children?.get('grand')).toBeDefined();
  });
});
