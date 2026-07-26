/**
 * Template tree data model for the WYSIWYG Widget Editor.
 *
 * Provides an immutable-by-convention tree structure with unique IDs on every
 * node so that the component tree, property inspector, and preview can all
 * reference the same nodes without ambiguity.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type ComponentType =
  | 'group'
  | 'text'
  | 'image'
  | 'video'
  | 'paginated-list'
  | 'scroller'
  | 'image-carousel'
  | 'qr-code';

/** A node in the template tree. Every node has a unique `_id`. */
export interface TemplateNode {
  _id: string;
  type: ComponentType;
  name: string;
  opts: Record<string, any>;
  children?: TemplateNode[];
  /** Used by paginated-list: the per-item template */
  item_template?: TemplateNode;
  animations?: any[];
  filter?: Record<string, any>;
  /** Conditional style overrides */
  $styles?: { filter: Record<string, any>; style: Record<string, any> }[];
}

// ─── ID generation ──────────────────────────────────────────────────────────

let _counter = 0;

export function generateId(): string {
  return `node_${Date.now().toString(36)}_${(++_counter).toString(36)}`;
}

// ─── Default node factories ─────────────────────────────────────────────────

const DEFAULT_STYLE: Record<string, string> = {
  width: '100%',
  height: '100%',
};

export function createDefaultNode(type: ComponentType): TemplateNode {
  const base: TemplateNode = {
    _id: generateId(),
    type,
    name: type,
    opts: { style: { ...DEFAULT_STYLE } },
  };

  switch (type) {
    case 'group':
      return {
        ...base,
        opts: {
          style: {
            width: '100%',
            height: '100%',
            display: 'flex',
            'flex-direction': 'column',
            'align-items': 'center',
            'justify-content': 'center',
          },
        },
        children: [],
      };
    case 'text':
      return {
        ...base,
        opts: {
          text: 'Hello World',
          style: {
            color: '#ffffff',
            'font-size': '1.5em',
            'font-weight': '600',
            width: 'auto',
            height: 'auto',
          },
        },
      };
    case 'image':
      return {
        ...base,
        opts: {
          src: 'https://placehold.co/600x400/1a1a2e/ffffff?text=Image',
          style: {
            width: '100%',
            height: '100%',
            'object-fit': 'cover',
          },
        },
      };
    case 'video':
      return {
        ...base,
        opts: {
          src: '',
          style: {
            width: '100%',
            height: '100%',
            'object-fit': 'cover',
          },
        },
      };
    case 'paginated-list':
      return {
        ...base,
        opts: {
          data: { type: 'ctx', key: 'items' },
          page_size: 1,
          page_duration: 5,
          style: { width: '100%', height: '100%' },
        },
        item_template: createDefaultNode('group'),
      };
    case 'scroller':
      return {
        ...base,
        opts: {
          speed: 50,
          style: { width: '100%', height: '100%' },
        },
        children: [],
      };
    case 'image-carousel':
      return {
        ...base,
        opts: {
          images: [],
          duration: 5000,
          style: { width: '100%', height: '100%' },
        },
      };
    case 'qr-code':
      return {
        ...base,
        opts: {
          data: 'https://castmill.com',
          style: { width: '12em', height: '12em' },
        },
      };
  }
}

// ─── Tree operations (immutable) ────────────────────────────────────────────

/** Deep-clone a node and assign new IDs to every node in the tree. */
export function cloneNode(node: TemplateNode): TemplateNode {
  const clone: TemplateNode = {
    ...node,
    _id: generateId(),
    opts: JSON.parse(JSON.stringify(node.opts)),
    children: node.children?.map(cloneNode),
    item_template: node.item_template
      ? cloneNode(node.item_template)
      : undefined,
  };
  return clone;
}

/** Find a node by ID in the tree. */
export function findNode(root: TemplateNode, id: string): TemplateNode | null {
  if (root._id === id) return root;
  for (const child of root.children || []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  if (root.item_template) {
    const found = findNode(root.item_template, id);
    if (found) return found;
  }
  return null;
}

/** Find the parent of a node by its ID. Returns [parent, childIndex]. */
export function findParent(
  root: TemplateNode,
  id: string
): [TemplateNode, number] | null {
  if (root.children) {
    for (let i = 0; i < root.children.length; i++) {
      if (root.children[i]._id === id) return [root, i];
      const found = findParent(root.children[i], id);
      if (found) return found;
    }
  }
  if (root.item_template) {
    if (root.item_template._id === id) return [root, -1]; // -1 = item_template slot
    const found = findParent(root.item_template, id);
    if (found) return found;
  }
  return null;
}

/** Replace a node in the tree (by ID) with a new node. Returns new root. */
export function replaceNode(
  root: TemplateNode,
  id: string,
  replacement: TemplateNode
): TemplateNode {
  if (root._id === id) return replacement;
  return {
    ...root,
    children: root.children?.map((child) =>
      replaceNode(child, id, replacement)
    ),
    item_template: root.item_template
      ? replaceNode(root.item_template, id, replacement)
      : undefined,
  };
}

/** Remove a node from the tree by ID. Returns new root or null if root was removed. */
export function removeNode(
  root: TemplateNode,
  id: string
): TemplateNode | null {
  if (root._id === id) return null;
  return {
    ...root,
    children: root.children
      ?.filter((child) => child._id !== id)
      .map((child) => removeNode(child, id)!)
      .filter(Boolean),
    item_template:
      root.item_template?._id === id
        ? undefined
        : root.item_template
          ? (removeNode(root.item_template, id) ?? undefined)
          : undefined,
  };
}

/** Insert a node as a child of parentId at the given index. */
export function insertChild(
  root: TemplateNode,
  parentId: string,
  child: TemplateNode,
  index: number
): TemplateNode {
  if (root._id === parentId) {
    const children = [...(root.children || [])];
    children.splice(index, 0, child);
    return { ...root, children };
  }
  return {
    ...root,
    children: root.children?.map((c) => insertChild(c, parentId, child, index)),
    item_template: root.item_template
      ? insertChild(root.item_template, parentId, child, index)
      : undefined,
  };
}

/** Move a node from its current position to a new parent at a given index. */
export function moveNode(
  root: TemplateNode,
  nodeId: string,
  newParentId: string,
  index: number
): TemplateNode {
  const node = findNode(root, nodeId);
  if (!node) return root;
  let newRoot = removeNode(root, nodeId);
  if (!newRoot) return root;
  return insertChild(newRoot, newParentId, node, index);
}

// ─── Serialization ──────────────────────────────────────────────────────────

/** Convert a TemplateNode tree to a plain JSON object (strips _id). */
export function toJson(node: TemplateNode): Record<string, any> {
  const result: Record<string, any> = {
    type: node.type,
    name: node.name,
    opts: node.opts,
  };
  if (node.children && node.children.length > 0) {
    result.children = node.children.map(toJson);
  }
  if (node.item_template) {
    result.item_template = toJson(node.item_template);
  }
  if (node.animations && node.animations.length > 0) {
    result.animations = node.animations;
  }
  if (node.filter) {
    result.filter = node.filter;
  }
  if (node.$styles && node.$styles.length > 0) {
    result.$styles = node.$styles;
  }
  return result;
}

/** Parse a plain JSON template object into a TemplateNode tree (assigns _ids). */
export function fromJson(json: Record<string, any>): TemplateNode {
  return {
    _id: generateId(),
    type: json.type as ComponentType,
    name: json.name || json.type,
    opts: json.opts || {},
    children: (json.children || json.components)?.map(fromJson),
    item_template: json.item_template
      ? fromJson(json.item_template)
      : undefined,
    animations: json.animations,
    filter: json.filter || (json.opts?.filter ? json.opts.filter : undefined),
    $styles: json.$styles,
  };
}

/** Returns true if the node type can have children. */
export function canHaveChildren(type: ComponentType): boolean {
  return type === 'group' || type === 'scroller';
}

/** Returns the component type's display label. */
export function componentTypeLabel(type: ComponentType): string {
  const labels: Record<ComponentType, string> = {
    group: 'Group',
    text: 'Text',
    image: 'Image',
    video: 'Video',
    'paginated-list': 'Paginated List',
    scroller: 'Scroller',
    'image-carousel': 'Image Carousel',
    'qr-code': 'QR Code',
  };
  return labels[type] || type;
}

/** Returns a suitable icon name for each component type. */
export function componentTypeIcon(type: ComponentType): string {
  const icons: Record<ComponentType, string> = {
    group: '□',
    text: 'T',
    image: '🖼',
    video: '▶',
    'paginated-list': '☰',
    scroller: '↕',
    'image-carousel': '⊞',
    'qr-code': '⊟',
  };
  return icons[type] || '?';
}

// ─── All available component types ──────────────────────────────────────────

export const ALL_COMPONENT_TYPES: ComponentType[] = [
  'group',
  'text',
  'image',
  'video',
  'paginated-list',
  'scroller',
  'image-carousel',
  'qr-code',
];
